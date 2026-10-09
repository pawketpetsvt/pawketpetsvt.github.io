import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { activityService } from './ActivityService.js'
import { twitchService } from './TwitchService.js'
import { toastService } from './ToastService.js'
import { TWITCH_LOGIN_SCOPES } from '../data/twitchData.js'

// Where to land after an OAuth round trip. Supabase appends its tokens to
// `redirectTo` as a URL fragment, so the destination can't ride in the fragment
// itself (this app's router lives there); it waits in sessionStorage instead.
const RETURN_KEY = 'pp_auth_return'

// Supabase's error codes for an OAuth redirect, in the player's terms.
const REDIRECT_ERRORS = {
  identity_already_exists: 'That Twitch account is already linked to a different PawketPets account. Log out and use "Log In With Twitch" to open that one.',
  access_denied: 'Twitch sign-in was cancelled.'
}

function readSession(key) {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function writeSession(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch { /* private mode: we just land on Home instead */ }
}

class AuthService {
  // Runs before the app mounts (main.js), so the router starts on a clean URL.
  // getSession() waits for Supabase to finish reading any login redirect.
  async restoreSession() {
    const { data } = await supabase.auth.getSession()
    AppState.user = data.session ? data.session.user : null
    this._settleRedirect()
    return AppState.user
  }

  // Supabase clears the fragment after a successful redirect but leaves a
  // failed one (`#error=…`) in place, where the hash router would try to route
  // it. Report it, then point the URL somewhere real.
  _settleRedirect() {
    const returnTo = readSession(RETURN_KEY)
    writeSession(RETURN_KEY, null)
    const hash = window.location.hash || ''
    const failed = /[#&](error|error_code|error_description)=/.test(hash)
    if (!failed && !returnTo) return

    let target = AppState.user ? (returnTo || '/home') : '/login'
    if (failed) {
      const params = new URLSearchParams(hash.replace(/^#\/?/, ''))
      const code = params.get('error_code') || params.get('error')
      toastService.error(REDIRECT_ERRORS[code] || params.get('error_description') || 'Twitch sign-in failed.')
    }
    window.history.replaceState({}, '', window.location.pathname + '#' + target)
  }

  // Log In With Twitch — the same call creates the account on a first visit.
  // A new account has no password; Twitch is how its owner signs in (the
  // database trigger in supabase/migrations/2026-10-08_twitch_login.sql makes
  // its players row and links its twitch_id). A Twitch account already linked
  // to an existing player signs in to THAT player.
  async signInWithTwitch() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: { redirectTo: window.location.origin + '/', scopes: TWITCH_LOGIN_SCOPES }
    })
    if (error) throw new Error(error.message)
  }

  // Attaches Twitch to the signed-in account, so it can also log in with
  // Twitch and earns chat rewards. Needs "Manual linking" enabled in Supabase.
  async linkTwitch() {
    writeSession(RETURN_KEY, '/twitch')
    const { error } = await supabase.auth.linkIdentity({
      provider: 'twitch',
      options: { redirectTo: window.location.origin + '/', scopes: TWITCH_LOGIN_SCOPES }
    })
    if (error) {
      writeSession(RETURN_KEY, null)
      throw new Error(error.message)
    }
  }

  // Must be called once, before the app mounts — Supabase processes a
  // password-recovery link's hash immediately and fires PASSWORD_RECOVERY via
  // this listener. Registering it late means missing the event entirely.
  subscribeToAuthChanges(onPasswordRecovery) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (onPasswordRecovery) onPasswordRecovery()
      } else if (event === 'SIGNED_IN' && session) {
        AppState.user = session.user
        // Twitch's own token arrives exactly once, on the sign-in straight after
        // a Twitch login or link, and is never refreshed by Supabase — kept for
        // the follow-reward checks.
        if (session.provider_token) twitchService.saveLoginToken(session.provider_token).catch(() => {})
      } else if (event === 'SIGNED_OUT') {
        AppState.user = null
      }
    })
  }

  async updatePasswordAfterRecovery(newPassword) {
    const result = await supabase.auth.updateUser({ password: newPassword })
    if (result.error) throw new Error(result.error.message)
    return result.data
  }

  async register(email, password, username) {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    })
    if (result.error) throw new Error(result.error.message)
    // Supabase returns success even for existing emails (security by design),
    // but the returned user has empty identities — that's the real signal.
    if (result.data.user && result.data.user.identities && result.data.user.identities.length === 0) {
      throw new Error('That email address already has an account. Try logging in, or use a different email.')
    }
    if (result.data.user) {
      const pr = await supabase.from('players').insert([{
        id: result.data.user.id, username, pawketpoints: 0
      }])
      if (pr.error) console.warn('Player row error:', pr.error.message)
    }
    return result.data
  }

  async login(email, password) {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      const errorMsg = result.error.message
      if (errorMsg.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please check your credentials and try again.')
      } else if (errorMsg.includes('Email not confirmed')) {
        throw new Error('Please verify your email address before logging in.')
      } else if (errorMsg.includes('User not found')) {
        throw new Error('No account found with this email address.')
      } else {
        throw new Error(errorMsg)
      }
    }
    AppState.user = result.data.user
    return result.data
  }

  async logout() {
    await supabase.auth.signOut()
    AppState.user = null
    AppState.player = null
    AppState.ownedPets = []
    AppState.ownedPetIds = []
    AppState.inventory = []
    // The activity feed caches the username for its announcement payloads, so
    // the next player to sign in on this browser must not inherit it.
    activityService.reset()
  }

  // Ports the tail of triggerBossDeathScreen() (game.js:19272-19285): sign out
  // and hard-reload while the screen is still black, so the player's next sight
  // is the login page. The reload is what makes it feel like the game threw
  // them out rather than merely navigated.
  //
  // Reloads even if the sign-out throws — legacy has the same `.catch()`
  // reload, and a player left sitting on a black screen because the network
  // hiccuped would be far worse than one whose session outlived the beat.
  async signOutAndReload() {
    try {
      await this.logout()
    } catch (e) {
      console.error('[auth] sign-out during boss death screen failed:', e)
    }
    window.location.reload()
  }

  async resetPassword(email) {
    // No redirectTo override — let Supabase use the Site URL from its own settings.
    const result = await supabase.auth.resetPasswordForEmail(email)
    if (result.error) throw new Error(result.error.message)
    return result.data
  }
}

export const authService = new AuthService()
