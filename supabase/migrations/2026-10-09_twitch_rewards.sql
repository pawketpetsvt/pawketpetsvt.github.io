-- ════════════════════════════════════════════════════════════════════════════
-- Twitch stream rewards, moved from the old worker's KV store into Supabase
--
-- The rebuilt Cloudflare worker (twitch-worker/worker.js) calls the two
-- functions below with the service key whenever Twitch reports chat, a follow,
-- a sub or a cheer. Each call awards the PP, updates the player's stats and
-- records a reward event IN ONE TRANSACTION. The site reads its own events and
-- stats straight from these tables (row-level security: own rows only).
--
-- What this fixes in the old worker:
--   • Double payment. The old worker added the PP to `players` AND queued the
--     same reward for the site, which then paid it again through
--     award_pp_secure — every Twitch reward was paid twice. Events here are
--     notifications only; the site no longer awards anything for them.
--   • Lost updates. The old worker read the balance, added, and wrote the total
--     back, so a purchase made in between was overwritten (refunded). This
--     increments in place.
--   • Double-claimed follow rewards. See twitch_award's p_follow_key.
--   • Twitch's at-least-once delivery. A redelivered notification carries the
--     same message id; `twitch_message_id` is unique, so it can't pay twice.
--   • Cloudflare KV's free-plan limit of 1,000 writes a day, which a busy
--     stream would exhaust (the old worker wrote ~4 times per rewarded chat).
--
-- The old worker's KV store turned out to be empty — it never recorded a single
-- reward — so there were no stats to carry over.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Tables ───────────────────────────────────────────────────────────────────
create table if not exists public.twitch_reward_stats (
  player_id            uuid primary key references public.players(id) on delete cascade,
  total_pp_earned      integer not null default 0,
  chat_messages        integer not null default 0,
  follows              integer not null default 0,
  subs                 integer not null default 0,
  cheers               integer not null default 0,
  last_chat_reward_at  timestamptz,   -- the 5-minute chat cooldown
  last_popup_at        timestamptz,   -- the OBS chat pop-up cooldown
  updated_at           timestamptz not null default now()
);

