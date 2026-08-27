// Housing data, ported from game.js's room_* block.
//
// Worth knowing up front: there are TWO room systems in the legacy app, sharing
// the `furniture_items` catalog and `user_furniture` ownership but nothing else.
//
//   1. The PLAYER room (this file's ROOM_SLOTS/ROOM_THEMES) — the Housing tab.
//      One per account, stored as `players.room_layout` (a slot→furniture map)
//      plus `players.room_theme`. Positioned slots, themes, bonuses, vibe score,
//      and it can be visited by other players.
//
//   2. The PET room — the 🏠 Room button on each pet card. One per pet, stored
//      as `pet_rooms.furniture_list` (a flat array, no positions or themes).
//      Its only mechanic is a daily happiness bonus applied on login.
//
// Both are ported. They are separate features, not competing implementations.

// The seven fixed positions in a player room. `x`/`y` are percentages within
// `.player-room-visual`, whose floor line sits at 45%.
export const ROOM_SLOTS = [
  { id: 0, zone: 'wall', label: 'Wall Left', x: '12%', y: '22%' },
  { id: 1, zone: 'wall', label: 'Wall Center', x: '42%', y: '14%' },
  { id: 2, zone: 'wall', label: 'Wall Right', x: '72%', y: '22%' },
  { id: 3, zone: 'floor', label: 'Floor Left', x: '8%', y: '62%' },
  { id: 4, zone: 'floor', label: 'Floor Ctr-L', x: '30%', y: '68%' },
  { id: 5, zone: 'floor', label: 'Floor Ctr-R', x: '54%', y: '68%' },
  { id: 6, zone: 'floor', label: 'Floor Right', x: '76%', y: '62%' }
]

// `requiresCorruption` on the Spooky Lair is inert in legacy — room_render reads
// it into a `locked` variable that is then never used, and room_setTheme checks
// only the price. So it is buyable like any other theme today, and that is what
// is ported. Wire the gate up when World State migrates.
export const ROOM_THEMES = {
  cottage: { name: '🌿 Cozy Cottage', price: 0, wall: '#e8dcc8', floor: '#c4a97a', accent: '#8b5e3c', sky: '#d4e8c2', desc: 'Warm wood and soft green.' },
  aquatic: { name: '🌊 Aquatic Den', price: 250, wall: '#b8d4e8', floor: '#5a8fa8', accent: '#2c6080', sky: '#87ceeb', desc: 'Cool blues and soft teal.' },
  spooky: { name: '🌑 Spooky Lair', price: 500, wall: '#2a1f3d', floor: '#1a1025', accent: '#9944cc', sky: '#0d0820', desc: "Unlocked through Piper's influence.", requiresCorruption: true },
  galactic: { name: '🌌 Galactic Suite', price: 1000, wall: '#1a1040', floor: '#0d0830', accent: '#4455ff', sky: '#080418', desc: 'Stars and deep space.' }
}

export const ROOM_BONUS_LABELS = {
  happiness: '😊 +{v} Daily Happiness',
  battle_xp: '⚔️ +{v}% Battle XP',
  racing_train: '🏋️ +{v}% Racing Fitness Gain',
  expedition_pp: '🗺️ +{v}% Expedition PP',
  fishing_casts: '🎣 +{v} Daily Cast',
  minigame_pp: '🎮 +{v}% Minigame PP',
  cooking_drops: '🌿 +{v}% Ingredient Drop Chance',
  energy_regen: '⚡ +{v} Energy on Login',
  vibe: '✨ Vibe Score +{v}'
}

// Max furniture in a PET room (the flat-list system). The player room is capped
// by its seven slots instead.
export const ROOM_MAX_ITEMS = 8

export const VIBE_MAX = 35

// Flavour text for the pet room's auto-generated description.
export const ROOM_VIBES = [
  'It feels warm and inviting.',
  "It's a cozy little space!",
  'Very homey!',
  'Quite the snug hideaway.',
  'A perfect retreat.'
]
