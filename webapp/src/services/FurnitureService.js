import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { ROOM_MAX_ITEMS, ROOM_VIBES } from '../data/roomData.js'

// Owns the furniture catalog, what the player owns of it, the Shop's Furniture
// tab, and the PET room system (`pet_rooms.furniture_list` + its daily happiness
// bonus). The PLAYER room — the Housing tab — is RoomService, which shares this
// catalog but nothing else.
export const furnitureState = reactive({
  catalog: [],     // furniture_items rows
  owned: [],       // user_furniture rows
  loaded: false
})

class FurnitureService {
  // The catalog is small and immutable, so it is fetched once per session.
  //
  // LEGACY BUG, resolved: room_load() ordered this same table by `price` while
  // furniture_loadShop() ordered it by `cost`. The column is `cost` (confirmed
  // against the live schema), so room_load()'s query returned an error and
  // cached an empty catalog every time — meaning **the Housing tab's player
  // room has never been able to display any furniture on the live site**, its
  // vibe score has always read 0, and none of its bonuses could ever appear.
  // The Furniture shop, which used the right column, worked fine.
  async loadCatalog(force = false) {
    if (furnitureState.catalog.length && !force) return furnitureState.catalog
    const res = await supabase.from('furniture_items').select('*').order('cost', { ascending: true })
    if (res.error) {
      console.error('[furnitureService.loadCatalog]', res.error)
      return []
    }
    furnitureState.catalog = res.data || []
    return furnitureState.catalog
  }

  priceOf(item) {
    return (item && item.cost) || 0
  }

  byId(id) {
    return furnitureState.catalog.find(f => f.id === id) || null
  }

  async loadOwned() {
    if (!AppState.user) { furnitureState.owned = []; return [] }
    const res = await supabase.from('user_furniture')
      .select('id, furniture_id, quantity')
      .eq('user_id', AppState.user.id)
    furnitureState.owned = res.error ? [] : (res.data || [])
    return furnitureState.owned
  }

  async load(force = false) {
    await Promise.all([this.loadCatalog(force), this.loadOwned()])
    furnitureState.loaded = true
  }

  ownsId(furnitureId) {
    return furnitureState.owned.some(o => o.furniture_id === furnitureId)
  }

  // The catalog rows the player owns, resolved to full items.
  ownedItems() {
    return furnitureState.owned
      .map(o => {
        const full = this.byId(o.furniture_id)
        return full ? { ...full, ownedId: o.id, quantity: o.quantity } : null
      })
      .filter(Boolean)
  }

  // Ports _furniture_buyCore(), including its refund-on-failure path: PP is
  // spent through the secure RPC first, and handed back if the grant fails, so
  // a failed insert can't quietly cost the player anything.
  async buy(item) {
    const cost = this.priceOf(item)
    const { playerService } = await import('./PlayerService.js')
    const remaining = await playerService.adjustPoints(-cost, 'furniture_purchase')
    if (remaining === null) throw new Error('Not enough PawketPoints!')

    const res = await supabase.from('user_furniture')
      .insert({ user_id: AppState.user.id, furniture_id: item.id, quantity: 1 })

    if (res.error) {
      await playerService.adjustPoints(cost, 'furniture_purchase_refund')
      // 23505 is a unique-violation: they already own it.
      throw new Error(res.error.code === '23505'
        ? 'You already own this furniture!'
        : 'Purchase failed: ' + res.error.message)
    }

    await this.loadOwned()
    return remaining
  }

  // ── pet rooms ─────────────────────────────────────────────────────────────
  // Ports furniture_openRoom()'s data half. A missing row is created rather than
  // treated as an error, matching legacy's insert-then-fall-back behaviour.
  async getPetRoom(petId) {
    const res = await supabase.from('pet_rooms').select('*').eq('pet_id', petId).maybeSingle()
    if (res.data) return res.data

    const created = await supabase.from('pet_rooms')
      .insert({ pet_id: petId, furniture_list: [] })
      .select()
      .maybeSingle()
    return created.data || { pet_id: petId, furniture_list: [] }
  }

  async setPetRoom(petId, list) {
    const res = await supabase.from('pet_rooms')
      .upsert({ pet_id: petId, furniture_list: list }, { onConflict: 'pet_id' })
    if (res.error) throw new Error('Could not update the room: ' + res.error.message)
  }

  async equipToPet(petId, list, furnitureId) {
    if (list.length >= ROOM_MAX_ITEMS) throw new Error(`Room is full! (max ${ROOM_MAX_ITEMS} items)`)
    if (list.includes(furnitureId)) return list
    const next = [...list, furnitureId]
    await this.setPetRoom(petId, next)
    return next
  }

  async unequipFromPet(petId, list, furnitureId) {
    const next = list.filter(id => id !== furnitureId)
    await this.setPetRoom(petId, next)
    return next
  }

  // Ports generateRoomDescription().
  describeRoom(petName, items) {
    if (!items || !items.length) {
      return `${petName}'s room is bare. Buy some furniture to make it cozy!`
    }
    const names = items.map(f => 'a ' + (f.name || '').toLowerCase())
    const list = names.length === 1
      ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
    return `${petName}'s room features ${list}. ${ROOM_VIBES[Math.floor(Math.random() * ROOM_VIBES.length)]}`
  }

  // Ports furniture_applyDailyBonus(). Runs once per day per pet: sums the
  // happiness bonus of everything in that pet's room and applies it through the
  // secure stat RPC, then stamps the date so it can't be claimed twice.
  async applyDailyBonus(petIds) {
    if (!AppState.user || !petIds || !petIds.length) return
    const today = new Date().toISOString().slice(0, 10)

    try {
      const res = await supabase.from('pet_rooms')
        .select('pet_id, furniture_list, last_bonus_date')
        .in('pet_id', petIds)
      const rooms = res.data || []
      if (!rooms.length) return

      await this.loadCatalog()

      for (const room of rooms) {
        if (room.last_bonus_date === today) continue
        const list = room.furniture_list || []
        if (!list.length) continue

        const bonus = list.reduce((sum, fid) => {
          const f = this.byId(fid)
          return sum + ((f && f.happiness_bonus) || 0)
        }, 0)
        if (bonus <= 0) continue

        const applied = await supabase.rpc('adjust_pet_stat_secure', {
          p_pet_id: room.pet_id, p_stat: 'happiness', p_delta: bonus, p_reason: 'furniture_daily_bonus'
        })
        if (applied.error) {
          console.error('[furnitureService] daily bonus failed:', applied.error)
          continue
        }

        const pet = (AppState.ownedPets || []).find(p => p.id === room.pet_id)
        if (pet && applied.data !== null && applied.data !== undefined) pet.happiness = applied.data

        await supabase.from('pet_rooms')
          .update({ last_bonus_date: today })
          .eq('pet_id', room.pet_id)

        const { toastService } = await import('./ToastService.js')
        toastService.success(`🏠 ${(pet && pet.nickname) || 'Your pet'} loved their room! +${bonus} happiness!`)
      }
    } catch (e) {
      console.error('[furnitureService.applyDailyBonus]', e)
    }
  }
}

export const furnitureService = new FurnitureService()
