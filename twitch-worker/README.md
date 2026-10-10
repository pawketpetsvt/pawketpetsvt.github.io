# PawketPets Twitch worker

The Cloudflare Worker behind stream rewards, "Our Streamers" live status, the
OBS overlay API and the Discord bot. `worker.js` is the whole thing — it is
pasted into the existing `pawketpets-twitch` worker in the Cloudflare dashboard
(Edit code); there is no build step. Its address stays
`https://pawketpets-twitch.pawketpetsvt.workers.dev`, so the site, the OBS
overlays, Discord and the Supabase webhooks keep pointing at the same place.

The header of `worker.js` lists what changed from the original code and why.

Nothing in this folder is secret. Every key lives in the worker's Variables and
Secrets, never in the code — this repo is public (GitHub Pages serves it).

## Rolling it out, in order

The order keeps rewards flowing the whole time: the original Twitch app's event
subscriptions keep delivering to this worker until step 7 deliberately cuts
them off, by which point the new app's are ready to replace them.

### 1. Database
In the Supabase SQL Editor, run `supabase/migrations/2026-10-08_twitch_login.sql`
(if not already) and then `2026-10-09_twitch_rewards.sql`.

### 2. Twitch app
In the Twitch developer console, the PawketPets app (`vgg0plq9…`) needs these
**OAuth Redirect URLs**:

- `https://hqzugbxutgefjilgmxqu.supabase.co/auth/v1/callback` — Log In With Twitch
- `https://pawketpets.net/` — Reconnect Twitch and streamer authorization
- `http://localhost:5174/` — the same, under `npm run dev`

### 3. Supabase webhooks get a shared secret (before the code changes)
Make a random string for `RELAY_SECRET` (PowerShell:
`[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')`).

Run `supabase/migrations/2026-10-09_discord_relay_secret.sql` in the SQL Editor,
pasting that string over its placeholder there (never into the file — the repo
is public). It re-creates the four Database Webhooks that post to
`…/discord/relay` (`active_world_event`, `Activity_feed`, `community_goals`,
`world_state_flags`) with an `X-Relay-Secret` header. The current code ignores
the header; the new code refuses any request without it. Doing this first means
Discord announcements never pause. (In the dashboard these webhooks live under
Integrations → Database Webhooks.)

### 4. Update the worker
Cloudflare → Workers & Pages → `pawketpets-twitch`.

**Settings → Variables and Secrets** — change or add:

| Name | Type | Value |
|---|---|---|
| `TWITCH_CLIENT_ID` | Text | `vgg0plq9stf7eub2ypba57c51dujih` (was the old app's) |
| `TWITCH_CLIENT_SECRET` | Secret | the new app's client secret |
| `ADMIN_KEY` | Secret | a new random string (unlocks `/setup`, `/clear`, `/subscriptions`) |
| `RELAY_SECRET` | Secret | the string from step 3 |

Leave `TWITCH_SECRET`, `BOT_USER_ID`, `BROADCASTER_IDS`, `SUPABASE_*` and
`DISCORD_*` as they are for now.

Then **Edit code** → replace everything with `worker.js` → **Deploy**.

From this moment: the old subscriptions keep delivering (same webhook secret),
each reward is paid once instead of twice, live status comes from the new app,
and the old site's reward polling gets a 404 (so the double payment stops even
before the site is redeployed).

### 5. Deploy the site
Build and deploy the site (it reads rewards and stats from Supabase and adds the
"For PawketPets streamers" section to the Twitch page).

### 6. The bot, then the streamers, authorize the new app
Twitch keeps authorizations per app and only the person themselves can grant
one, so nothing carries over from the original app — and there was little to
carry: its secrets suggest only Embertail and Pyxshuul ever authorized it, and
its empty KV store says it never paid a reward.

What each kind of reward needs (all granted to the new app):

| Reward | Needs |
|---|---|
| Chat | the bot authorized, **and** either the bot is a moderator in the channel or the streamer authorized their channel |
| Follow | the bot authorized and a moderator there, **or** the streamer authorized their channel |
| Sub / gift sub | the streamer authorized their channel (Twitch keeps subs private to the channel) |
| Cheer | the streamer authorized their channel |

So, in order:

- **The chat bot account** — do this yourself. A dedicated account you control
  (e.g. "PawketPetsBot") is the cleaner choice; the original used Embertail's
  own account (91821604). Logged in to Twitch as the bot: pawketpets.net →
  Twitch page → *For PawketPets streamers* → **Authorize the chat bot account**.
  The page shows its Twitch user id, for `BOT_USER_ID` in step 7.
- **Each team streamer, minimum**: type `/mod <bot name>` in their own chat. That
  alone turns on chat and follow rewards in their channel.
- **Each team streamer, for subs and cheers too**: same section → **Authorize my
  channel**, logged in to Twitch as their streaming account.

### 7. Switch the event subscriptions to the new app
The original worker's KV store was empty, meaning it never recorded a single
reward — its subscriptions were most likely never working. So this step is in
practice where stream rewards switch on for the first time.

In Variables and Secrets:

- `TWITCH_SECRET` → a **new** random string. This cuts off any of the original
  app's subscriptions that might still be alive: their deliveries are signed
  with the old string, so the worker rejects them and Twitch shuts them down.
  Without it, the old and new subscriptions could both deliver every sub and
  cheer, paying it twice.
- `BOT_USER_ID` → the bot account's id, if it changed in step 6.

Deploy, then open `…/setup?key=<ADMIN_KEY>`. Each line's `status` is what Twitch
did: `202` registered, `409` already registered (fine), `403` not authorized yet
(see the table in step 6). `/setup` can be opened again any time — after a
streamer mods the bot or authorizes their channel, open it again and their
lines turn `202`. `…/subscriptions?key=<ADMIN_KEY>` lists what's registered.

### 8. Tidy up
- Delete the secrets the code never read: `BROADCASTER_TOKEN_*`,
  `TWITCH_BOT_TOKEN`, and `DISCORD_BOT_TOKEN` (it's only for registering slash
  commands — see below — not something the worker uses).
- Remove the `PAWKET_KV` binding (Settings → Bindings) and delete the namespace —
  it's empty and the code no longer uses it.
- Ember can delete the original Twitch app (`moqd3war…`). Deleting it also
  removes any of its subscriptions that are left.

## Discord

The worker keeps answering the existing Discord application at the same
address, so nothing needs to change there. If you also want your own Discord
application: create it, set its **Interactions Endpoint URL** to
`https://pawketpets-twitch.pawketpetsvt.workers.dev/discord/interactions`, put its
public key in `DISCORD_PUBLIC_KEY`, run `register-discord-commands.mjs` once
(instructions inside), and invite the new bot to the server. A
`DISCORD_WEBHOOK_URL` you create yourself (Discord channel → Edit Channel →
Integrations → Webhooks) works with either application.
