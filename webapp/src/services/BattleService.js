import { reactive } from 'vue'
import { AppState } from '../AppState.js'
import { passService } from './PassService.js'
import { supabase } from './SupabaseService.js'
import { equipmentService } from './EquipmentService.js'
import { inventoryService } from './InventoryService.js'
import { musicService } from './MusicService.js'
import { soundService } from './SoundService.js'
import { toastService } from './ToastService.js'
import { companionService } from './CompanionService.js'
import { taskTracker } from './TaskTrackerService.js'
import { trackDailyStat } from './DailyStatsService.js'
import { recordLocalBossKill } from './MelonService.js'
import { scrapbookService } from './ScrapbookService.js'
import { communityGoalService } from './CommunityGoalService.js'
import { argLogService } from './ArgLogService.js'
import { petMoodService } from './PetMoodService.js'
import { weatherService } from './WeatherService.js'
import { worldEventService } from './WorldEventService.js'
import { worldStateService } from './WorldStateService.js'
import { getCalendarBonus, todaysEvent } from '../utils/calendarBonus.js'
import { guildPerkService } from './GuildPerkService.js'
import { activityService } from './ActivityService.js'
import { isPiper, piperTurnAction, piperResolveAction, applyDefendPassives, tickInfluence } from './PiperBoss.js'
import {
  ZONE_CONFIG, STATUS_EFFECTS, PASSIVE_EFFECTS,
  PET_SKILLS, SKILL_KEY_MAP, ENEMY_BEHAVIORS, BATTLE_CONSTANTS
} from '../data/battleData.js'

// ─────────────────────────────────────────────────────────────────────────────
// Ports the manual battle engine (game.js:7907-8712) as a state machine.
//
// The legacy engine interleaved combat rules with direct DOM writes — it read
// HP out of elements, wrote narrative into innerHTML, and drove animations by
// toggling classes mid-calculation. Here the rules only ever mutate
// `battleState`; BattlePage.vue renders from it. That separation is what makes
// the turn loop testable and is why the port reads shorter than the original
// despite covering the same rules.
//
// The Archive lore bonus and the world-state corruption read are both live as
// of Phase 9.5/8b. One seam remains — integrityEffects(), the per-turn glitch
// damage at very low Beta Integrity — and it returns a neutral value, so combat
// behaves exactly as it does for a player in a healthy beta.
// ─────────────────────────────────────────────────────────────────────────────

export const battleState = reactive({
  active: false,
  // 'exploring' | 'fighting' | 'over'
  phase: 'exploring',
  zone: 'outskirts',
  player: null,
  enemy: null,
  playerHP: 0,
  playerMaxHP: 0,
  enemyHP: 0,
  enemyMaxHP: 0,
  turn: 0,
  playerStatuses: {},
  enemyStatuses: {},
  skillCooldowns: {},
  narrative: [],
  log: [],
  victory: null,
  processing: false,
  // Set true by a successful flee. It MUST be declared here and reset in
  // startBattle: `battleState` is a module-level singleton, so a `fled` left
  // over from a previous battle makes `playerAction` end the NEXT battle on the
  // player's first move — whatever they chose — because the flee check runs
  // straight after the action resolves.
  fled: false,
  rewards: null,
  calendarBonus: null,
  // Per-battle counters the badge checks read (ports s.totalDamageTaken /
  // s.uniqueStatusesApplied / s.skillsUsedThisBattle). Arrays rather than Sets
  // so they stay plainly reactive; both are deduped on write.
  totalDamageTaken: 0,
  uniqueStatusesApplied: [],
  skillsUsedThisBattle: [],
  // transient animation cues the page reacts to
  anim: { playerAttack: 0, enemyAttack: 0, playerHit: 0, enemyHit: 0 }
})

// Ports calculateDamage() (game.js). Defence is 50% effective; Luck raises the
// crit rate from a 5% base by 0.5% per point, capped at 25%.
export function calculateDamage(attack, defense, luck = 0) {
  const baseDamage = Math.max(1, attack - Math.floor(defense * 0.5))
  let variance = Math.floor(Math.random() * 3) - 1 // -1 | 0 | +1

  const critChance = Math.min(0.25, 0.05 + luck * 0.005)
  const isCrit = Math.random() < critChance
  if (isCrit) variance = Math.max(variance, 1)

  let damage = Math.max(1, baseDamage + variance)
  if (isCrit) damage = Math.floor(damage * 1.5)
  return { damage, variance, isCrit }
}

class BattleService {
  // ── unmigrated-system seams ───────────────────────────────────────────────
  // The ARG "archive logs" grant passive combat bonuses. Until that system is
  // migrated this returns the same zeros a player with no logs would have.
  // Live as of Phase 9.5 — the Archive's combat bonus scales with how many
  // tester logs the player has recovered. Returns zeros for a player with none,
  // which is what this seam used to return for everyone.
  archiveBonus() {
    return argLogService.combatBonus()
  }

  // World-state corruption inflicts per-turn glitch damage at low integrity.
  // Neutral until the world-state system migrates.
  integrityEffects() {
    return null
  }

  // Ports getWorldStateValueSync('corruption_level', 50). Now reads the real
  // world state rather than a hardcoded fallback — which means Piper's
  // Influence meter can actually fill (it needs Beta Integrity at 25 or below,
  // i.e. corruption 75+) and The Echo scales as designed.
  corruptionLevel() {
    return worldStateService.corruptionSync()
  }

  // The helper bundle the Piper module needs, so it can stay a pure module
  // rather than importing this service back and creating a cycle.
  bossContext() {
    return {
      applyStatusToPlayer: (t) => this.applyStatusToPlayer(t),
      applyStatusToEnemy: (t) => this.applyStatusToEnemy(t),
      applyStatusDirect: (t, target) => battleState.$applyStatus(t, target),
      applyHeal: (n) => this.applyHeal(n),
      corruptionLevel: () => this.corruptionLevel()
    }
  }

  // Ports loadBattlePets() (game.js:11255-11400). Returns the RAW user_pets
  // rows rather than OwnedPet models, because the battle card needs the
  // base_attack/base_defense/base_speed/current_hp/max_hp columns the model
  // doesn't carry.
  //
  // Pets on an unclaimed expedition are excluded — they're away, and legacy
  // shows "All your pets are exploring!" when that empties the list.
  async getBattlePets(userId) {
    const petRes = await supabase
      .from('user_pets')
      .select('*, pets(name, image_file, vtuber_name)')
      .eq('user_id', userId)
    if (petRes.error) throw new Error('Could not load your pets.')

    const expRes = await supabase
      .from('expeditions')
      .select('pet_id')
      .eq('user_id', userId)
      .eq('claimed', false)
    const away = new Set((expRes.data || []).map(r => r.pet_id))

    const all = petRes.data || []
    return {
      available: all.filter(p => !away.has(p.id)),
      // `all` includes pets currently away — the expedition panel needs them to
      // name whose expedition is running.
      all,
      total: all.length,
      awayCount: away.size
    }
  }

