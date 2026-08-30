// Static fishing content, ported verbatim from game.js:9169-9631.

export const FISH_SPOTS = {
  pond: { name: '🏞️ Pond', baseCasts: 8, description: 'Calm water. Common fish.' },
  river: { name: '🏔️ River', baseCasts: 10, description: 'Fast current. Uncommon fish.' },
  lake: { name: '🌊 Lake', baseCasts: 10, description: 'Deep water. Rare fish.' },
  ocean: { name: '🌊 Ocean', baseCasts: 8, description: 'Legendary catches possible.' }
}

export const FISH_BAIT = {
  worm: { name: '🪱 Worm', cost: 0, rarityBoost: 0, description: 'Free! Catches common fish.' },
  bread: { name: '🍞 Bread Crumbs', cost: 5, rarityBoost: 0.15, description: '+15% rare catch chance.' },
  lure: { name: '🪝 Fancy Lure', cost: 15, rarityBoost: 0.30, description: '+30% rare catch chance.' },
  golden: { name: '✨ Golden Lure', cost: 40, rarityBoost: 0.50, description: '+50% rare catch chance.' }
}

// spot:rarity:weather-bonus. weather-gated legendaries (ghost_fish/storm_eel/
// void_fish/aurora_cod) and junk_ad only appear when their `weather` field
// matches the active weather — there's no migrated weather system yet, so
// FishingService always treats weather as 'clear' and these simply never
// appear, the same graceful-degradation pattern used elsewhere for
// not-yet-migrated systems.
export const FISH_POOL = [
  { id: 'boot', name: 'Old Boot', emoji: '👢', pp: 0, rarity: 'junk', spots: ['pond', 'river', 'lake', 'ocean'], weight: 15, minWeightG: 300, maxWeightG: 2500 },
  { id: 'seaweed', name: 'Seaweed Clump', emoji: '🌿', pp: 1, rarity: 'junk', spots: ['pond', 'river', 'lake', 'ocean'], weight: 12, minWeightG: 80, maxWeightG: 600 },
  { id: 'pebble', name: 'Sparkly Pebble', emoji: '💎', pp: 2, rarity: 'junk', spots: ['pond', 'river'], weight: 10, minWeightG: 30, maxWeightG: 250 },
  { id: 'carp', name: 'Carp', emoji: '🐟', pp: 4, rarity: 'common', spots: ['pond', 'river'], weight: 20, minWeightG: 500, maxWeightG: 5000 },
  { id: 'bluegill', name: 'Bluegill', emoji: '🐠', pp: 5, rarity: 'common', spots: ['pond', 'lake'], weight: 18, minWeightG: 100, maxWeightG: 1800 },
  { id: 'perch', name: 'Yellow Perch', emoji: '🐡', pp: 6, rarity: 'common', spots: ['pond', 'river', 'lake'], weight: 16, minWeightG: 150, maxWeightG: 1200 },
  { id: 'catfish', name: 'Catfish', emoji: '🐈', pp: 8, rarity: 'uncommon', spots: ['river', 'lake'], weight: 14, minWeightG: 800, maxWeightG: 8000 },
  { id: 'trout', name: 'Rainbow Trout', emoji: '🌈', pp: 10, rarity: 'uncommon', spots: ['river'], weight: 12, minWeightG: 400, maxWeightG: 4500 },
  { id: 'bass', name: 'Largemouth Bass', emoji: '🎣', pp: 12, rarity: 'uncommon', spots: ['lake', 'river'], weight: 10, minWeightG: 600, maxWeightG: 5500 },
  { id: 'pike', name: 'Northern Pike', emoji: '⚡', pp: 14, rarity: 'uncommon', spots: ['lake'], weight: 8, minWeightG: 1500, maxWeightG: 12000 },
  { id: 'salmon', name: 'Atlantic Salmon', emoji: '🐟', pp: 18, rarity: 'rare', spots: ['river', 'ocean'], weight: 6, minWeightG: 1500, maxWeightG: 15000 },
  { id: 'eel', name: 'Electric Eel', emoji: '⚡', pp: 20, rarity: 'rare', spots: ['lake', 'ocean'], weight: 5, minWeightG: 300, maxWeightG: 2500 },
  { id: 'swordfish', name: 'Swordfish', emoji: '🗡️', pp: 25, rarity: 'rare', spots: ['ocean'], weight: 4, minWeightG: 8000, maxWeightG: 60000 },
  { id: 'pufferfish', name: 'Pufferfish', emoji: '🐡', pp: 22, rarity: 'rare', spots: ['ocean'], weight: 5, minWeightG: 200, maxWeightG: 2500 },
  { id: 'shark', name: 'Baby Shark', emoji: '🦈', pp: 35, rarity: 'epic', spots: ['ocean'], weight: 2, minWeightG: 8000, maxWeightG: 35000 },
  { id: 'turtle', name: 'Ancient Turtle', emoji: '🐢', pp: 30, rarity: 'epic', spots: ['lake', 'ocean'], weight: 2, minWeightG: 15000, maxWeightG: 90000 },
  { id: 'manta', name: 'Manta Ray', emoji: '🦅', pp: 40, rarity: 'epic', spots: ['ocean'], weight: 1, minWeightG: 50000, maxWeightG: 200000 },
  { id: 'ghost_fish', name: 'Ghost Fish', emoji: '👻', pp: 50, rarity: 'legendary', spots: ['pond', 'lake'], weather: 'foggy', weight: 3, minWeightG: 50, maxWeightG: 400 },
  { id: 'storm_eel', name: 'Storm Eel', emoji: '⛈️', pp: 45, rarity: 'legendary', spots: ['ocean', 'river'], weather: 'windy', weight: 3, minWeightG: 600, maxWeightG: 4000 },
  { id: 'void_fish', name: 'Void Fish', emoji: '🌑', pp: 60, rarity: 'legendary', spots: ['lake', 'ocean'], weather: 'cursed', weight: 2, minWeightG: 1, maxWeightG: 50 },
  { id: 'aurora_cod', name: 'Aurora Cod', emoji: '🌌', pp: 55, rarity: 'legendary', spots: ['ocean'], weather: 'starry', weight: 3, minWeightG: 800, maxWeightG: 7000 },
  { id: 'junk_ad', name: 'Sponsored Content', emoji: '📢', pp: 0, rarity: 'junk', spots: ['pond', 'river', 'lake', 'ocean'], weather: 'adpocalypse', weight: 8, minWeightG: 0, maxWeightG: 0 },
  { id: 'golden_carp', name: 'Golden Carp', emoji: '✨', pp: 100, rarity: 'legendary', spots: ['pond'], weight: 1, minWeightG: 2000, maxWeightG: 25000 },
  { id: 'piper_fish', name: 'Unfamiliar Fish', emoji: '❓', pp: 75, rarity: 'legendary', spots: ['lake', 'ocean'], weight: 1, minWeightG: 200, maxWeightG: 5000 }
]