create table if not exists public.twitch_reward_events (
  id                 bigint generated always as identity primary key,
  player_id          uuid not null references public.players(id) on delete cascade,
  amount             integer not null,
  type               text not null,          -- chat | follow | sub | cheer
  reason             text not null,
  twitch_message_id  text unique,            -- EventSub message id (dedupe)
  seen               boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists twitch_reward_events_unseen
  on public.twitch_reward_events (player_id) where not seen;

alter table public.twitch_reward_stats  enable row level security;
alter table public.twitch_reward_events enable row level security;

drop policy if exists "Players read their own Twitch stats" on public.twitch_reward_stats;
create policy "Players read their own Twitch stats" on public.twitch_reward_stats
  for select to authenticated using (player_id = auth.uid());

drop policy if exists "Players read their own Twitch rewards" on public.twitch_reward_events;
create policy "Players read their own Twitch rewards" on public.twitch_reward_events
  for select to authenticated using (player_id = auth.uid());

-- Reads only. Every write goes through the functions below.
revoke insert, update, delete on public.twitch_reward_stats  from anon, authenticated;
revoke insert, update, delete on public.twitch_reward_events from anon, authenticated;


-- ── Lookup ───────────────────────────────────────────────────────────────────
-- `twitch_id` is compared as text so this works whether the column is text or
-- numeric. Since 2026-10-08 it is set only from a verified Twitch identity.
create or replace function public.twitch_player_id(p_twitch_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.players where twitch_id::text = p_twitch_id limit 1;
$$;


-- ── Chat ─────────────────────────────────────────────────────────────────────
-- Called for EVERY chat message in a team channel. Decides, under a row lock
-- so two simultaneous messages can't both win:
--   popup   — whether the OBS overlay should show this chatter's companion
--             (at most once per p_popup_seconds);
--   awarded — whether this message earns chat PP (at most once per
--             p_cooldown_seconds).
-- Returns {linked:false} for chatters who haven't linked Twitch.
create or replace function public.twitch_chat_activity(
  p_twitch_id         text,
  p_message_id        text,
  p_amount            integer,
  p_cooldown_seconds  integer,
  p_popup_seconds     integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player  uuid;
  s         public.twitch_reward_stats;
  v_popup   boolean;
  v_award   boolean;
begin
  v_player := public.twitch_player_id(p_twitch_id);
  if v_player is null then
    return jsonb_build_object('linked', false);
  end if;

  insert into public.twitch_reward_stats (player_id) values (v_player)
  on conflict (player_id) do nothing;

  select * into s from public.twitch_reward_stats where player_id = v_player for update;

  v_popup := s.last_popup_at is null
          or s.last_popup_at < now() - make_interval(secs => p_popup_seconds);
  v_award := p_amount > 0 and (s.last_chat_reward_at is null
          or s.last_chat_reward_at < now() - make_interval(secs => p_cooldown_seconds));

  update public.twitch_reward_stats set
    last_popup_at       = case when v_popup then now() else last_popup_at end,
    last_chat_reward_at = case when v_award then now() else last_chat_reward_at end,
    chat_messages       = chat_messages   + case when v_award then 1 else 0 end,
    total_pp_earned     = total_pp_earned + case when v_award then p_amount else 0 end,
    updated_at          = now()
  where player_id = v_player;

  if v_award then
    update public.players set pawketpoints = coalesce(pawketpoints, 0) + p_amount where id = v_player;
    insert into public.twitch_reward_events (player_id, amount, type, reason, twitch_message_id)
    values (v_player, p_amount, 'chat', 'chatting in stream', p_message_id)
    on conflict (twitch_message_id) do nothing;
  end if;

  return jsonb_build_object('linked', true, 'player_id', v_player,
                            'popup', v_popup, 'awarded', v_award);
end;
$$;


-- ── Follow / sub / cheer ─────────────────────────────────────────────────────
-- p_follow_key: for follows, the key the SITE uses in
-- players.twitch_follow_rewards ('embertail', 'aria', …). The old worker used
-- the Twitch login instead ('ariadoestwitch', …), so the worker's record and
-- the site's "Check Follows" record never matched for most streamers and each
-- follow could be paid twice. Both now write the same key, and whichever
-- arrives first wins.
create or replace function public.twitch_award(
  p_twitch_id   text,
  p_type        text,
  p_amount      integer,
  p_reason      text,
  p_message_id  text,
  p_follow_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player   uuid;
  v_rewards  jsonb;
  v_new      public.players.twitch_follow_rewards%type;
  v_event    bigint;
begin
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('awarded', false, 'why', 'no_amount');
  end if;

  v_player := public.twitch_player_id(p_twitch_id);
  if v_player is null then
    return jsonb_build_object('awarded', false, 'why', 'not_linked');
  end if;

  if p_follow_key is not null then
    select coalesce(twitch_follow_rewards::jsonb, '{}'::jsonb) into v_rewards
      from public.players where id = v_player for update;
    if v_rewards ->> p_follow_key is not null then
      return jsonb_build_object('awarded', false, 'why', 'already_claimed');
    end if;
    v_new := v_rewards || jsonb_build_object(p_follow_key, true);
    update public.players set twitch_follow_rewards = v_new where id = v_player;
  end if;

  insert into public.twitch_reward_events (player_id, amount, type, reason, twitch_message_id)
  values (v_player, p_amount, p_type, p_reason, p_message_id)
  on conflict (twitch_message_id) do nothing
  returning id into v_event;

  if v_event is null then
    return jsonb_build_object('awarded', false, 'why', 'duplicate');
  end if;

  update public.players set pawketpoints = coalesce(pawketpoints, 0) + p_amount where id = v_player;

  insert into public.twitch_reward_stats (player_id, total_pp_earned, follows, subs, cheers)
  values (v_player, p_amount,
          case when p_type = 'follow' then 1 else 0 end,
          case when p_type = 'sub'    then 1 else 0 end,
          case when p_type = 'cheer'  then 1 else 0 end)
  on conflict (player_id) do update set
    total_pp_earned = twitch_reward_stats.total_pp_earned + excluded.total_pp_earned,
    follows         = twitch_reward_stats.follows + excluded.follows,
    subs            = twitch_reward_stats.subs    + excluded.subs,
    cheers          = twitch_reward_stats.cheers  + excluded.cheers,
    updated_at      = now();

  return jsonb_build_object('awarded', true, 'player_id', v_player);
end;
$$;


-- ── Removed: one-time KV stats import ───────────────────────────────────────
-- twitch_import_stats existed briefly for copying the old worker's KV stats
-- in. The KV store was empty, so it was never needed; dropped if an earlier
-- run of this file created it.
drop function if exists public.twitch_import_stats(text, integer, integer, integer, integer, integer);


-- ── Site: acknowledge rewards ────────────────────────────────────────────────
-- The site shows each unseen reward once, then marks it seen. Seen events
-- older than 30 days are pruned here so the table doesn't grow forever.
create or replace function public.mark_twitch_rewards_seen(p_ids bigint[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.twitch_reward_events set seen = true
   where player_id = auth.uid() and id = any(p_ids);
  delete from public.twitch_reward_events
   where player_id = auth.uid() and seen and created_at < now() - interval '30 days';
$$;


-- ── Who may call what ────────────────────────────────────────────────────────
revoke all on function public.twitch_player_id(text) from public, anon, authenticated;
revoke all on function public.twitch_chat_activity(text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.twitch_award(text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.twitch_player_id(text) to service_role;
grant execute on function public.twitch_chat_activity(text, text, integer, integer, integer) to service_role;
grant execute on function public.twitch_award(text, text, integer, text, text, text) to service_role;

revoke all on function public.mark_twitch_rewards_seen(bigint[]) from public, anon;
grant execute on function public.mark_twitch_rewards_seen(bigint[]) to authenticated;
