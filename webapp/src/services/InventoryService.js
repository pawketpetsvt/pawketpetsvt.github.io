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
    const itemsRes = await supabase.from('items').select('id, name, hunger_effect, energy_effect, happiness_effect, xp_effect').in('id', itemIds)
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
        xp: item.xp_effect
      })
    })
    return AppState.inventory
  }

  async useItem(invItem) {
    if (invItem.qty <= 1) {
      await supabase.from('user_inventory').delete().eq('id', invItem.invId)
      AppState.inventory = AppState.inventory.filter(i => i.invId !== invItem.invId)
    } else {
      await supabase.from('user_inventory').update({ quantity: invItem.qty - 1 }).eq('id', invItem.invId)
      const found = AppState.inventory.find(i => i.invId === invItem.invId)
      if (found) found.qty -= 1
    }
  }
}

export const inventoryService = new InventoryService()
