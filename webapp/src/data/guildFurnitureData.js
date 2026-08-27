// Guild Hall furniture, extracted verbatim from GUILD_FURNITURE_CATALOG
// (game.js:21683-21723). Distinct from the pet/player furniture in roomData.js —
// this is bought with GUILD TOKENS, not PP, and its buffs apply to every pet
// owned by every member of the guild.

export const GUILD_FURNITURE_CATALOG = [
  // ── Tier 1: Cheap, basic buffs (10-30 tokens) ──
  { key: 'banner',         name: 'Guild Banner',       emoji: '🚩', cost: 10, tier: 1,
    buff: null, desc: 'A decorative banner. Shows guild pride!' },
  { key: 'training_dummy', name: 'Training Dummy',     emoji: '🪆', cost: 20, tier: 1,
    buff: { stat: 'attack', amount: 1 }, desc: 'All guild pets get +1 ATK permanently.' },
  { key: 'healing_pond',   name: 'Healing Pond',       emoji: '💧', cost: 25, tier: 1,
    buff: { stat: 'hp_regen', amount: 2 }, desc: 'HP regenerates 2 extra HP/hour for all guild members.' },
  { key: 'bookshelf',      name: 'Ancient Bookshelf',  emoji: '📚', cost: 30, tier: 1,
    buff: { stat: 'xp_bonus', amount: 5 }, desc: '+5% XP gain for all guild pets.' },

  // ── Tier 2: Moderate, meaningful buffs (50-100 tokens) ──
  { key: 'weapon_rack',    name: 'Weapon Rack',        emoji: '⚔️',  cost: 50, tier: 2,
    buff: { stat: 'attack', amount: 2 }, desc: 'All guild pets get +2 ATK permanently.' },
  { key: 'stone_wall',     name: 'Reinforced Wall',    emoji: '🧱', cost: 60, tier: 2,
    buff: { stat: 'defense', amount: 2 }, desc: 'All guild pets get +2 DEF permanently.' },
  { key: 'lucky_shrine',   name: 'Lucky Shrine',       emoji: '🍀', cost: 75, tier: 2,
    buff: { stat: 'luck', amount: 3 }, desc: '+3 Luck for all guild pets in battle.' },
  { key: 'feast_table',    name: 'Feast Table',        emoji: '🍽️', cost: 80, tier: 2,
    buff: { stat: 'happiness_max', amount: 10 }, desc: '+10 max happiness for all guild pets.' },
  { key: 'speed_track',    name: 'Speed Track',        emoji: '⚡', cost: 90, tier: 2,
    buff: { stat: 'speed', amount: 2 }, desc: 'All guild pets get +2 SPD permanently.' },

  // ── Tier 3: Expensive, powerful buffs (150-300 tokens) ──
  { key: 'throne',         name: 'Guild Throne',       emoji: '👑', cost: 150, tier: 3,
    buff: { stat: 'pp_bonus', amount: 10 }, desc: '+10% PP from all battles for guild members.' },
  { key: 'arcane_forge',   name: 'Arcane Forge',       emoji: '🔮', cost: 200, tier: 3,
    buff: { stat: 'attack', amount: 3, defense: 1 }, desc: '+3 ATK, +1 DEF for all guild pets.' },
  { key: 'spirit_crystal', name: 'Spirit Crystal',     emoji: '💎', cost: 250, tier: 3,
    buff: { stat: 'spirit', amount: 5 }, desc: '+5 Spirit for all guild pets. Piper is less likely to appear.' },
  { key: 'corruption_ward',name: 'Corruption Ward',    emoji: '🌑', cost: 300, tier: 3,
    buff: { stat: 'corruption_resist', amount: 15 }, desc: 'Reduces Corruption damage in battle by 15% for all guild members.' },

  // ── Tier 4: Guild-level locked (500+ tokens) ──
  { key: 'piper_painting', name: "Piper's Portrait",   emoji: '🎵', cost: 500, tier: 4,
    buff: null, desc: "Something about this painting moves when you're not looking. No game effect. Piper is pleased.",
    requiresLevel: 5 },
  { key: 'champions_hall', name: "Champion's Hall",    emoji: '🏆', cost: 800, tier: 4,
    buff: { stat: 'attack', amount: 5, defense: 3, speed: 2 }, desc: '+5 ATK, +3 DEF, +2 SPD for ALL guild pets.',
    requiresLevel: 8 }
]

// Slots unlock one per guild level, capped at 10 (ports guild_furnitureSlots).
export const guildFurnitureSlots = guildLevel => Math.min(10, guildLevel || 1)
export const GUILD_FURNITURE_MAX_SLOTS = 10

// 50 PP buys one guild token (ports guild_donateForTokens).
export const PP_PER_GUILD_TOKEN = 50

export const BUFF_LABELS = {
  attack: '⚔️ ATK', defense: '🛡️ DEF', speed: '⚡ SPD', luck: '🍀 Luck',
  spirit: '✨ Spirit', xp_bonus: '📚 XP Bonus', pp_bonus: '💰 PP Bonus',
  hp_regen: '💧 HP Regen/hr', happiness_max: '😊 Max Happiness',
  corruption_resist: '🌑 Corruption Resist'
}

export const BUFF_UNITS = {
  xp_bonus: '%', pp_bonus: '%', corruption_resist: '%', hp_regen: '/hr'
}