  // Ports quickHeal(). Restores the pet to full HP for PP. Writes max_hp back
  // alongside current_hp so the stored row matches what battle computed.
  async quickHeal(pet, cost = 100) {
    const { playerService } = await import('./PlayerService.js')
    const maxHP = pet.max_hp || pet.base_hp || 60
    if ((pet.current_hp ?? 0) >= maxHP) throw new Error('Pet is already at full HP!')

    const remaining = await playerService.spendPoints(cost, 'quick_heal')
    if (remaining === null) throw new Error(`Not enough PP! Quick Heal costs ${cost} PP.`)

    const res = await supabase.from('user_pets')
      .update({ current_hp: maxHP, max_hp: maxHP }).eq('id', pet.id)
    if (res.error) throw new Error('Heal failed.')
    return maxHP
  }

  // Ports quickEnergyTopup(). 220 PP — the price of two Energy Drinks.
  async energyTopUp(pet, cost = 220) {
    const { playerService } = await import('./PlayerService.js')
    const maxEnergy = pet.max_energy || 100
    if ((pet.energy ?? 0) >= maxEnergy) throw new Error('Pet energy is already full!')

    const remaining = await playerService.spendPoints(cost, 'energy_topup')
    if (remaining === null) throw new Error(`Not enough PP! Energy Top-Up costs ${cost} PP.`)

    const res = await supabase.from('user_pets')
      .update({ energy: maxEnergy }).eq('id', pet.id)
    if (res.error) throw new Error('Top-up failed.')
    return maxEnergy
  }

  // ── encounter generation ──────────────────────────────────────────────────
  // Ports getRandomEnemy() (game.js:12160-12522). Enemies live in the
  // `enemy_pets` table, so this is a query rather than a local table.
  async rollEnemy(zone, playerLevel) {
    const zoneKey = zone || 'outskirts'

    // Piper only appears with spooky mode on. Equipped Spirit lowers the rate:
    // each 10 Spirit removes 0.3%, with a 0.5% floor.
    const { settingsState } = await import('./SettingsService.js')
    if (settingsState.spooky_enabled) {
      const spirit = await equipmentService.getTotalSpirit()
      const rate = Math.max(
        0.005,
        BATTLE_CONSTANTS.BOSS_ENCOUNTER_RATE - Math.floor(spirit / 10) * 0.003
      )
      if (Math.random() < rate) {
        const piper = await this.getBossEnemy(zoneKey, playerLevel)
        // No Piper configured for this zone is not an error — fall through to
        // a normal enemy rather than aborting the encounter.
        if (piper) return piper
      }
    }

    // Zone boss: roughly one fight in twenty (see ZONE_BOSS_CHANCE, which
    // documents why this is 5% rather than legacy's 12%). `spawn_weight = 0`
    // marks the Piper-only rows handled above, so they're excluded here.
    if (Math.random() < BATTLE_CONSTANTS.ZONE_BOSS_CHANCE) {
      const bossRes = await supabase.from('enemy_pets').select('*')
        .eq('forest_zone', zoneKey).eq('is_boss', true).gt('spawn_weight', 0)
      if (bossRes.data && bossRes.data.length) {
        return bossRes.data[Math.floor(Math.random() * bossRes.data.length)]
      }
    }

    const res = await supabase.from('enemy_pets').select('*').eq('forest_zone', zoneKey)
    if (res.error || !res.data || !res.data.length) {
      console.error('[battleService.rollEnemy] no enemies for zone', zoneKey, res.error)
      return null
    }

    // Level band: the player-relative window is clamped to the zone's hard
    // caps, so a high-level player can't drag level-20 enemies into the
    // starter zone (and vice versa).
    const conf = ZONE_CONFIG[zoneKey] || ZONE_CONFIG.outskirts
    let minLevel = Math.max(conf.minLevel, Math.min(playerLevel - 1, conf.maxLevel))
    let maxLevel = Math.min(conf.maxLevel, Math.max(playerLevel + 2, conf.minLevel))
    if (minLevel > maxLevel) minLevel = maxLevel

    const named = res.data.filter(e => e.name)
    const inBand = named.filter(e => {
      const lvl = e.level || 1
      return lvl >= minLevel && lvl <= maxLevel
    })
    const pool = inBand.length ? inBand : named
    if (!pool.length) return null

    // spawn_weight biases the pick; rows without one count as weight 1.
    const total = pool.reduce((sum, e) => sum + (e.spawn_weight || 1), 0)
    let roll = Math.random() * total
    for (const e of pool) {
      roll -= e.spawn_weight || 1
      if (roll <= 0) return e
    }
    return pool[pool.length - 1]
  }

  async getBossEnemy(zone, playerLevel) {
    const res = await supabase.from('enemy_pets').select('*')
      .eq('forest_zone', zone).eq('is_boss', true).eq('spawn_weight', 0)
    if (res.error || !res.data || !res.data.length) return null
    return res.data[Math.floor(Math.random() * res.data.length)]
  }

  // ── battle lifecycle ──────────────────────────────────────────────────────
  // Ports startBattleWithEnemy() + initManualBattle().
  async startBattle(petId, enemy, zone) {
    const player = await equipmentService.calculatePetStats(petId)
    if (!player) throw new Error('Could not load your pet.')

    const zoneKey = enemy.forest_zone || zone || 'outskirts'
    const conf = ZONE_CONFIG[zoneKey] || ZONE_CONFIG.outskirts

    if (player.energy < conf.energyCost) {
      throw new Error(`${player.name} needs ${conf.energyCost} energy to explore here.`)
    }
    if (player.currentHP <= 0) {
      throw new Error(`${player.name} has no HP left — heal them first!`)
    }

    // enemy_pets stores base_* columns; normalise to flat combat stats.
    const e = {
      ...enemy,
      hp: Math.max(1, enemy.base_hp || enemy.hp || 10),
      attack: Math.max(1, enemy.base_attack || enemy.attack || 3),
      defense: Math.max(0, enemy.base_defense || enemy.defense || 0),
      speed: Math.max(1, enemy.base_speed || enemy.speed || 3)
    }

    const newEnergy = Math.max(0, player.energy - conf.energyCost)
    await supabase.from('user_pets').update({ energy: newEnergy }).eq('id', petId)

    Object.assign(battleState, {
      active: true,
      phase: 'fighting',
      zone: zoneKey,
      zoneConf: conf,
      player,
      enemy: e,
      petId,
      playerHP: player.currentHP,
      playerMaxHP: player.maxHP,
      enemyHP: e.hp,
      enemyMaxHP: e.hp,
      turn: 0,
      playerStatuses: {},
      enemyStatuses: {},
      skillCooldowns: {},
      skillUseCount: 0,
      attackUseCount: 0,
      enemyDefDebuff: 0,
      playerAtkBuff: 0,
      playerEvasionBuff: false,
      totalDamageTaken: 0,
      uniqueStatusesApplied: [],
      skillsUsedThisBattle: [],
      narrative: [`A wild ${e.name} appears!`],
      log: [],
      victory: null,
      processing: false,
      fled: false,
      rewards: null,
      calendarBonus: null,
      usedRevive: false,
      playerDefShred: 0,
      // Piper fight state — inert for every other enemy.
      piperPhase: 1,
      piperMelody: 0,
      piperInfluence: 0,
      piperSkillCooldown: 0,
      piperPhase2Triggered: false,
      piperPhase3Triggered: false,
      piperTelegraphFired: false,
      piperNextAction: null,
      piperGlitch: 0,
      piperFlash: 0,
      archive: this.archiveBonus()
    })
    this.attachBehaviorHelpers()

    // Piper gets his own theme; other bosses share the boss track.
    const isPiper = !!e.is_boss && (e.name || '').includes('Piper')
    musicService.playBattleTrack(isPiper ? 'piper' : e.is_boss ? 'boss' : 'normal')
    // Warm the three most-used hit sounds so the opening exchange isn't silent
    // while they fetch. Starting a battle is a real user gesture, which is what
    // browsers require before audio may play at all.
    soundService.preloadBattle()

    return battleState
  }

