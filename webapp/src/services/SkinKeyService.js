import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { BASIC_VARIANTS } from '../data/petCardData.js'

// Ports the skin-key system (game.js:14171-14580) — the currency that unlocks
// pet variants, and the `unlocked_variants` table recording which pet owns which.
//
// This is what the Variant modal has been missing: without it, "unlocked" could
// only ever mean "the variant this pet already has applied", so the modal could
// show the catalogue but never let anyone acquire anything from it.
//
// Variants in SPECIAL_VARIANTS are collab/guest skins granted outside the key
// economy (Twitch channel-point redemptions and the like), so they bypass the
// unlock check entirely — legacy's own carve-out.
export const SPECIAL_VARIANTS = [
  'emi', 'numi', 'tob', 'shondo', 'merry', 'vienna', 'lily', 'sleepy',
  'cottontail', 'yuno', 'susu', 'sinder', 'snuffy', 'bat', 'zen', 'bao'
]

export const skinKeyState = reactive({
  keys: 0,
  // { [userPetId]: variantId[] }
  unlocked: {},
  loaded: false
})

class SkinKeyService {
  async load() {
    if (!AppState.user) return
    try {
      const { data: player } = await supabase
        .from('players').select('skin_keys').eq('id', AppState.user.id).maybeSingle()
      skinKeyState.keys = (player && player.skin_keys) || 0

      // Legacy read pet ids off its in-memory `petState`, so opening a variant
      // picker before visiting My Pets loaded no unlocks at all. Queried here.
      const { data: pets } = await supabase
        .from('user_pets').select('id').eq('user_id', AppState.user.id)
      const petIds = (pets || []).map(p => p.id)
      if (!petIds.length) { skinKeyState.loaded = true; return }

      const { data: rows } = await supabase
        .from('unlocked_variants').select('user_pet_id, variant_id').in('user_pet_id', petIds)

      const map = {}
      ;(rows || []).forEach(r => {
        ;(map[r.user_pet_id] = map[r.user_pet_id] || []).push(r.variant_id)
      })
      skinKeyState.unlocked = map
      skinKeyState.loaded = true
    } catch (e) {
      console.error('[skinKeys] load failed:', e)
      skinKeyState.loaded = true
    }
  }

  isUnlocked(petId, variantId) {
    if (SPECIAL_VARIANTS.includes(variantId)) return true
    const list = skinKeyState.unlocked[petId]
    return !!list && list.includes(variantId)
  }

  cost(variantId) {
    const v = BASIC_VARIANTS[variantId]
    return v ? (v.cost || 1) : 1
  }

  // Ports skinkey_unlockVariant(). Spends keys through the secure RPC, records
  // the unlock, and refunds if the record fails.
  async unlock(petId, variantId) {
    if (!AppState.user) throw new Error('Please log in first')
    if (!BASIC_VARIANTS[variantId]) throw new Error('Invalid variant')
    if (this.isUnlocked(petId, variantId)) throw new Error('Variant already unlocked!')

    const cost = this.cost(variantId)
    if (skinKeyState.keys < cost) throw new Error(`Not enough Skin Keys! Need ${cost}`)

    const { data: spend, error: spendErr } = await supabase.rpc('spend_skin_key_secure', {
      p_amount: cost, p_reason: 'variant_unlock_' + variantId
    })
    if (spendErr) throw new Error(spendErr.message)
    if (spend && spend.error) throw new Error(spend.error)

    const { error: unlockErr } = await supabase.from('unlocked_variants')
      .insert({ user_pet_id: petId, variant_id: variantId })
    if (unlockErr) {
      await supabase.rpc('award_skin_key_secure', {
        p_amount: cost, p_reason: 'variant_unlock_refund'
      }).then(null, () => {})
      throw new Error('Failed to unlock variant')
    }

    // LEGACY BUG: it assigned the server's authoritative balance and THEN
    // subtracted the cost again —
    //     if (spendResult.skin_keys !== undefined) skinKeyState.keys = spendResult.skin_keys
    //     skinKeyState.keys -= cost
    // — so the on-screen key count read `cost` too low after every unlock, and
    // nothing re-fetched it on that path. Taking the server value alone.
    if (spend && spend.skin_keys !== undefined) skinKeyState.keys = spend.skin_keys
    else skinKeyState.keys = Math.max(0, skinKeyState.keys - cost)

    ;(skinKeyState.unlocked[petId] = skinKeyState.unlocked[petId] || []).push(variantId)
    return BASIC_VARIANTS[variantId]
  }

  // Ports skinkey_grantKeys(). Used by the referral milestones and the Pass.
  async grant(amount, reason) {
    if (!AppState.user || !(amount > 0)) return false
    try {
      const { data, error } = await supabase.rpc('award_skin_key_secure', {
        p_amount: amount, p_reason: reason || 'award'
      })
      if (error) throw error
      if (data && data.error) throw new Error(data.error)
      skinKeyState.keys = (data && data.skin_keys !== undefined)
        ? data.skin_keys
        : skinKeyState.keys + amount
      return true
    } catch (e) {
      console.error('[skinKeys] grant failed:', e)
      return false
    }
  }
}

export const skinKeyService = new SkinKeyService()
