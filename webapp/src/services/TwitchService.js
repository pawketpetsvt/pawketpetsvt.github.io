import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { notificationService } from './NotificationService.js'
import { toastService } from './ToastService.js'
import {
  TWITCH_CLIENT_ID, TWITCH_REDIRECT_URI,
  FOLLOW_STREAMERS, FOLLOW_REWARD_PP, STREAMER_AUTH_SCOPES
} from '../data/twitchData.js'

// ── OAuth token capture ─────────────────────────────────────────────────────
// Twitch's implicit flow returns the token in the URL FRAGMENT
// (`https://pawketpets.net/#access_token=…&scope=…`), and this app uses
// createWebHashHistory — so the router would try to resolve that fragment as a
// route and land nowhere. The fragment is therefore read and stripped at module
// load, BEFORE the router is created (main.js imports this first), and parked
// here for TwitchPage to pick up on mount.
//
// Two flows use it, told apart by the `state` they send: "Reconnect Twitch"
// (state=reconnect) and streamer authorization (state=channel / state=bot).
// Linking and logging in go through Supabase, whose redirects ALSO carry
// `#access_token=…` — those always include a `refresh_token`, so they're left
// for Supabase to read (SupabaseService's isSupabaseCallback draws the same line
// from its side).
//
// Legacy did this inside initTwitchTab() because it had no router to fight with.
let pendingOAuth = null

function consumeOAuthFragment() {
  if (typeof window === 'undefined') return
  const hash = window.location.hash || ''
  if (!hash.includes('access_token')) return

  const params = {}
  hash.replace(/^#\/?/, '').split('&').forEach(part => {
    const [k, v] = part.split('=')
    params[k] = decodeURIComponent(v || '')
  })
  if (params.refresh_token) return
  if (params.access_token) pendingOAuth = { token: params.access_token, state: params.state || 'reconnect' }

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
  // Set when the stored Twitch token is missing or expired, so the page can
  // offer "Reconnect Twitch" instead of a follow check that can only fail.
  needsReconnect: false,
  // The outcome of a streamer authorization round trip, shown on the page:
  // { kind, login, missing[] }. Replaces the old "copy this token into
  // Cloudflare" box — the worker never read those tokens; Twitch only needs the
  // streamer to have authorized the app.
  streamerAuth: null
})

let rewardPollStarted = false

class TwitchService {
  // { token, state } from a Twitch redirect, once.
  takePendingAuth() {
    const p = pendingOAuth
    pendingOAuth = null
    return p
  }

  // ── Linking ───────────────────────────────────────────────────────────────
  // Linking is Supabase's Twitch identity now (AuthService.linkTwitch), not
  // legacy's linkTwitch()/handleTwitchCallback() (game.js:3763/3773). Those
  // wrote `players.twitch_id` from the browser, so any player could claim any
  // Twitch id and collect that viewer's chat rewards. The column is set by a
  // database trigger from the identity Twitch verified, and the browser can no
  // longer write it (supabase/migrations/2026-10-08_twitch_login.sql).