  // The per-species AI in ENEMY_BEHAVIORS is kept verbatim from game.js so it
  // stays auditable against the original. It calls two status helpers as bare
  // globals there; here they're attached to the state object it already
  // receives, which is why battleData.js calls `s.$applyStatus*`.
  attachBehaviorHelpers() {
    battleState.$applyStatus = (type, target) => {
      const def = STATUS_EFFECTS[type]
      if (!def) return
      const cur = target[type]
      target[type] = { turns: cur ? Math.max(cur.turns, def.duration) : def.duration }
    }
    battleState.$applyStatusToPlayer = (type) => this.applyStatusToPlayer(type)
  }

  // ── status / heal helpers ─────────────────────────────────────────────────
  applyStatusToEnemy(type) {
    const def = STATUS_EFFECTS[type]
    if (!def) return
    const cur = battleState.enemyStatuses[type]
    battleState.enemyStatuses[type] = { turns: cur ? Math.max(cur.turns, def.duration) : def.duration }
    if (!battleState.uniqueStatusesApplied.includes(type)) {
      battleState.uniqueStatusesApplied.push(type)
    }
  }

  // Spirit both resists statuses outright and shortens the ones that land.
  applyStatusToPlayer(type) {
    const def = STATUS_EFFECTS[type]
    if (!def) return false
    const spirit = battleState.player.stats.spirit || 0
    if (Math.random() < Math.min(0.4, spirit * 0.02)) return false
    const duration = Math.max(1, def.duration - Math.floor(spirit / 3))
    const cur = battleState.playerStatuses[type]
    battleState.playerStatuses[type] = { turns: cur ? Math.max(cur.turns, duration) : duration }
    return true
  }

  // Spirit and archive bonuses amplify healing.
  applyHeal(baseHeal) {
    const spirit = battleState.player.stats.spirit || 0
    const archHeal = battleState.archive.healPct || 0
    const amount = Math.floor(baseHeal * (1 + spirit * 0.05 + archHeal))
    battleState.playerHP = Math.min(battleState.playerMaxHP, battleState.playerHP + amount)
    return amount
  }

  damageMultiplier(isCorrupted) {
    const a = battleState.archive
    return 1 + (a.dmgPct || 0) + (isCorrupted ? (a.corruptedDmgPct || 0) : 0)
  }

  // Ports manualBattle_tickDOT(). Damage-over-time statuses tick, then every
  // status loses a turn and expires at zero.
  tickStatuses(side) {
    const statuses = side === 'player' ? battleState.playerStatuses : battleState.enemyStatuses
    const lines = []
    for (const key of Object.keys(statuses)) {
      const def = STATUS_EFFECTS[key]
      if (!def) continue
      if (def.type === 'dot') {
        const dmg = def.damage || 0
        if (side === 'player') {
          battleState.playerHP = Math.max(0, battleState.playerHP - dmg)
          battleState.totalDamageTaken += dmg
        } else {
          battleState.enemyHP = Math.max(0, battleState.enemyHP - dmg)
        }
        lines.push(`${def.icon} ${def.label}: ${dmg} damage!`)
      }
      statuses[key].turns--
      if (statuses[key].turns <= 0) delete statuses[key]
    }
    return lines
  }

  // Ports manualBattle_applyEquipPassives() — gear procs on the player's hit.
  applyAttackPassives(baseDamage) {
    const lines = []
    for (const p of battleState.player.passives || []) {
      const fx = PASSIVE_EFFECTS[p.effect]
      if (!fx || fx.type !== 'attack') continue
      if (Math.random() * 100 >= (p.chance || 0)) continue

      if (fx.bonusDamage) {
        battleState.enemyHP = Math.max(0, battleState.enemyHP - fx.bonusDamage)
        lines.push(`${fx.icon} ${fx.label}! +${fx.bonusDamage}`)
      }
      if (fx.healPct) {
        const healed = this.applyHeal(Math.floor(baseDamage * fx.healPct))
        lines.push(`${fx.icon} ${fx.label}! +${healed} HP`)
      }
      if (fx.extraHitPct) {
        const extra = Math.max(1, Math.floor(baseDamage * fx.extraHitPct))
        battleState.enemyHP = Math.max(0, battleState.enemyHP - extra)
        lines.push(`${fx.icon} ${fx.label}! +${extra}`)
      }
      if (fx.defenseShred) {
        battleState.enemyDefDebuff += fx.defenseShred
        lines.push(`${fx.icon} ${fx.label}!`)
      }
    }
    return lines
  }

  cue(name) {
    battleState.anim[name] = Date.now()
  }

