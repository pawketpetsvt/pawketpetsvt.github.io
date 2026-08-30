// Logic smoke test for the guild-dungeon combat engine.
//
// GuildDungeonEngine is pure — no Supabase, no DOM — so this imports it
// directly under plain Node with no loader hooks, the same as race-smoke.mjs.
//
// Run: node guild-dungeon-smoke.mjs   (from webapp/)
import {
  buildWaves, createBattle, playerAction, nextWave, startRoundIfNeeded,
  battleOver, allEnemiesDead, allPartyDead, hasMoreWaves, currentActor, isPartyTurn
} from './src/services/GuildDungeonEngine.js'
import { DUNGEON_ENEMIES } from './src/data/guildDungeonData.js'

// Deterministic RNG so a failure is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ACTIONS = ['attack', 'power', 'guard']
const violations = []
let battles = 0
let turns = 0
let guardsUsed = 0
let guardReduced = 0

function check(cond, msg) {
  if (!cond) violations.push(msg)
}

function makeParty(size, rng) {
  const party = []
  for (let i = 0; i < size; i++) {
    const maxHp = 40 + Math.floor(rng() * 120)
    party.push({
      id: 'pet' + i,
      name: 'Pet' + i,
      ownerName: i === 0 ? 'You' : 'Mate' + i,
      isPlayer: i === 0,
      icon: '🐾',
      maxHp,
      currentHp: maxHp,
      attack: 5 + Math.floor(rng() * 25),
      defense: 2 + Math.floor(rng() * 12),
      speed: 2 + Math.floor(rng() * 8)
    })
  }
  return party
}

function validateState(s, label) {
  for (const c of [...s.party, ...s.enemies]) {
    check(Number.isFinite(c.currentHp), `${label}: ${c.name} HP is not finite (${c.currentHp})`)
    check(c.currentHp >= 0, `${label}: ${c.name} HP below zero (${c.currentHp})`)
    check(c.currentHp <= c.maxHp, `${label}: ${c.name} HP above max (${c.currentHp}/${c.maxHp})`)
  }
  for (const e of s.log.concat(s.fullLog)) {
    check(typeof e.text === 'string' && e.text.length > 0, `${label}: empty log entry`)
    check(!/NaN|undefined/.test(e.text), `${label}: log entry contains NaN/undefined — "${e.text}"`)
  }
}

// ── Guard must actually reduce incoming damage ──────────────────────────────
// This is the behaviour the live site advertises and never implements; assert
// the port really does it rather than trusting the code read.
function guardCheck() {
  const { enemyAct } = globalThis.__engine || {}
  // Compare damage taken with and without _guarding, same RNG stream.
  const mk = () => ({
    dungeon: { name: 'T' }, waves: [[]], waveIndex: 0, turn: 0,
    actorQueue: [], roundDone: false, log: [], fullLog: [],
    party: [{ id: 'p', name: 'P', ownerName: 'You', isPlayer: true, icon: '🐾', maxHp: 500, currentHp: 500, attack: 1, defense: 20, speed: 1 }],
    enemies: [{ name: 'E', icon: '👻', maxHp: 100, currentHp: 100, attack: 60, defense: 1, speed: 9 }]
  })

  for (let seed = 1; seed <= 200; seed++) {
    const plain = mk(); const guarded = mk()
    guarded.party[0]._guarding = true
    plain.actorQueue = [plain.enemies[0]]
    guarded.actorQueue = [guarded.enemies[0]]
    enemyAct(plain, plain.enemies[0], mulberry32(seed))
    enemyAct(guarded, guarded.enemies[0], mulberry32(seed))
    const dmgPlain = 500 - plain.party[0].currentHp
    const dmgGuard = 500 - guarded.party[0].currentHp
    guardsUsed++
    if (dmgGuard < dmgPlain) guardReduced++
    check(dmgGuard <= dmgPlain,
      `guard increased damage taken (plain ${dmgPlain} vs guarded ${dmgGuard}, seed ${seed})`)
  }
  check(guardReduced > 0, 'guard never reduced damage in any sample — it is decorative')
}

// ── Full runs ───────────────────────────────────────────────────────────────
const keys = Object.keys(DUNGEON_ENEMIES)

for (let seed = 1; seed <= 400; seed++) {
  const rng = mulberry32(seed)
  const key = keys[seed % keys.length]
  const enemyLevel = 1 + Math.floor(rng() * 20)
  const totalWaves = 1 + Math.floor(rng() * 4)
  const waves = buildWaves(key, enemyLevel, totalWaves)

  check(waves.length === totalWaves, `seed ${seed}: wrong wave count`)
  waves.forEach((w, i) => {
    check(w.length >= 1, `seed ${seed}: wave ${i} has no enemies`)
    w.forEach(e => {
      check(e.maxHp > 0, `seed ${seed}: wave ${i} enemy ${e.name} has no HP`)
      check(e.attack > 0, `seed ${seed}: wave ${i} enemy ${e.name} has no attack`)
    })
  })

  const battle = createBattle({ name: 'Test', dungeon_key: key }, makeParty(1 + Math.floor(rng() * 4), rng), waves)
  startRoundIfNeeded(battle, rng)
  battles++

  let safety = 0
  while (safety++ < 4000) {
    validateState(battle, `seed ${seed} wave ${battle.waveIndex}`)

    if (battleOver(battle)) {
      if (allEnemiesDead(battle) && hasMoreWaves(battle) && !allPartyDead(battle)) {
        nextWave(battle)
        startRoundIfNeeded(battle, rng)
        continue
      }
      break
    }

    if (!isPartyTurn(battle)) {
      // The engine should never hand back a non-party turn outside battleOver:
      // advanceThroughEnemies runs enemy turns to completion.
      check(false, `seed ${seed}: stalled on a non-party turn (actor ${currentActor(battle)?.name})`)
      break
    }

    playerAction(battle, ACTIONS[Math.floor(rng() * ACTIONS.length)], rng)
    turns++
  }

  check(safety < 4000, `seed ${seed}: battle did not terminate`)
  check(allEnemiesDead(battle) || allPartyDead(battle),
    `seed ${seed}: ended without a decisive outcome`)
}

// enemyAct isn't exported by name in the loop above; pull it in for guardCheck.
globalThis.__engine = await import('./src/services/GuildDungeonEngine.js')
guardCheck()

console.log(`battles: ${battles}   player turns: ${turns}   dungeons: ${keys.length}`)
console.log(`guard samples: ${guardsUsed}   guard reduced damage in: ${guardReduced}`)
if (violations.length) {
  console.error(`\nFAILED — ${violations.length} violation(s):`)
  violations.slice(0, 20).forEach(v => console.error('  • ' + v))
  process.exit(1)
}
console.log('OK — no exceptions, no invariant violations')
