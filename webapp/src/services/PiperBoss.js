import { STATUS_EFFECTS, PASSIVE_EFFECTS } from '../data/battleData.js'
import { calculateDamage } from './BattleService.js'

// Ports the Shadow of Piper boss AI (piperBoss_*, game.js:8895-9092) and
// Piper's Influence (manualBattle_tickInfluence + PIPER_EVENTS).
//
// Piper is the game's ARG centrepiece, so the fight is structured rather than
// statistical: three HP-gated phases, a Melody counter that damages on a fixed
// cadence regardless of what either side does, and telegraphed skills that cost
// her a turn before landing.
//
// The visual half of legacy's implementation (adding `boss-ui-glitch` to
// <body>, injecting a red flash div, recolouring the enemy name) is expressed
// as flags on the battle state instead, so the component owns the DOM.

const MELODY_INTERVAL = 3          // melody damage every N ticks
const MELODY_BASE_DAMAGE = 4

// Ports PIPER_EVENTS. Each returns its narrative line; `ctx` carries the
// helpers that would otherwise be free globals.
const PIPER_EVENTS = [
  (s, ctx) => {
    const d = Math.floor(5 + Math.random() * 10)
    s.playerHP = Math.max(1, s.playerHP - d)
    s.enemyHP = Math.max(0, s.enemyHP - d)
    return `👁️ Piper's Echo: both sides take ${d} damage!`
  },
  (s, ctx) => {
    const st = ['confuse', 'fear'][Math.floor(Math.random() * 2)]
    const applied = ctx.applyStatusToPlayer(st)
    const icon = STATUS_EFFECTS[st]?.icon || ''
    return `👁️ Piper's Curse:${applied ? ` ${icon} ${st} applied!` : ' Resisted by Spirit!'}`
  },
  (s, ctx) => {
    ctx.applyStatusToEnemy('fear')
    return '👁️ Piper\'s Warning: the enemy is afraid!'
  },
  (s, ctx) => {
    ctx.applyHeal(Math.floor(s.playerMaxHP * 0.15))
    return '👁️ Piper\'s Gift: restored HP... why?'
  },
  (s) => {
    for (const k of Object.keys(s.skillCooldowns)) s.skillCooldowns[k] = 0
    return '👁️ Piper\'s Laughter: all skill cooldowns reset!'
  }
]

export function isPiper(enemy) {
  return !!enemy?.is_boss && (enemy.name || '').includes('Piper')
}

// Ports piperBoss_getTurnAction(). Decides what Piper does, ticking the Melody
// counter and firing phase transitions on the way.
export function piperTurnAction(s, ctx) {
  const hpPct = s.enemyHP / s.enemyMaxHP

  s.piperMelody = (s.piperMelody || 0) + 1

  // The Melody damages on its own cadence, independent of Piper's action.
  // Spirit blunts it.
  let melodyLine = null
  if (s.piperMelody % MELODY_INTERVAL === 0) {
    const spirit = s.player.stats.spirit || 0
    const dmg = Math.max(1, MELODY_BASE_DAMAGE - Math.floor(spirit / 3))
    s.playerHP = Math.max(0, s.playerHP - dmg)
    s.totalDamageTaken += dmg
    melodyLine = `🎵 The melody resonates: ${dmg} dark damage!`
  }

  // Phase transitions fire once each and consume the turn.
  if (hpPct <= 0.66 && !s.piperPhase2Triggered) {
    s.piperPhase = 2
    s.piperPhase2Triggered = true
    s.piperGlitch = Date.now()
    return { type: 'narrative', text: '"You\'re still here. Interesting."', extra: melodyLine }
  }
  if (hpPct <= 0.33 && !s.piperPhase3Triggered) {
    s.piperPhase = 3
    s.piperPhase3Triggered = true
    s.piperGlitch = Date.now()
    s.piperFlash = Date.now()
    return { type: 'narrative', text: '"Don\'t make me do this."', glitch: true, extra: melodyLine }
  }

  const phase = s.piperPhase || 1
  s.piperSkillCooldown = Math.max(0, (s.piperSkillCooldown || 0) - 1)

  let action = null
  if (phase === 1 && s.piperSkillCooldown <= 0 && s.turn % 3 === 0) {
    s.piperSkillCooldown = 3
    action = {
      type: 'skill', name: 'Haunting Refrain', mult: 0.8,
      defDown: true, confuseChance: 0.3,
      telegraph: '🎵 Piper raises her flute...'
    }
  } else if (phase === 2 && s.piperSkillCooldown <= 0 && s.turn % 3 === 0) {
    s.piperSkillCooldown = 3
    // The Echo hits harder the more corrupted the world state is.
    const corruption = ctx.corruptionLevel()
    action = {
      type: 'skill', name: 'The Echo', mult: corruption > 50 ? 1.8 : 1.4,
      burnApply: true,
      telegraph: '🌑 The echo builds around her...'
    }
  } else if (phase === 3 && s.piperSkillCooldown <= 0 && s.turn % 4 === 0) {
    s.piperSkillCooldown = 4
    // Lament doubles against an already-afflicted pet.
    const hasStatus = Object.keys(s.playerStatuses || {}).length > 0
    action = {
      type: 'skill', name: "Piper's Lament", mult: hasStatus ? 4.0 : 2.0,
      selfHealPct: 0.1, glitchEffect: true,
      telegraph: '💔 Something shifts. Piper\'s eyes close.'
    }
  }

  if (!action) {
    action = { type: 'attack', fearChance: phase === 3 ? 0.35 : 0.25 }
  }
  action.extra = melodyLine
  return action
}