  // ── player's action ───────────────────────────────────────────────────────
  // Ports manualBattle_resolvePlayerAction(). Returns the narrative line; all
  // state changes happen in place.
  resolvePlayerAction(type, payload) {
    const s = battleState

    if (type === 'flee') {
      // Legacy odds: a flat 40% chance to escape.
      if (Math.random() < 0.4) {
        s.fled = true
        return `🏃 ${s.player.name} fled from battle!`
      }
      return '🏃 Tried to flee... but couldn\'t escape!'
    }

    if (type === 'attack') {
      s.attackUseCount++
      tickInfluence(s, 8, this.bossContext())
      this.cue('playerAttack')
      this.cue('enemyHit')
      const atk = Math.max(1, (s.player.stats.attack || 5) + (s.playerAtkBuff || 0))
      const def = Math.max(0, (s.enemy.defense || 0) - (s.enemyDefDebuff || 0))
      const roll = calculateDamage(atk, def, s.player.stats.luck || 0)
      const isCorrupted = s.enemy.specialVariant === 'corrupted' || !!s.enemy.is_boss
      const dmg = Math.max(1, Math.round(roll.damage * this.damageMultiplier(isCorrupted)))
      s.enemyHP = Math.max(0, s.enemyHP - dmg)
      // Light / normal / crit, off the same roll that decided the damage.
      soundService.hit('player', roll.variance, roll.isCrit)

      let line = `${roll.isCrit ? '⚡ CRITICAL! ' : ''}${s.player.name} attacks for ${dmg} damage!`
      const procs = this.applyAttackPassives(dmg)
      if (procs.length) line += ' ' + procs.join(' ')

      // Both buffs are single-use and clear whether or not they mattered.
      s.playerEvasionBuff = false
      s.playerAtkBuff = 0
      return line
    }

    if (type === 'item') {
      tickInfluence(s, 6, this.bossContext())
      return this.resolveItemUse(payload)
    }

    if (type === 'skill') {
      const skill = (s.player.skills || [])[payload]
      if (!skill) return 'No skill found!'
      if ((s.skillCooldowns[skill.id] || 0) > 0) return 'Skill not ready!'
      s.skillUseCount++
      tickInfluence(s, 5, this.bossContext())
      this.cue('playerAttack')
      // Skills always use the normal hit sound — they have no damage roll of
      // their own to derive a tier from. Legacy does the same.
      soundService.play('playerNormal')
      if (!s.skillsUsedThisBattle.includes(skill.id)) s.skillsUsedThisBattle.push(skill.id)
      // Feeds the 'Use battle skills 20 times' weekly challenge.
      taskTracker.report('use_skill')
      if (skill.cooldown > 0) s.skillCooldowns[skill.id] = skill.cooldown
      return this.applySkill(skill)
    }

    return '...nothing happened.'
  }

  // Ports manualBattle_getUsableItems(). Medicine is always battle-usable;
  // food counts only if it actually restores something.
  usableItems(inventory) {
    return (inventory || []).filter(i =>
      (i.qty || 0) > 0 && (
        i.itemType === 'medicine' ||
        (i.itemType === 'food' && (i.effectValue || 0) > 0)
      )
    ).slice(0, 8)
  }

  // Ports manualBattle_getItemBattleLabel() — what the item will do in combat,
  // which is often not what it does outside one.
  itemBattleLabel(item) {
    const name = (item.name || '').toLowerCase()
    if (name.includes('smoke bomb')) return 'Confuse enemy'
    if (name.includes('shock shard')) return 'Burn enemy'
    if (name.includes('panacea')) return 'Cleanse ALL'
    if (name.includes('clarity')) return 'Cleanse Confuse/Fear/Glitch'
    if (name.includes('antidote')) return 'Cleanse Burn'
    if (name.includes('full restore')) return 'Full HP restore'
    const hp = item.effectValue || 0
    return hp > 0 ? `+~${hp} HP` : ''
  }

  // Ports manualBattle_resolveItemUse(). Items are matched by name because the
  // effects are authored into the item names rather than into columns — the
  // legacy behaviour, kept so the same items keep working.
  resolveItemUse(item) {
    const s = battleState
    const name = (item.name || '').toLowerCase()
    // Feeds the 'Use items in battle 5 times' weekly challenge.
    taskTracker.report('use_battle_item')

    if (name.includes('smoke bomb')) {
      this.applyStatusToEnemy('confuse')
      return '💨 Smoke Bomb! Enemy is Confused for 2 turns!'
    }
    if (name.includes('shock shard')) {
      this.applyStatusToEnemy('burn')
      return '⚡ Shock Shard! Enemy is Burned!'
    }
    if (name.includes('panacea')) {
      s.playerStatuses = {}
      return '✨ Panacea! All status effects cleared!'
    }
    if (name.includes('clarity')) {
      for (const st of ['confuse', 'fear', 'glitch']) delete s.playerStatuses[st]
      return '💎 Clarity Draft! Confuse, Fear, and Glitch removed!'
    }
    if (name.includes('antidote')) {
      for (const st of ['burn', 'poison']) delete s.playerStatuses[st]
      return '🌿 Antidote! Burn removed!'
    }

    // Everything else heals. Full Restore ignores the item's own value.
    let hpGain = item.effectValue || 15
    if (name.includes('full restore')) hpGain = s.playerMaxHP
    return `🧪 ${item.name}! Restored ${this.applyHeal(hpGain)} HP!`
  }

