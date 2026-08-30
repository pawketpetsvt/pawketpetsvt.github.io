import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { Player } from '../models/Player.js'
import { taskTracker } from './TaskTrackerService.js'
import { ppHistoryService } from './PPHistoryService.js'
import { rollPPGlitch } from './PPGlitchService.js'

// PP awarded BY a progress system, which must not feed back into it. Matches
// the reasons BingoService, WeeklyChallengeService and PassService use.
const REWARD_REASONS = /^(bingo|weekly|pass_level|Bingo|Weekly)/

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
      // The Bingo "Earn 500 PP" square counts the AMOUNT, not the number of
      // awards — so the event carries it. Reported here rather than at every
      // call site, since this is the one funnel every PP award passes through.
      //
      // Rewards paid BY the progress systems are excluded, or completing a
      // bingo square would report PP straight back into the listener that just
      // awarded it. A flag can't do this job: onTask is async, so it would
      // clear before the nested award ran.
      if (!REWARD_REASONS.test(reason || '')) taskTracker.report('earn_points', amount)
      rollPPGlitch()
      ppHistoryService.log(amount, reason, data)
      return data
    }
    console.error('[awardPoints] award_pp_secure RPC failed:', error && error.message)
    return null
  }

  // `deductPoints(amount)` was removed. It mutated the LOCAL balance only —
  // no database write, no affordability check, and no PP-history entry — and
  // its single caller (pet adoption) paired it with a hand-computed absolute
  // write to `players.pawketpoints`. That combination is what made adoptions
  // the one charge missing from the player's PP History.
  //
  // Every PP movement now goes through awardPoints / spendPoints / adjustPoints,
  // which are atomic server-side and all log. Nothing should set
  // `AppState.player.pawketpoints` directly except those three, from an RPC's
  // returned balance.

  // Records a charge that an RPC already made SERVER-SIDE, so it appears in the
  // player's PP History like every other spend.
  //
  // Several RPCs own their own pricing and charge PP themselves —
  // `unlock_room_theme_secure`, `racing_buy_gear_secure`, `enter_grand_prix`,
  // `perform_corruption_ritual`. That is deliberate (the price lives on the
  // server so a client cannot name its own), but it means those charges never
  // passed through spendPoints and so were INVISIBLE in PP History. A player
  // seeing their balance drop with no matching entry has no way to account for
  // it — which is exactly how a correct guild donation came to look like a
  // double charge.
  //
  // The balance is re-read rather than computed, because the RPC is the
  // authority on what it actually took.
  // `knownBalance` skips the re-read where the RPC already returned the new
  // total, so no call site pays for a query it does not need.
  async noteExternalSpend(amount, reason, knownBalance) {
    let balance
    if (typeof knownBalance === 'number') {
      balance = knownBalance
      if (AppState.player) AppState.player.pawketpoints = balance
    } else {
      balance = await this.refreshPoints()
    }
    if (amount) ppHistoryService.log(-Math.abs(amount), reason, balance)
    return balance
  }

  // Re-reads the balance from the server. Needed wherever an RPC moves PP
  // without going through awardPoints/spendPoints — `save_battle_result` credits
  // battle winnings server-side, and without this the navbar and sidebar would
  // keep showing the pre-battle number until the next navigation.
  async refreshPoints() {
    if (!AppState.user) return null
    const { data, error } = await supabase
      .from('players').select('pawketpoints').eq('id', AppState.user.id).maybeSingle()
    if (error || !data) return null
    if (AppState.player) AppState.player.pawketpoints = data.pawketpoints
    return data.pawketpoints
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
      // Legacy logs ONLY awards (pp_logTransaction is called from awardPP,
      // which rejects any amount <= 0), so its "PP History" modal has never
      // shown a single purchase — even though the modal styles a red negative
      // row it can therefore never render. Spends are logged here so the panel
      // is what its title says it is.
      rollPPGlitch()
      ppHistoryService.log(-amount, reason, data)
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
      rollPPGlitch()
      ppHistoryService.log(-amount, reason, data)
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
      rollPPGlitch()
      ppHistoryService.log(delta, reason, data)
      return data
    }
    console.error('[adjustPoints] award_pp_secure RPC failed:', error && error.message)
    return null
  }
}

export const playerService = new PlayerService()
