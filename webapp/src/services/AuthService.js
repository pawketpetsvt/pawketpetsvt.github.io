import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'

class AuthService {
  async restoreSession() {
    const { data } = await supabase.auth.getSession()
    AppState.user = data.session ? data.session.user : null
    return AppState.user
  }

  async register(email, password, username) {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    })
    if (result.error) throw new Error(result.error.message)
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
  }

  async resetPassword(email) {
    const result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    if (result.error) throw new Error(result.error.message)
    return result.data
  }
}

export const authService = new AuthService()
