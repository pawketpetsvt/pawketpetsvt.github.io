import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { evolutionStage, evolutionBonuses, skillLoadout, passiveSkills } from '../utils/petSkills.js'
import { BATTLE_CONSTANTS } from '../data/battleData.js'

// Owns equipment I/O and the battle-ready stat calculation that depends on it.
// Ports calculatePetStats() (game.js:6309-6473) plus the equipment queries
// around it.
class EquipmentService {
  // All equipment the player owns, with its catalog row.
  async getOwned() {
    const res = await supabase
      .from('player_equipment')
      .select('*, equipment(*)')
      .eq('user_id', AppState.user.id)
    if (res.error) {
      console.error('[equipmentService.getOwned]', res.error)
      return []
    }
    return res.data || []
  }

  // What this specific pet currently has equipped.
  async getEquippedFor(petId) {
    const res = await supabase
      .from('player_equipment')
      .select('*, equipment(*)')
      .eq('user_id', AppState.user.id)
      .eq('pet_id', petId)
      .eq('is_equipped', true)
    if (res.error) {
      console.error('[equipmentService.getEquippedFor]', res.error)
      return []
    }
    return res.data || []
  }

  // Ports getCurrentRotationWeek() — the shop cycles A/B/C weekly, so which
  // gear is buyable depends on the week.
  currentRotationWeek() {
    const weeks = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
    return ['A', 'B', 'C'][weeks % 3]
  }

  // Ports loadEquipmentShop() (game.js:24447+) — the Shop's Equipment tab,
  // deferred out of Phase 3 because equipment had no consumer until Battle.
  //
  // Deliberately NOT applied, consistent with the same deferral already
  // documented in ShopService: mini-season stock and world-state corruption
  // gating, both of which belong to unmigrated systems. This returns the
  // regular weekly rotation, which is what a player sees today with corruption
  // at its default.
  async getShopStock(filter = 'all') {
    const res = await supabase
      .from('equipment')
      .select('*')
      .eq('rotation_week', this.currentRotationWeek())
      .order('tier', { ascending: true })
      .order('weight_class', { ascending: true })
    if (res.error) {
      console.error('[equipmentService.getShopStock]', res.error)
      return []
    }
    const stock = res.data || []
    if (!filter || filter === 'all') return stock
    return stock.filter(e => (e.slot || e.equipment_type || e.weight_class) === filter)
  }

  // Ports _buyEquipmentCore(). Price is charged through `spend_pp_secure` so it
  // can't be manipulated client-side, then the row lands unequipped.
  async buy(item) {
    const { playerService } = await import('./PlayerService.js')
    const remaining = await playerService.spendPoints(item.price, 'equipment_purchase')
    if (remaining === null) throw new Error('Not enough PawketPoints!')

    const res = await supabase.from('player_equipment').insert([{
      user_id: AppState.user.id,
      equipment_id: item.id,
      quantity: 1,
      is_equipped: false,
      pet_id: null
    }])
    if (res.error) throw new Error('Purchase failed!')
    return remaining
  }

  // Everything the player owns that isn't currently equipped anywhere — the
  // pool the equip modal offers.
  async getUnequipped() {
    const res = await supabase
      .from('player_equipment')
      .select('*, equipment(*)')
      .eq('user_id', AppState.user.id)
      .eq('is_equipped', false)
    if (res.error) {
      console.error('[equipmentService.getUnequipped]', res.error)
      return []
    }
    return res.data || []
  }

  // A pet's two slots, keyed by `equipped_slot`. Ports loadPetEquipment().
  async getSlots(petId) {
    const rows = await this.getEquippedFor(petId)
    const slots = { weapon: null, armor: null }
    for (const row of rows) {
      if (row.equipped_slot === 'weapon') slots.weapon = row
      else if (row.equipped_slot === 'armor') slots.armor = row
    }
    return slots
  }

  // Minimum pet level for a gear tier. Ports GAME_CONSTANTS.EQUIP_TIER_MIN_LEVEL.
  tierMinLevel(tier) {
    return BATTLE_CONSTANTS.EQUIP_TIER_MIN_LEVEL[tier] || 1
  }

