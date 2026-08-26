import { ZONE_CONFIG, PASSIVE_EFFECTS, BATTLE_CONSTANTS } from '../data/battleData.js'
import { calculateDamage } from './BattleService.js'

// Ports simulateBattle() (game.js:7380+) — the AUTO-battle resolver.
//
// This is a genuinely separate engine from the manual one in BattleService:
// it runs a whole fight to completion with no player input and returns a
// replayable log. Its only consumer in the entire codebase is the Starter
// Dungeon, so it lives beside that rather than inside the manual engine.
//
// Rules it has that the manual engine doesn't: a `specialSkill` with a trigger
// chance, speed deciding who strikes first, and a one-turn enemy stun from the
// `stunEnemy` gear passive.

// Flavour lines, ported from calculateDamage()'s own text. The manual engine
// drops these (its narrative is built per-action instead); the auto log shows
// them, so they belong here.
const FLAVOR = {
  low: ['Barely scratched them!', 'A glancing blow!', 'Just grazed them!', "Wasn't very effective...", 'A weak hit!'],
  normal: ['A solid hit!', 'Good wallop!', 'Nice strike!', 'Connected cleanly!', 'That hurt!'],
  crit: ['Critical hit!', 'A devastating blow!', 'Super effective!', 'Absolutely crushed them!', 'WHAM! Direct hit!'],
  bossLow: ["Piper's flute makes your head spin...", 'The haunting melody disorients you!', 'A distant note echoes in your mind...', 'The sound barely reaches you...', 'A faint whistle brushes past you...'],
  bossNormal: ["Piper's flute makes you feel sick!", 'The melody pierces through you!', 'Reality wavers to the tune!', 'The haunting song grips your mind!', "The flute's cry echoes in your bones!"],
  bossCrit: ["Piper's flute distorts reality itself!", 'The melody SHATTERS your senses!', 'Reality BREAKS under the song!', "The flute's scream tears through existence!", 'The haunting tune OVERWHELMS everything!']
}

function flavorFor(variance, isBoss) {
  const set = isBoss
    ? (variance === -1 ? FLAVOR.bossLow : variance === 0 ? FLAVOR.bossNormal : FLAVOR.bossCrit)
    : (variance === -1 ? FLAVOR.low : variance === 0 ? FLAVOR.normal : FLAVOR.crit)
  return set[Math.floor(Math.random() * set.length)]
}

