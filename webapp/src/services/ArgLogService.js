import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { toastService } from './ToastService.js'
import { worldStateService } from './WorldStateService.js'
import { TESTER_LOGS, ARG_DROP_RATES } from '../data/argLogData.js'

// Ports the ARG lore-log layer (argLogs_*, game.js:36097-36280).
//
// Twenty diary entries from "Tester #7" drop at random from battles,
// expeditions and fishing. The Archive stays completely hidden until the first
// one is found — which is the whole point of it, so nothing here reveals its
// existence to a player who has none.
//
// This also fills BattleService's `archiveBonus()` seam, which has returned
// zeros since Phase 7.
export const argState = reactive({
  found: {},        // logId -> { found_at }
  loaded: false
})

// Combat bonuses granted by how much of the Archive is recovered. Ported from
// the `archiveBonus` reads in legacy's damage math.
const BONUS_PER_LOG = { dmgPct: 0.25, corruptedDmgPct: 0.5, healPct: 0.25 }

class ArgLogService {
  count() {
    return Object.keys(argState.found).length
  }

  has(logId) {
    return !!argState.found[logId]
  }

  // Nothing about the Archive is shown until the player owns at least one log.
  get revealed() {
    return this.count() > 0
  }

  async load() {
    argState.found = {}
    if (!AppState.user) return
    try {
      const res = await supabase
        .from('player_found_logs')
        .select('log_id, found_at')
        .eq('user_id', AppState.user.id)
      if (res.error) throw res.error
      for (const row of res.data || []) {
        argState.found[row.log_id] = { found_at: row.found_at }
      }
      argState.loaded = true
    } catch (e) {
      console.error('[argLogs] load failed:', e)
    }
  }

  // Ports argLogs_tryDrop(). `source` is 'battle' | 'expedition' | 'fishing' |
  // 'fishing_legendary'.
  async tryDrop(source) {
    if (!AppState.user) return null
    const rate = ARG_DROP_RATES[source] || 0.04
    if (Math.random() > rate) return null

    const base = source.replace('_legendary', '')
    let eligible = TESTER_LOGS.filter(l => !this.has(l.id) && l.sources.includes(base))
    if (!eligible.length && source === 'fishing_legendary') {
      eligible = TESTER_LOGS.filter(l => !this.has(l.id) && l.sources.includes('fishing'))
    }
    if (!eligible.length) return null

    const log = eligible[Math.floor(Math.random() * eligible.length)]

    try {
      const res = await supabase.from('player_found_logs')
        .insert({ user_id: AppState.user.id, log_id: log.id })
      // A duplicate means it was already found in another tab.
      if (res.error) return null
    } catch {
      return null
    }

    const wasFirst = this.count() === 0
    argState.found[log.id] = { found_at: new Date().toISOString() }
    const total = this.count()

    if (wasFirst) {
      toastService.info('You found something.')
      setTimeout(() => {
        toastService.info(`${log.id}: "${log.title}" has been added to the Archive. 📓`)
      }, 4500)
    } else {
      toastService.info(`Found: ${log.id}. Check the Archive. 📓`)
    }

    if (total === 10) {
      setTimeout(() => {
        toastService.info("...something is aware you've been reading the logs.")
      }, 8000)
    }
    if (total === TESTER_LOGS.length) {
      setTimeout(async () => {
        toastService.success("You've found all the logs. Tester #7 says nothing. But you feel like they know.")
        await playerService.awardPoints(500, 'archive_complete')
      }, 3000)
    }

    return log
  }

  // The Archive renders every log in order, with unfound ones redacted rather
  // than hidden — so the player can see how much is missing.
  entries() {
    return TESTER_LOGS.map(log => ({
      ...log,
      found: this.has(log.id),
      foundAt: argState.found[log.id] ? argState.found[log.id].found_at : null
    }))
  }

  // Beta Integrity below 40 (corruption above 60) glitches the Archive's
  // presentation, as legacy's `isCorrupted` flag does.
  isCorrupted() {
    return worldStateService.corruptionSync() > 60
  }

  // Fills BattleService.archiveBonus(). Scales with how many logs are held, so
  // a full Archive is worth +5% damage, +10% against corrupted enemies and +5%
  // healing.
  combatBonus() {
    const n = this.count()
    return {
      dmgPct: n * BONUS_PER_LOG.dmgPct,
      corruptedDmgPct: n * BONUS_PER_LOG.corruptedDmgPct,
      healPct: n * BONUS_PER_LOG.healPct
    }
  }
}

export const argLogService = new ArgLogService()
