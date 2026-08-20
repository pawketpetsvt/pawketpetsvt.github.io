import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { OwnedPet } from '../models/OwnedPet.js'
import { playerService } from './PlayerService.js'
import { calculateEnergyRegen, calculateHungerDecay, calculateHappinessDecay, calculateLevelUp } from '../utils/PetStatMath.js'

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

  async useItem(pet, invItem) {
    const updates = {}
    if (invItem.h > 0) updates.hunger = Math.min(pet.hunger + invItem.h, pet.max_hunger)
    if (invItem.e > 0) updates.energy = Math.min(pet.energy + invItem.e, pet.max_energy)
    if (invItem.hap > 0) updates.happiness = Math.min(pet.happiness + invItem.hap, pet.max_happiness)
    if (invItem.xp > 0) updates.xp = pet.xp + invItem.xp
    if (!Object.keys(updates).length) throw new Error('This item has no effects yet.')
    const res = await supabase.from('user_pets').update(updates).eq('id', pet.id)
    if (res.error) throw new Error(res.error.message)
    Object.assign(pet, updates)
  }
}

export const ownedPetsService = new OwnedPetsService()
