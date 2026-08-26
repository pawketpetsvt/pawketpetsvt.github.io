// Presentation metadata for the zone picker, ported from the hand-written
// zone buttons in index.html:1365-1430. The mechanical half of a zone (energy
// cost, level band, battle modifier) lives in ZONE_CONFIG in battleData.js —
// this is only what the button shows.
export const ZONE_META = [
  {
    key: 'outskirts', icon: '🏘️', name: 'City Outskirts',
    blurb: 'Perfect for beginners', difficulty: '⭐ EASY', color: 'var(--green)',
    denizens: 'Birds, Bunnies, Squirrels'
  },
  {
    key: 'glade', icon: '🌳', name: 'Forest Glade',
    blurb: 'For experienced pets', difficulty: '⭐⭐ MEDIUM', color: '#ffaa00',
    denizens: 'Foxes, Raccoons, Boars'
  },
  {
    key: 'deepwoods', icon: '🌲', name: 'Deep Woods',
    blurb: 'For champions only', difficulty: '⭐⭐⭐ HARD', color: '#ff6b6b',
    denizens: 'Wolves, Bears, Deer'
  },
  {
    key: 'ruins', icon: '🏛️', name: 'Outside The Ruins',
    blurb: 'Something waits inside', difficulty: '⭐⭐⭐⭐ EXTREME', color: '#7209b7',
    denizens: 'Corrupted things'
  },
  // Not a battle zone: picking this runs the three-wave Starter Dungeon
  // gauntlet instead of a single encounter.
  {
    key: 'dungeon', icon: '⛰️', name: 'Shallow Cave',
    blurb: '3 waves, no healing!', difficulty: '⚔️ GAUNTLET', color: '#9d4edd',
    denizens: 'Baby · Adult · KING', isDungeon: true
  },
  // Secret zones stay hidden until discovered through exploration. The unlock
  // system that reveals them is not migrated yet, so `secret: true` keeps them
  // out of the picker rather than showing a permanently locked button.
  {
    key: 'hollow_warrens', icon: '🐇', name: 'The Hollow Warrens',
    blurb: 'Tunnels beneath the glade', difficulty: '⭐⭐⭐ HARD', color: '#22c55e',
    denizens: 'Warren-dwellers', secret: true
  },
  {
    key: 'ashen_ruins', icon: '🔥', name: 'The Ashen Ruins',
    blurb: 'Hard-tier • Between Deepwoods & Ruins boss', difficulty: '⭐⭐⭐ HARD', color: '#f97316',
    denizens: 'Ash-touched', secret: true
  }
]
