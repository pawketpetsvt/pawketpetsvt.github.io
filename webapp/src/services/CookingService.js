import { supabase } from './SupabaseService.js'
import { passService } from './PassService.js'
import * as badgeHooks from './BadgeHooks.js'
import { inventoryService } from './InventoryService.js'
import { COOKING_RECIPES, COOKING_INGREDIENTS } from '../data/cookingData.js'
import { taskTracker } from './TaskTrackerService.js'

// Ports the Cooking system, game.js:41761-42118. Ingredient drop rolls from
// Battle/Fishing/Expedition (COOKING_DROP_TABLES) aren't ported — those
// systems don't exist yet, so ingredients only enter play via
// ShopService.buyStaple(). Badges, Bingo, weekly-challenge and PawketPass-XP
// side effects are skipped for the same reason (their systems aren't
// migrated); the discovery-flash moment and the Piper's Broth flavor toast
// are kept since they're pure client-side flavor with no cross-system
// dependency.
class CookingService {
  async loadIngredients(userId) {
    const { data } = await supabase.from('user_ingredients').select('ingredient_id, quantity').eq('user_id', userId)
    const map = {}
    ;(data || []).forEach(r => { map[r.ingredient_id] = r.quantity || 0 })
    return map
  }

  async loadDiscoveredRecipes(userId) {
    const { data } = await supabase.from('cooking_log').select('recipe_id').eq('user_id', userId)
    const map = {}
    ;(data || []).forEach(r => { map[r.recipe_id] = true })
    return map
  }

  // Order-independent match against the filled slot contents, game.js:41864-41875.
  matchRecipe(ingredientIds) {
    if (!ingredientIds.length) return null
    const sorted = ingredientIds.slice().sort()
    return COOKING_RECIPES.find(recipe => {
      const rSorted = recipe.ingredients.slice().sort()
      return rSorted.length === sorted.length && rSorted.join(',') === sorted.join(',')
    }) || null
  }

  // Full cook transaction, game.js:41902-42048. Mutates ingredientsMap and
  // discoveredMap in place (same in-place-mutation convention as
  // InventoryService.decrementLocal) so the caller's reactive state updates
  // without a full reload. Throws on failure with a user-facing message.
  async cook(userId, ingredientIds, multiCount, ingredientsMap, discoveredMap) {
    const match = this.matchRecipe(ingredientIds)
    if (!match) throw new Error("Unknown recipe... these ingredients don't seem to go together.")

    const needed = {}
    ingredientIds.forEach(id => { needed[id] = (needed[id] || 0) + 1 })
    for (const id in needed) {
      const have = ingredientsMap[id] || 0
      const need = needed[id] * multiCount
      if (have < need) {
        const name = COOKING_INGREDIENTS[id] ? COOKING_INGREDIENTS[id].name : id
        throw new Error(`Not enough ${name} for ${multiCount}x! (need ${need}, have ${have})`)
      }
    }

    for (const id in needed) {
      const deduct = needed[id] * multiCount
      ingredientsMap[id] = Math.max(0, (ingredientsMap[id] || 0) - deduct)
      await supabase.from('user_ingredients').upsert(
        { user_id: userId, ingredient_id: id, quantity: ingredientsMap[id], updated_at: new Date().toISOString() },
        { onConflict: 'user_id,ingredient_id' }
      )
    }

    try {
      const itemRow = await supabase.from('items').select('id, name').ilike('name', match.name).maybeSingle()
      if (itemRow.data) await inventoryService.grant(userId, itemRow.data.id, multiCount)
    } catch (err) {
      console.error('[Cooking] Item grant error (non-fatal):', err)
    }

    const isNewDiscovery = !discoveredMap[match.id]
    if (isNewDiscovery) {
      discoveredMap[match.id] = true
      await supabase.from('cooking_log').upsert(
        { user_id: userId, recipe_id: match.id, times_cooked: multiCount, first_cooked: new Date().toISOString() },
        { onConflict: 'user_id,recipe_id' }
      )
    } else {
      const logRow = await supabase.from('cooking_log').select('times_cooked').eq('user_id', userId).eq('recipe_id', match.id).maybeSingle()
      if (logRow.data) {
        await supabase.from('cooking_log').update({ times_cooked: (logRow.data.times_cooked || 1) + multiCount }).eq('user_id', userId).eq('recipe_id', match.id)
      }
    }

    taskTracker.report('cook_meal')
    // Total dishes cooked = the sum of times_cooked across the log, which is
    // what legacy's cook_10 / cook_50 thresholds count.
    badgeHooks.onCook({ totalCooked: await this.totalCooked(userId), recipeId: match.id })
    // 3 XP per dish in the batch, capped at 30 (main:42017).
    passService.addXP(Math.min(multiCount * 3, 30), 'cooking')
    return { recipe: match, isNewDiscovery }
  }

  // How many dishes this player has cooked in total, summed across the log.
  // Used only by the cooking badge thresholds.
  async totalCooked(userId) {
    const { data } = await supabase
      .from('cooking_log').select('times_cooked').eq('user_id', userId)
    return (data || []).reduce((s, r) => s + (r.times_cooked || 0), 0)
  }

  // Grants an ingredient outside of a purchase — used by FishingService for
  // catch-drop ingredients (fresh_salmon/fresh_cod/shellfish/seaweed).
  // Ports cooking_awardIngredient(), game.js:42151-42171. Mutates
  // ingredientsMap in place, same convention as cook().
  async awardIngredient(userId, ingredientId, qty, ingredientsMap) {
    if (!COOKING_INGREDIENTS[ingredientId]) return
    const newQty = (ingredientsMap[ingredientId] || 0) + qty
    ingredientsMap[ingredientId] = newQty
    await supabase.from('user_ingredients').upsert(
      { user_id: userId, ingredient_id: ingredientId, quantity: newQty, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,ingredient_id' }
    )
  }
}

export const cookingService = new CookingService()
