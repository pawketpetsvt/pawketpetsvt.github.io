import { supabase } from './SupabaseService.js'
import * as badgeHooks from './BadgeHooks.js'
import { AppState } from '../AppState.js'
import { ShopItem } from '../models/ShopItem.js'
import { playerService } from './PlayerService.js'
import { inventoryService } from './InventoryService.js'
import { COOKING_INGREDIENTS, SHOP_STAPLE_INGREDIENT_IDS } from '../data/cookingData.js'
import { guildPerkService } from './GuildPerkService.js'

const SKIN_KEY_ID = '00000000-0000-0000-0000-000000000001'

// Ports loadShop()'s dedupe/categorize pipeline, game.js:7151-7252.
//
// The guild shop-discount perk IS applied as of Phase 9 (see effectivePrice
// below) — it was deferred here while Guild was unmigrated. Still out of scope,
// each still unmigrated: world events, mini-season stock, and world-state
// gating.
class ShopService {
  // What an item actually costs this player right now. Legacy applied the
  // guild discount in two separate places — once for the displayed price
  // (main:7318/7373) and again for the charged price (main:33221) — and the two
  // could disagree if a perk expired between render and click. One function
  // used by both means the number shown is always the number charged.
  effectivePrice(item, qty = 1) {
    const discount = guildPerkService.multiplier('discount')
    const unit = discount < 1 ? Math.floor(item.price * discount) : item.price
    return unit * qty
  }

  hasDiscount() {
    return guildPerkService.multiplier('discount') < 1
  }

  async getCatalog() {
    const res = await supabase.from('items').select('*')
      .or('is_boss_drop.is.null,is_boss_drop.eq.false')
      .neq('id', SKIN_KEY_ID)
      .neq('name', 'Skin Key')
      .neq('item_type', 'ingredient')
      .order('price', { ascending: true })
    if (res.error || !res.data) return { food: [], toys: [], energy: [], other: [] }

    const seen = new Map()
    res.data.forEach(item => {
      const key = item.name.toLowerCase().trim()
      const existing = seen.get(key)
      if (!existing || item.price < existing.price) seen.set(key, item)
    })

    const categories = { food: [], toys: [], energy: [], other: [] }
    Array.from(seen.values()).forEach(item => {
      const shopItem = new ShopItem(item)
      const isHealing = shopItem.effect === 'healing' || /heal|ointment|potion/i.test(shopItem.name)
      if (isHealing || shopItem.itemType === 'equipment') return // healing -> Consumables tab, equipment -> Battle phase
      if (shopItem.e > 0 && (shopItem.h === 0 || shopItem.e > shopItem.h)) categories.energy.push(shopItem)
      else if (shopItem.hap > 0 && (shopItem.h === 0 || shopItem.hap > shopItem.h)) categories.toys.push(shopItem)
      else if (shopItem.h > 0) categories.food.push(shopItem)
      else categories.other.push(shopItem)
    })

    // Deterministic daily rotation when there are more than 8 food items,
    // game.js:7246-7252 (date-seeded LCG so it's stable within a day).
    if (categories.food.length > 8) {
      const seed = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10)
      let s = seed
      const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296 }
      const shuffled = categories.food.slice()
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      categories.food = shuffled.slice(0, 8)
    }

    Object.keys(categories).forEach(key => categories[key].sort((a, b) => a.price - b.price))
    return categories
  }

  async getConsumables() {
    const res = await supabase.from('items').select('*')
      .eq('item_type', 'medicine')
      .or('is_boss_drop.is.null,is_boss_drop.eq.false')
      .order('price', { ascending: true })
    if (res.error || !res.data) return []
    return res.data.map(item => new ShopItem(item))
  }

  // The 5 shop-purchasable cooking staples (item_type='ingredient'). The
  // items table also holds item_type='ingredient' rows for fishing-only
  // ingredients (Shellfish, Seaweed, ...) — those aren't meant to be
  // purchasable at all, so this filters down to just the 5 real staples by
  // name rather than trusting item_type alone.
  async getIngredientStaples() {
    const res = await supabase.from('items').select('*').eq('item_type', 'ingredient').order('price', { ascending: true })
    if (res.error || !res.data) return []
    const stapleNames = SHOP_STAPLE_INGREDIENT_IDS.map(id => COOKING_INGREDIENTS[id].name.toLowerCase())
    return res.data.filter(item => stapleNames.includes(item.name.toLowerCase())).map(item => new ShopItem(item))
  }

  // Ports buyItem()/buyItemMulti(), game.js:7394-7446 — spends PP via the
  // secure RPC then grants the item(s) into user_inventory.
  async buyItem(item, qty = 1) {
    const total = this.effectivePrice(item, qty)
    const newTotal = await playerService.spendPoints(total, qty > 1 ? 'shop_buy_5x' : 'shop_purchase')
    if (newTotal === null) throw new Error('Purchase failed — not enough PP?')
    await inventoryService.grant(AppState.user.id, item.id, qty)
    badgeHooks.onPurchase(total)
    return newTotal
  }

  // Buys one of the 5 shop staples and grants it into user_ingredients
  // instead of user_inventory — finishes the "shop staples convert into
  // cooking ingredients" behavior game.js only ever left as a comment
  // (game.js:41500, "transferred to ingredients when used") with no actual
  // implementation.
  async buyStaple(item, qty = 1) {
    const ingredientId = SHOP_STAPLE_INGREDIENT_IDS.find(
      id => COOKING_INGREDIENTS[id].name.toLowerCase() === item.name.toLowerCase()
    )
    if (!ingredientId) throw new Error('Unrecognized staple: ' + item.name)
    const total = this.effectivePrice(item, qty)
    const newTotal = await playerService.spendPoints(total, 'cooking_staple_purchase')
    if (newTotal === null) throw new Error('Purchase failed — not enough PP?')
    const existing = await supabase.from('user_ingredients').select('quantity').eq('user_id', AppState.user.id).eq('ingredient_id', ingredientId).maybeSingle()
    const newQty = (existing.data ? existing.data.quantity : 0) + qty
    await supabase.from('user_ingredients').upsert(
      { user_id: AppState.user.id, ingredient_id: ingredientId, quantity: newQty, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,ingredient_id' }
    )
    return { newTotal, ingredientId, newQty }
  }
}

export const shopService = new ShopService()
