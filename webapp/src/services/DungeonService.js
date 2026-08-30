import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { equipmentService } from './EquipmentService.js'
import { expeditionService } from './ExpeditionService.js'
import { simulateBattle } from './AutoBattle.js'
import { ENEMY_SPRITE_CONFIG } from '../data/battleData.js'

// Ports the Starter Dungeon (game.js:20007-20417) — the "Shallow Cave"
// gauntlet on the battle page's zone picker.
//
// Three waves built from ONE outskirts enemy, escalating: Baby (level −1,
// ×0.7 stats), Adult (player level, ×1.3), then the KING (level +2, ×2.5).
// HP carries between waves with no healing, which is the whole challenge.
// Each wave is resolved by the auto-battle simulator rather than manual
// combat, and the log is played back.
export const dungeonState = reactive({
  active: false,
  // 'intro' | 'fighting' | 'wave-clear' | 'complete' | 'failed'
  phase: 'intro',
  wave: 0,
  petId: null,
  pet: null,
  petHP: 0,
  petMaxHP: 0,
  enemies: [],
  log: [],
  rewards: { pp: 0, xp: 0 },
  bonusPP: 0
})

const WAVES = [
  { key: 'baby', label: 'Baby', levelDelta: -1, mult: 0.7 },
  { key: 'adult', label: 'Adult', levelDelta: 0, mult: 1.3 },
  { key: 'king', label: '👑 KING', levelDelta: 2, mult: 2.5 }
]

const ENERGY_COST = 15
const DAILY_ENERGY_CAP = 250
const COMPLETION_BONUS_PP = 100

class DungeonService {
  // Ports the localStorage daily energy budget legacy gates the run on. Kept
  // as-is: it's a soft pacing limit on a PvE gauntlet, not a reward gate, so
  // it doesn't need the server-side claim treatment Phase 4 applied to PP.
  energyKey() {
    return 'energy_used_' + new Date().toISOString().split('T')[0]
  }

  energyUsedToday() {
    return parseInt(localStorage.getItem(this.energyKey()) || '0', 10) || 0
  }

  canRun() {
    return this.energyUsedToday() <= DAILY_ENERGY_CAP - ENERGY_COST
  }

  // Ports createDungeonEnemy(). Stats scale off the base enemy by level and the
  // wave multiplier; the sprite config travels with it because the dungeon is
  // the only place that renders enemies as spritesheet frames rather than emoji.
  buildEnemy(base, level, wave) {
    const levelBonus = level - 1
    const scale = (n) => Math.floor(n * wave.mult)
    const hp = scale(base.base_hp + levelBonus * 8)
    const atk = scale(base.base_attack + levelBonus)
    const def = scale(base.base_defense + Math.floor(levelBonus * 0.5))
    const spd = scale(base.base_speed + Math.floor(levelBonus * 0.5))

    return {
      id: base.id,
      species: base.species,
      name: `${wave.label} ${base.name}`,
      level,
      hp, attack: atk, defense: def, speed: spd,
      base_hp: hp, base_attack: atk, base_defense: def, base_speed: spd,
      forest_zone: base.forest_zone,
      variant: wave.key,
      exp_reward: Math.floor((base.exp_reward || 0) * wave.mult),
      pp_reward: Math.floor((base.pp_reward || 0) * wave.mult),
      sprite: this.spriteFor(base.species)
    }
  }

  // The one consumer of ENEMY_SPRITE_CONFIG. Legacy paints frame 0 of the
  // sheet as a static background — `startSpriteAnimation` is a no-op, so there
  // is no animation to reproduce.
  spriteFor(species) {
    const cfg = ENEMY_SPRITE_CONFIG[(species || '').toLowerCase()] || ENEMY_SPRITE_CONFIG.bird
    if (!cfg) return null
    return {
      file: '/images/' + cfg.file,
      frameWidth: cfg.frameWidth,
      frameHeight: cfg.frameHeight,
      sheetWidth: cfg.frameWidth * cfg.framesPerRow,
      sheetHeight: cfg.frameHeight * cfg.rows
    }
  }

  // Ports generateDungeonEnemies(). "Player level" here is derived from the
  // pet's combat stats rather than its actual level — legacy's own formula.
  async buildWaves(petStats) {
    const level = Math.floor(
      (petStats.stats.attack + petStats.stats.defense + petStats.stats.speed) / 5
    )
    const res = await supabase.from('enemy_pets').select('*').eq('forest_zone', 'outskirts')
    const pool = (res.data || []).filter(e => e.name)
    if (!pool.length) return []

    // All three waves are the same creature at different ages — that's the
    // gauntlet's identity, so the base is picked once.
    const base = pool[Math.floor(Math.random() * pool.length)]
    return WAVES.map(w => this.buildEnemy(base, Math.max(1, level + w.levelDelta), w))
  }

  async start(petId) {
    if (!this.canRun()) throw new Error('⚡ Not enough energy for a dungeon run today!')

    const petStats = await equipmentService.calculatePetStats(petId)
    if (!petStats) throw new Error('Could not load your pet.')
    if (petStats.currentHP <= 0) throw new Error(`${petStats.name} has fainted — heal them first!`)

    const enemies = await this.buildWaves(petStats)
    if (!enemies.length) throw new Error('The cave is empty right now — try again later.')

    localStorage.setItem(this.energyKey(), String(this.energyUsedToday() + ENERGY_COST))

    Object.assign(dungeonState, {
      active: true,
      phase: 'intro',
      wave: 1,
      petId,
      pet: petStats,
      petHP: petStats.currentHP,
      petMaxHP: petStats.maxHP,
      enemies,
      log: [],
      rewards: { pp: 0, xp: 0 },
      bonusPP: 0
    })
    return dungeonState
  }

  // Resolves the current wave. HP carries forward, which is what makes the
  // third wave hard.
  fightWave() {
    const s = dungeonState
    const enemy = s.enemies[s.wave - 1]
    const result = simulateBattle({ ...s.pet, currentHP: s.petHP }, enemy)

    s.log = result.log
    s.petHP = result.playerFinalHP
    s.phase = 'fighting'
    return result
  }

  // Ports handleDungeonBattleEnd() — accrue, advance, or fail.
  async resolveWave(result) {
    const s = dungeonState
    const enemy = s.enemies[s.wave - 1]

    if (!result.victory) {
      s.phase = 'failed'
      await this.persistHP()
      return
    }

    s.rewards.pp += enemy.pp_reward || 0
    s.rewards.xp += enemy.exp_reward || 0

    if (s.wave >= WAVES.length) {
      await this.complete()
    } else {
      s.wave++
      s.phase = 'wave-clear'
    }
  }

  // Ports completeDungeon(). The clear bonus is on top of the per-wave rewards.
  async complete() {
    const s = dungeonState
    s.bonusPP = COMPLETION_BONUS_PP
    s.rewards.pp += COMPLETION_BONUS_PP
    s.phase = 'complete'

    await playerService.awardPoints(s.rewards.pp, 'dungeon_reward')
    await expeditionService.awardPetXP(s.petId, s.rewards.xp)
    await this.persistHP()
  }

  async persistHP() {
    try {
      await supabase.from('user_pets')
        .update({ current_hp: Math.max(0, dungeonState.petHP) })
        .eq('id', dungeonState.petId)
    } catch (e) {
      console.error('[dungeonService.persistHP]', e)
    }
  }

  reset() {
    dungeonState.active = false
    dungeonState.phase = 'intro'
    dungeonState.log = []
    dungeonState.wave = 0
  }
}

export const dungeonService = new DungeonService()
