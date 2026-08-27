import {
  DUNGEON_ENEMIES, WAVE_HEAL_PCT, CRIT_CHANCE_PLAYER, CRIT_CHANCE_ENEMY,
  CRIT_MULTIPLIER, POWER_STRIKE_MULTIPLIER, GUARD_DEF_MULTIPLIER
} from '../data/guildDungeonData.js'

// The guild-dungeon combat engine, ported from guild_runBattle / guild_buildActorQueue
// / guild_enemyAct / guild_advanceThroughEnemies / guild_playerAction /
// guild_manualNextWave (game.js:8408-8697).
//
// PURE — no Supabase, no DOM, no toast. Everything arrives as arguments and it
// only mutates the state object it is handed. Same shape as RaceEngine, and for
// the same reason: it can be exercised under plain Node with no stubbing.
//
// Legacy interleaved these rules with innerHTML writes, re-rendering the whole
// panel after every action; here the component renders from state.

// ── Setup ───────────────────────────────────────────────────────────────────

// Ports guild_startDungeon's wave construction. Wave N has more enemies and
// tougher ones: count grows every 2 waves, HP by 15% and ATK by 10% per wave.
export function buildWaves(dungeonKey, enemyLevel, totalWaves) {
  const templates = DUNGEON_ENEMIES[dungeonKey] || DUNGEON_ENEMIES.guild_dungeon_easy
  const levelMult = 1 + enemyLevel * 0.1
  const waves = []

  for (let w = 0; w < totalWaves; w++) {
    const count = Math.min(templates.length, 1 + Math.floor(w / 2))
    const wave = []
    for (let e = 0; e < count; e++) {
      const t = templates[e % templates.length]
      const hp = Math.floor(t.base_hp * levelMult * (1 + w * 0.15))
      wave.push({
        name: t.name,
        icon: t.icon,
        maxHp: hp,
        currentHp: hp,
        attack: Math.floor(t.base_attack * (1 + w * 0.1)),
        defense: Math.floor(t.base_defense),
        speed: t.speed
      })
    }
    waves.push(wave)
  }
  return waves
}

export function createBattle(dungeon, party, waves) {
  return {
    dungeon,
    party,
    waves,
    waveIndex: 0,
    enemies: waves[0].map(e => ({ ...e })),
    log: [],
    fullLog: [],
    turn: 0,
    actorQueue: [],
    roundDone: true
  }
}

// ── Queue ───────────────────────────────────────────────────────────────────

const isAlive = c => (c.currentHp || 0) > 0
// A party member is distinguished by carrying an owner — enemies never do.
const isPartyMember = c => c && (c.isPlayer !== undefined || c.ownerName !== undefined)

export function buildActorQueue(s) {
  s.actorQueue = [...s.party.filter(isAlive), ...s.enemies.filter(isAlive)]
    .sort((a, b) => (b.speed || 4) - (a.speed || 4))
}

export function currentActor(s) {
  while (s.actorQueue.length > 0) {
    const actor = s.actorQueue[0]
    if (!isAlive(actor)) { s.actorQueue.shift(); continue }
    return actor
  }
  return null
}

export const allEnemiesDead = s => !s.enemies.some(isAlive)
export const allPartyDead = s => !s.party.some(isAlive)
export const battleOver = s => allEnemiesDead(s) || allPartyDead(s)
export const isPartyTurn = s => isPartyMember(currentActor(s))

// ── Damage ──────────────────────────────────────────────────────────────────

function effectiveDefense(target) {
  // GUARD IS REAL HERE, AND IS NOT ON THE LIVE SITE. Legacy sets
  // `actor._guarding = true`, shows a 🛡️ next to the guarding pet, clears the
  // flag between waves — and never reads it in any damage calculation. Its own
  // help text promises "Guard: double DEF this round", so on the live site the
  // button costs the player a turn and does nothing at all. Same decorative-
  // control family as the room bonuses and the expedition pace selector.
  const base = target.defense || 0
  return target._guarding ? base * GUARD_DEF_MULTIPLIER : base
}

function rollDamage(attack, target, critChance, rng) {
  const base = Math.max(1, attack - Math.floor(effectiveDefense(target) * 0.5))
  const variance = 0.8 + rng() * 0.6
  const isCrit = rng() < critChance
  return { dmg: Math.floor(base * variance * (isCrit ? CRIT_MULTIPLIER : 1)), isCrit }
}

// ── Turns ───────────────────────────────────────────────────────────────────

