import { ZONE_CONFIG } from '../data/battleData.js'

// Ports the stat half of getRandomEnemy() and getBossEnemy() (game.js:18657-18965
// and 18972-19010 at 826475d). Pure functions over an `enemy_pets` row, so the
// smoke test can exercise them without Supabase.
//
// DROPPED BY THE PHASE 7 PORT, restored 2026-09-15. rollEnemy handed the raw row
// to the fight, so every wild enemy fought at its template stats: no age bands,
// no elementals, no level scaling and no special variants — which also meant no
// Corrupted enemies, the only ones that carry an enemy-side passive.

// Per-zone age band and elemental odds. One roll is checked against `upTo` in
// order. `mult` scales HP, DEF and SPD directly, and ATK at 75% of it.
const ZONE_VARIANTS = {
  outskirts: {
    ages: [{ age: 'baby', upTo: 1, mult: 1.25 }],
    elementalChance: 0, elementals: []
  },
  glade: {
    ages: [{ age: 'baby', upTo: 0.5, mult: 1.2 }, { age: 'adult', upTo: 1, mult: 1.6 }],
    elementalChance: 0.10, elementals: ['shadow', 'flame', 'frost']
  },
  deepwoods: {
    ages: [{ age: 'adult', upTo: 0.5, mult: 1.9 }, { age: 'elder', upTo: 1, mult: 2.3 }],
    elementalChance: 0.25, elementals: ['shadow', 'flame', 'frost', 'storm']
  },
  ruins: {
    ages: [{ age: 'adult', upTo: 0.5, mult: 2.0 }, { age: 'elder', upTo: 1, mult: 2.6 }],
    elementalChance: 0.35, elementals: ['shadow', 'flame', 'frost', 'storm', 'void']
  },
  hollow_warrens: {
    ages: [{ age: 'adult', upTo: 0.6, mult: 1.75 }, { age: 'elder', upTo: 1, mult: 2.1 }],
    elementalChance: 0.15, elementals: ['shadow', 'frost']
  },
  ashen_ruins: {
    ages: [{ age: 'adult', upTo: 0.5, mult: 2.1 }, { age: 'elder', upTo: 1, mult: 2.45 }],
    elementalChance: 0.25, elementals: ['flame', 'void', 'storm']
  }
}
// A zone legacy has no branch for fights babies at template strength.
const DEFAULT_VARIANTS = { ages: [{ age: 'baby', upTo: 1, mult: 1.0 }], elementalChance: 0, elementals: [] }

const ELEMENTAL_MULT = 1.3

// Special variants share one roll, each band stacked on the one before, so the
// order matters. Glitched has no fixed multiplier — it rolls 0.8x-1.8x.
//
// Legacy also gives each one a `rewardMultiplier` (2.5 / 1.8 / 1.6 / 1.5 / 1.25)
// that nothing ever reads, so it is not carried.
const SPECIALS = [
  { id: 'golden', chance: 0.005, mult: 1.8, prefix: '👑 Golden' },
  { id: 'shiny', chance: 0.01, mult: 1.4, prefix: '✨ Shiny' },
  { id: 'glitched', chance: 0.01, mult: null, prefix: '🌀 Glitched' },
  { id: 'corrupted', chance: 0.03, mult: 1.5, prefix: '🔥 Corrupted' },
  { id: 'rare', chance: 0.05, mult: 1.2, prefix: '💎 Rare' }
]

// Piper's zone multipliers. The secret zones have no entry and use the Outskirts
// figure, as in legacy.
const PIPER_ZONE_SCALE = { outskirts: 1.8, glade: 2.4, deepwoods: 3.2, ruins: 4.2 }

const capitalise = s => s.charAt(0).toUpperCase() + s.slice(1)
const pick = list => list[Math.floor(Math.random() * list.length)]

// World-state corruption widens the Corrupted band by up to 6 points, and Cursed
// Fog lifts it to at least 12%.
function chanceOf(special, corruption, weatherId) {
  if (special.id !== 'corrupted') return special.chance
  const chance = special.chance + (corruption / 100) * 0.06
  return weatherId === 'cursed' ? Math.max(chance, 0.12) : chance
}

