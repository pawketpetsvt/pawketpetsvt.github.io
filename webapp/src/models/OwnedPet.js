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

    // Battle/cosmetic columns. These were omitted until the pet card was
    // brought up to parity — without them the card can't show combat stats,
    // the variant aura, the active title or unspent stat points, which is
    // exactly how those features went missing from the Vue version.
    this.base_hp = data.base_hp ?? null
    this.base_attack = data.base_attack ?? null
    this.base_defense = data.base_defense ?? null
    this.base_speed = data.base_speed ?? null
    this.current_hp = data.current_hp ?? null
    this.max_hp = data.max_hp ?? null
    this.bonus_attack = data.bonus_attack ?? 0
    this.bonus_defense = data.bonus_defense ?? 0
    this.bonus_speed = data.bonus_speed ?? 0
    this.bonus_hp = data.bonus_hp ?? 0
    this.stat_points = data.stat_points ?? 0
    this.current_variant = data.current_variant || null
    this.active_pet_title_id = data.active_pet_title_id || null

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
