import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { notificationService } from './NotificationService.js'
import { toastService } from './ToastService.js'
import {
  TWITCH_CLIENT_ID, TWITCH_REDIRECT_URI, WORKER_URL,
  FOLLOW_STREAMERS, FOLLOW_REWARD_PP
} from '../data/twitchData.js'

// ── OAuth token capture ─────────────────────────────────────────────────────
// Twitch's implicit flow returns the token in the URL FRAGMENT
// (`https://pawketpets.net/#access_token=…&scope=…`), and this app uses
// createWebHashHistory — so the router would try to resolve that fragment as a
// route and land nowhere. The fragment is therefore read and stripped at module
// load, BEFORE the router is created (main.js imports this first), and parked
// here for TwitchPage to pick up on mount.
//
// Legacy did this inside initTwitchTab() because it had no router to fight with.
let pendingOAuthToken = null

function consumeOAuthFragment() {
  if (typeof window === 'undefined') return
  const hash = window.location.hash || ''
  if (!hash.includes('access_token')) return

  const params = {}
  hash.replace(/^#\/?/, '').split('&').forEach(part => {
    const [k, v] = part.split('=')
    params[k] = decodeURIComponent(v || '')
  })
  if (params.access_token) pendingOAuthToken = params.access_token

  // Strip the fragment so a refresh doesn't replay the link, and so the router
  // starts from a clean URL. Landing on /twitch is right: that is the tab the
  // player left from and the one that shows the result.
  window.history.replaceState({}, '', window.location.pathname + '#/twitch')
}

consumeOAuthFragment()

export const twitchState = reactive({
  loading: true,
  linked: false,
  username: '',
  // Per-streamer claim state, keyed by FOLLOW_STREAMERS[].key. A value of
  // 'claimed' persists in the DB; 'not-following' is this session's result only.
  followRewards: {},
  followStatus: {},
  stats: null,
  checkingFollows: false,
  // The token a streamer copies into their Cloudflare worker config. Only ever
  // set on the request that came back from Twitch, never re-read from the DB.
  displayToken: ''
})

let rewardPollStarted = false

class TwitchService {
  takePendingToken() {
    const t = pendingOAuthToken
    pendingOAuthToken = null
    return t
  }

  // Ports linkTwitch(), game.js:3763.
  beginLink() {
    const scope = 'user:read:email user:read:follows'
    window.location.href =
      'https://id.twitch.tv/oauth2/authorize' +
      '?client_id=' + TWITCH_CLIENT_ID +
      '&redirect_uri=' + encodeURIComponent(TWITCH_REDIRECT_URI) +
      '&response_type=token' +
      '&scope=' + encodeURIComponent(scope)
  }

