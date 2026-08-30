import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { awardService } from './AwardService.js'
import { COSMETICS_CATALOG } from '../data/cosmeticsData.js'

// Ports the cosmetic UNLOCK half of the Phase 1 cosmetics system
// (phase1_loadUnlockedCosmetics / phase1_unlockCosmetic, game.js:36820-36900).
//
// Phase 6 built the equip panel and persisted the equipped selection, but the
// unlock state was left deferred — so the panel could only ever offer the
// `alwaysUnlocked` catalogue entries, and every earned background, frame and
// badge pip showed permanently locked with its hint. This is the table behind
// those hints: `unlocked_cosmetics(user_id, cosmetic_type, cosmetic_id)`.
export const cosmeticUnlockState = reactive({
  background: [],
  frame: [],
  badge: [],
  loaded: false
})

const TYPES = ['background', 'frame', 'badge']

class CosmeticUnlockService {
  async load() {
    if (!AppState.user) return
    try {
      const { data, error } = await supabase
        .from('unlocked_cosmetics')
        .select('cosmetic_type, cosmetic_id')
        .eq('user_id', AppState.user.id)
      if (error) throw error
      for (const t of TYPES) {
        cosmeticUnlockState[t] = (data || [])
          .filter(c => c.cosmetic_type === t)
          .map(c => c.cosmetic_id)
      }
      cosmeticUnlockState.loaded = true
    } catch (e) {
      console.error('[cosmetics] unlock load failed:', e)
    }
  }

  // Ports cosmetics_isOwned(). `alwaysUnlocked` catalogue entries need no row.
  isOwned(type, id) {
    const catalog = COSMETICS_CATALOG[type + 's'] || []
    const item = catalog.find(c => c.id === id)
    if (!item) return false
    if (item.alwaysUnlocked) return true
    return (cosmeticUnlockState[type] || []).includes(id)
  }

  // Ports phase1_unlockCosmetic(). Returns true only when this call is what
  // unlocked it, so a caller can decide whether to celebrate.
  async unlock(type, cosmeticId) {
    if (!AppState.user || !type || !cosmeticId) return false
    if ((cosmeticUnlockState[type] || []).includes(cosmeticId)) return false

    try {
      const { error } = await supabase.from('unlocked_cosmetics').insert({
        user_id: AppState.user.id,
        cosmetic_type: type,
        cosmetic_id: cosmeticId
      })
      // A duplicate means someone else's request got there first — not a
      // failure, and definitely not a reason to celebrate twice.
      if (error && error.code === '23505') return false
      if (error) throw error

      if (!cosmeticUnlockState[type]) cosmeticUnlockState[type] = []
      cosmeticUnlockState[type].push(cosmeticId)

      const catalog = COSMETICS_CATALOG[type + 's'] || []
      const item = catalog.find(c => c.id === cosmeticId)
      awardService.celebrate({
        kind: 'cosmetic',
        name: item ? item.name : cosmeticId,
        emoji: (item && item.emoji) || '✨',
        detail: type === 'background' ? 'Profile background'
          : type === 'frame' ? 'Avatar frame' : 'Profile badge'
      })
      return true
    } catch (e) {
      console.error('[cosmetics] unlock failed:', e)
      return false
    }
  }

}

export const cosmeticUnlockService = new CosmeticUnlockService()
