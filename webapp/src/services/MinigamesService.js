import { supabase } from './SupabaseService.js'
import { passService } from './PassService.js'
import { AppState } from '../AppState.js'
import { toastService } from './ToastService.js'
import { DAILY_COMPLETE_BONUS_PP } from '../data/minigamesData.js'
import { taskTracker } from './TaskTrackerService.js'
import { getCalendarBonus, todaysEvent } from '../utils/calendarBonus.js'

// Daily per-game claims are enforced server-side via claim_daily_secure
// (see supabase/migrations/2026-08-23_game_claims.sql) — the client no
// longer decides on its own whether today's reward has been claimed. This
// replaces an earlier localStorage-only gate (isCD/setCD) that mirrored
// game.js's own client-only check and could be bypassed entirely by
// clearing localStorage, replaying any minigame for real, persisted PP.
class MinigamesService {
  async _claimAndApply(rpcName, params, { silent = false } = {}) {
    const { data, error } = await supabase.rpc(rpcName, params)
    if (error) {
      if (!silent) console.error('[' + rpcName + ']', error.message)
      return null
    }
    if (AppState.player && data !== null && data !== undefined) AppState.player.pawketpoints = data
    return data
  }

  // Server-authoritative "already claimed today?" check, used up front so a
  // page can show the cooldown message before the player plays a whole
  // round only to be rejected when they try to claim the reward.
  async isOnCooldown(gameKey) {
    if (!AppState.user) return false
    const { data, error } = await supabase.rpc('has_claimed_daily', { p_game_key: gameKey })
    if (error) {
      console.error('[isOnCooldown]', error.message)
      return false
    }
    return !!data
  }

  // Claims today's reward for gameKey via the atomic server-side RPC, then
  // opportunistically attempts the "all 6 core games done today" bonus —
  // that attempt is silent (no console noise) since it's expected to fail
  // on every win except the 6th.
  async completeGame(gameKey, baseReward, reason) {
    if (!AppState.user || !gameKey) return
    const claimed = await this._claimAndApply('claim_daily_secure', { p_game_key: gameKey, p_amount: baseReward, p_reason: reason || gameKey })
    if (claimed === null) return

    taskTracker.report('complete_minigame')
    passService.addXP(3, 'minigame')

    // Minigame Monday: the calendar bonus is paid as EXTRA PP on top of what
    // the game already awarded, rather than by scaling the original claim —
    // legacy's own arrangement, and it keeps the claim RPC's amount honest.
    const mult = getCalendarBonus('minigame_pp')
    if (mult > 1 && baseReward > 0) {
      const extra = Math.floor(baseReward * (mult - 1))
      if (extra > 0) {
        const { playerService } = await import('./PlayerService.js')
        await playerService.awardPoints(extra, 'calendar_bonus')
        toastService.success(`🎮 ${todaysEvent().name}! +${extra} bonus PP!`)
      }
    }

    const bonus = await this._claimAndApply(
      'claim_daily_complete_bonus_secure',
      { p_amount: DAILY_COMPLETE_BONUS_PP, p_reason: 'daily_complete' },
      { silent: true }
    )
    if (bonus !== null) {
      toastService.success('🌟 Daily Complete! All minigames done! +' + DAILY_COMPLETE_BONUS_PP + ' PP bonus!')
    }
  }
}

export const minigamesService = new MinigamesService()
