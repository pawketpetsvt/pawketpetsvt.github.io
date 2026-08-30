// Ports SECRET_DUNGEONS (game.js:5718) — two hidden battle zones found by
// exploring, not bought or unlocked by level.
//
// Both zones are already fully built on the Vue side: ZONE_CONFIG has their
// battle modifiers, zoneMeta has their picker cards, and encounterData has
// their flavour lines. Only the discovery that reveals them was missing, which
// is why they have been unreachable.
//
// `lsKey` is dropped from the port: legacy tracked unlocks in localStorage with
// the DB as a backup copy, so a cleared browser hid zones a player had already
// found until the next login re-synced them. `player_unlocks` is the single
// source of truth here.
export const SECRET_DUNGEONS = [
  {
    key: 'hollow_warrens',
    name: 'The Hollow Warrens',
    emoji: '🐇',
    description: 'A labyrinthine network of tunnels beneath the glade. Something has been living here for a very long time.',
    // Discoverable only while exploring one of these.
    requiredZones: ['outskirts', 'glade'],
    difficulty: 'Mid-tier (between Glade and Deepwoods)',
    flavorText: "The entrance smells of earth and something older. Your pet's ears perk up."
  },
  {
    key: 'ashen_ruins',
    name: 'The Ashen Ruins',
    emoji: '🔥',
    description: 'Scorched stone corridors deep within the ruins. The fire here never seems to go out.',
    requiredZones: ['deepwoods', 'ruins'],
    difficulty: 'Hard (between Deepwoods and Ruins bosses)',
    flavorText: 'The air shimmers with heat. Something has been burning here for centuries.'
  }
]

// Chance of a discovery roll firing when an expedition is claimed.
export const DISCOVERY_CHANCE = 0.02
export const DISCOVERY_PP = 100
