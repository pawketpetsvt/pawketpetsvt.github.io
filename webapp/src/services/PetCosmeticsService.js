import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { PET_VARIANTS } from '../data/petCardData.js'

// Owns the three cosmetic layers on a pet card that aren't gear:
// pet titles, variants (skins), and which pet is the active companion.
//
// Ports getPetTitleDisplay()/renderPetTitleSelector() (game.js:21527-21717),
// the skinkey variant accessors, and CompanionBuddy.setCompanion().
export const cosmeticsState = reactive({
  allTitles: [],          // every pet title that exists
  unlockedByPet: {},      // petId -> [titleId]
  companionPetId: null,
  loaded: false
})

const RARITY_COLORS = {
  common: '#8e8e8e',
  uncommon: '#5cb85c',
  rare: '#5bc0de',
  epic: '#9c27b0',
  legendary: '#ff9800'
}

class PetCosmeticsService {
  // Loaded once per session — the catalogue is static and the unlock rows are
  // small, so per-card fetches would be pure overhead.
  async load(userId) {
    if (cosmeticsState.loaded) return
    try {
      const [titlesRes, unlockedRes] = await Promise.all([
        supabase.from('pet_titles').select('*'),
        supabase.from('user_pet_titles').select('*').eq('user_id', userId)
      ])
      cosmeticsState.allTitles = titlesRes.data || []

      const map = {}
      for (const row of unlockedRes.data || []) {
        (map[row.pet_id] ||= []).push(row.title_id)
      }
      cosmeticsState.unlockedByPet = map
      cosmeticsState.loaded = true
    } catch (e) {
      console.error('[petCosmeticsService.load]', e)
      // An empty catalogue degrades to "No Title" rather than breaking cards.
      cosmeticsState.loaded = true
    }
  }

  titleById(id) {
    return cosmeticsState.allTitles.find(t => t.id === id) || null
  }

  rarityColor(rarity) {
    return RARITY_COLORS[rarity] || RARITY_COLORS.common
  }

  // Titles this pet has actually unlocked, for the selector.
  unlockedTitles(petId) {
    const ids = cosmeticsState.unlockedByPet[petId] || []
    return cosmeticsState.allTitles.filter(t => ids.includes(t.id))
  }

  // Locked ones are still listed, showing their unlock condition — that's how
  // the legacy selector teaches players what's obtainable.
  lockedTitles(petId) {
    const ids = cosmeticsState.unlockedByPet[petId] || []
    return cosmeticsState.allTitles.filter(t => !ids.includes(t.id))
  }

  async setTitle(petId, titleId) {
    const res = await supabase.from('user_pets')
      .update({ active_pet_title_id: titleId || null })
      .eq('id', petId)
      .eq('user_id', AppState.user.id)
    if (res.error) throw new Error('Could not change the pet title.')
  }

  // ── variants ──────────────────────────────────────────────────────────────
  variantData(key) {
    return key ? (PET_VARIANTS[key] || null) : null
  }

  // Ports getPetVariantClass() — the CSS hook that paints the card's aura.
  variantClass(key) {
    return key ? 'pet-variant-' + key : ''
  }

  async setVariant(petId, variantKey) {
    const res = await supabase.from('user_pets')
      .update({ current_variant: variantKey || null })
      .eq('id', petId)
      .eq('user_id', AppState.user.id)
    if (res.error) throw new Error('Could not change the variant.')
  }

  // ── companion ─────────────────────────────────────────────────────────────
  // Ports CompanionBuddy.setCompanion(). The active companion is stored on the
  // player, not the pet, since only one can be active at a time.
  async setCompanion(petId) {
    const res = await supabase.from('players')
      .update({ companion_pet_id: petId })
      .eq('id', AppState.user.id)
    if (res.error) throw new Error('Could not set the companion.')
    cosmeticsState.companionPetId = petId
  }

  async loadCompanion(userId) {
    try {
      const res = await supabase.from('players')
        .select('companion_pet_id').eq('id', userId).maybeSingle()
      cosmeticsState.companionPetId = res.data?.companion_pet_id || null
    } catch (e) {
      cosmeticsState.companionPetId = null
    }
  }
}

export const petCosmeticsService = new PetCosmeticsService()