export function enemyAct(s, enemy, rng = Math.random) {
  const targets = s.party.filter(isAlive)
  if (!targets.length) return
  const target = targets[Math.floor(rng() * targets.length)]
  const { dmg, isCrit } = rollDamage(enemy.attack, target, CRIT_CHANCE_ENEMY, rng)
  target.currentHp = Math.max(0, target.currentHp - dmg)

  let line = `${enemy.icon} ${enemy.name} attacks ${target.name} for ${dmg} damage!` +
    (isCrit ? ' ⚡ CRIT!' : '')
  if (target.currentHp <= 0) line += ` ${target.name} was knocked out! 😵`
  s.log.push({ type: 'enemy', text: line, waveIdx: s.waveIndex })
  s.actorQueue.shift()
}

// Runs enemy turns until a party member is up, or the round/battle ends.
export function advanceThroughEnemies(s, rng = Math.random) {
  let safety = 0
  while (safety++ < 30) {
    const actor = currentActor(s)
    if (!actor) { s.roundDone = true; break }
    if (isPartyMember(actor)) break
    enemyAct(s, actor, rng)
    if (allPartyDead(s) || allEnemiesDead(s)) break
  }
}

// Called once before the first render and again whenever a round completes.
export function startRoundIfNeeded(s, rng = Math.random) {
  if (!s.roundDone) return
  s.roundDone = false
  s.turn++
  buildActorQueue(s)
  advanceThroughEnemies(s, rng)
}

export function playerAction(s, type, rng = Math.random) {
  const actor = currentActor(s)
  if (!isPartyMember(actor)) return

  const targets = s.enemies.filter(isAlive)
  if (!targets.length) return

  if (type === 'attack') {
    const target = targets[Math.floor(rng() * targets.length)]
    const { dmg, isCrit } = rollDamage(actor.attack, target, CRIT_CHANCE_PLAYER, rng)
    target.currentHp = Math.max(0, target.currentHp - dmg)
    let line = `🐾 ${actor.name} attacks ${target.name} for ${dmg} damage!` + (isCrit ? ' ⚡ CRIT!' : '')
    if (target.currentHp <= 0) line += ` ${target.name} was defeated! 💀`
    s.log.push({ type: 'atk', text: line, waveIdx: s.waveIndex })
  } else if (type === 'power') {
    let total = 0
    targets.forEach(target => {
      const base = Math.max(1, actor.attack - Math.floor(effectiveDefense(target) * 0.5))
      const dmg = Math.floor(base * POWER_STRIKE_MULTIPLIER)
      target.currentHp = Math.max(0, target.currentHp - dmg)
      total += dmg
      if (target.currentHp <= 0) {
        s.log.push({ type: 'crit', text: `${target.name} was defeated! 💀`, waveIdx: s.waveIndex })
      }
    })
    s.log.push({
      type: 'crit',
      text: `💥 ${actor.name} uses Power Strike! Hits all enemies for ~${Math.floor(total / targets.length)} damage each!`,
      waveIdx: s.waveIndex
    })
  } else if (type === 'guard') {
    actor._guarding = true
    s.log.push({ type: 'atk', text: `🛡️ ${actor.name} guards! Defense doubled this round.`, waveIdx: s.waveIndex })
  }

  s.actorQueue.shift()

  if (allEnemiesDead(s)) { s.fullLog = s.fullLog.concat(s.log); return }
  advanceThroughEnemies(s, rng)
  if (allPartyDead(s)) { s.fullLog = s.fullLog.concat(s.log); return }
  startRoundIfNeeded(s, rng)
}

export function nextWave(s) {
  s.party.forEach(p => {
    if (p.currentHp > 0) {
      p.currentHp = Math.min(p.maxHp, p.currentHp + Math.floor(p.maxHp * WAVE_HEAL_PCT))
    }
    // Guard lasts a round, so it never carries into the next wave.
    p._guarding = false
  })
  s.fullLog = s.fullLog.concat(s.log)
  s.log = []
  s.waveIndex++
  s.enemies = s.waves[s.waveIndex].map(e => ({ ...e }))
  s.actorQueue = []
  s.roundDone = true
  s.fullLog.push({
    type: 'atk',
    text: `🌊 Wave ${s.waveIndex + 1} begins! Party recovered ${Math.round(WAVE_HEAL_PCT * 100)}% HP.`,
    waveIdx: s.waveIndex
  })
}

export const hasMoreWaves = s => s.waveIndex < s.waves.length - 1