export function simulateBattle(playerStats, enemyStats) {
  const log = []
  let playerHP = playerStats.currentHP
  let enemyHP = enemyStats.hp
  let turn = 0
  let enemyStunned = false

  // Enemy stats are mutated by shred passives, so work on a copy rather than
  // permanently degrading the caller's enemy object between dungeon waves.
  const enemy = { ...enemyStats }

  const zoneConf = ZONE_CONFIG[enemy.forest_zone || 'outskirts'] || ZONE_CONFIG.outskirts
  const mod = zoneConf.battleMod || { type: 'none' }
  const enemyPassives = enemy.passives || (enemy.passive ? [enemy.passive] : [])

  const push = (type, text, extra = {}) =>
    log.push({ type, text, playerHP: Math.max(0, playerHP), enemyHP: Math.max(0, enemyHP), ...extra })

  if (mod.type !== 'none' && mod.label) push('zone_mod', `${mod.label}: ${mod.desc}`)

  let fogTurnsLeft = mod.type === 'fog' ? (mod.fogTurns || 2) : 0
  const fogEvasion = mod.type === 'fog' ? (mod.evasion || 0.15) : 0
  const playerFirst = playerStats.stats.speed >= enemy.speed

  push('start', `Battle begins! ${playerStats.name} vs ${enemy.name}!`)

  while (playerHP > 0 && enemyHP > 0 && turn < BATTLE_CONSTANTS.BATTLE_MAX_TURNS) {
    turn++

    // A slower pet forfeits only the opening turn, not every turn.
    if (playerFirst || turn > 1) {
      const skill = playerStats.specialSkill
      if (skill && Math.random() < (skill.trigger_chance || 0)) {
        const dmg = Math.max(1, Math.floor((playerStats.stats.attack - enemy.defense) * skill.damage_multiplier))
        enemyHP -= dmg
        let heal = 0
        if (skill.heal_percent > 0) {
          heal = Math.floor(dmg * skill.heal_percent)
          playerHP = Math.min(playerStats.maxHP, playerHP + heal)
        }
        push('player_attack',
          `${playerStats.name} uses ${skill.name}! ${skill.icon} ${dmg} damage!${heal > 0 ? ` (Healed ${heal} HP!)` : ''}`,
          { attacker: 'player', damage: dmg, variance: 1, isSkill: true })
      } else if (fogTurnsLeft > 0 && Math.random() < fogEvasion) {
        fogTurnsLeft--
        push('player_attack', `🌫️ ${playerStats.name} swings... but misses! (Fog of War)`,
          { attacker: 'player', damage: 0, isSkill: false })
      } else {
        if (fogTurnsLeft > 0) fogTurnsLeft--
        const roll = calculateDamage(playerStats.stats.attack, enemy.defense, playerStats.stats.luck || 0)
        enemyHP -= roll.damage
        push('player_attack',
          `${roll.isCrit ? '⚡ CRITICAL HIT! ' : ''}${playerStats.name} attacks for ${roll.damage} damage! ${flavorFor(roll.variance, false)}`,
          { attacker: 'player', damage: roll.damage, variance: roll.variance, isSkill: false, isCrit: roll.isCrit })

        for (const p of playerStats.passives || []) {
          const fx = PASSIVE_EFFECTS[p.effect]
          if (!fx || fx.type !== 'attack') continue
          if (Math.random() * 100 >= (p.chance || 0)) continue

          if (fx.bonusDamage) enemyHP -= fx.bonusDamage
          if (fx.doubleDamage) enemyHP -= roll.damage
          if (fx.extraHitPct) {
            const extra = Math.max(1, Math.floor((playerStats.stats.attack - enemy.defense) * fx.extraHitPct))
            enemyHP -= extra
            push('passive', `${fx.icon} ${fx.label}! ${playerStats.name} strikes again for ${extra} damage!`)
          }
          if (fx.forceCrit) {
            enemyHP -= Math.floor(roll.damage * 0.5)
            push('passive', `${fx.icon} ${fx.label}! A guaranteed critical strike!`)
          }
          if (fx.ignoreDefense) enemyHP -= enemy.defense
          if (fx.healPct) {
            const h = Math.floor(roll.damage * fx.healPct)
            playerHP = Math.min(playerStats.maxHP, playerHP + h)
            push('passive', `${fx.icon} ${fx.label}! ${playerStats.name} heals ${h} HP!`)
          }
          if (fx.selfDamage) {
            playerHP = Math.max(0, playerHP - fx.selfDamage)
            push('passive', `${fx.icon} ${fx.label} takes its toll... ${playerStats.name} loses ${fx.selfDamage} HP!`)
          }
          if (fx.defenseShred) enemy.defense = Math.max(0, enemy.defense - fx.defenseShred)
          if (fx.attackShred) enemy.attack = Math.max(0, enemy.attack - fx.attackShred)
          if (fx.stunEnemy) {
            enemyStunned = true
            push('passive', `${fx.icon} ${fx.label}! The haunting melody stuns the enemy!`)
          }
        }
      }
      if (enemyHP <= 0) break
    }

    // ── enemy's turn ────────────────────────────────────────────────────────
    if (enemyStunned) {
      push('passive', '🎵 The enemy is still reeling from the haunting melody and cannot attack!')
      enemyStunned = false
    } else {
      const roll = calculateDamage(enemy.attack, playerStats.stats.defense, 0)
      let finalDamage = roll.damage
      const passiveLines = []

      if (enemy.passive) {
        const epx = PASSIVE_EFFECTS[enemy.passive.effect]
        if (epx && epx.type === 'enemyAttack' && Math.random() * 100 < (enemy.passive.chance || 0)) {
          if (epx.bonusDamagePct) {
            const bonus = Math.floor(finalDamage * epx.bonusDamagePct)
            finalDamage += bonus
            passiveLines.push(`${epx.icon} ${epx.label}! ${enemy.name} strikes with corrupted power for ${bonus} extra damage!`)
          }
        }
      }

      for (const p of playerStats.passives || []) {
        const fx = PASSIVE_EFFECTS[p.effect]
        if (!fx || fx.type !== 'defend') continue
        if (Math.random() * 100 >= (p.chance || 0)) continue

        if (fx.fullBlock) { finalDamage = 0; passiveLines.push(`${fx.icon} ${fx.label}! The attack was fully blocked!`) }
        if (fx.flatReduction) { finalDamage = Math.max(0, finalDamage - fx.flatReduction); passiveLines.push(`${fx.icon} ${fx.label}! Damage reduced!`) }
        if (fx.reflectPct) {
          const ref = Math.floor(finalDamage * fx.reflectPct)
          if (ref > 0) { enemyHP -= ref; passiveLines.push(`${fx.icon} ${fx.label}! Reflected ${ref} damage back!`) }
        }
        if (fx.healMaxPct) {
          const h = Math.floor(playerStats.maxHP * fx.healMaxPct)
          playerHP = Math.min(playerStats.maxHP, playerHP + h)
          passiveLines.push(`${fx.icon} ${fx.label}! Healed ${h} HP!`)
        }
        if (fx.selfDamage) {
          playerHP = Math.max(0, playerHP - fx.selfDamage)
          passiveLines.push(`${fx.icon} ${fx.label} takes its toll... lost ${fx.selfDamage} HP!`)
        }
      }

      playerHP -= finalDamage
      push('enemy_attack',
        `${enemy.name} attacks for ${finalDamage} damage! ${flavorFor(roll.variance, !!enemy.is_boss)}`,
        { attacker: 'enemy', damage: finalDamage, variance: roll.variance })
      for (const line of passiveLines) push('passive', line)
    }
    if (playerHP <= 0) break

    if (mod.type === 'regen' && enemyHP > 0) {
      const amt = mod.amount || 3
      enemyHP = Math.min(enemy.hp, enemyHP + amt)
      push('zone', `${mod.label}: Enemy recovered ${amt} HP!`)
    }
    if (mod.type === 'corruption') {
      const dmg = mod.damage || 2
      playerHP = Math.max(0, playerHP - dmg)
      push('zone', `${mod.label}: You took ${dmg} corruption damage!`)
    }

    for (const p of enemyPassives) {
      const fx = PASSIVE_EFFECTS[p.effect]
      if (!fx || fx.type !== 'enemyAttack') continue
      if (Math.random() * 100 >= (p.chance || 20)) continue
      const bonus = fx.bonusDamagePct ? Math.max(1, Math.floor(enemy.attack * fx.bonusDamagePct)) : 0
      if (bonus > 0) {
        playerHP = Math.max(0, playerHP - bonus)
        push('enemy_passive', `${fx.icon} ${fx.label}! Enemy surges for ${bonus} bonus damage!`)
      }
    }
    if (playerHP <= 0) break
  }

  const victory = playerHP > 0
  push('end', victory ? `Victory! ${playerStats.name} wins!` : `Defeat! ${playerStats.name} fainted!`)

  return {
    victory,
    log,
    turns: turn,
    playerFinalHP: Math.max(0, playerHP),
    enemyFinalHP: Math.max(0, enemyHP)
  }
}
