// Logic smoke test for the ported battle engine.
//
// Runs many randomised fights against every enemy species that has an AI
// behaviour, through battleService.resolveTurn() — the same turn the page runs,
// not a copy of it. Only startBattle()/endBattle() touch Supabase, so the state
// is populated directly and no network or browser is needed.
//
// Run from webapp/ — plain `node` cannot load the services (see smoke-hooks.mjs):
//   node --experimental-loader ./smoke-hooks.mjs battle-smoke.mjs
import { battleService, battleState, calculateDamage } from './src/services/BattleService.js'
import {
  PET_SKILLS, ENEMY_BEHAVIORS, ZONE_CONFIG, SKILL_KEY_MAP, STATUS_EFFECTS, INTEGRITY_TIERS, INTEGRITY_STABLE
} from './src/data/battleData.js'
import { skillLoadout, passiveSkills } from './src/utils/petSkills.js'
import { generateWildEnemy, scalePiper } from './src/utils/enemyScaling.js'
import { simulateBattle } from './src/services/AutoBattle.js'
import { argState } from './src/services/ArgLogService.js'
import { TESTER_LOGS } from './src/data/argLogData.js'

// localStorage is only used for the skill loadout; a stub keeps that path live.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }

const problems = []
let turnsRun = 0
let fights = 0

// Every mechanic restored or made to work on 2026-09-15, matched against the
// narrative each turn produces. Each must fire at least once, so a change that
// silently disconnects one fails the run instead of passing quietly — which is
// how all of them went missing in the first place.
const MECHANICS = {
  integrityMisfire: /Beta glitch! /,
  integrityDamage: /integrity damage!/,
  corruptedFury: /Corrupted Fury!/,
  legendaryProc: /Critical strike!|Double hit!|The enemy is stunned!|Ignores defence|Enemy attack -/,
  speciesAttackMod: /\(\d\.\dx\)/,
  enemyGlitched: /glitches out/,
  petConfused: /Smoke is confused and misses/,
  fogEvasion: /slips away in the fog/,
  stunOrFearFromSkill: /(Stun|Fear) (applied|guaranteed)!/,
  noDamageStatus: /uses Portal Peek!.*applied!/,
  escapeAttempt: /Success! The enemy loses|Failed! Smoke loses|shakes it off/,
  timedAtkBuff: /attack for \d turns?!/,
  timedDefBuff: /defense for \d turns?!/,
  evasionDodge: /but misses!/,
  passiveLifesteal: /Feral Aura:/,
  revive: /refuses to fall/
}
const fired = Object.fromEntries(Object.keys(MECHANICS).map(k => [k, 0]))
let battleStarts = 0

// The four legendary procs the manual engine used to skip, plus the two it
// never had at all (attackShred, ignoreDefense).
const LEGENDARY_GEAR = [
  { effect: 'fated_strike', chance: 40 },
  { effect: 'haunting_melody', chance: 40 },
  { effect: 'pipers_final_verse', chance: 40 },
  { effect: 'cataloged_weakness', chance: 40 }
]
const INTEGRITY = [INTEGRITY_STABLE, ...INTEGRITY_TIERS]

