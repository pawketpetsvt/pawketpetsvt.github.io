import { supabase } from './SupabaseService.js'

// Ports getActiveMiniSeasons() / getSeasonalWeekSlot() (game.js:6978-7015) —
// the seasonal shop rotation.
//
// A shop item may carry a `season_key` and a `season_week_slot` (1-4). It only
// appears while its season is running AND its slot matches the current week, so
// a season's stock cycles through four sets over a month. An item with no
// `season_key` is always eligible.
//
// This was the last deferral on ShopService.
const CACHE_MS = 300000

class MiniSeasonService {
  constructor() {
    this.cache = null
    this.fetchedAt = 0
  }

  // Several seasons can run at once by design — a short event layered over a
  // longer calendar season — so this returns an array.
  async active() {
    if (this.cache && Date.now() - this.fetchedAt < CACHE_MS) return this.cache
    try {
      const nowIso = new Date().toISOString()
      const res = await supabase
        .from('mini_seasons')
        .select('*')
        .eq('is_active', true)
        .lte('started_at', nowIso)
        .gte('ends_at', nowIso)
      this.cache = res.data || []
      this.fetchedAt = Date.now()
    } catch (e) {
      console.error('[miniSeasons] load failed:', e)
      this.cache = []
    }
    return this.cache
  }

  // A weekly 1-4 counter, deliberately separate from the shop's own A/B/C
  // rotation so the two can't interfere.
  weekSlot() {
    const weeks = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
    return (weeks % 4) + 1
  }

  // Filters a catalogue down to what should be on the shelves right now.
  async filterStock(items) {
    const seasons = await this.active()
    const keys = seasons.map(s => s.season_key)
    const slot = this.weekSlot()
    return items.filter(item => {
      if (!item.season_key) return true
      return keys.includes(item.season_key) && item.season_week_slot === slot
    })
  }
}

export const miniSeasonService = new MiniSeasonService()
