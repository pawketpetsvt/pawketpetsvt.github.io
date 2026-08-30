import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { InventoryItem } from '../models/InventoryItem.js'

class InventoryService {
  async getInventory(userId) {
    const invRes = await supabase.from('user_inventory').select('id, item_id, quantity').eq('user_id', userId).gt('quantity', 0)
    if (invRes.error || !invRes.data || !invRes.data.length) {
      AppState.inventory = []
      return AppState.inventory
    }
    const itemIds = invRes.data.map(r => r.item_id)
    const itemsRes = await supabase.from('items').select('id, name, item_type, image_url, food_category, hunger_effect, energy_effect, happiness_effect, xp_effect, effect, effect_value').in('id', itemIds)
    const itemMap = {}
    if (itemsRes.data) itemsRes.data.forEach(i => { itemMap[i.id] = i })
    AppState.inventory = invRes.data.map(row => {
      const item = itemMap[row.item_id] || {}
      return new InventoryItem({
        invId: row.id,
        itemId: row.item_id,
        name: item.name,
        qty: row.quantity,
        h: item.hunger_effect,
        e: item.energy_effect,
        hap: item.happiness_effect,
        xp: item.xp_effect,
        itemType: item.item_type,
        imageUrl: item.image_url,
        foodCategory: item.food_category,
        effect: item.effect,
        effectValue: item.effect_value
      })
    })
    return AppState.inventory
  }

  async useItem(invItem) {
    if (invItem.qty <= 1) {
      await supabase.from('user_inventory').delete().eq('id', invItem.invId)
    } else {
      await supabase.from('user_inventory').update({ quantity: invItem.qty - 1 }).eq('id', invItem.invId)
    }
    this.decrementLocal(invItem)
  }

  // Local-only mirror of the decrement useItem() performs in the DB — used
  // by the use_item_secure RPC path (OwnedPetsService.useItemOnPet), which
  // already decrements user_inventory server-side and would double-decrement
  // if this also hit the DB.
  decrementLocal(invItem) {
    if (invItem.qty <= 1) {
      AppState.inventory = AppState.inventory.filter(i => i.invId !== invItem.invId)
    } else {
      const found = AppState.inventory.find(i => i.invId === invItem.invId)
      if (found) found.qty -= 1
    }
  }

  // Grants a purchased/cooked item into the current inventory (shared by
  // ShopService.buyItem and CookingService.cook — both land dishes/items in
  // user_inventory the same way). Upserts by (user_id, item_id).
  async grant(userId, itemId, qty) {
    const existing = await supabase.from('user_inventory').select('id, quantity').eq('user_id', userId).eq('item_id', itemId).maybeSingle()
    if (existing.data) {
      await supabase.from('user_inventory').update({ quantity: existing.data.quantity + qty }).eq('id', existing.data.id)
    } else {
      await supabase.from('user_inventory').insert({ user_id: userId, item_id: itemId, quantity: qty })
    }
  }
}

export const inventoryService = new InventoryService()
