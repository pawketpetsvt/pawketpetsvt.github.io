// Ports weatherSystem.weatherTypes (game.js:32594). Weather rotates every six
// hours and is shared by every player — it is stored per-day on `daily_features`
// so everyone sees the same sky.
export const WEATHER_TYPES = [
  { id: 'clear', name: 'Clear', icon: '☀️', weight: 22, description: 'Perfect weather for pet adventures!', effect: 'Normal conditions' },
  { id: 'sunny', name: 'Sunny', icon: '🌤️', weight: 20, description: 'The sun is shining brightly!', effect: 'Pets are extra happy today' },
  { id: 'rainy', name: 'Rainy', icon: '🌧️', weight: 18, description: 'The mushrooms are extra happy today.', effect: 'Water types earn +25% XP' },
  { id: 'foggy', name: 'Foggy', icon: '🌫️', weight: 16, description: 'Mysterious mists drift through the Deep Woods.', effect: 'Rare encounters +10% chance' },
  { id: 'windy', name: 'Windy', icon: '💨', weight: 16, description: 'Hold onto your spoons! Gusty conditions today.', effect: 'All pets move +15% faster' },
  { id: 'starry', name: 'Starry Night', icon: '✨', weight: 6, description: 'The cosmos align. Make a wish!', effect: 'Mystical bonuses active' },
  { id: 'cursed', name: 'Cursed Fog', icon: '🟣', weight: 2, description: 'Strange purple fog from the ruins. Beware.', effect: 'Something feels different...' },
  { id: 'adpocalypse', name: 'Ad-pocalypse', icon: '📢', weight: 3, description: 'Melon Interactive is pushing targeted ads. Click wisely.', effect: "Ads appear! Some reward PP, some... don't." }
]

// Weather → the `bonus_type` legacy writes alongside it on `daily_features`.
export const WEATHER_BONUS_TYPE = {
  clear: 'normal', sunny: 'happiness_boost', rainy: 'water_xp',
  foggy: 'rare_encounters', windy: 'speed_boost', starry: 'mystery_bonus',
  cursed: 'spooky_bonus'
}

export const ROTATION_HOURS = 6

// Ports weatherSystem.getWeatherBonus()'s `bonusMap` (game.js:32790-32830).
//
// THIS WAS DROPPED. The Phase 8b weather port carried the rotation, the body
// class and the id lookup, and documented what it was deferring (the navbar
// widget, Ad-pocalypse, the cursed glitches) — but it silently left out the
// bonus table, which is the half that actually affects play. Weather has been
// purely cosmetic in the Vue app ever since, apart from the four weather-gated
// legendary fish. These are the live multipliers, restored verbatim.
//
// `adpocalypse` appears in no row, so it falls through to the 1.0 default, as
// it does in legacy.
export const WEATHER_BONUSES = {
  // Extra XP from battles and expeditions.
  xpBonus:        { clear: 1.0, sunny: 1.10, rainy: 1.0,  foggy: 1.0,  windy: 1.0,  starry: 1.20, cursed: 0.90 },
  // Extra PP from all sources.
  ppBonus:        { clear: 1.0, sunny: 1.0,  rainy: 1.05, foggy: 1.0,  windy: 1.0,  starry: 1.15, cursed: 0.95 },
  // Rare item find multiplier.
  dropChance:     { clear: 1.0, sunny: 1.0,  rainy: 1.0,  foggy: 1.15, windy: 1.0,  starry: 1.25, cursed: 1.0 },
  // Energy regen rate multiplier.
  energyRegen:    { clear: 1.0, sunny: 1.15, rainy: 1.0,  foggy: 1.0,  windy: 1.10, starry: 1.0,  cursed: 0.85 },
  // How fast happiness drops — LOWER is better here.
  happinessDecay: { clear: 1.0, sunny: 0.85, rainy: 1.10, foggy: 1.0,  windy: 1.0,  starry: 0.90, cursed: 1.20 }
}
