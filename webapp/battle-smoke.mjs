// Logic smoke test for the ported battle engine.
//
// Runs many randomised fights against every enemy species that has an AI
// behaviour, driving the same code paths the UI does. It bypasses
// startBattle()/endBattle() (the only Supabase-touching parts) and populates
// the state directly, so it needs no network and no browser.
//
// Run: node battle-smoke.mjs   (from webapp/)
import { battleService, battleState, calculateDamage } from './src/services/BattleService.js'
import { PET_SKILLS, ENEMY_BEHAVIORS, ZONE_CONFIG, SKILL_KEY_MAP } from './src/data/battleData.js'
import { skillLoadout } from './src/utils/petSkills.js'
import { simulateBattle } from './src/services/AutoBattle.js'

// localStorage is only used for the skill loadout; a stub keeps that path live.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }

const problems = []
let turnsRun = 0
let fights = 0

function setupFight(petName, level, species, zoneKey, opts = {}) {
  const skills = skillLoadout('smoke-pet', petName, level)
  Object.assign(battleState, {
    active: true, phase: 'fighting', zone: zoneKey,
    zoneConf: ZONE_CONFIG[zoneKey],
    petId: 'smoke-pet',
    // Piper fight state — inert unless the enemy is actually Piper.
    piperPhase: 1, piperMelody: 0, piperInfluence: 0, piperSkillCooldown: 0,
    piperPhase2Triggered: false, piperPhase3Triggered: false,
    piperTelegraphFired: false, piperNextAction: null,
    piperGlitch: 0, piperFlash: 0,
    player: {
      name: 'Smoke', petBaseName: petName, level,
      imageFile: null, passives: [],
      stats: { attack: 12, defense: 6, speed: 5, luck: 4, spirit: 3 },
      skills
    },
    enemy: opts.piper
      ? { name: 'Shadow of Piper', species: 'piper', hp: 400, attack: 14, defense: 6, speed: 6, is_boss: true, level }
      : { name: 'Test ' + species, species, hp: 90, attack: 8, defense: 4, speed: 5, is_boss: false, level },
    playerHP: 80, playerMaxHP: 80,
    enemyHP: opts.piper ? 400 : 90,
    enemyMaxHP: opts.piper ? 400 : 90,
    turn: 0, playerStatuses: {}, enemyStatuses: {}, skillCooldowns: {},
    skillUseCount: 0, attackUseCount: 0, enemyDefDebuff: 0,
    playerAtkBuff: 0, playerEvasionBuff: false, playerDefShred: 0,
    totalDamageTaken: 0, uniqueStatusesApplied: [], skillsUsedThisBattle: [],
    narrative: [], log: [], victory: null, processing: false,
    usedRevive: false, archive: battleService.archiveBonus()
  })
  battleService.attachBehaviorHelpers()
}

// One turn, without the persistence that endBattle() would do.
function runTurn(action, payload) {
  const s = battleState
  s.turn++
  if (s.playerStatuses.stun || s.playerStatuses.fear) {
    const k = s.playerStatuses.stun ? 'stun' : 'fear'
    s.playerStatuses[k].turns--
    if (s.playerStatuses[k].turns <= 0) delete s.playerStatuses[k]
  } else {
    battleService.resolvePlayerAction(action, payload)
    if (s.fled || s.enemyHP <= 0) return 'end'
  }
  battleService.tickStatuses('player')
  if (s.playerHP <= 0) return 'end'
  battleService.enemyTurn()
  if (s.playerHP <= 0) return 'end'
  battleService.tickStatuses('enemy')
  if (s.enemyHP <= 0) return 'end'
  for (const k of Object.keys(s.skillCooldowns)) {
    s.skillCooldowns[k] = Math.max(0, s.skillCooldowns[k] - 1)
  }
  const beh = ENEMY_BEHAVIORS[(s.enemy.species || '').toLowerCase().split(' ')[0]] || {}
  if (beh.turnEnd && s.enemyHP > 0) beh.turnEnd(s, s.enemy)
  return 'continue'
}

function check(cond, msg) { if (!cond) problems.push(msg) }

const pets = Object.keys(PET_SKILLS)
const species = Object.keys(ENEMY_BEHAVIORS)
const zones = Object.keys(ZONE_CONFIG)

for (const petName of pets) {
  for (const sp of species) {
    for (const zoneKey of zones) {
      for (const level of [1, 5, 12, 20]) {
        setupFight(petName, level, sp, zoneKey)
        fights++
        const skillCount = battleState.player.skills.length
        check(skillCount > 0, `${petName} L${level}: no skills in loadout`)

        for (let t = 0; t < 60; t++) {
          const r = Math.random()
          let action = 'attack'
          let payload
          if (r < 0.55 && skillCount) {
            action = 'skill'
            payload = Math.floor(Math.random() * skillCount)
          }
          let out
          try {
            out = runTurn(action, payload)
          } catch (err) {
            problems.push(`${petName} vs ${sp} in ${zoneKey} L${level}: ${err.message}`)
            break
          }
          turnsRun++
          const s = battleState
          check(s.playerHP >= 0, `${petName} vs ${sp}: playerHP went negative`)
          check(s.enemyHP >= 0, `${petName} vs ${sp}: enemyHP went negative`)
          check(s.playerHP <= s.playerMaxHP, `${petName} vs ${sp}: playerHP exceeded max`)
          check(!Number.isNaN(s.playerHP), `${petName} vs ${sp}: playerHP is NaN`)
          check(!Number.isNaN(s.enemyHP), `${petName} vs ${sp}: enemyHP is NaN`)
          if (out === 'end') break
        }
      }
    }
  }
}

