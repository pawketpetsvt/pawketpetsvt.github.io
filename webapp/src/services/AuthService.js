import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { activityService } from './ActivityService.js'

class AuthService {
  async restoreSession() {
    const { data } = await supabase.auth.getSession()
    AppState.user = data.session ? data.session.user : null
    return AppState.user
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

  async resetPassword(email) {
    // No redirectTo override — let Supabase use the Site URL from its own settings.
    const result = await supabase.auth.resetPasswordForEmail(email)
    if (result.error) throw new Error(result.error.message)
    return result.data
  }
}

export const authService = new AuthService()