  // Ports manualBattle_applySkill() (game.js:8548-8676) — the widest single
  // piece of the engine, since every optional field on a skill is handled here.
  applySkill(skill) {
    const s = battleState
    const lines = [`${s.player.name} uses ${skill.name}!`]
    const atk = Math.max(1, Number(s.player.stats.attack) || 5)

    // Self-cost skills can never be lethal — the floor is 1 HP.
    if (skill.selfCostPct > 0) {
      const cost = Math.max(1, Math.floor(s.playerHP * skill.selfCostPct))
      s.playerHP = Math.max(1, s.playerHP - cost)
      lines.push(`(${s.player.name} spends ${cost} HP)`)
    }
    if (skill.healPct > 0) {
      lines.push(`Restored ${this.applyHeal(Math.floor(s.playerMaxHP * skill.healPct))} HP!`)
    }
    if (skill.cleanse) {
      s.playerStatuses = {}
      lines.push('All negative effects cleared!')
    }

    if (skill.damageMult > 0) {
      const def = Math.max(0, Number(s.enemy.defense || 0))
      let scaling = 1
      if (skill.skillScaling) {
        scaling = 1 + Math.min(skill.skillScaling.max, s.skillUseCount * skill.skillScaling.perSkillUsed)
      }
      if (skill.atkScaling) {
        scaling = 1 + Math.min(skill.atkScaling.max, s.attackUseCount * skill.atkScaling.perAttack)
      }
      let dmg = Math.max(1, Math.round((atk - def * 0.5) * skill.damageMult * scaling))

      // Chaos Portal (Kelta) — a weighted table that can replace the hit entirely.
      if (skill.chaosEffect) {
        let roll = Math.random() * 100
        let chosen = null
        for (const opt of skill.chaosEffect) {
          roll -= opt.weight
          if (roll < 0) { chosen = opt.effect; break }
        }
        if (chosen === 'double_damage') { dmg *= 2; lines.push('The portal doubles power!') }
        else if (chosen === 'heal_20pct') { this.applyHeal(Math.floor(s.playerMaxHP * 0.2)); lines.push('The portal heals you!'); dmg = 0 }
        else if (chosen === 'enemy_skip') { this.applyStatusToEnemy('fear'); lines.push('The portal scares the enemy!'); dmg = 0 }
        else { lines.push('The portal opens... and closes. (Nothing happened.)'); dmg = 0 }
      }

      // Escape Attempt (Blushimia) — trades a guaranteed skip either way.
      if (skill.escapeEffect) {
        if (Math.random() < skill.escapeEffect.successChance) {
          this.applyStatusToEnemy('fear')
          lines.push('Success! The enemy loses their next turn!')
        } else {
          this.applyStatusToPlayer('stun')
          lines.push(`Failed! ${s.player.name} loses next turn!`)
        }
        dmg = 0
      }

      const isCorrupted = s.enemy.specialVariant === 'corrupted' || !!s.enemy.is_boss
      dmg = Math.max(0, Math.round(dmg * this.damageMultiplier(isCorrupted)))
      if (skill.condBonus?.ifStatus && s.enemyStatuses[skill.condBonus.ifStatus]) {
        dmg = Math.floor(dmg * (skill.condBonus.mult || 2))
        lines.push(`(${skill.condBonus.ifStatus} combo!)`)
      }
      if (dmg > 0) {
        s.enemyHP = Math.max(0, s.enemyHP - dmg)
        this.cue('enemyHit')
        lines.push(`Hit for ${dmg} damage!`)
      }

      if (skill.status) {
        // A conditional guarantee replaces the usual roll when its prerequisite
        // status is already on the enemy.
        if (skill.condBonus?.guaranteeStatus && s.enemyStatuses[skill.condBonus.ifStatus]) {
          this.applyStatusToEnemy(skill.condBonus.guaranteeStatus)
          const d = STATUS_EFFECTS[skill.condBonus.guaranteeStatus] || {}
          lines.push(`${d.icon || ''} ${skill.condBonus.guaranteeStatus} guaranteed!`)
        } else if (Math.random() < (skill.status.chance || 0)) {
          this.applyStatusToEnemy(skill.status.type)
          const d = STATUS_EFFECTS[skill.status.type] || {}
          lines.push(`${d.icon || ''} ${skill.status.type} applied!`)
        }
      }
      if (skill.lifeSteal && dmg > 0) {
        this.applyHeal(Math.floor(dmg * skill.lifeSteal))
        lines.push('Drained HP!')
      }
      if (skill.lifeStealChance && dmg > 0 && Math.random() < skill.lifeStealChance.chance) {
        this.applyHeal(Math.floor(dmg * skill.lifeStealChance.pct))
        lines.push('Siphoned HP!')
      }
      if (skill.status2 && Math.random() < (skill.status2.chance || 0)) {
        this.applyStatusToEnemy(skill.status2.type)
        const d = STATUS_EFFECTS[skill.status2.type] || {}
        lines.push(`${d.icon || ''} ${skill.status2.type} applied!`)
      }
    }

    if (skill.evasionBuff) {
      s.playerEvasionBuff = skill.evasionBuff
      lines.push(`Next enemy attack has ${Math.round(skill.evasionBuff * 100)}% miss chance!`)
    }
    if (skill.atkBuff) {
      s.playerAtkBuff = Math.floor(atk * skill.atkBuff.amount)
      lines.push(`+${Math.round(skill.atkBuff.amount * 100)}% attack for ${skill.atkBuff.turns} turn(s)!`)
    }
    if (skill.debuff?.stat === 'defense') {
      const shred = Math.floor(Math.max(0, Number(s.enemy.defense || 0)) * (skill.debuff.amount || 0.1))
      s.enemyDefDebuff += shred
      if (shred > 0) lines.push(`Enemy defense reduced by ${shred}!`)
    }
    if (skill.randomBuff && Math.random() < skill.randomBuff.chance) {
      const stat = skill.randomBuff.options[Math.floor(Math.random() * skill.randomBuff.options.length)]
      if (stat === 'attack') {
        s.playerAtkBuff = Math.floor(atk * skill.randomBuff.amount)
        lines.push(`+${Math.round(skill.randomBuff.amount * 100)}% attack buff!`)
      } else {
        lines.push('Defense boost!')
      }
    }
    if (skill.atkBuffChance && Math.random() < skill.atkBuffChance.chance) {
      s.playerAtkBuff = Math.floor(atk * skill.atkBuffChance.amount)
      lines.push(`+${Math.round(skill.atkBuffChance.amount * 100)}% attack buff!`)
    }

    return lines.join(' ')
  }

  // ── enemy's action ────────────────────────────────────────────────────────
  // Ports manualBattle_enemyTurn(). Skip/miss checks resolve before any damage.
  enemyTurn() {
    const s = battleState
    const enemy = s.enemy

    for (const key of ['stun', 'fear']) {
      if (s.enemyStatuses[key]) {
        s.enemyStatuses[key].turns--
        if (s.enemyStatuses[key].turns <= 0) delete s.enemyStatuses[key]
        return `${enemy.name} is ${key === 'stun' ? 'stunned' : 'afraid'} and cannot act!`
      }
    }
    if (s.enemyStatuses.confuse && Math.random() < STATUS_EFFECTS.confuse.missChance) {
      s.enemyStatuses.confuse.turns--
      if (s.enemyStatuses.confuse.turns <= 0) delete s.enemyStatuses.confuse
      return `${enemy.name} is confused and misses!`
    }
    if (s.playerEvasionBuff && Math.random() < s.playerEvasionBuff) {
      s.playerEvasionBuff = false
      return `${enemy.name} attacks... but misses!`
    }

    // Piper has her own phase-based AI rather than a species behaviour. A
    // telegraphed skill queued last turn resolves now instead of picking anew.
    if (isPiper(enemy)) {
      const ctx = this.bossContext()
      if (s.piperNextAction) {
        const queued = s.piperNextAction
        s.piperNextAction = null
        return piperResolveAction(queued, s, ctx)
      }
      return piperResolveAction(piperTurnAction(s, ctx), s, ctx)
    }

    // Per-species AI may take the whole turn with a narrative move instead of
    // attacking (ENEMY_BEHAVIORS hooks are pure functions over the state).
    const speciesKey = (enemy.species || '').toLowerCase().split(' ')[0]
    const behavior = ENEMY_BEHAVIORS[speciesKey] || {}
    if (behavior.checkMidpoint) {
      const mid = behavior.checkMidpoint(s, enemy)
      if (mid) return mid
    }
    if (behavior.getTurnAction) {
      const act = behavior.getTurnAction(s, enemy)
      if (act) return act
    }

    this.cue('enemyAttack')
    const atk = Math.max(1, enemy.attack || 3)
    // Some behaviours (e.g. the boar's charge) shred defence for the hit.
    const def = Math.max(0, (s.player.stats.defense || 0) - (s.playerDefShred || 0))
    const roll = calculateDamage(atk, def, 0)

    // Defend-side gear passives can block, reduce, reflect or heal off the hit.
    const defend = applyDefendPassives(s, roll.damage, this.bossContext())
    s.playerHP = Math.max(0, s.playerHP - defend.finalDmg)
    s.totalDamageTaken += defend.finalDmg
    this.cue('playerHit')
    // A boss gets Piper's flute instead of the ordinary enemy hit, and bypasses
    // the rate limit so it is never the sound that gets dropped.
    const isBoss = !!(enemy.is_boss || (enemy.name || '').includes('Piper'))
    soundService.hit(isBoss ? 'boss' : 'enemy', roll.variance, roll.isCrit)

    let line = `${roll.isCrit ? '⚡ ' : ''}${enemy.name} attacks for ${defend.finalDmg} damage!`
    if (defend.lines.length) line += ' ' + defend.lines.join(' ')

    // Species procs that fire off the back of a landed attack.
    if (behavior.onAttackProc) {
      const proc = behavior.onAttackProc(s)
      if (proc) line += ' ' + proc
    }
    if (behavior.onHitPlayer) behavior.onHitPlayer(s)

    const influence = tickInfluence(s, 10, this.bossContext())
    if (influence) line += ' ' + influence
    return line
  }

