import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { OwnedPet } from '../models/OwnedPet.js'
import { playerService } from './PlayerService.js'
import { inventoryService } from './InventoryService.js'
import { calculateEnergyRegen, calculateHungerDecay, calculateHappinessDecay, calculateLevelUp } from '../utils/PetStatMath.js'
import { containsProfanity } from '../utils/profanity.js'

class OwnedPetsService {
  async getOwnedPetIds(userId) {
    const owned = await supabase.from('user_pets').select('pet_id').eq('user_id', userId)
    AppState.ownedPetIds = owned.data ? owned.data.map(p => p.pet_id) : []
    return AppState.ownedPetIds
  }

  async getMyPets(userId) {
    const res = await supabase.from('user_pets')
      .select('*, pets(name, image_file, vtuber_name, twitch_url)')
      .eq('user_id', userId)
      .order('adopted_at', { ascending: true })
    if (res.error || !res.data) {
      AppState.ownedPets = []
      throw new Error('Could not load pets.')
    }
    AppState.ownedPets = res.data.map(pet => new OwnedPet({
      ...pet,
      energy: calculateEnergyRegen(pet.energy, pet.max_energy, pet.last_played),
      hunger: calculateHungerDecay(pet.hunger, pet.last_fed),
      happiness: calculateHappinessDecay(pet.happiness, pet.last_fed, pet.last_played)
    }))
    return AppState.ownedPets
  }

  // Ports saveNickname(), game.js:4171-4227 — the rename flow that lived
  // behind the pet card's edit button. Validation order and messages are kept
  // as they were; throwing lets the caller surface them through the toast
  // service instead of the service reaching for UI itself.
  async rename(pet, rawNickname) {
    const nickname = (rawNickname || '').trim()
    if (!nickname) throw new Error('Please enter a nickname!')
    if (nickname.length > 30) throw new Error('Nickname too long! (Max 30 characters)')
    if (/<\/?[a-z][\s\S]*>/i.test(nickname)) throw new Error('Nickname cannot contain HTML tags!')
    if (containsProfanity(nickname)) throw new Error('Please choose a family-friendly nickname!')

    const res = await supabase.from('user_pets')
      .update({ nickname })
      .eq('id', pet.id)
      .eq('user_id', AppState.user.id)
    if (res.error) throw new Error('Failed to update nickname')

    // Mutating the reactive model updates every view of this pet at once —
    // legacy had to call loadMyPets() to re-render the whole tab.
    pet.nickname = nickname
    return nickname
  }

  async adopt(pet, nickname, price) {
    const res = await supabase.from('user_pets').insert([{
      user_id: AppState.user.id, pet_id: pet.id, nickname,
      level: 1, xp: 0, hunger: 50, energy: 50, happiness: 50,
      max_hunger: 100, max_energy: 100, max_happiness: 100
    }])
    if (res.error) throw new Error(res.error.message)

    if (price > 0) {
      const newPoints = AppState.player.pawketpoints - price
      await supabase.from('players').update({ pawketpoints: newPoints }).eq('id', AppState.user.id)
      playerService.deductPoints(price)
    }

    try {
      await supabase.from('activity_feed').insert([{
        user_id: AppState.user.id,
        activity_type: 'pet_adopted',
        activity_data: { pet_name: nickname },
        is_public: true
      }])
    } catch (actErr) {
      console.log('Activity log error (non-critical):', actErr)
    }

    AppState.ownedPetIds.push(pet.id)
  }

  async feed(pet) {
    if (!pet.canFeed) return
    const nh = Math.min(pet.hunger + 20, pet.max_hunger)
    const nhap = Math.min(pet.happiness + 5, pet.max_happiness)
    const nxp = pet.xp + 10
    const lu = calculateLevelUp(nxp, pet.level, pet.max_hunger, pet.max_energy, pet.max_happiness)
    const updates = { hunger: nh, happiness: nhap, xp: lu.xp, level: lu.level, last_fed: new Date().toISOString() }
    if (lu.leveled) { updates.max_hunger = lu.maxHunger; updates.max_energy = lu.maxEnergy; updates.max_happiness = lu.maxHappiness }
    const res = await supabase.from('user_pets').update(updates).eq('id', pet.id)
    if (res.error) throw new Error(res.error.message)
    Object.assign(pet, updates)
    return lu
  }

  async play(pet) {
    if (!pet.canPlay) return
    const ne = Math.max(pet.energy - 10, 0)
    const nhap = Math.min(pet.happiness + 15, pet.max_happiness)
    const nxp = pet.xp + 15
    const lu = calculateLevelUp(nxp, pet.level, pet.max_hunger, pet.max_energy, pet.max_happiness)
    const updates = { energy: ne, happiness: nhap, xp: lu.xp, level: lu.level, last_played: new Date().toISOString() }
    if (lu.leveled) { updates.max_hunger = lu.maxHunger; updates.max_energy = lu.maxEnergy; updates.max_happiness = lu.maxHappiness }
    const res = await supabase.from('user_pets').update(updates).eq('id', pet.id)
    if (res.error) throw new Error(res.error.message)
    Object.assign(pet, updates)
    return lu
  }

  // Ports useOnPet(), game.js:7734-7827. Healing items (effect='healing'/
  // 'full_heal'/'revive') go through a direct HP update since use_item_secure
  // only covers hunger/energy/happiness/xp, not the current_hp column.
  // Everything else calls the secure RPC, which validates ownership,
  // applies effects, and decrements the inventory row server-side — so the
  // client only needs to mirror that decrement locally, not repeat it.
  async useItemOnPet(pet, invItem) {
    const isHealing = invItem.effect === 'healing' || invItem.effect === 'full_heal' || invItem.effect === 'revive'
    if (isHealing) {
      const healAmount = invItem.effectValue > 0 ? invItem.effectValue : 9999
      const petRow = await supabase.from('user_pets').select('current_hp, max_hp').eq('id', pet.id).maybeSingle()
      if (!petRow.data) throw new Error('Could not find pet.')
      const { current_hp: curHP, max_hp: maxHP } = petRow.data
      if (curHP >= maxHP) throw new Error('Pet is already at full HP!')
      const newHP = Math.min(curHP + healAmount, maxHP)
      const healed = newHP - curHP
      await supabase.from('user_pets').update({ current_hp: newHP }).eq('id', pet.id)
      await inventoryService.useItem(invItem)
      return { healed, currentHp: newHP, maxHp: maxHP }
    }

    const { data: ef, error } = await supabase.rpc('use_item_secure', { p_pet_id: pet.id, p_inv_id: invItem.invId })
    if (error) throw new Error(error.message)
    if (ef && ef.error) throw new Error(ef.error)

    const updates = {}
    if (ef.hunger !== undefined) updates.hunger = ef.hunger
    if (ef.energy !== undefined) updates.energy = ef.energy
    if (ef.happiness !== undefined) updates.happiness = ef.happiness
    if (ef.xp !== undefined) updates.xp = ef.xp
    if (ef.leveled_up && ef.new_level) updates.level = ef.new_level
    Object.assign(pet, updates)
    inventoryService.decrementLocal(invItem)

    return { reactionType: ef.reaction_type, leveledUp: !!ef.leveled_up, newLevel: ef.new_level }
  }
}

export const ownedPetsService = new OwnedPetsService()