export const FISHING_RODS = [
  null,
  { level: 1, name: 'Basic Rod', emoji: '🎣', desc: 'The starter rod.', cost: 0 },
  { level: 2, name: 'Nice Rod', emoji: '🎣', desc: 'A step up. Less junk.', cost: 500 },
  { level: 3, name: 'Pro Rod', emoji: '🎣', desc: "Fisher's choice. Much less junk.", cost: 2000 },
  { level: 4, name: 'Legendary Rod', emoji: '✨', desc: 'Almost no junk. Melon-approved.', cost: 5000 }
]

export const ROD_CASTS_BONUS = [0, 0, 4, 10, 17]

export const AUTO_FISHER_TIERS = [
  { level: 1, name: 'Basic', cost: 1000, interval: 3600, maxHaul: 16, desc: '1 fish/hour — haul max 16' },
  { level: 2, name: 'Advanced', cost: 5000, interval: 1800, maxHaul: 24, desc: '1 fish/30min — haul max 24' },
  { level: 3, name: 'Elite', cost: 15000, interval: 600, maxHaul: 36, desc: '1 fish/10min — haul max 36' }
]

export const DAILY_FISH_CHALLENGES = [
  { id: 'catch_5', label: 'Catch 5 fish today', target: 5, stat: 'df_any', reward: 30 },
  { id: 'catch_rare', label: 'Catch 1 rare or better fish', target: 1, stat: 'df_rare', reward: 50 },
  { id: 'catch_epic', label: 'Catch 1 epic or legendary fish', target: 1, stat: 'df_epic', reward: 80 },
  { id: 'no_junk', label: 'Catch 8 non-junk fish', target: 8, stat: 'df_nonjunk', reward: 40 },
  { id: 'weight_champ', label: 'Catch any fish over 500g', target: 1, stat: 'df_heavy', reward: 45 }
]

export const RARITY_COLORS = { junk: '#888', common: '#5dde7a', uncommon: '#4dabf7', rare: '#9966ff', epic: '#ff9f43', legendary: '#ffd700' }

export const FISH_HUNGER_BY_RARITY = { junk: 0, common: 8, uncommon: 15, rare: 25, epic: 40, legendary: 60 }

export function formatWeight(grams) {
  if (!grams || grams <= 0) return null
  if (grams < 1000) return grams + 'g'
  return (grams / 1000).toFixed(1) + 'kg'
}

// Ports weeklyChallenge_getWeekKey(), game.js:35862-35867. This was extracted
// standalone in Phase 4 because Fishing's own weekly quest seeds its target fish
// per ISO week and the Weekly Challenges system was unmigrated at the time; that
// system landed in Phase 9.5, but the helper stays here so this data module has
// no dependency on a service.
export function getWeekKey() {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
  return now.getFullYear() + '_w' + weekNum
}
