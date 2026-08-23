import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { Player } from '../models/Player.js'

class PlayerService {
  async getPlayer(userId) {
    const pr = await supabase.from('players').select('*').eq('id', userId).maybeSingle()
    if (pr.data) AppState.player = new Player(pr.data)
    return AppState.player
  }

  // Auto-recovery: creates a fresh player row if one is missing (e.g. a prior
  // signup that didn't complete the insert). Ports showApp()'s player-creation
  // fallback, game.js:2082-2117.
  async ensurePlayerRow(user) {
    const pr = await supabase.from('players').select('*').eq('id', user.id).maybeSingle()
    if (pr.data) {
      AppState.player = new Player(pr.data)
      return AppState.player
    }
    const tempUsername = 'Player' + Math.floor(Math.random() * 100000)
    const created = await supabase
      .from('players')
      .insert([{ id: user.id, username: tempUsername, pawketpoints: 0, created_at: new Date().toISOString() }])
      .select('*')
      .single()
    if (created.data) {
      AppState.player = new Player(created.data)
      return AppState.player
    }
    console.error('Failed to create player row:', created.error)
    return null
  }

  // Ports updateSidebarStats(), game.js:2274-2363 (minus the DOM writes — those
  // are now handled reactively by LeftSidebar.vue reading AppState.sidebarStats).
  async refreshSidebarStats(userId) {
    const [petsRes, itemsRes] = await Promise.all([
      supabase.from('user_pets').select('id').eq('user_id', userId),
      supabase.from('user_inventory').select('quantity').eq('user_id', userId)
    ])
    const totalItems = (itemsRes.data || []).reduce((sum, item) => sum + (item.quantity || 0), 0)
    AppState.sidebarStats.petCount = petsRes.data ? petsRes.data.length : 0
    AppState.sidebarStats.itemCount = totalItems
    AppState.sidebarStats.streak = AppState.player ? AppState.player.login_streak : 0
  }

  // Awards PP via the same secure RPC the live game uses (award_pp_secure),
  // rather than a raw update — keeps server-side validation/logging intact.
  async awardPoints(amount, reason) {
    if (!AppState.user || amount <= 0) return null
    const { data, error } = await supabase.rpc('award_pp_secure', { p_amount: amount, p_reason: reason || 'unknown' })
    if (!error && data !== null && data !== undefined) {
      if (AppState.player) AppState.player.pawketpoints = data
      return data
    }
    console.error('[awardPoints] award_pp_secure RPC failed:', error && error.message)
    return null
  }

  deductPoints(amount) {
    if (AppState.player) AppState.player.pawketpoints -= amount
  }

  // Spends PP via the secure RPC (spend_pp_secure) the live game uses for
  // shop purchases — validates the player can actually afford it server-side
  // rather than trusting a client-computed balance. Returns the new total,
  // or null if the spend was rejected (e.g. insufficient funds).
  async spendPoints(amount, reason) {
    if (!AppState.user || amount <= 0) return null
    const { data, error } = await supabase.rpc('spend_pp_secure', { p_amount: amount, p_reason: reason || 'unknown' })
    if (!error && data !== null && data !== undefined) {
      if (AppState.player) AppState.player.pawketpoints = data
      return data
    }
    console.error('[spendPoints] spend_pp_secure RPC failed:', error && error.message)
    return null
  }

  // A second, separate "take PP" RPC the live game uses for the Slot
  // Machine bet only (deduct_pp_secure) — kept distinct from spendPoints
  // (spend_pp_secure) rather than consolidated, since this migration has no
  // visibility into whether the two RPCs validate differently server-side.
  async deductPointsSecure(amount, reason) {
    if (!AppState.user || amount <= 0) return null
    const { data, error } = await supabase.rpc('deduct_pp_secure', { p_amount: amount, p_reason: reason || 'unknown' })
    if (!error && data !== null && data !== undefined) {
      if (AppState.player) AppState.player.pawketpoints = data
      return data
    }
    console.error('[deductPointsSecure] deduct_pp_secure RPC failed:', error && error.message)
    return null
  }

  // A third "take PP" pattern: award_pp_secure called with a negative delta
  // (fishing bait cost, rod upgrades). Unlike awardPoints, this allows any
  // signed amount and doesn't reject non-positive values.
  async adjustPoints(delta, reason) {
    if (!AppState.user || !delta) return null
    const { data, error } = await supabase.rpc('award_pp_secure', { p_amount: delta, p_reason: reason || 'unknown' })
    if (!error && data !== null && data !== undefined) {
      if (AppState.player) AppState.player.pawketpoints = data
      return data
    }
    console.error('[adjustPoints] award_pp_secure RPC failed:', error && error.message)
    return null
  }
}

export const playerService = new PlayerService()