  // Asks Twitch who a token belongs to, which app issued it and with what
  // scopes, or null if it is expired or revoked. Helix only accepts a token
  // alongside the issuing app's Client-Id; using the one Twitch reports keeps
  // tokens issued before the move to the new Twitch app working until they
  // expire.
  async validateToken(token) {
    if (!token) return null
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: 'OAuth ' + token }
    })
    if (!res.ok) return null
    return res.json()
  }

  _authorize(scope, state, forceVerify) {
    window.location.href =
      'https://id.twitch.tv/oauth2/authorize' +
      '?client_id=' + TWITCH_CLIENT_ID +
      '&redirect_uri=' + encodeURIComponent(TWITCH_REDIRECT_URI) +
      '&response_type=token' +
      '&scope=' + encodeURIComponent(scope) +
      '&state=' + state +
      (forceVerify ? '&force_verify=true' : '')
  }

  // ── Streamer authorization ────────────────────────────────────────────────
  // The worker receives subs, cheers, follows and chat through Twitch EventSub,
  // which Twitch only allows once each streamer (and the chat-reading bot
  // account) has authorized the app with the scopes in STREAMER_AUTH_SCOPES.
  // Nothing is stored: the authorization itself is what Twitch checks.
  // force_verify makes Twitch show its consent screen, so a streamer can see
  // and pick which Twitch account they're authorizing.
  beginStreamerAuth(kind) {
    this._authorize(STREAMER_AUTH_SCOPES[kind], kind, true)
  }

  async completeStreamerAuth(token, kind) {
    const info = await this.validateToken(token)
    if (!info) throw new Error('Twitch did not accept that authorization. Please try again.')
    const granted = info.scopes || []
    const missing = STREAMER_AUTH_SCOPES[kind].split(' ').filter(s => !granted.includes(s))
    twitchState.streamerAuth = { kind, login: info.login, userId: info.user_id, missing }
  }

  // The Twitch token Supabase hands over once, right after a Twitch login or
  // link. `twitch_token` is the one Twitch column the browser may still write.
  async saveLoginToken(token) {
    if (!AppState.user || !token) return
    await supabase.from('players').update({ twitch_token: token }).eq('id', AppState.user.id)
    twitchState.needsReconnect = false
  }

  // "Reconnect Twitch": legacy's direct implicit grant, kept for the
  // longer-lived token it returns (~60 days, against ~4 hours for one from Log
  // In With Twitch), which the follow check needs.
  beginReconnect() {
    this._authorize('user:read:email user:read:follows', 'reconnect', false)
  }

  // Stores a reconnected token, but only for the Twitch account already
  // linked to this player — it refreshes a link, it never makes or moves one.
  async completeReconnect(token) {
    if (!AppState.user) return false
    const info = await this.validateToken(token)
    if (!info) throw new Error('Twitch did not accept that sign-in. Please try again.')

    const { data: player } = await supabase
      .from('players').select('twitch_id').eq('id', AppState.user.id).maybeSingle()
    if (!player || !player.twitch_id) {
      throw new Error('Link Twitch with "Connect with Twitch" first.')
    }
    if (String(player.twitch_id) !== String(info.user_id)) {
      throw new Error(`That was the Twitch account "${info.login}", not the one linked here. Log in to Twitch as the linked account and try again.`)
    }

    const { error } = await supabase.from('players').update({ twitch_token: token }).eq('id', AppState.user.id)
    if (error) throw error

    twitchState.needsReconnect = false
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

      // twitch_id, not twitch_username, is what the worker keys on — and the
      // trigger can set the id before Twitch's claims supply a username.
      twitchState.linked = !!(data && data.twitch_id)
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

      if (!player || !player.twitch_id) {
        toastService.error('Twitch not linked!')
        return
      }
      // Validated up front: a Log In With Twitch token lasts about 4 hours, and
      // the check needs the issuing app's Client-Id (see validateToken).
      const token = player.twitch_token
      const info = await this.validateToken(token)
      if (!info || String(info.user_id) !== String(player.twitch_id)) {
        twitchState.needsReconnect = true
        toastService.info('Your Twitch connection has expired. Press "Reconnect Twitch", then check again.')
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
            { headers: { 'Client-Id': info.client_id, Authorization: 'Bearer ' + token } }
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

  // Ports unlinkTwitch(), game.js:4213 — now removes the Twitch identity, and
  // the database trigger clears the players columns with it. Supabase refuses
  // to remove an account's only way in, so a Twitch-only account can't unlink;
  // that's said up front rather than left to a raw API error.
  async unlink() {
    if (!AppState.user) return
    const { data, error: idErr } = await supabase.auth.getUserIdentities()
    if (idErr) { toastService.error(idErr.message); return }
    const identities = (data && data.identities) || []
    const twitch = identities.find(i => i.provider === 'twitch')
    if (twitch && identities.length < 2) {
      toastService.error('This account signs in with Twitch, so Twitch can\'t be unlinked from it.')
      return
    }
    if (twitch) {
      const { error } = await supabase.auth.unlinkIdentity(twitch)
      if (error) { toastService.error(error.message); return }
    } else {
      // A legacy link with no identity — one of several accounts that had all
      // claimed the same Twitch id, which the migration's backfill skips. The
      // browser can't clear twitch_id any more, so it needs an admin.
      toastService.error('This link predates Log In With Twitch and can only be removed by an admin.')
      return
    }
    twitchState.linked = false
    twitchState.username = ''
    twitchState.stats = null
    toastService.info('Twitch unlinked.')
  }

  // Ports loadTwitchStats(), game.js:2877 — now the player's own row in
  // twitch_reward_stats (written by the worker through Supabase) instead of the
  // old worker's KV store. Follows count the site's own claim map, as before,
  // since that also includes follows claimed with "Check Follows".
  async loadStats() {
    if (!AppState.user) return
    const [statsRes, playerRes] = await Promise.all([
      supabase.from('twitch_reward_stats')
        .select('total_pp_earned, chat_messages, subs').eq('player_id', AppState.user.id).maybeSingle(),
      supabase.from('players').select('twitch_follow_rewards').eq('id', AppState.user.id).maybeSingle()
    ])
    const stats = statsRes.data || {}
    twitchState.stats = {
      pp: stats.total_pp_earned || 0,
      chats: stats.chat_messages || 0,
      follows: Object.keys((playerRes.data && playerRes.data.twitch_follow_rewards) || {}).length,
      subs: stats.subs || 0
    }
  }

  // Ports checkTwitchRewards(), game.js:2821 — announces the stream rewards the
  // worker has paid since the last check.
  //
  // It no longer PAYS them. The worker always added the PP to the account
  // itself, and legacy then paid each reward a second time here through
  // award_pp_secure, so every chat, follow, sub and cheer reward was doubled.
  // These rows are notifications; the balance is just re-read.
  async checkRewards() {
    if (!AppState.user) return
    try {
      const { data: rewards, error } = await supabase
        .from('twitch_reward_events')
        .select('id, amount, reason')
        .eq('player_id', AppState.user.id)
        .eq('seen', false)
        .order('created_at', { ascending: true })
        .limit(50)
      if (error || !rewards || !rewards.length) return

      for (const reward of rewards) {
        toastService.success('🎬 Twitch Reward! +' + reward.amount + ' PP for ' + reward.reason)
        notificationService.create(
          AppState.user.id, 'twitch_reward', '🎬 Twitch Reward!',
          '+' + reward.amount + ' PP for ' + reward.reason, 'tab:twitch'
        ).catch(() => {})
      }
      await supabase.rpc('mark_twitch_rewards_seen', { p_ids: rewards.map(r => r.id) })
      await playerService.getPlayer(AppState.user.id)
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
