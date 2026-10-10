// Twitch integration config, ported from game.js:322-335 and the Cloudflare
// worker block at game.js:2817-2905.

// The PawketPets Twitch app (replaced the original `moqd3war…` app in 2026-10).
// One app does everything: Log In With Twitch (its client ID and secret are in
// Supabase → Authentication → Providers → Twitch), Reconnect Twitch and
// streamer authorization (below), and the Cloudflare worker's EventSub and live
// status (its TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET).
export const TWITCH_CLIENT_ID = 'vgg0plq9stf7eub2ypba57c51dujih'

// Registered with Twitch as this app's OAuth redirect, so it cannot be derived
// from the running origin the way the referral link is — Twitch rejects any
// redirect_uri that is not on the app's allow-list.
//
// Under `npm run dev` it returns to the dev server instead, so Reconnect Twitch
// can be tested locally rather than always landing on the live site — which
// needs `http://localhost:5174/` on the Twitch app's redirect list too. The
// guards keep this importable from the plain-Node smoke tests.
const IS_DEV = typeof window !== 'undefined' && !!(import.meta.env && import.meta.env.DEV)
export const TWITCH_REDIRECT_URI = IS_DEV ? window.location.origin + '/' : 'https://pawketpets.net/'

// Supabase always asks for `user:read:email`; this adds what the follow
// rewards need.
export const TWITCH_LOGIN_SCOPES = 'user:read:follows'

// What the worker's EventSub subscriptions need Twitch to have been granted
// (twitch-worker/worker.js, handleSetup):
//   channel — each team streamer, for their own channel: subs and gift subs,
//             cheers, follows (as their own moderator), and letting the bot
//             read their chat;
//   bot     — the account named by the worker's BOT_USER_ID: reads chat, and
//             reads follows in any channel where it is a moderator. A streamer
//             who only mods the bot therefore gets chat and follow rewards
//             without authorizing anything; subs and cheers still need them.
export const STREAMER_AUTH_SCOPES = {
  channel: 'channel:read:subscriptions bits:read moderator:read:followers channel:bot',
  bot: 'user:read:chat user:bot moderator:read:followers'
}

// Cloudflare worker: receives Twitch EventSub (it pays chat/follow/sub/cheer PP
// through Supabase), serves live status (/api/live) and the OBS overlay API.
// Its source is twitch-worker/worker.js. Also referenced by obs.html and
// overlay.js at the repo root — change all three together.
export const WORKER_URL = 'https://pawketpets-twitch.pawketpetsvt.workers.dev'

export const FOLLOW_REWARD_PP = 50

// Broadcaster ids for the follow reward, keyed EXACTLY as legacy keyed them —
// these keys are the ones already persisted in `players.twitch_follow_rewards`,
// so renaming any of them would make a claimed reward claimable again.
//
// Legacy's table had a tenth entry, `cypurractive`, carrying the SAME broadcaster
// id as `cypurr` (755193792). Since the loop awards per KEY, following Cypurr
// paid out twice — 100 PP instead of 50 — and burned an extra API call on a
// duplicate lookup. The duplicate is dropped here; `cypurr` keeps the id, so any
// player who already has `cypurractive` in their rewards map is unaffected.
export const FOLLOW_STREAMERS = [
  { key: 'embertail', name: 'Embertail', twitchId: '91821604' },
  { key: 'pyxshuul', name: 'Pyxshuul', twitchId: '1459912293' },
  { key: 'aria', name: 'Aria', twitchId: '1445288832' },
  { key: 'blushimia', name: 'Blushimia', twitchId: '659500662' },
  { key: 'cowbee', name: 'Cowbee', twitchId: '203845195' },
  { key: 'kelta', name: 'Kelta', twitchId: '121490227' },
  { key: 'jess', name: 'Jess', twitchId: '88727356' },
  { key: 'gnarly', name: 'Gnarly', twitchId: '531222973' },
  { key: 'cypurr', name: 'Cypurr', twitchId: '755193792' }
]

// The "how you earn PP" explainer cards. Static copy in legacy's markup
// (index.html:1106-1140); data here so the four cards render from one loop.
export const TWITCH_REWARD_CARDS = [
  {
    icon: '💬', title: 'Chat Activity',
    desc: '+2 PP every 5 minutes while chatting in any team stream',
    cooldown: '⏱️ 5-minute cooldown between rewards'
  },
  {
    icon: '✅', title: 'Follow',
    desc: '+' + FOLLOW_REWARD_PP + ' PP for following any team member (one-time per streamer)'
  },
  {
    icon: '🎯', title: 'Subscribe / Gift Sub',
    desc: '+200 PP for subscribing or gifting a sub to any team stream'
  },
  {
    icon: '💎', title: 'Bits / Cheers',
    desc: '+1 PP per 10 Bits cheered in any team stream'
  }
]

export const TWITCH_TEAM_URL = 'https://www.twitch.tv/team/vcutiez'