  // ── the turn ──────────────────────────────────────────────────────────────
  // Ports _manualBattle_doTurn(). Order is load-bearing and matches legacy:
  // player acts -> zone modifier -> player DOT -> enemy acts -> enemy DOT ->
  // cooldowns. Every step that can reduce HP to zero ends the battle straight
  // away rather than letting a dead combatant keep acting.
  async playerAction(type, payload) {
    const s = battleState
    if (!s.active || s.victory !== null || s.processing) return
    s.processing = true
    const lines = []

    try {
      s.turn++

      if (s.playerStatuses.stun || s.playerStatuses.fear) {
        const key = s.playerStatuses.stun ? 'stun' : 'fear'
        lines.push(`😵 ${s.player.name} is ${key === 'stun' ? 'stunned' : 'afraid'} and cannot act!`)
        s.playerStatuses[key].turns--
        if (s.playerStatuses[key].turns <= 0) delete s.playerStatuses[key]
      } else {
        lines.push(this.resolvePlayerAction(type, payload))
        if (s.fled) { await this.endBattle('flee', lines); return }
        if (s.enemyHP <= 0) { await this.endBattle(true, lines); return }
      }

      const mod = (s.zoneConf && s.zoneConf.battleMod) || { type: 'none' }
      if (mod.type === 'regen' && s.enemyHP > 0) {
        s.enemyHP = Math.min(s.enemyMaxHP, s.enemyHP + (mod.amount || 3))
        lines.push(`${mod.label}: Enemy recovered ${mod.amount || 3} HP!`)
      }
      if (mod.type === 'corruption') {
        const spirit = s.player.stats.spirit || 0
        const dmg = Math.max(0, (mod.damage || 2) - Math.floor(spirit / 3))
        s.playerHP = Math.max(0, s.playerHP - dmg)
        s.totalDamageTaken += dmg
        lines.push(`${mod.label}: ${dmg} corruption damage!${spirit > 0 ? ' (Spirit resisted!)' : ''}`)
        if (s.playerHP <= 0) { await this.endBattle(false, lines); return }
      }
      if (mod.type === 'burn_ground') {
        const dmg = mod.damage || 1
        s.playerHP = Math.max(0, s.playerHP - dmg)
        s.enemyHP = Math.max(0, s.enemyHP - dmg)
        s.totalDamageTaken += dmg
        lines.push(`${mod.label}: ${dmg} damage to both fighters!`)
        if (s.enemyHP <= 0) { await this.endBattle(true, lines); return }
        if (s.playerHP <= 0) { await this.endBattle(false, lines); return }
      }

      lines.push(...this.tickStatuses('player'))
      if (s.playerHP <= 0) { await this.endBattle(false, lines); return }

      lines.push(this.enemyTurn())
      if (s.playerHP <= 0) { await this.endBattle(false, lines); return }

      lines.push(...this.tickStatuses('enemy'))
      if (s.enemyHP <= 0) { await this.endBattle(true, lines); return }

      for (const k of Object.keys(s.skillCooldowns)) {
        s.skillCooldowns[k] = Math.max(0, s.skillCooldowns[k] - 1)
      }

      // Some species regenerate or reposition at end of turn.
      const speciesKey = (s.enemy.species || '').toLowerCase().split(' ')[0]
      const behavior = ENEMY_BEHAVIORS[speciesKey] || {}
      if (behavior.turnEnd && s.enemyHP > 0) {
        const end = behavior.turnEnd(s, s.enemy)
        if (end) lines.push(end)
      }

      // A revive skill gets one chance to prevent a defeat, once per battle.
      if (s.playerHP <= 0 && !s.usedRevive) {
        const all = PET_SKILLS[SKILL_KEY_MAP[(s.player.petBaseName || '').toLowerCase()] || ''] || []
        const rev = all.find(sk => sk.revive && sk.unlockLevel <= (s.player.level || 1))
        if (rev) {
          s.usedRevive = true
          s.playerHP = Math.max(1, Math.floor(s.playerMaxHP * rev.revive.hpPct))
          lines.push(`${rev.icon} ${rev.name}! ${s.player.name} refuses to fall! Revived at ${s.playerHP} HP!`)
        }
      }
      if (s.playerHP <= 0) { await this.endBattle(false, lines); return }

      if (s.turn >= BATTLE_CONSTANTS.BATTLE_MAX_TURNS) { await this.endBattle(false, lines); return }

      s.narrative = lines
      s.log.push(...lines)
    } catch (err) {
      console.error('[battleService.playerAction]', err)
      s.narrative = ['⚠️ Something went wrong — try again!']
    } finally {
      s.processing = false
    }
  }