function setupFight(petName, level, species, zoneKey, opts = {}) {
  const skills = skillLoadout('smoke-pet', petName, level)
  Object.assign(battleState, {
    active: true, phase: 'fighting', zone: zoneKey,
    zoneConf: ZONE_CONFIG[zoneKey],
    petId: 'smoke-pet',
    integrity: opts.integrity || INTEGRITY_STABLE,
    // Piper fight state — inert unless the enemy is actually Piper.
    piperPhase: 1, piperMelody: 0, piperInfluence: 0, piperSkillCooldown: 0,
    piperPhase2Triggered: false, piperPhase3Triggered: false,
    piperTelegraphFired: false, piperNextAction: null,
    piperGlitch: 0, piperFlash: 0,
    // Species AI flags, reset as startBattle resets them.
    enemyTelegraph: null, _squirrelDodge: false, _bunnyDodgeActive: false,
    _boarCharge: false, _boarBerserk: false, _bearMaul: false,
    _wolfHowled: false, _wolfAtkBuff: 0, _slimeHealed: false,
    player: {
      name: 'Smoke', petBaseName: petName, level,
      imageFile: null, passives: opts.legendary ? LEGENDARY_GEAR : [],
      stats: { attack: 12, defense: 6, speed: 5, luck: 4, spirit: 3 },
      skills,
      passiveSkills: passiveSkills(petName, level)
    },
    enemy: opts.piper
      ? { name: 'Shadow of Piper', species: 'piper', hp: 400, attack: 14, defense: 6, speed: 6, is_boss: true, level, passives: [] }
      : {
          name: 'Test ' + species, species, hp: 90, attack: 8, defense: 4, speed: 5, is_boss: false, level,
          specialVariant: opts.corrupted ? 'corrupted' : null,
          passives: opts.corrupted ? [{ effect: 'corrupted_fury', chance: 20 }] : []
        },
    playerHP: 80, playerMaxHP: 80,
    enemyHP: opts.piper ? 400 : 90,
    enemyMaxHP: opts.piper ? 400 : 90,
    turn: 0, playerStatuses: {}, enemyStatuses: {}, skillCooldowns: {},
    skillUseCount: 0, attackUseCount: 0, enemyDefDebuff: 0,
    playerEvasionBuff: false, playerDefShred: 0, enemyAtkDebuff: 0,
    timedMods: [], turnStep: 'end',
    totalDamageTaken: 0, uniqueStatusesApplied: [], skillsUsedThisBattle: [],
    narrative: [], log: [], victory: null, processing: false,
    usedRevive: false, archive: battleService.archiveBonus()
  })
  battleService.attachBehaviorHelpers()
  // startBattle's opening hook (the mushroom's spore cloud).
  if (battleService.behaviorFor(battleState.enemy).battleStart?.(battleState, battleState.enemy)) battleStarts++
}

// One real turn, minus endBattle's persistence. Returns the outcome, or null.
function runTurn(action, payload) {
  const { lines, outcome } = battleService.resolveTurn(action, payload)
  for (const line of lines) {
    for (const [name, pattern] of Object.entries(MECHANICS)) {
      if (pattern.test(line)) fired[name]++
    }
  }
  return outcome
}

// State that must hold after every turn that did not end the battle.
function checkTurnState(label) {
  const s = battleState
  check(s.playerHP >= 0 && s.enemyHP >= 0, `${label}: HP went negative`)
  check(s.playerHP <= s.playerMaxHP, `${label}: playerHP exceeded max`)
  check(!Number.isNaN(s.playerHP) && !Number.isNaN(s.enemyHP), `${label}: HP is NaN`)
  check(s.timedMods.every(m => m.lastTurn > s.turn), `${label}: an expired timed mod survived the turn`)
  for (const side of [s.playerStatuses, s.enemyStatuses]) {
    for (const [type, st] of Object.entries(side)) {
      check(STATUS_EFFECTS[type], `${label}: unknown status "${type}" on a fighter`)
      check(st.turns > 0, `${label}: status "${type}" left at ${st.turns} turns`)
    }
  }
  for (const n of [battleService.playerAttack(), battleService.playerDefense(), battleService.enemyDefense(), battleService.enemyAttack()]) {
    check(Number.isFinite(n) && n >= 0, `${label}: an effective stat is ${n}`)
  }
}

function check(cond, msg) { if (!cond) problems.push(msg) }

const pets = Object.keys(PET_SKILLS)
const species = Object.keys(ENEMY_BEHAVIORS)
const zones = Object.keys(ZONE_CONFIG)

