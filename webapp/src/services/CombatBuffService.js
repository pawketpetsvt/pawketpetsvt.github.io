import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { COOKING_RECIPES } from '../data/cookingData.js'

// Ports the COMBAT BUFF SYSTEM block of game.js (combatBuff_load / _apply /
// _tick): the per-battle stat buffs the six secret cooking recipes grant.
//
// The Phase 7 port kept the read and the per-battle decrement but never the
// write, so `pet_combat_buffs` never received a row and the six dishes were
// ordinary food.
//
// One row per stat — { user_id, pet_id, recipe_id, stat, amount, battles_left }.
// A two-stat dish writes a row for each, with the stat appended to its
// recipe_id (`glitch_cookie_luck`), exactly as legacy does.
//
// The writes are client-side, as legacy's were. That is not a new exposure: the
// same battle flow already writes current_hp, xp, level and energy to user_pets
// from the client, so moving only this behind an RPC would not stop anyone.
class CombatBuffService {
  // The secret recipe an inventory item is, if any. Matched by name because the
  // items table has no recipe column — legacy's own rule.
  recipeFor(itemName) {
    const name = (itemName || '').toLowerCase()
    if (!name) return null
    return COOKING_RECIPES.find(r => r.combatBuff && r.name.toLowerCase() === name) || null
  }

  // Every buff on this pet with battles still left.
  async active(petId) {
    if (!AppState.user || !petId) return []
    const res = await supabase
      .from('pet_combat_buffs')
      .select('id, recipe_id, stat, amount, battles_left')
      .eq('user_id', AppState.user.id)
      .eq('pet_id', petId)
      .gt('battles_left', 0)
    if (res.error) {
      console.error('[combatBuffService.active]', res.error)
      return []
    }
    return res.data || []
  }

  // Ports combatBuff_apply(). Eating a dish whose buff is already running adds
  // its battles to what is left rather than stacking the bonus twice. Returns
  // the number of battles granted.
  async apply(petId, recipe) {
    const buff = recipe.combatBuff
    const battles = buff.battles || 5
    const rows = buff.stat === 'multi'
      ? (buff.bonuses || []).map(b => ({ recipe_id: `${recipe.id}_${b.stat}`, stat: b.stat, amount: b.amount }))
      : [{ recipe_id: recipe.id, stat: buff.stat, amount: buff.amount }]

    for (const row of rows) {
      const existing = await supabase
        .from('pet_combat_buffs')
        .select('id, battles_left')
        .eq('user_id', AppState.user.id)
        .eq('pet_id', petId)
        .eq('recipe_id', row.recipe_id)
        .maybeSingle()
      if (existing.error) throw existing.error

      const res = existing.data
        ? await supabase.from('pet_combat_buffs')
          .update({ battles_left: Math.max(0, existing.data.battles_left || 0) + battles })
          .eq('id', existing.data.id)
        : await supabase.from('pet_combat_buffs')
          .insert({ user_id: AppState.user.id, pet_id: petId, ...row, battles_left: battles })
      if (res.error) throw res.error
    }
    return battles
  }

  // Ports combatBuff_tick(). Every manual battle — won, lost or fled — uses one
  // charge of each buff, and a buff that runs out is deleted. The Phase 7 port
  // decremented but never deleted, which would have left spent rows at zero.
  async tick(petId) {
    for (const b of await this.active(petId)) {
      const left = (b.battles_left || 0) - 1
      const res = left <= 0
        ? await supabase.from('pet_combat_buffs').delete().eq('id', b.id)
        : await supabase.from('pet_combat_buffs').update({ battles_left: left }).eq('id', b.id)
      if (res.error) console.error('[combatBuffService.tick]', res.error)
    }
  }
}

export const combatBuffService = new CombatBuffService()
