// Ports worldEvents.events (game.js:10064) — the 15 rotating world events.
// Extracted programmatically from the legacy array rather than retyped: the
// effect multipliers are load-bearing gameplay numbers where a transcription
// slip would be invisible.
//
// One event is live at a time for EVERY player, rolled server-side by
// roll_world_event() so the whole community shares the same world.
export const WORLD_EVENTS = [
  {
    id: "mushroom_migration", name: "Mushroom Migration Day", icon: "🍄",
    description: "The mushrooms are on the move! Battle encounters are more common today.",
    duration: 1, rarity: "common",
    effects: { battleXpBonus: 1.25, encounterRate: 1.5 }
  },
  {
    id: "spoon_appreciation", name: "Spoon Appreciation Week", icon: "🥄",
    description: "All spoons deserve recognition. Spoon weapons deal extra damage!",
    duration: 7, rarity: "uncommon",
    effects: { spoonDamageBonus: 1.5, spoonShopDiscount: 0.75 }
  },
  {
    id: "pyxie_chaos", name: "Pyxie Chaos Festival", icon: "✨",
    description: "Maximum chaos day! Random bonuses and surprises everywhere.",
    duration: 1, rarity: "rare",
    effects: { randomBonusChance: 0.3, ppGainBonus: 1.5 }
  },
  {
    id: "golden_bunny", name: "Golden Bunny Sighting", icon: "🐰",
    description: "The elusive Golden Bunny grants luck! Rare drops are more common.",
    duration: 1, rarity: "legendary",
    effects: { rareFindChance: 2, criticalHitChance: 1.5, luckBonus: true }
  },
  {
    id: "strange_fog", name: "Strange Fog in the Deep Woods", icon: "🌫️",
    description: "Mysterious fog affects the forest. Pets feel... different.",
    duration: 2, rarity: "rare",
    effects: { petHappinessDecay: 0.5, mysteryBonus: true, explorationBonus: 1.25 }
  },
  {
    id: "pet_parade", name: "Grand Pet Parade", icon: "🎉",
    description: "All pets are celebrating! Happiness increases faster today.",
    duration: 1, rarity: "common",
    effects: { happinessGain: 2, petXpBonus: 1.25, snackEfficiency: 1.5 }
  },
  {
    id: "market_madness", name: "Marketplace Madness", icon: "🛒",
    description: "Special deals in the shop! Everything is discounted.",
    duration: 1, rarity: "uncommon",
    effects: { shopDiscount: 0.7, sellBonus: 1.5 }
  },
  {
    id: "void_watching", name: "The Void is Watching", icon: "👁️",
    description: "The void grants mysterious bonuses. Proceed respectfully.",
    duration: 1, rarity: "rare",
    effects: { allStatsBonus: 1.15, mysteryRewardChance: 0.2, voidBlessing: true }
  },
  {
    id: "battle_tournament", name: "Arena Championship", icon: "⚔️",
    description: "The Battle Arena is hosting a tournament! Victory rewards doubled.",
    duration: 3, rarity: "uncommon",
    effects: { battleRewards: 2, battleXpBonus: 1.5, winStreakBonus: 1.25 }
  },
  {
    id: "snack_shortage", name: "Great Snack Shortage", icon: "🍪",
    description: "Someone hoarded all the snacks. Snacks are less effective but cheaper!",
    duration: 1, rarity: "common",
    effects: { snackEfficiency: 0.75, snackCost: 0.5 }
  },
  {
    id: "full_moon", name: "Full Moon Night", icon: "🌕",
    description: "The full moon brings nocturnal power. Night bonuses active!",
    duration: 1, rarity: "uncommon",
    effects: { nightPowerBonus: 1.4, energyRegen: 1.5, moonBlessing: true }
  },
  {
    id: "butterfly_swarm", name: "Suspicious Butterfly Swarm", icon: "🦋",
    description: "The butterflies share their secrets. Discovery chances increased!",
    duration: 1, rarity: "rare",
    effects: { discoveryChance: 2, explorationBonus: 1.5, hiddenItemChance: 1.75 }
  },
  {
    id: "tactical_napping", name: "International Tactical Napping Day", icon: "😴",
    description: "Strategic rest pays off. Energy regenerates much faster!",
    duration: 1, rarity: "common",
    effects: { energyRegen: 2.5, restBonus: 1.5, fatigueReduction: 0.5 }
  },
  {
    id: "ruins_rumbling", name: "The Ruins are Rumbling", icon: "🏛️",
    description: "Ancient power awakens. All rewards significantly increased!",
    duration: 2, rarity: "legendary",
    effects: { allRewards: 2, ancientPowerBonus: 1.5, legendaryDropChance: 3, ruinsBlessing: true }
  },
  {
    id: "friendship_festival", name: "Friendship Festival", icon: "💖",
    description: "Bonds grow stronger. Friend activities and social features boosted!",
    duration: 3, rarity: "common",
    effects: { friendshipGain: 2, giftEfficiency: 1.5, socialBonus: 1.3, happinessGain: 1.5 }
  }
]

