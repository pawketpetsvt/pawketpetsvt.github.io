-- ════════════════════════════════════════════════════════════════════════════
-- Discord announcement webhooks: add the X-Relay-Secret header
--
-- The four Database Webhooks that post to the Cloudflare worker's
-- /discord/relay, re-created exactly as they were (same names, tables, events,
-- address and 5s timeout) plus the header the updated worker requires.
-- Database Webhooks are triggers on supabase_functions.http_request, so they
-- still show in the dashboard (Integrations → Database Webhooks) afterwards.
--
-- HOW TO RUN: paste this into the SQL Editor, replace PASTE_RELAY_SECRET_HERE
-- (one place, below) with the worker's RELAY_SECRET, and run. Do NOT save the
-- secret back into this file — the repo is public. It refuses to run with the
-- placeholder still in place.
--
-- Run it BEFORE deploying the updated worker: the current worker ignores the
-- extra header, the updated one rejects any request without it.
--
-- Safe to re-run (e.g. after rotating the secret).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_secret  text := 'PASTE_RELAY_SECRET_HERE';
  v_url     text := 'https://pawketpets-twitch.pawketpetsvt.workers.dev/discord/relay';
  v_headers text;
  -- trigger name (case matters: "Activity_feed" was created capitalised),
  -- table, events
  hooks     text[][] := array[
    ['active_world_event', 'active_world_event', 'update'],
    ['Activity_feed',      'activity_feed',      'insert'],
    ['community_goals',    'community_goals',    'insert or update'],
    ['world_state_flags',  'world_state_flags',  'update']
  ];
  i int;
begin
  if v_secret = 'PASTE_RELAY_SECRET_HERE' or length(v_secret) < 16 then
    raise exception 'Paste the worker''s RELAY_SECRET over PASTE_RELAY_SECRET_HERE first.';
  end if;

  v_headers := json_build_object(
    'Content-type',   'application/json',
    'X-Relay-Secret', v_secret
  )::text;

  for i in 1 .. array_length(hooks, 1) loop
    execute format('drop trigger if exists %I on public.%I', hooks[i][1], hooks[i][2]);
    execute format(
      'create trigger %I after %s on public.%I for each row '
      'execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
      hooks[i][1], hooks[i][3], hooks[i][2],
      v_url, 'POST', v_headers, '{}', '5000'
    );
  end loop;
end;
$$;

-- Check (shows whether each one carries the header, without printing it):
--   select event_object_table, event_manipulation, trigger_name,
--          action_statement ilike '%X-Relay-Secret%' as has_secret
--     from information_schema.triggers
--    where action_statement ilike '%discord/relay%';
