// Static minigame content ported from game.js. Badge/Bingo/PassXP/Event
// Calendar side effects on these games are deliberately not ported — those
// systems (Badges, Bingo, PawketPass, Event Calendar) aren't migrated yet.

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
  'Magnificent', 'Phenomenal', 'Adventurous', 'Mysterious', 'Adventurer', 'Triumphant'
]

export const MEMORY_EMOJIS = ['🐾', '🍉', '⭐', '🎈', '🌙', '🔥', '💎', '🌸', '🦋', '🍀', '🎵', '⚡']
export const MEMORY_PAIRS = 6
export const MEMORY_TRIES = 15

export const WHACK_MOLE_IMAGES = ['/images/pets/ember.png', '/images/pets/pyxie.png']

// The 6 "core" games that count toward the +50 PP daily-complete bonus.
// Dice and Slot Machine are deliberately excluded, game.js:35198.
export const DAILY_COMPLETE_CORE_GAMES = ['guess', 'wheel', 'whack', 'memory', 'shell', 'typing']
export const DAILY_COMPLETE_BONUS_PP = 50
