-- ════════════════════════════════════════════════════════════════════════════
-- Log In With Twitch
--
-- Supabase Auth's built-in Twitch provider does the login itself. This file
-- makes the GAME side follow it:
--   1. a Twitch login that creates a new auth user also creates its `players`
--      row, named after the Twitch account;
--   2. linking or logging in with Twitch fills `players.twitch_id` /
--      `twitch_username` from the identity Twitch verified — which is what the
--      chat-rewards worker keys on, so chat PP starts working with no extra step;
--   3. the browser can no longer write those two columns itself;
--   4. every account already linked the old way gets a Twitch identity, so
--      "Log In With Twitch" signs its owner into THAT account, whatever email
--      it was registered with.
--
-- Safe to re-run: every object is create-or-replace / drop-if-exists, and the
-- backfill skips identities that already exist.
--
-- RUN THESE CHECKS FIRST (read-only) and send me anything surprising:
--
--   -- (a) Any trigger already creating players rows from auth.users? If one
--   --     exists, step 2 below may race it — tell me its name.
--   select tgname from pg_trigger
--    where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
--   -- (b) Twitch ids linked to MORE THAN ONE account. These are skipped by the
--   --     backfill (an identity can belong to one user only); the first Twitch
--   --     login for such an id creates/uses whichever account Supabase picks and
--   --     unlinks the others. Decide which account should keep it first.
--   select twitch_id, array_agg(username) as accounts
--     from public.players where twitch_id is not null
--    group by twitch_id having count(*) > 1;
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Lock the Twitch columns against direct writes from the browser ────────
-- Until now `twitch_id` was set by a plain client-side UPDATE, so a player could
-- put ANY Twitch id on their account and collect that viewer's chat rewards.
-- From here on only the identity trigger below (running as its owner) and the
-- service role may change it. `twitch_token` stays client-writable: it is the
-- player's own Twitch token, used for follow checks, and grants nothing here.
--
-- `current_user` is 'authenticated'/'anon' for PostgREST requests and the
-- function owner inside the SECURITY DEFINER trigger, which is how the two are
-- told apart.
create or replace function public.guard_player_twitch_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.twitch_id := null;
      new.twitch_username := null;
    elsif new.twitch_id is distinct from old.twitch_id
       or new.twitch_username is distinct from old.twitch_username then
      raise exception 'Twitch is linked through Log In With Twitch, not set directly'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_player_twitch_columns on public.players;
create trigger guard_player_twitch_columns
  before insert or update on public.players
  for each row execute function public.guard_player_twitch_columns();


-- ── 2. Keep players in step with the Twitch identity ─────────────────────────
-- Fires when Supabase creates a Twitch identity (new Twitch login, or an
-- existing player linking Twitch), refreshes it (every Twitch login updates
-- identity_data), or deletes it (unlinking).
--
-- `v_tid` is declared with the column's own type so this works whether
-- `players.twitch_id` is text or numeric — Twitch ids arrive as text.
create or replace function public.sync_twitch_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid      public.players.twitch_id%type;
  v_login    text;
  v_display  text;
  v_base     text;
  v_name     text;
  n          int := 1;
begin
  if tg_op = 'DELETE' then
    if old.provider = 'twitch' then
      update public.players
         set twitch_id = null, twitch_username = null, twitch_token = null
       where id = old.user_id;
    end if;
    return old;
  end if;

  if new.provider <> 'twitch' then
    return new;
  end if;

  v_tid     := new.provider_id;
  -- Supabase's Twitch provider has stored the login under different claim
  -- names across versions; take the first that is present.
  v_login   := coalesce(new.identity_data->>'name',
                        new.identity_data->>'user_name',
                        new.identity_data->>'preferred_username',
                        new.identity_data->>'nickname');
  v_display := coalesce(new.identity_data->>'nickname',
                        new.identity_data->>'full_name',
                        v_login);

  -- A verified identity wins over an old, unverified client-side link of the
  -- same Twitch account on some other player.
  update public.players
     set twitch_id = null, twitch_username = null, twitch_token = null
   where twitch_id = v_tid and id <> new.user_id;

  if exists (select 1 from public.players where id = new.user_id) then
    update public.players
       set twitch_id = v_tid,
           twitch_username = coalesce(v_login, twitch_username)
     where id = new.user_id;
  else
    -- Brand-new Twitch account: name it after the Twitch display name, adding
    -- _2, _3 … on a clash. Usernames are compared case-insensitively, as the
    -- site's own rename check does (ProfileService: ilike). 26 chars leaves room
    -- for a suffix inside the site's 30-character limit.
    v_base := left(btrim(coalesce(v_display, '')), 26);
    if length(v_base) < 2 then
      v_base := 'TwitchPlayer';
    end if;
    v_name := v_base;
    while exists (select 1 from public.players where lower(username) = lower(v_name)) loop
      n := n + 1;
      v_name := v_base || '_' || n;
    end loop;

    insert into public.players (id, username, pawketpoints, twitch_id, twitch_username)
    values (new.user_id, v_name, 0, v_tid, v_login);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_twitch_identity on auth.identities;
create trigger sync_twitch_identity
  after insert or update or delete on auth.identities
  for each row execute function public.sync_twitch_identity();


-- ── 3. Backfill: give every existing Twitch link a real identity ──────────────
-- Supabase finds the account for a Twitch login by (provider, provider_id). A
-- player who linked Twitch the old way has `players.twitch_id` but no identity,
-- so without this their first Twitch login would make a SECOND account instead
-- of opening theirs. Ids linked to several accounts are skipped — see check (b).
--
-- identity_data only needs `sub`; Supabase overwrites it with Twitch's real
-- claims on that player's first Twitch login (which fires the trigger above
-- again and refreshes twitch_username).
insert into auth.identities
  (provider_id, user_id, identity_data, provider, created_at, updated_at)
select p.twitch_id::text,
       p.id,
       jsonb_build_object('sub', p.twitch_id::text,
                          'provider_id', p.twitch_id::text,
                          'name', p.twitch_username),
       'twitch',
       now(),
       now()
  from public.players p
 where p.twitch_id is not null
   and p.twitch_id::text in (
         select twitch_id::text from public.players
          where twitch_id is not null
          group by twitch_id having count(*) = 1)
   and not exists (
         select 1 from auth.identities i
          where i.provider = 'twitch' and i.provider_id = p.twitch_id::text);


-- ── After running ────────────────────────────────────────────────────────────
-- How many existing links now have an identity (should equal the number of
-- players with a twitch_id, minus any duplicates from check (b)):
--   select count(*) from auth.identities where provider = 'twitch';
--
-- After your first real Twitch login, show me what Twitch's claims look like so
-- I can confirm the username fields above picked the right one:
--   select identity_data from auth.identities
--    where provider = 'twitch' order by updated_at desc limit 1;