  // Ports manualBattle_endBattle()'s persistence half: writes back HP, awards
  // XP/level-ups and PP, and decrements cooking combat buffs.
  async endBattle(result, lines = []) {
    const s = battleState
    s.victory = result
    s.phase = 'over'
    s.narrative = lines
    s.log.push(...lines)
    // Fades out and resumes the background music if it was playing.
    musicService.stopBattleTrack()

    try {
      await supabase.from('user_pets')
        .update({ current_hp: Math.max(0, s.playerHP) })
        .eq('id', s.petId)

      await equipmentService.consumeCombatBuffs(s.petId)

      // Records the fight. THIS IS THE CALL THAT WRITES `battle_history` AND
      // THE `players.battles_won` / `total_battles` COUNTERS — see the note on
      // saveBattleResult(). It also awards XP and PP server-side when it
      // succeeds, so the client award below only runs on the fallback path.
      const saved = await this.saveBattleResult(s, result === true)

      if (result === true) {
        const enemyLevel = s.enemy.level || 1

        // Base rewards: the server's figures when the RPC ran, this port's own
        // formula otherwise (the Phase 7 behaviour, kept intact as the fallback).
        const baseXP = saved
          ? Math.max(0, saved.exp_gained || 0)
          : Math.max(5, Math.round(enemyLevel * 8 * (s.enemy.is_boss ? 2.5 : 1)))
        const basePP = saved
          ? Math.max(0, saved.pp_gained || 0)
          : Math.max(1, Math.round(enemyLevel * 3 * (s.enemy.is_boss ? 3 : 1)))

        // ── XP multipliers ───────────────────────────────────────────────────
        // Guild XP-boost perk (main:16210), then Battle Tuesday, then weather,
        // then the world event. All four return 1.0 when nothing is active.
        let xpMult = 1
        const guildXpMult = guildPerkService.multiplier('xp_boost')
        if (guildXpMult > 1) xpMult *= guildXpMult

        const calMult = getCalendarBonus('battle_xp')
        if (calMult > 1) {
          xpMult *= calMult
          s.calendarBonus = todaysEvent().name
        }

        xpMult *= weatherService.bonus('xpBonus')
        // LEGACY NOTE: `battleXpBonus` and `petXpBonus` are advertised by five
        // events (and by the news ticker headline) but are read NOWHERE in
        // legacy — only the "helper functions for other systems to use" comment
        // block mentions them. Applied for real here, for the same reason the
        // Rare Shoal bonus and Guard were: the game states them to the player.
        xpMult *= worldEventService.bonus('battleXpBonus')
        xpMult *= worldEventService.bonus('petXpBonus')

        const xp = Math.floor(baseXP * xpMult)

        // ── PP multipliers ───────────────────────────────────────────────────
        let ppMult = weatherService.bonus('ppBonus')
        ppMult *= worldEventService.bonus('ppGainBonus')
        ppMult *= worldEventService.bonus('battleRewards')
        ppMult *= worldEventService.bonus('allRewards')
        const pp = Math.floor(basePP * ppMult)

        // ── Grant ────────────────────────────────────────────────────────────
        // On the RPC path the server has already written `baseXP` to the pet, so
        // only the bonus difference is added here; on the fallback path the
        // whole amount is. Legacy shows these bonuses and grants NONE of them
        // when the RPC succeeds — it recomputes a display number with nothing
        // behind it (main:16209-16235). Granting the difference is what makes
        // the numbers on the rewards screen true.
        const xpToWrite = saved ? Math.max(0, xp - baseXP) : xp
        const petRes = await supabase.from('user_pets')
          .select('xp, level').eq('id', s.petId).single()
        let leveled = false
        let newLevel = petRes.data?.level || 1
        if (petRes.data) {
          let newXP = (petRes.data.xp || 0) + xpToWrite
          while (newXP >= newLevel * BATTLE_CONSTANTS.XP_PER_LEVEL) {
            newXP -= newLevel * BATTLE_CONSTANTS.XP_PER_LEVEL
            newLevel++
            leveled = true
          }
          await supabase.from('user_pets')
            .update({ xp: newXP, level: newLevel }).eq('id', s.petId)
        }

        const { playerService } = await import('./PlayerService.js')
        const ppToAward = saved ? Math.max(0, pp - basePP) : pp
        if (ppToAward > 0) {
          await playerService.awardPoints(ppToAward, saved ? 'battle_bonus' : 'battle_victory')
        } else if (saved && basePP > 0) {
          // The server already moved the balance; re-read it so the navbar and
          // sidebar don't keep showing the pre-battle number.
          await playerService.refreshPoints()
        }

        s.rewards = { xp, pp, leveled, newLevel, item: null }

        // Item drops — dropped entirely from the Phase 7 port. See rollItemDrop().
        s.rewards.item = await this.rollItemDrop(s)
      } else {
        s.rewards = { xp: 0, pp: 0, leveled: false, item: null }
      }

      this.companionReaction(result === true, s)
      this.recordMemories(result === true, s)

      // Pass XP. Legacy grants battle XP from TWO places for the same fight —
      // 8 inside saveBattleHistory (main:16158) and another 15/5 by result
      // (main:16235) — so a win is worth 23 and a loss 5, against a 50/day cap.
      // The Phase 7 port picked up only the first, so wins paid 8 and losses
      // nothing. One call, same effective amounts.
      passService.addXP(result === true ? 23 : 5, 'battle')

      if (result === true) {
        taskTracker.report('win_battle')
        // The last two weekly-challenge counters: 'Win a battle without damage'
        // and 'Fight a boss battle'. Both read state this engine already keeps.
        if (s.totalDamageTaken === 0) taskTracker.report('flawless_win')
        // Two community goals count specific KINDS of enemy, which no bus
        // event can express — reported straight to the goal service, as legacy
        // does (main:16355-16362).
        const enemyName = ((s.enemy && s.enemy.name) || '').toLowerCase()
        if (enemyName.includes('mushroom')) communityGoalService.increment('defeat_mushrooms')
        if (s.enemy && s.enemy.specialVariant === 'corrupted') communityGoalService.increment('corrupted_kills')
        if (s.enemy.is_boss) taskTracker.report('boss_fight')
        trackDailyStat('battles_won')
        argLogService.tryDrop('battle')
        petMoodService.completeWish(s.petId, 'win_battle')
        // Announce to activity_feed. These three (boss_defeated / level_up /
        // pet_fainted) all live in legacy's saveBattleHistory (main:16258,
        // 16417, 16452) and were dropped when it was ported — so the Discord
        // bot and the OBS ticker, which subscribe to activity_feed INSERTs,
        // have never reported a boss kill, a level-up or a faint from the
        // Vue app.
        if (s.rewards && s.rewards.leveled) {
          activityService.log('level_up', {
            pet_name: this.petNameFor(s.petId),
            level: s.rewards.newLevel
          })
        }
        if (s.enemy.is_boss) {
          activityService.log('boss_defeated', { boss_name: s.enemy.name })
          trackDailyStat('bosses_killed')
          // Per-player tally, ported from legacy's `player_local_stats` blob —
          // Melon's `first_boss` milestone is the only reader.
          recordLocalBossKill()
          // Ports nudgeWorldStateForBossKill() — corruption ticks down and, on
          // every tenth community kill, a one-hour +15% XP/PP celebration buff
          // fires for everyone. WeatherService.bonus() already layers that buff
          // on XP and PP, so this is what makes it reachable.
          this.nudgeWorldStateForBossKill()
        }
        // Badges and player titles. Not awaited: the rewards screen should not
        // wait on several count queries, and awardBattleBadges never throws.
        import('./BattleBadges.js')
          .then(m => m.awardBattleBadges(s))
          .catch(e => console.error('[battleService] badge pass failed:', e))
      }
    } catch (err) {
      console.error('[battleService.endBattle]', err)
    }
  }

  // The activity_feed payloads name the pet, and the battle state carries only
  // its id. Legacy read the name off its in-memory pet cache the same way.
  petNameFor(petId) {
    const pet = (AppState.ownedPets || []).find(p => p.id === petId)
    return (pet && pet.nickname) || 'their pet'
  }