// The player-relative level window, clamped to the zone's hard caps so a
// high-level player can't drag level-20 enemies into the starter zone.
function levelBand(zoneKey, playerLevel) {
  const conf = ZONE_CONFIG[zoneKey] || ZONE_CONFIG.outskirts
  let min = Math.max(conf.minLevel, Math.min(playerLevel - 1, conf.maxLevel))
  const max = Math.min(conf.maxLevel, Math.max(playerLevel + 2, conf.minLevel))
  if (min > max) min = max
  return { min, max }
}

// Ports getRandomEnemy()'s variant roll and stat scaling. `corruption` is the
// world-state corruption level (0-100); `weatherId` is the current weather.
export function generateWildEnemy(base, zoneKey, playerLevel, { corruption = 50, weatherId = 'clear' } = {}) {
  const zone = ZONE_VARIANTS[zoneKey] || DEFAULT_VARIANTS
  const { min, max } = levelBand(zoneKey, playerLevel)
  const level = min + Math.floor(Math.random() * (max - min + 1))

  const ageRoll = Math.random()
  const band = zone.ages.find(a => ageRoll < a.upTo) || zone.ages[zone.ages.length - 1]
  let mult = band.mult

  let elemental = null
  if (zone.elementals.length && Math.random() < zone.elementalChance) {
    elemental = pick(zone.elementals)
    mult *= ELEMENTAL_MULT
  }

  const specialRoll = Math.random()
  let threshold = 0
  let special = null
  for (const candidate of SPECIALS) {
    threshold += chanceOf(candidate, corruption, weatherId)
    if (specialRoll < threshold) { special = candidate; break }
  }
  if (special) mult *= special.mult ?? (0.8 + Math.random())

  // "Golden Shadow Slime", "Shiny Baby Rabbit", "Elder Wolf" — an elemental
  // takes the age word's place rather than adding to it.
  const descriptor = capitalise(elemental || band.age)
  const name = [special && special.prefix, descriptor, base.name].filter(Boolean).join(' ')

  const levelBonus = level - 1
  return {
    ...base,
    name,
    level,
    base_hp: Math.max(30, Math.floor(((base.base_hp || 0) + levelBonus * 12) * mult)),
    // ATK takes 75% of the multiplier so enemies hit hard without one-shotting.
    base_attack: Math.max(2, Math.floor(((base.base_attack || 0) + levelBonus) * mult * 0.75)),
    base_defense: Math.max(1, Math.floor(((base.base_defense || 0) + Math.floor(levelBonus * 0.5)) * mult)),
    base_speed: Math.max(1, Math.floor(((base.base_speed || 0) + Math.floor(levelBonus * 0.5)) * mult)),
    variant: band.age,
    elementalType: elemental,
    specialVariant: special ? special.id : null,
    passive: special && special.id === 'corrupted' ? { effect: 'corrupted_fury', chance: 20 } : null
  }
}

// Ports getBossEnemy()'s scaling. Piper always outlevels the player by six, and
// is far stronger the deeper the zone. `forest_zone` becomes the zone she is
// fought in, so that zone's modifier and boss loot table apply.
export function scalePiper(boss, zoneKey, playerLevel) {
  const scale = PIPER_ZONE_SCALE[zoneKey] || 1.8
  const level = Math.max(5, playerLevel + 6)
  const levelBonus = level - 1
  return {
    ...boss,
    level,
    base_hp: Math.round(((boss.base_hp || 0) + levelBonus * 20) * scale),
    base_attack: Math.round(((boss.base_attack || 0) + levelBonus * 2) * scale),
    base_defense: Math.round(((boss.base_defense || 0) + levelBonus) * scale),
    base_speed: (boss.base_speed || 0) + levelBonus,
    forest_zone: zoneKey,
    is_boss: true,
    exp_reward: Math.round((boss.exp_reward || 50) * scale),
    pp_reward: Math.round((boss.pp_reward || 75) * scale)
  }
}
