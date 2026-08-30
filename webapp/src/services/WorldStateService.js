import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { playerService } from './PlayerService.js'
import { AppState } from '../AppState.js'
import { toastService } from './ToastService.js'

// Ports the world-state flag layer (getWorldStateFlags / getWorldStateValue /
// performCorruptionRitual, game.js:7024-7150). One row per flag in
// `world_state_flags`, cached for a minute.
//
// `corruption_level` is the one that matters: it is shown on the Home page as
// **Beta Integrity** (inverted — high integrity is good), it weights Cursed Fog
// in the weather roll, and it gates Piper's Influence meter in battle. Until
// this existed, all three read a hardcoded default of 50.
export const worldState = reactive({
  flags: {},
  loaded: false
})

const CACHE_MS = 60000
const DEFAULT_CORRUPTION = 50

class WorldStateService {
  constructor() {
    this.fetchedAt = 0
    this.inflight = null
  }

  async loadFlags(force = false) {
    const now = Date.now()
    if (!force && worldState.loaded && now - this.fetchedAt < CACHE_MS) return worldState.flags
    // Collapse concurrent callers onto one request — the Today card, the
    // weather roll and a battle can all ask at once on a cold load.
    if (this.inflight) return this.inflight

    this.inflight = (async () => {
      try {
        const res = await supabase.from('world_state_flags').select('*')
        const flags = {}
        for (const row of res.data || []) {
          // Temporary flags (celebration buffs and the like) expire.
          if (row.expires_at && new Date(row.expires_at) < new Date()) continue
          flags[row.flag_key] = row
        }
        worldState.flags = flags
        this.fetchedAt = Date.now()
        worldState.loaded = true
      } catch (e) {
        console.error('[worldStateService.loadFlags]', e)
      } finally {
        this.inflight = null
      }
      return worldState.flags
    })()

    return this.inflight
  }

  async value(flagKey, fallback) {
    const flags = await this.loadFlags()
    const row = flags[flagKey]
    return row && typeof row.value === 'number' ? row.value : fallback
  }

  // Cache-only read, for callers that can't await — the weather roll needs a
  // number synchronously, and a slightly stale one is fine there.
  valueSync(flagKey, fallback) {
    const row = worldState.flags[flagKey]
    return row && typeof row.value === 'number' ? row.value : fallback
  }

  corruptionSync() {
    return this.valueSync('corruption_level', DEFAULT_CORRUPTION)
  }

  async corruption() {
    return this.value('corruption_level', DEFAULT_CORRUPTION)
  }

  // Beta Integrity is corruption inverted, which is what the UI shows.
  integrityFrom(corruption) {
    return Math.round(100 - corruption)
  }

  describeIntegrity(integrity) {
    if (integrity >= 75) return 'The beta is running stable. Integrity is high.'
    if (integrity >= 50) return 'The beta is holding together, thanks to recent boss defeats.'
    if (integrity >= 25) return 'The beta feels a little more stable today, thanks to recent boss kills.'
    return 'Critical instability detected. The beta is failing. Defeat bosses to restore integrity.'
  }

  // Ports performCorruptionRitual(). The RPC owns the cost and the size of the
  // shift, so the client only names a direction.
  async performRitual(direction) {
    if (!AppState.user) return null
    try {
      const res = await supabase.rpc('perform_corruption_ritual', { p_direction: direction })
      if (res.error || !res.data || res.data.error) {
        toastService.error((res.data && res.data.error) || 'The ritual failed')
        return null
      }
      const data = res.data

      // The ritual's cost is taken inside the RPC. Logged from the actual
      // difference rather than an assumed price, since the RPC owns the figure.
      const before = (AppState.player && AppState.player.pawketpoints) || 0
      if (typeof data.new_pp === 'number') {
        await playerService.noteExternalSpend(
          Math.max(0, before - data.new_pp), 'corruption_ritual', data.new_pp
        )
      }
      // Force a fresh read so every reader reflects the new value.
      await this.loadFlags(true)

      const integrity = this.integrityFrom(data.new_value)
      toastService.success(
        (direction === 'purify'
          ? '🛠️ You debugged the beta a little! Integrity restored.'
          : '💀 You broke the beta further! Integrity decreased.') +
        ` Beta Integrity is now ${integrity}%.`
      )
      return integrity
    } catch (e) {
      console.error('[worldStateService.performRitual]', e)
      toastService.error('The ritual failed')
      return null
    }
  }
}

export const worldStateService = new WorldStateService()