  // Ports handleTwitchCallback(), game.js:3773.
  async completeLink(token) {
    if (!AppState.user) return false
    const resp = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: 'Bearer ' + token }
    })
    const body = await resp.json()
    if (!body.data || !body.data.length) throw new Error('Failed to get Twitch user info')

    const twitchUser = body.data[0]
    const { error } = await supabase.from('players').update({
      twitch_id: twitchUser.id,
      twitch_username: twitchUser.login,
      twitch_token: token
    }).eq('id', AppState.user.id)
    if (error) throw error

    twitchState.displayToken = token
    await this.loadStatus()
    return true
  }

  // Ports checkTwitchLinked(), game.js:4161.
  async loadStatus() {
    if (!AppState.user) return
    twitchState.loading = true
    try {
      const { data } = await supabase
        .from('players')
        .select('twitch_username, twitch_id, twitch_follow_rewards')
        .eq('id', AppState.user.id)
        .maybeSingle()

      twitchState.linked = !!(data && data.twitch_username)
      twitchState.username = (data && data.twitch_username) || ''
      twitchState.followRewards = (data && data.twitch_follow_rewards) || {}
      if (twitchState.linked) this.loadStats().catch(() => {})
    } finally {
      twitchState.loading = false
    }
  }

  // Ports checkFollows(), game.js:4175.
  //
  // Legacy wrote each result into an element it looked up as
  // `el('follow-' + key + '-badge')` — but the only two badges in the markup
  // were `follow-ember-badge` and `follow-pyxs-badge`, while the keys are
  // `embertail` and `pyxshuul`. No lookup ever matched, so the per-streamer
  // result never appeared during a check; only the two hardcoded badges, filled
  // in on reload from the saved rewards map, ever showed anything. Here the
  // result is state keyed by the same key the loop uses, so every streamer
  // reports back.
  async checkFollows() {
    if (!AppState.user || twitchState.checkingFollows) return
    twitchState.checkingFollows = true
    try {
      const { data: player } = await supabase
        .from('players')
        .select('twitch_id, twitch_token, twitch_follow_rewards')
        .eq('id', AppState.user.id)
        .maybeSingle()

      if (!player || !player.twitch_token) {
        toastService.error('Twitch not linked!')
        return
      }

      const rewards = player.twitch_follow_rewards || {}
      const status = {}
      let earned = 0

      for (const s of FOLLOW_STREAMERS) {
        if (rewards[s.key]) { status[s.key] = 'claimed'; continue }
        try {
          const r = await fetch(
            'https://api.twitch.tv/helix/channels/followed' +
            '?user_id=' + player.twitch_id + '&broadcaster_id=' + s.twitchId,
            { headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: 'Bearer ' + player.twitch_token } }
          )
          const body = await r.json()
          if (body.data && body.data.length > 0) {
            rewards[s.key] = true
            status[s.key] = 'claimed'
            earned += FOLLOW_REWARD_PP
          } else {
            status[s.key] = 'not-following'
          }
        } catch (e) {
          // One streamer's lookup failing must not abandon the rest.
          console.warn('[twitch] follow check failed for ' + s.key, e)
          status[s.key] = 'error'
        }
      }

      if (earned > 0) {
        try {
          await playerService.awardPoints(earned, 'twitch_follow')
        } catch (e) {
          console.error('[twitch] follow PP award failed:', e)
        }
      }

      // twitch_follow_rewards is a tracking flag, not a currency field, so a
      // direct write is safe — legacy's own note, and still true.
      await supabase.from('players')
        .update({ twitch_follow_rewards: rewards })
        .eq('id', AppState.user.id)

      twitchState.followRewards = rewards
      twitchState.followStatus = status

      if (earned > 0) toastService.success('You earned ' + earned + ' PP!')
      else toastService.info('No new rewards. Follow our streamers!')
    } finally {
      twitchState.checkingFollows = false
    }
  }

  // Ports unlinkTwitch(), game.js:4213.
  async unlink() {
    if (!AppState.user) return
    await supabase.from('players')
      .update({ twitch_id: null, twitch_username: null, twitch_token: null })
      .eq('id', AppState.user.id)
    twitchState.linked = false
    twitchState.username = ''
    twitchState.stats = null
    twitchState.displayToken = ''
    toastService.info('Twitch unlinked.')
  }

  // Ports loadTwitchStats(), game.js:2877. Silent on failure — the worker is a
  // separate deployment and the page is fully usable without it.
  async loadStats() {
    if (!AppState.user) return
    const { data } = await supabase
      .from('players')
      .select('twitch_id, twitch_follow_rewards')
      .eq('id', AppState.user.id)
      .maybeSingle()
    if (!data || !data.twitch_id) return

    const res = await fetch(WORKER_URL + '/api/rewards/stats?twitch_id=' + data.twitch_id)
    if (!res.ok) return
    const stats = await res.json()
    twitchState.stats = {
      pp: stats.total_pp_earned || 0,
      chats: stats.chat_messages || 0,
      follows: Object.keys(data.twitch_follow_rewards || {}).length,
      subs: stats.subs || 0
    }
  }

  // Ports checkTwitchRewards(), game.js:2821 — claims whatever the worker has
  // credited since the last check.
  async checkRewards() {
    if (!AppState.user) return
    try {
      const { data } = await supabase
        .from('players').select('twitch_id').eq('id', AppState.user.id).maybeSingle()
      if (!data || !data.twitch_id) return

      const res = await fetch(WORKER_URL + '/api/rewards?twitch_id=' + data.twitch_id, {
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) return
      const rewards = await res.json()
      if (!Array.isArray(rewards) || !rewards.length) return

      for (const reward of rewards) {
        if (reward.claimed) continue
        await playerService.awardPoints(reward.amount, 'twitch_' + reward.type)
        toastService.success('🎬 Twitch Reward! +' + reward.amount + ' PP for ' + reward.reason)
        notificationService.create(
          AppState.user.id, 'twitch_reward', '🎬 Twitch Reward!',
          '+' + reward.amount + ' PP for ' + reward.reason, 'tab:twitch'
        ).catch(() => {})
        fetch(WORKER_URL + '/api/rewards/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reward_id: reward.id, twitch_id: data.twitch_id })
        }).catch(() => {})
      }
      this.loadStats().catch(() => {})
    } catch (e) {
      console.debug('[twitch] reward check failed:', e)
    }
  }

  // Legacy started this from initTwitchTab() and never stopped it, so once the
  // tab had been opened the poll ran for the rest of the session. Same here,
  // with a guard so revisiting the page doesn't stack intervals — legacy would
  // have added a second timer on every visit.
  startRewardPolling() {
    if (rewardPollStarted) return
    rewardPollStarted = true
    this.checkRewards()
    setInterval(() => this.checkRewards(), 120000)
  }
}

export const twitchService = new TwitchService()
