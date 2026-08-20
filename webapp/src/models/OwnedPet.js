import { Pet } from './Pet.js'

export class OwnedPet {
  constructor(data = {}) {
    this.id = data.id || ''
    this.userId = data.user_id || ''
    this.petId = data.pet_id || ''
    this.nickname = data.nickname || ''
    this.level = data.level ?? 1
    this.xp = data.xp ?? 0
    this.hunger = data.hunger ?? 50
    this.energy = data.energy ?? 50
    this.happiness = data.happiness ?? 50
    this.max_hunger = data.max_hunger ?? 100
    this.max_energy = data.max_energy ?? 100
    this.max_happiness = data.max_happiness ?? 100
    this.last_fed = data.last_fed || null
    this.last_played = data.last_played || null
    this.adopted_at = data.adopted_at || null
    this.species = new Pet(data.pets || {})
  }

  get xpForNextLevel() {
    return this.level * 100
  }

  get canFeed() {
    return this.hunger < this.max_hunger
  }

  get canPlay() {
    return this.energy >= 10
  }
}