  // Ports equipItem(). Slots are exclusive per pet, so whatever occupies the
  // target slot is cleared first. The tier/level gate is re-checked here rather
  // than trusted from the UI, matching legacy's own "even if UI was bypassed"
  // comment.
  async equip(row, slot, pet) {
    const tier = (row.equipment && row.equipment.tier) || 1
    const minLevel = this.tierMinLevel(tier)
    if ((pet.level || 1) < minLevel) {
      throw new Error(`This pet needs to be level ${minLevel} to equip Tier ${tier} gear!`)
    }

    await supabase.from('player_equipment')
      .update({ is_equipped: false, equipped_slot: null, pet_id: null })
      .eq('user_id', AppState.user.id)
      .eq('pet_id', pet.id)
      .eq('equipped_slot', slot)

    const res = await supabase.from('player_equipment')
      .update({ is_equipped: true, equipped_slot: slot, pet_id: pet.id })
      .eq('id', row.id)
    if (res.error) throw new Error('Could not equip that item.')
  }

  // Ports unequipItem() — clears whatever is in that slot for this pet.
  async unequip(slot, petId) {
    const res = await supabase.from('player_equipment')
      .update({ is_equipped: false, equipped_slot: null, pet_id: null })
      .eq('user_id', AppState.user.id)
      .eq('pet_id', petId)
      .eq('equipped_slot', slot)
    if (res.error) throw new Error('Could not unequip that item.')
  }

  // Total Spirit across everything equipped. Spirit lowers the Piper encounter
  // rate, so the battle service asks for it before rolling an encounter.
  async getTotalSpirit() {
    const res = await supabase
      .from('player_equipment')
      .select('equipment(spirit_bonus)')
      .eq('user_id', AppState.user.id)
      .eq('is_equipped', true)
    if (res.error || !res.data) return 0
    return res.data.reduce((sum, e) => sum + ((e.equipment && e.equipment.spirit_bonus) || 0), 0)
  }

