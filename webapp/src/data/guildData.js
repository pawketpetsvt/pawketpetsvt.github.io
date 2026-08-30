// Guild constants, ported from the GUILD SYSTEM block (game.js:6838+).

export const GUILD_MAX_MEMBERS = 50
export const GUILD_CREATE_COST = 500
export const GUILD_MIN_PET_LEVEL = 5
export const GUILDS_PER_PAGE = 10

// Guild XP needed for the next level: level * 100.
export const guildXpNeeded = level => (level || 1) * 100

export const ROLE_ICONS = { leader: '👑', officer: '⭐', member: '👤' }

// ── Chat ────────────────────────────────────────────────────────────────────
export const CHAT_MAX_LEN = 500
export const CHAT_LIMIT = 50

// ── Treasury ────────────────────────────────────────────────────────────────
export const DONATE_MIN = 10

// PP taken from the treasury when a proposal passes.
export const PROPOSAL_COSTS = { xp_boost: 1000, discount: 2000, reward_boost: 1500 }

// A proposal passes early once it has this many "for" votes AND more for than
// against. At its deadline it passes on a simple majority instead.
export const VOTE_PASS_THRESHOLD = 3

export const PROPOSAL_EFFECTS = [
  { key: 'xp_boost', label: '⚡ XP Boost (+10%)' },
  { key: 'discount', label: '🛒 Shop Discount (-20%)' },
  { key: 'reward_boost', label: '💰 Reward Boost (+25%)' }
]

export const EFFECT_ICONS = { xp_boost: '⚡', discount: '🛒', reward_boost: '💰', special: '✨' }

// The three treasury-vote perks. `multiplierFrom` mirrors applyGuildPerk()
// (game.js:7569): a discount is a multiplier BELOW 1, the two boosts above it.
export const PERK_TYPES = ['xp_boost', 'discount', 'reward_boost']

export const PERK_LABELS = {
  xp_boost: '⚡ XP Boost',
  discount: '🛒 Shop Discount',
  reward_boost: '💰 Reward Boost'
}

export const PERK_DEFAULT_PERCENT = {
  xp_boost: 10,
  discount: 20,
  reward_boost: 25
}

export function perkMultiplierFrom(effectType, effectValue) {
  const percent = (effectValue && effectValue.percent) || PERK_DEFAULT_PERCENT[effectType] || 0
  if (effectType === 'discount') return 1 - percent / 100
  return 1 + percent / 100
}