// How each effect key is described to the player.
//
// LEGACY BUG this consolidates and fixes. Legacy describes an event's bonuses
// from TWO separate hand-written tables that were never reconciled —
// `esw_getEventBonusText()` (8 keys) for the navbar tooltip and
// `worldEvents.getEffectsDisplay()` (7 keys) for the event banner. Between
// them they cover 10 of the 37 effect keys the 15 events actually use, so
// **four whole events describe themselves as having no bonuses at all**:
// Strange Fog, The Void is Watching, Great Snack Shortage and Suspicious
// Butterfly Swarm each carry 2-3 real effects and render as "No special
// bonuses". Same two-copies-of-one-table shape as the Grand Prix scoring
// formula found in Phase 9.
//
// `dir` says which way is good, because six of these are multipliers BELOW 1
// that are a benefit (a 0.7 shop discount is 30% off, not a 30% penalty):
//   'up'   — higher is better, shown as +N%
//   'down' — lower is better, shown as the reduction
//   'mult' — read as a raw multiplier (2x rather than +100%)
//   'pct'  — the value is already a probability, shown as N%
//   'flag' — a boolean; the label stands alone
const E = (icon, label, dir = 'up') => ({ icon, label, dir })

export const EFFECT_LABELS = {
  battleXpBonus:       E('⚔️', 'Battle XP'),
  petXpBonus:          E('⬆️', 'Pet XP'),
  ppGainBonus:         E('💜', 'PP Gain'),
  battleRewards:       E('🪙', 'Battle PP', 'mult'),
  allRewards:          E('✨', 'All Rewards', 'mult'),
  encounterRate:       E('👀', 'Encounters'),
  energyRegen:         E('⚡', 'Energy Regen', 'mult'),
  restBonus:           E('🛌', 'Rest Benefits'),
  fatigueReduction:    E('😌', 'Fatigue', 'down'),
  happinessGain:       E('💖', 'Happiness'),
  petHappinessDecay:   E('💗', 'Happiness Decay', 'down'),
  shopDiscount:        E('🛒', 'Off Shop Items', 'down'),
  spoonShopDiscount:   E('🥄', 'Off Spoons', 'down'),
  snackCost:           E('🍪', 'Off Snacks', 'down'),
  snackEfficiency:     E('🍬', 'Snack Effectiveness'),
  sellBonus:           E('💰', 'Sell Value'),
  spoonDamageBonus:    E('🥄', 'Spoon Damage'),
  criticalHitChance:   E('🎯', 'Critical Hits'),
  allStatsBonus:       E('📊', 'All Stats'),
  ancientPowerBonus:   E('🏛️', 'Stat Power'),
  nightPowerBonus:     E('🌙', 'Power at Night'),
  winStreakBonus:      E('🔥', 'Win Streak Rewards'),
  rareFindChance:      E('🎁', 'Rare Drop Chance', 'mult'),
  legendaryDropChance: E('🌟', 'Legendary Drop Chance', 'mult'),
  hiddenItemChance:    E('🔍', 'Hidden Item Chance'),
  discoveryChance:     E('🗺️', 'Discovery Chance', 'mult'),
  explorationBonus:    E('🧭', 'Exploration Rewards'),
  friendshipGain:      E('🤝', 'Friendship XP', 'mult'),
  giftEfficiency:      E('🎀', 'Gift Effectiveness'),
  socialBonus:         E('💬', 'Social Rewards'),
  randomBonusChance:   E('🎲', 'Random Bonus Chance', 'pct'),
  mysteryRewardChance: E('❔', 'Mystery Reward Chance', 'pct'),
  luckBonus:           E('🍀', "The Golden Bunny's luck is with you", 'flag'),
  moonBlessing:        E('🌕', "Blessed by the full moon", 'flag'),
  voidBlessing:        E('👁️', 'The void has blessed you', 'flag'),
  ruinsBlessing:       E('🏛️', 'The ruins have blessed you', 'flag'),
  mysteryBonus:        E('🔮', 'Random stat changes', 'flag')
}

// Ports esw_getWeatherBonusText() — the navbar tooltip's weather copy. Kept as
// prose rather than derived from WEATHER_BONUSES because legacy's own comment
// says these "match the actual values in getWeatherBonus()", and they do; the
// numbers here are checked against that table in WeatherService.
export const WEATHER_BONUS_TEXT = {
  clear:  '☀️ Normal conditions, no bonuses or penalties',
  sunny:  '☀️ +10% XP from all sources\n⚡ +15% Energy regen\n😊 Happiness decays 15% slower',
  rainy:  '🌧️ +5% PP from all sources\n😟 Happiness decays 10% faster',
  foggy:  '🌫️ +15% rare item drop chance',
  windy:  '💨 +10% Energy regen',
  starry: '✨ +20% XP from all sources\n💜 +15% PP from all sources\n⭐ +25% rare item drop chance',
  cursed: '🟣 -10% XP and PP from all sources\n⚡ -15% Energy regen\n😱 Happiness decays 20% faster'
}
