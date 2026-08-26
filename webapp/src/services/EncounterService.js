import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { COOKING_RECIPES } from '../data/cookingData.js'
import { FLAVOR_BY_ZONE, FLAVOR_UNIVERSAL, ENCOUNTER_ODDS } from '../data/encounterData.js'

// Ports the random-encounter half of goExploring() (game.js:6818-7135).
//
// Exploring is NOT always a fight: 82% battle, 6% found item, 4% treasure,
// 3% recipe book, 5% flavour event. The non-battle outcomes are the reason
// exploring repeatedly feels varied, so they matter more than their odds
// suggest.
class EncounterService {
  // Ports the cumulative roll table.
  rollKind() {
    const roll = Math.random()
    for (const entry of ENCOUNTER_ODDS) {
      if (roll < entry.upTo) return entry.kind
    }
    return 'battle'
  }

  // Shared by the item and treasure encounters — both grant one item and some
  // PP, differing only in the price band they draw from.
  async grantItem(minPrice, maxPrice, ppMin, ppSpread, reason) {
    let query = supabase.from('items').select('*')
      .or('is_boss_drop.is.null,is_boss_drop.eq.false')
      .limit(20)
    query = maxPrice ? query.lte('price', maxPrice) : query.gte('price', minPrice)

    const res = await query
    const pool = res.data || []
    if (!pool.length) return null

    const item = pool[Math.floor(Math.random() * pool.length)]
    const pp = ppMin + Math.floor(Math.random() * (ppSpread + 1))

    // Stack onto an existing row rather than creating duplicates.
    const existing = await supabase.from('user_inventory').select('*')
      .eq('user_id', AppState.user.id).eq('item_id', item.id).maybeSingle()
    if (existing.data) {
      await supabase.from('user_inventory')
        .update({ quantity: existing.data.quantity + 1 }).eq('id', existing.data.id)
    } else {
      await supabase.from('user_inventory')
        .insert([{ user_id: AppState.user.id, item_id: item.id, quantity: 1 }])
    }

    await playerService.awardPoints(pp, reason)
    return { item, pp }
  }

  // Ports handleItemEncounter() — a common find (price ≤ 80), 10-20 PP.
  async itemEncounter() {
    const found = await this.grantItem(null, 80, 10, 10, 'item_found')
    if (!found) return null
    return {
      kind: 'item',
      title: '📦 Found an item!',
      body: `Your pet dug up a ${found.item.name}!`,
      reward: `+1 ${found.item.name} · +${found.pp} PP`
    }
  }

  // Ports handleTreasureEncounter() — a rarer find, 30-50 PP, with a 30%
  // chance of drawing from a higher price band still.
  async treasureEncounter() {
    const highRare = Math.random() < 0.3
    const found = await this.grantItem(highRare ? 100 : 50, null, 30, 20, 'treasure_found')
    if (!found) return this.itemEncounter()
    return {
      kind: 'treasure',
      title: '💎 Treasure!',
      body: `Something glinted in the undergrowth — a ${found.item.name}!`,
      reward: `+1 ${found.item.name} · +${found.pp} PP`
    }
  }

  // Ports handleRecipeBookEncounter() — teaches one undiscovered NON-secret
  // cooking recipe. Falls back to a flavour event when everything is known.
  async recipeEncounter(zone) {
    try {
      const known = await supabase.from('cooking_log')
        .select('recipe_id').eq('user_id', AppState.user.id)
      const knownIds = (known.data || []).map(r => r.recipe_id)

      const discoverable = COOKING_RECIPES.filter(r => !r.secret && !knownIds.includes(r.id))
      if (!discoverable.length) return this.flavorEncounter(zone)

      const recipe = discoverable[Math.floor(Math.random() * discoverable.length)]
      await supabase.from('cooking_log').insert([{
        user_id: AppState.user.id, recipe_id: recipe.id
      }])
      await playerService.awardPoints(25, 'recipe_book')

      return {
        kind: 'recipe',
        title: '📖 A weathered recipe book!',
        body: `Tucked inside was the recipe for ${recipe.emoji || '🍽️'} ${recipe.name}.`,
        reward: '+25 PP · Recipe learned'
      }
    } catch (e) {
      console.error('[encounterService.recipeEncounter]', e)
      return this.flavorEncounter(zone)
    }
  }

  // Ports handleFlavorEncounter() — a small moment that unlocks nothing, drawn
  // from the zone's own pool plus the universal one.
  async flavorEncounter(zone) {
    const pool = [...(FLAVOR_BY_ZONE[zone] || FLAVOR_BY_ZONE.outskirts), ...FLAVOR_UNIVERSAL]
    const event = pool[Math.floor(Math.random() * pool.length)]
    await playerService.awardPoints(event.pp, 'flavor_event')
    return {
      kind: 'flavor',
      title: `${event.emoji} Out in the ${this.zoneLabel(zone)}...`,
      body: event.text,
      note: '(Just a moment — nothing was unlocked.)',
      reward: `+${event.pp} PP`
    }
  }

  zoneLabel(zone) {
    return {
      outskirts: 'Outskirts', glade: 'Glade', deepwoods: 'Deep Woods',
      ruins: 'Ruins', hollow_warrens: 'Warrens', ashen_ruins: 'Ashen Ruins'
    }[zone] || 'Wild'
  }

  // Returns null when the roll says "battle", so the caller starts a fight.
  async roll(zone) {
    const kind = this.rollKind()
    if (kind === 'battle') return null
    if (kind === 'item') return this.itemEncounter()
    if (kind === 'treasure') return this.treasureEncounter()
    if (kind === 'recipe') return this.recipeEncounter(zone)
    return this.flavorEncounter(zone)
  }
}

export const encounterService = new EncounterService()