// ── Shadow of Piper ──────────────────────────────────────────────────────────
// Piper fights are long (400 HP) and phase-gated, so they're driven separately
// with enough turns to actually cross both HP thresholds and fire the
// telegraph → resolve cycle.
let piperFights = 0
let sawPhase2 = 0
let sawPhase3 = 0
for (const petName of pets) {
  for (const level of [1, 10, 20]) {
    setupFight(petName, level, 'piper', 'ruins', { piper: true })
    piperFights++
    const skillCount = battleState.player.skills.length
    for (let t = 0; t < 200; t++) {
      const useSkill = Math.random() < 0.5 && skillCount
      let out
      try {
        out = runTurn(useSkill ? 'skill' : 'attack', useSkill ? Math.floor(Math.random() * skillCount) : undefined)
      } catch (err) {
        problems.push(`Piper vs ${petName} L${level}: ${err.message}`)
        break
      }
      turnsRun++
      const s = battleState
      check(s.playerHP >= 0 && s.enemyHP >= 0, `Piper vs ${petName}: HP went negative`)
      check(!Number.isNaN(s.playerHP) && !Number.isNaN(s.enemyHP), `Piper vs ${petName}: HP is NaN`)
      check(s.piperPhase >= 1 && s.piperPhase <= 3, `Piper vs ${petName}: bad phase ${s.piperPhase}`)
      // The player is topped up so the fight lasts long enough to reach phase 3.
      if (s.playerHP < 25) { s.playerHP = 80; s.playerStatuses = {} }
      if (out === 'end') break
    }
    if (battleState.piperPhase2Triggered) sawPhase2++
    if (battleState.piperPhase3Triggered) sawPhase3++
  }
}
check(sawPhase2 > 0, 'Piper phase 2 never triggered in any fight')
check(sawPhase3 > 0, 'Piper phase 3 never triggered in any fight')

// ── Starter Dungeon auto-battle ──────────────────────────────────────────────
// simulateBattle() is a separate engine from the manual one, so it gets its own
// coverage: every pet, every zone modifier, and the three wave multipliers.
let autoFights = 0
let autoTurns = 0
for (const petName of pets) {
  for (const zoneKey of zones) {
    for (const mult of [0.7, 1.3, 2.5]) {
      const player = {
        name: 'Smoke', maxHP: 80, currentHP: 80, passives: [],
        stats: { attack: 12, defense: 6, speed: 5, luck: 4, spirit: 3 },
        specialSkill: mult === 1.3
          ? { name: 'Test Skill', icon: '✨', trigger_chance: 0.3, damage_multiplier: 1.5, heal_percent: 0.2 }
          : null
      }
      const enemy = {
        name: 'Wave Enemy', species: 'bird', forest_zone: zoneKey,
        hp: Math.floor(60 * mult), attack: Math.floor(8 * mult),
        defense: Math.floor(4 * mult), speed: 5, is_boss: mult === 2.5
      }
      let result
      try {
        result = simulateBattle(player, enemy)
      } catch (err) {
        problems.push(`auto-battle ${petName}/${zoneKey}/x${mult}: ${err.message}`)
        continue
      }
      autoFights++
      autoTurns += result.turns
      check(typeof result.victory === 'boolean', 'auto-battle: victory not boolean')
      check(result.playerFinalHP >= 0, 'auto-battle: negative final HP')
      check(!Number.isNaN(result.playerFinalHP), 'auto-battle: NaN final HP')
      check(result.log.length > 0, 'auto-battle: empty log')
      check(result.log[result.log.length - 1].type === 'end', 'auto-battle: log does not end with an end entry')
      // A fight must terminate, never spin to the turn cap by accident.
      check(result.turns <= 50, `auto-battle: ran ${result.turns} turns`)
    }
  }
}

// calculateDamage invariants
for (let i = 0; i < 20000; i++) {
  const d = calculateDamage(
    Math.floor(Math.random() * 60), Math.floor(Math.random() * 40), Math.floor(Math.random() * 50)
  )
  check(d.damage >= 1, 'calculateDamage produced < 1')
  check(!Number.isNaN(d.damage), 'calculateDamage produced NaN')
}

// Every skill referenced by a loadout must resolve to a real entry.
for (const petName of pets) {
  const key = SKILL_KEY_MAP[petName] || petName
  check(PET_SKILLS[key], `SKILL_KEY_MAP has no entry resolving ${petName}`)
}

console.log(`auto-battles: ${autoFights} (${autoTurns} turns)`)
console.log(`fights: ${fights}   piper fights: ${piperFights} (phase2 reached ${sawPhase2}x, phase3 ${sawPhase3}x)   turns: ${turnsRun}`)
if (problems.length) {
  const unique = [...new Set(problems)]
  console.log(`PROBLEMS: ${problems.length} (${unique.length} unique)`)
  unique.slice(0, 25).forEach(p => console.log('  - ' + p))
  process.exit(1)
}
console.log('OK — no exceptions, no invariant violations')