for (const petName of pets) {
  for (const sp of species) {
    for (const zoneKey of zones) {
      // 32 unlocks every passive and revive skill.
      for (const level of [1, 5, 12, 20, 32]) {
        // Cycle integrity tiers, Corrupted enemies and legendary gear across
        // the grid so every combination turns up.
        setupFight(petName, level, sp, zoneKey, {
          integrity: INTEGRITY[fights % INTEGRITY.length],
          corrupted: fights % 3 === 0,
          legendary: fights % 2 === 1
        })
        fights++
        const skillCount = battleState.player.skills.length
        check(skillCount > 0, `${petName} L${level}: no skills in loadout`)

        for (let t = 0; t < 60; t++) {
          let action = 'attack'
          let payload
          if (Math.random() < 0.55 && skillCount) {
            action = 'skill'
            payload = Math.floor(Math.random() * skillCount)
          }
          let outcome
          try {
            outcome = runTurn(action, payload)
          } catch (err) {
            problems.push(`${petName} vs ${sp} in ${zoneKey} L${level}: ${err.stack}`)
            break
          }
          turnsRun++
          if (outcome) break
          checkTurnState(`${petName} vs ${sp} in ${zoneKey} L${level}`)
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
  for (const level of [1, 10, 20, 32]) {
    setupFight(petName, level, 'piper', 'ruins', { piper: true })
    piperFights++
    const skillCount = battleState.player.skills.length
    for (let t = 0; t < 200; t++) {
      const useSkill = Math.random() < 0.5 && skillCount
      let outcome
      try {
        outcome = runTurn(useSkill ? 'skill' : 'attack', useSkill ? Math.floor(Math.random() * skillCount) : undefined)
      } catch (err) {
        problems.push(`Piper vs ${petName} L${level}: ${err.stack}`)
        break
      }
      turnsRun++
      const s = battleState
      check(s.piperPhase >= 1 && s.piperPhase <= 3, `Piper vs ${petName}: bad phase ${s.piperPhase}`)
      if (outcome === 'win' || s.enemyHP <= 0) break
      checkTurnState(`Piper vs ${petName} L${level}`)
      // The player is topped up so the fight lasts long enough to reach phase 3.
      if (s.playerHP < 25 || outcome === 'lose') { s.playerHP = 80; s.playerStatuses = {} }
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

// ── Wild enemy generation ────────────────────────────────────────────────────
// generateWildEnemy() is pure, so every zone can be rolled thousands of times.
const template = {
  id: 1, name: 'Slime', species: 'slime', forest_zone: 'glade',
  base_hp: 20, base_attack: 4, base_defense: 2, base_speed: 3, spawn_weight: 5
}
const variantsSeen = new Set()
let enemiesGenerated = 0
for (const zoneKey of zones) {
  const conf = ZONE_CONFIG[zoneKey]
  for (const playerLevel of [1, 5, 12, 20, 40]) {
    for (let i = 0; i < 1500; i++) {
      const e = generateWildEnemy(template, zoneKey, playerLevel, {
        corruption: i % 101,
        weatherId: i % 7 === 0 ? 'cursed' : 'clear'
      })
      enemiesGenerated++
      for (const k of ['base_hp', 'base_attack', 'base_defense', 'base_speed', 'level']) {
        check(Number.isFinite(e[k]) && e[k] >= 1, `wild ${zoneKey}: ${k} is ${e[k]}`)
      }
      check(e.level >= conf.minLevel && e.level <= conf.maxLevel, `wild ${zoneKey}: level ${e.level} outside the zone band`)
      check(e.name.endsWith(' Slime') && e.name !== 'Slime', `wild ${zoneKey}: bad name "${e.name}"`)
      check((e.specialVariant === 'corrupted') === !!e.passive, `wild ${zoneKey}: passive without corruption, or the reverse`)
      if (e.specialVariant) variantsSeen.add(e.specialVariant)
    }
  }
}
for (const v of ['golden', 'shiny', 'glitched', 'corrupted', 'rare']) {
  check(variantsSeen.has(v), `wild enemies: ${v} never rolled`)
}

for (const zoneKey of zones) {
  for (const playerLevel of [1, 10, 30]) {
    const p = scalePiper(
      { id: 10, name: 'Shadow of Piper', is_boss: true, base_hp: 120, base_attack: 10, base_defense: 5, base_speed: 6 },
      zoneKey, playerLevel
    )
    check(p.level === Math.max(5, playerLevel + 6), `Piper ${zoneKey}: level ${p.level}`)
    check(p.is_boss && p.forest_zone === zoneKey, `Piper ${zoneKey}: lost is_boss or zone`)
    for (const k of ['base_hp', 'base_attack', 'base_defense', 'base_speed']) {
      check(Number.isFinite(p[k]) && p[k] >= 1, `Piper ${zoneKey}: ${k} is ${p[k]}`)
    }
  }
}

// ── Archive combat bonus ─────────────────────────────────────────────────────
// One log is +1% damage (it was +25%); the full Archive tops out at +35%.
argState.found = { 'LOG-001': {} }
let archive = battleService.archiveBonus()
check(Math.abs(archive.dmgPct - 0.01) < 1e-9, `archive: one log gave dmgPct ${archive.dmgPct}`)
check(archive.healPct === 0 && archive.statusResist === 0, 'archive: one ordinary log granted a themed bonus')
argState.found = Object.fromEntries(TESTER_LOGS.map(l => [l.id, {}]))
archive = battleService.archiveBonus()
check(Math.abs(archive.dmgPct - (TESTER_LOGS.length * 0.01 + 0.15)) < 1e-9, `archive: full dmgPct ${archive.dmgPct}`)
check(Math.abs(archive.healPct - 0.20) < 1e-9, `archive: full healPct ${archive.healPct}`)
check(archive.statusResist === 0.10 && archive.corruptedDmgPct === 0.10, 'archive: themed log bonuses missing')
argState.found = {}

// ── Skill data ───────────────────────────────────────────────────────────────
// Every status a skill names must exist, or applying it silently does nothing —
// which is how twenty skills' Stun and Fear never landed.
for (const [pet, skills] of Object.entries(PET_SKILLS)) {
  for (const sk of skills) {
    for (const type of [sk.status?.type, sk.status2?.type, sk.condBonus?.ifStatus, sk.condBonus?.guaranteeStatus]) {
      if (type) check(STATUS_EFFECTS[type], `${pet}/${sk.id}: unknown status "${type}"`)
    }
    if (sk.passiveEffect) {
      check(['atk_bonus', 'lifesteal_pct', 'evasion_per_turn', 'def_bonus'].includes(sk.passiveEffect.type),
        `${pet}/${sk.id}: passive type "${sk.passiveEffect.type}" has no implementation`)
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

check(battleStarts > 0, 'battleStart never fired')
for (const [mechanic, count] of Object.entries(fired)) {
  check(count > 0, `${mechanic} never fired — has it been disconnected again?`)
}

console.log(`auto-battles: ${autoFights} (${autoTurns} turns)`)
console.log(`fights: ${fights}   piper fights: ${piperFights} (phase2 reached ${sawPhase2}x, phase3 ${sawPhase3}x)   turns: ${turnsRun}`)
console.log(`wild enemies generated: ${enemiesGenerated} (variants seen: ${[...variantsSeen].sort().join(', ')})`)
console.log(`battleStart ${battleStarts}; mechanics fired: ` + Object.entries(fired).map(([k, n]) => `${k} ${n}`).join(', '))
if (problems.length) {
  const unique = [...new Set(problems)]
  console.log(`PROBLEMS: ${problems.length} (${unique.length} unique)`)
  unique.slice(0, 25).forEach(p => console.log('  - ' + p))
  process.exit(1)
}
console.log('OK — no exceptions, no invariant violations')