// Ports piperBoss_resolveTurnAction().
export function piperResolveAction(action, s, ctx) {
  if (!action) return 'Something stirs in the silence.'
  const enemy = s.enemy
  const lines = []
  if (action.extra) lines.push(action.extra)

  if (action.type === 'narrative') {
    lines.push(action.text)
    return lines.join(' ')
  }

  // A telegraphed skill costs Piper this turn — it lands on the next one.
  if (action.telegraph && !s.piperTelegraphFired) {
    s.piperTelegraphFired = true
    s.piperNextAction = { ...action, telegraph: null }
    lines.push(action.telegraph)
    return lines.join(' ')
  }
  s.piperTelegraphFired = false

  if (action.type === 'skill') {
    const atk = Math.max(1, enemy.attack || 3)
    const def = Math.max(0, s.player.stats.defense || 0)
    const dmg = Math.max(1, Math.round(Math.max(1, atk - def) * (action.mult || 1)))

    if (action.glitchEffect) s.piperGlitch = Date.now()

    s.playerHP = Math.max(0, s.playerHP - dmg)
    s.totalDamageTaken += dmg
    lines.push(`🎵 ${enemy.name} uses ${action.name}! ${dmg} damage!`)

    if (action.defDown) {
      s.playerDefShred = (s.playerDefShred || 0) + Math.floor(def * 0.15)
      lines.push('Your defense weakens!')
    }
    if (action.confuseChance && Math.random() < action.confuseChance) {
      ctx.applyStatusToPlayer('confuse')
      lines.push('😵 Confused!')
    }
    if (action.burnApply) {
      // Applied directly, bypassing Spirit resistance — as legacy does.
      ctx.applyStatusDirect('burn', s.playerStatuses)
      lines.push('🔥 Burn applied!')
    }
    if (action.selfHealPct) {
      const heal = Math.floor(s.enemyMaxHP * action.selfHealPct)
      s.enemyHP = Math.min(s.enemyMaxHP, s.enemyHP + heal)
      lines.push(`Piper heals ${heal} HP...`)
    }
    return lines.join(' ')
  }

  // Basic attack, with the defend-side gear passives applied.
  const atk = Math.max(1, enemy.attack || 3)
  const def = Math.max(0, (s.player.stats.defense || 0) - (s.playerDefShred || 0))
  const roll = calculateDamage(atk, def, 0)
  const defend = applyDefendPassives(s, roll.damage, ctx)
  s.playerHP = Math.max(0, s.playerHP - defend.finalDmg)
  s.totalDamageTaken += defend.finalDmg
  lines.push(`${enemy.name} attacks for ${defend.finalDmg} damage!`)
  if (defend.lines.length) lines.push(defend.lines.join(' '))
  if (action.fearChance && Math.random() < action.fearChance) {
    ctx.applyStatusToPlayer('fear')
    lines.push('😨 Fear!')
  }
  return lines.join(' ')
}

// Ports manualBattle_applyDefendPassives() — gear that reacts when the pet is
// hit. Shared with ordinary enemies once they route through here.
export function applyDefendPassives(s, incoming, ctx) {
  let finalDmg = incoming
  const lines = []
  for (const p of s.player.passives || []) {
    const fx = PASSIVE_EFFECTS[p.effect]
    if (!fx || fx.type !== 'defend') continue
    if (Math.random() * 100 >= (p.chance || 0)) continue

    if (fx.fullBlock) { finalDmg = 0; lines.push(`${fx.icon} Blocked!`) }
    if (fx.flatReduction) finalDmg = Math.max(0, finalDmg - fx.flatReduction)
    if (fx.reflectPct) {
      const ref = Math.floor(incoming * fx.reflectPct)
      s.enemyHP = Math.max(0, s.enemyHP - ref)
      lines.push(`${fx.icon} Reflected ${ref}!`)
    }
    if (fx.healMaxPct) {
      const h = Math.floor(s.playerMaxHP * fx.healMaxPct)
      ctx.applyHeal(h)
      lines.push(`${fx.icon} Healed ${h}!`)
    }
    if (fx.selfDamage) s.playerHP = Math.max(0, s.playerHP - fx.selfDamage)
  }
  return { finalDmg, lines }
}

// Ports manualBattle_tickInfluence(). Piper's Influence builds as the player
// acts and can fire an out-of-nowhere event.
//
// Note this is gated on world-state corruption: legacy returns null unless
// Beta Integrity (100 − corruption) has fallen to 25 or below. World state is
// not migrated, and its default of 50 leaves integrity at 50 — so the meter is
// dormant today, exactly as it is on the live site for a normal player. The
// logic is here in full for when that system lands.
export function tickInfluence(s, gain, ctx) {
  const betaIntegrity = 100 - ctx.corruptionLevel()
  if (betaIntegrity > 25) return null

  const spirit = s.player.stats.spirit || 0
  const reduction = Math.min(0.3, spirit * 0.02)
  s.piperInfluence = Math.min(100, (s.piperInfluence || 0) + Math.round(gain * (1 - reduction)))

  const chance = s.piperInfluence >= 75 ? 0.55
    : s.piperInfluence >= 50 ? 0.35
      : s.piperInfluence >= 25 ? 0.15 : 0
  if (chance > 0 && Math.random() < chance) {
    s.piperInfluence = Math.max(0, s.piperInfluence - 20)
    const event = PIPER_EVENTS[Math.floor(Math.random() * PIPER_EVENTS.length)]
    return event(s, ctx)
  }
  return null
}
