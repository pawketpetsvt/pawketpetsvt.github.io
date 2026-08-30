// Static minigame content ported from game.js.
//
// The Event Calendar's Minigame Monday bonus IS applied — see
// MinigamesService.completeGame(), which pays the multiplier as extra PP.
// Badge, Bingo and PawketPass side effects are all live as of Phase 9.5.

export const WHEEL_PRIZES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🎰']
export const SLOT_BETS = [10, 50, 100]

export const GUESS_PP_REWARDS = [100, 70, 50, 35, 25, 20]

export const TYPING_WORDS = [
  'Ember', 'Pyxie', 'Embertail', 'Pyxshuul', 'Gnarly', 'Blushimia', 'Kelta', 'Aria', 'Jess', 'Steve', 'Cowbee', 'Cypurr',
  'Piper', 'Pawket', 'PawketPets', 'Melon', 'Warrens', 'Archivist', 'Outskirts', 'Deepwoods', 'Ruins', 'Glade',
  'Panda', 'Koala', 'Dragon', 'Phoenix', 'Tiger', 'Leopard', 'Cheetah', 'Panther', 'Wolf', 'Bear', 'Raccoon', 'Otter',
  'Seal', 'Fox', 'Bunny', 'Rabbit', 'Squirrel', 'Bird', 'Spider', 'Boar', 'Deer', 'Moth', 'Smilodon', 'Parasaur',
  'Protogen', 'Sparkledog', 'Pomeranian',
  'Biscuit', 'Cookie', 'Sashimi', 'Smoothie', 'Burrito', 'Steak', 'Bread', 'Honey', 'Mango', 'Anchovy', 'Cinnabon',
  'Potion', 'Remedy', 'Nectar', 'Berries', 'Mushroom', 'Elixir',
  'Battle', 'Sprint', 'Jostle', 'Block', 'Conserve', 'Stamina', 'League', 'Trophy', 'Champion', 'Phantom',
  'Expedition', 'Exploration', 'Adventure', 'Discovery', 'Treasure', 'Recipe', 'Cooking', 'Fishing', 'Racing',
  'Corruption', 'Archive', 'Hollow', 'Ashen', 'Warren', 'Shadow', 'Glitch', 'Portal', 'Cascade', 'Inferno',
  'Cosmos', 'Nebula', 'Starfall', 'Nightmare', 'Vortex', 'Catalyst',
  'Brave', 'Swift', 'Clever', 'Fierce', 'Loyal', 'Bright', 'Cozy', 'Spooky', 'Fluffy', 'Ancient',
  'Crystal', 'Thunder', 'Frost', 'Storm', 'Flame', 'Void', 'Chaos', 'Spirit', 'Nature',
  'Crimson', 'Violet', 'Silver', 'Golden', 'Scarlet', 'Cobalt',
  'Constellation', 'Catastrophe', 'Spectacular', 'Extraordinary', 'Championship', 'Celebration',
  'Magnificent', 'Phenomenal', 'Adventurous', 'Mysterious', 'Adventurer', 'Triumphant', 'Ry'
]

export const MEMORY_EMOJIS = ['🐾', '🍉', '⭐', '🎈', '🌙', '🔥', '💎', '🌸', '🦋', '🍀', '🎵', '⚡']
export const MEMORY_PAIRS = 6
export const MEMORY_TRIES = 15

// Whack-a-Mole targets. Melon is the mascot and the ONLY thing worth points;
// everything else that pops up is a pet acting as bait. Legacy had no such
// distinction — it alternated two pet images by hole index and scored every
// pop, so the two pictures meant nothing.
export const WHACK_MELON_IMAGE = '/images/melon.png'

// Bait normally comes from the live pet catalog, so new pets appear here on
// their own. This is only the fallback for when the catalog has not loaded.
export const WHACK_BAIT_FALLBACK = [
  '/images/pets/aria.png',
  '/images/pets/blushimia.png',
  '/images/pets/cowbee.png',
  '/images/pets/cy.png',
  '/images/pets/disc.png',
  '/images/pets/ember.png',
  '/images/pets/gnarly.png',
  '/images/pets/kelta.png',
  '/images/pets/pyxie.png'
]

// Share of pops that are bait rather than Melon.
export const WHACK_BAIT_CHANCE = 0.3

// The 6 "core" games that count toward the +50 PP daily-complete bonus.
// Dice and Slot Machine are deliberately excluded, game.js:35198.
//
// REFERENCE ONLY — nothing imports this. The authoritative list lives inside
// `claim_daily_complete_bonus_secure`, the RPC added by Phase 4's game_claims
// migration, because a client-held list is a client-editable one. Kept here as
// documentation of what that RPC checks; editing it changes nothing.
export const DAILY_COMPLETE_CORE_GAMES = ['guess', 'wheel', 'whack', 'memory', 'shell', 'typing']
export const DAILY_COMPLETE_BONUS_PP = 50