  // Ports calculatePetStats(). Builds the combat-ready snapshot of a pet:
  // base stats + evolution bonuses + per-level growth + equipment + allocated
  // stat points + cooking combat buffs.
  //
  // Deliberately NOT ported: the guild furniture buff block. Legacy guards it
  // with `typeof guild_getFurnitureBuffs === 'function'`, and Guild is Phase 9 —
  // so it currently contributes nothing there either. Wire it in with Guild.
  async calculatePetStats(petId) {
    const petRes = await supabase
      .from('user_pets')
      .select('*, pets!inner(name, image_file, special_skill)')
      .eq('id', petId)
      .single()
    if (petRes.error || !petRes.data) return null

    const pet = petRes.data
    const stage = evolutionStage(pet.level)
    const evo = evolutionBonuses(stage)
    const equipped = await this.getEquippedFor(petId)

    let maxHP = (pet.base_hp || 60) + evo.hp
    for (const row of equipped) maxHP += (row.equipment && row.equipment.hp_bonus) || 0

    // Legacy writes the recomputed max back so other screens agree with battle.
    if (pet.max_hp !== maxHP) {
      await supabase.from('user_pets').update({ max_hp: maxHP }).eq('id', petId)
    }

    // `current_hp` of 0 is meaningful (a knocked-out pet), so only a genuinely
    // absent value falls back to full health.
    let currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : maxHP
    if (currentHP > maxHP) {
      currentHP = maxHP
      await supabase.from('user_pets').update({ current_hp: maxHP }).eq('id', petId)
    }

    // Per-level growth on top of the milestone evolution bumps, so levelling
    // between milestones still improves the pet.
    const levelBonus = Math.max(0, (pet.level || 1) - 1)
    const stats = {
      hp: currentHP,
      maxHP,
      attack: Math.round((pet.base_attack || 5) + evo.attack + levelBonus * 0.4),
      defense: Math.round((pet.base_defense || 3) + evo.defense + levelBonus * 0.25),
      speed: Math.round((pet.base_speed || 4) + evo.speed + levelBonus * 0.2),
      luck: 0,
      spirit: 0
    }

    const passives = []
    let hpPenaltyPct = 0
    for (const row of equipped) {
      const eq = row.equipment
      if (!eq) continue
      stats.attack += eq.attack_bonus || 0
      stats.defense += eq.defense_bonus || 0
      stats.speed += eq.speed_bonus || 0
      stats.luck += eq.luck_bonus || 0
      stats.spirit += eq.spirit_bonus || 0
      hpPenaltyPct += eq.hp_penalty_pct || 0
      if (eq.passive_effect && eq.passive_chance > 0) {
        passives.push({ effect: eq.passive_effect, chance: eq.passive_chance, itemName: eq.name })
      }
    }

    // Corrupted/dark gear trades max HP for its passives. Applied to the battle
    // snapshot only — the pet's stored max_hp is untouched — and capped at 50%
    // so stacking several such items can't reduce a pet to nothing.
    if (hpPenaltyPct > 0) {
      stats.maxHP = Math.max(1, Math.floor(stats.maxHP * (1 - Math.min(0.5, hpPenaltyPct))))
      stats.hp = Math.min(stats.hp, stats.maxHP)
      maxHP = stats.maxHP
      currentHP = stats.hp
    }

    // Player-allocated stat points.
    //
    // LEGACY BUG, fixed here: `statPoints_spend` stores the GAIN, not the point
    // count — +2 into bonus_attack, +2 into bonus_defense, +1 into bonus_speed
    // and +3 into bonus_hp. Attack/defence/speed are then read raw, which is
    // correct, but legacy read bonus_hp as `* 3` (game.js:6422) — multiplying
    // an already-multiplied value. Each HP point therefore granted **9** max HP
    // while its own modal advertises "+3 max HP per point". Read raw here so
    // all four behave alike and match what the UI promises.
    //
    // Visible consequence: a pet that has spent HP points loses the surplus it
    // was never meant to have.
    stats.attack += pet.bonus_attack || 0
    stats.defense += pet.bonus_defense || 0
    stats.speed += pet.bonus_speed || 0
    maxHP += pet.bonus_hp || 0

    // Combat buffs from the secret cooking recipes (Phase 3 stored these but
    // nothing consumed them until now).
    try {
      const buffs = await supabase
        .from('pet_combat_buffs')
        .select('stat, amount')
        .eq('user_id', AppState.user.id)
        .eq('pet_id', petId)
        .gt('battles_left', 0)
      for (const b of buffs.data || []) {
        if (b.stat && stats[b.stat] !== undefined) stats[b.stat] += b.amount || 0
      }
    } catch (e) {
      console.error('[equipmentService] combat buff load failed:', e)
    }

    const petName = pet.pets.name || ''
    return {
      id: pet.id,
      name: pet.nickname || petName || 'Your Pet',
      imageFile: pet.pets.image_file,
      stats,
      currentHP,
      maxHP,
      energy: pet.energy || 50,
      maxEnergy: pet.max_energy || 100,
      specialSkill: pet.pets.special_skill || null,
      passives,
      skills: skillLoadout(pet.id, petName, pet.level || 1),
      passiveSkills: passiveSkills(petName, pet.level || 1),
      level: pet.level || 1,
      petBaseName: petName,
      evolutionStage: stage
    }
  }

  // Decrements the battle counter on any active cooking buffs. Legacy does this
  // at battle end; kept here so all combat-buff handling lives together.
  async consumeCombatBuffs(petId) {
    try {
      const res = await supabase
        .from('pet_combat_buffs')
        .select('id, battles_left')
        .eq('user_id', AppState.user.id)
        .eq('pet_id', petId)
        .gt('battles_left', 0)
      for (const b of res.data || []) {
        await supabase.from('pet_combat_buffs')
          .update({ battles_left: b.battles_left - 1 })
          .eq('id', b.id)
      }
    } catch (e) {
      console.error('[equipmentService.consumeCombatBuffs]', e)
    }
  }
}

export const equipmentService = new EquipmentService()
