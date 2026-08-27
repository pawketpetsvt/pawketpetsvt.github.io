// Twitch integration config, ported from game.js:322-335 and the Cloudflare
// worker block at game.js:2817-2905.

export const TWITCH_CLIENT_ID = 'moqd3war5e7fleif8yte1d8n6kl25u'

// Registered with Twitch as this app's OAuth redirect, so it cannot be derived
// from the running origin the way the referral link is — Twitch rejects any
// redirect_uri that is not on the app's allow-list.
export const TWITCH_REDIRECT_URI = 'https://pawketpets.net/'

// Cloudflare worker that watches the team's chats and credits chat/sub/bit
// rewards. The site only reads what it has already awarded.
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