  // Ports the six SCRAPBOOK blocks in manualBattle_endBattle (main:16362-16446).
  // Fire-and-forget: a memory is flavour, and must never delay or fail the
  // rewards screen. `add()` handles its own once-per-pet and cooldown rules.
  recordMemories(won, s) {
    const petId = s.petId
    if (!petId) return
    const maxHP = Math.max(1, s.playerMaxHP || 60)

    if (won) {
      scrapbookService.add(petId, 'first_battle_win', { enemy: (s.enemy && s.enemy.name) || 'an enemy' })
      if (s.playerHP > 0 && s.playerHP < maxHP * 0.1) {
        scrapbookService.add(petId, 'low_hp_victory', { hp: s.playerHP })
      }
      const lvl = s.rewards && s.rewards.newLevel
      if (s.rewards && s.rewards.leveled && [5, 10, 15, 20].includes(lvl)) {
        scrapbookService.add(petId, 'level_milestone', { level: lvl })
      }
      // Evolution stages land at 5 and 10, so a level-up across either boundary
      // is also an evolution.
      if (s.rewards && s.rewards.leveled) {
        if (lvl === 5) scrapbookService.add(petId, 'evolution_teen', {})
        if (lvl === 10) scrapbookService.add(petId, 'evolution_adult', {})
      }
    } else if (s.playerHP <= 0) {
      // Legacy records this only on an actual 0-HP faint, not on every loss, so
      // it stays a moment rather than noise. The activity_feed announcement is
      // gated the same way, matching main:16452.
      scrapbookService.add(petId, 'first_battle_loss', { enemy: (s.enemy && s.enemy.name) || 'an enemy' })
      activityService.log('pet_fainted', {
        pet_name: this.petNameFor(petId),
        enemy: (s.enemy && s.enemy.name) || 'an enemy'
      })
    }
  }

  // Ports saveBattleHistory() (main:16100-16145).
  //
  // THIS WAS DROPPED BY THE PHASE 7 PORT, and it is the load-bearing half of
  // the legacy function rather than a nicety. `save_battle_result` is the ONLY
  // writer of `players.battles_won` and `players.total_battles` anywhere in the
  // codebase — nothing updates those columns client-side — and it is what
  // inserts the `battle_history` row. Without it:
  //   • BattleBadges' `battle_history` counts are always 0, so the boss-slayer
  //     and battle-count badges are unreachable
  //   • AwardService's fighter/warrior/champion player titles never unlock
  //   • the Stats page shows 0 battles for a player who has fought hundreds
  //   • Melon's `first_boss` milestone can never fire
  //
  // Returns the server's reward figures, or null if the RPC is unavailable — in
  // which case endBattle falls back to computing and awarding them itself,
  // which is the behaviour this port has had since Phase 7. Legacy decides
  // whether to fall back the same way.
  async saveBattleResult(s, victory) {
    if (!s.petId || !s.enemy) return null
    try {
      // Legacy is explicit that enemy ids are INTEGERS here and that passing a
      // numeric string breaks the RPC's signature, so the coercion is kept.
      const rawId = s.enemy.id
      const enemyId = (typeof rawId === 'string' && !isNaN(parseInt(rawId, 10)))
        ? parseInt(rawId, 10)
        : rawId

      const { data, error } = await supabase.rpc('save_battle_result', {
        p_pet_id: s.petId,
        p_enemy_id: enemyId,
        p_victory: victory,
        p_turns_taken: s.turn || 0,
        p_player_final_hp: Math.max(0, s.playerHP),
        p_battle_log: s.log || []
      })
      if (error || !data || data.error) {
        console.error('[battleService.saveBattleResult] falling back to client rewards:',
          (error && error.message) || (data && data.error))
        return null
      }
      return data
    } catch (e) {
      console.error('[battleService.saveBattleResult]', e)
      return null
    }
  }

  // Ports the two item-drop branches of manualBattle_endBattle
  // (main:16276-16340). Also dropped by the Phase 7 port, so no battle in the
  // Vue app has ever produced loot — including bosses, whose drop tables are
  // the only source of their gear.
  //
  // Boss kills roll the boss's own zone-scoped table; ordinary wins have a flat
  // 10% chance at something cheap, multiplied by the world event's
  // rareFindChance and the weather's dropChance.
  async rollItemDrop(s) {
    if (!AppState.user) return null
    try {
      if (s.enemy.is_boss) {
        const zone = s.enemy.forest_zone || s.zone || ''
        const res = await supabase.from('items').select('*')
          .eq('is_boss_drop', true)
          .ilike('boss_source', '%' + zone + '%')
        if (res.error || !res.data || !res.data.length) return null
        const item = res.data[Math.floor(Math.random() * res.data.length)]
        await inventoryService.grant(AppState.user.id, item.id, 1)
        return item
      }

      let dropChance = 0.1
      dropChance *= worldEventService.bonus('rareFindChance')
      dropChance *= worldEventService.bonus('legendaryDropChance')
      dropChance *= weatherService.bonus('dropChance')
      if (Math.random() >= dropChance) return null

      const res = await supabase.from('items').select('*')
        .lte('price', 100)
        .or('is_boss_drop.is.null,is_boss_drop.eq.false')
        .limit(20)
      if (res.error || !res.data || !res.data.length) return null
      const item = res.data[Math.floor(Math.random() * res.data.length)]
      // Legacy inserts a fresh row here rather than incrementing, so a second
      // drop of the same item produced a duplicate inventory line. grant()
      // upserts, which is what every other award path in this app does.
      await inventoryService.grant(AppState.user.id, item.id, 1)
      return item
    } catch (e) {
      console.error('[battleService.rollItemDrop]', e)
      return null
    }
  }

  // Ports nudgeWorldStateForBossKill() (main:7066). Fire-and-forget: a failure
  // here must never hold up the rewards screen.
  nudgeWorldStateForBossKill() {
    ;(async () => {
      try {
        await supabase.rpc('nudge_world_state', { p_flag_key: 'corruption_level', p_delta: -1 })
        const killRes = await supabase.rpc('record_boss_kill')
        // Force a fresh read so corruption and any new celebration buff are
        // visible to the next thing that asks.
        await worldStateService.loadFlags(true)
        if (killRes.data && killRes.data.triggered) {
          toastService.success('🎉 10 bosses defeated by the community! Everyone gets a 1-hour +15% XP/PP bonus!')
        }
      } catch (e) {
        console.error('[battleService.nudgeWorldStateForBossKill]', e)
      }
    })()
  }

  // Ports the two COMPANION REACTION blocks in manualBattle_endBattle: the
  // companion cheers the win, remembers how it went so it can bring it up later,
  // and follows up on a level-up three seconds afterwards.
  companionReaction(won, s) {
    companionService.remember({
      lastBattleResult: {
        victory: won,
        enemyName: (s.enemy && s.enemy.name) || null,
        finalHP: s.playerHP
      }
    })
    if (!won) return
    companionService.react([
      'That was incredible! ⚔️✨',
      "You're so strong! 💪",
      'Amazing battle! 🌟',
      'We won! 🎉',
      'Victory is ours! ⭐'
    ])
    if (s.rewards && s.rewards.leveled) {
      companionService.react(["You're getting stronger! 💪⭐"], 3000)
    }
  }

  reset() {
    // Covers leaving the page mid-fight, where endBattle never runs.
    musicService.stopBattleTrack(false)
    battleState.active = false
    battleState.phase = 'exploring'
    battleState.victory = null
    battleState.rewards = null
    battleState.calendarBonus = null
    battleState.narrative = []
    battleState.log = []
  }
}

export const battleService = new BattleService()
