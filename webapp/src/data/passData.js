// PawketPass season-1 reward track, extracted from PASS_REWARDS
// (game.js:10782-10833). 50 levels of points / items / titles.
//
// ── THE ITEM REWARDS, AND WHY THEY LOOK LIKE THIS ──────────────────────────
// Legacy wrote six of the seven item rewards as SLUGS — `basic_food`, `treat`,
// `rare_toy`, `premium_treat`, `revive_potion`, `mystery_box` — and inserted
// them straight into `user_inventory.item_id`. That column is a uuid, so every
// one of those inserts failed; legacy never checked the result, so 13 of the 50
// levels silently granted nothing on the live site for the pass's whole life.
//
// Three of the slugs turned out to name REAL categories in the items table
// (`food_category='basic'` has 5 rows, `item_type='toy'` has 6, and snack+sweet
// foods make 8), so the intent was clearly a random draw from a category — the
// resolving code was simply never written. Those three stay as CATEGORY TOKENS
// and are resolved at claim time by `pass_resolve_item` server-side.
//
// The other three had no category behind them and are now fixed items.
export const FAERIE_DUST_DELIGHT = '26641868-18fa-4311-9f65-292eacd31a22'
export const FULL_RESTORE = 'cd1f341f-488e-48a8-8511-d93e769cc004'
export const GOLDEN_CROWN_ROAST = '696505ec-49c1-4c13-94c2-b6fbfc337d97'

// Category tokens. `pass_resolve_item` recognises these by name and picks a
// random matching item; anything else is treated as a uuid or an item name.
export const PASS_ITEM_CATEGORIES = {
  basic_food: { item_type: 'food', food_category: 'basic' },
  // `item_type` is pinned to 'food' so this cannot draw Faerie Dust Delight,
  // which is `item_type='snack'` with `food_category='sweet'` and is the
  // premium tier's fixed reward.
  treat: { item_type: 'food', food_category: ['snack', 'sweet'] },
  rare_toy: { item_type: 'toy' }
}

export const PASS_REWARDS = {
  1: { type: 'points', amount: 100 },
  2: { type: 'item', itemId: 'basic_food', quantity: 2 },
  3: { type: 'item', itemId: 'treat', quantity: 3 },
  4: { type: 'points', amount: 150 },
  5: { type: 'item', itemId: 'rare_toy', quantity: 1 },
  6: { type: 'title', titleKey: 'pass_rider' },
  7: { type: 'points', amount: 200 },
  8: { type: 'item', itemId: 'treat', quantity: 2, itemId2: 'basic_food', quantity2: 1 },
  9: { type: 'points', amount: 250 },
  10: { type: 'item', itemId: FAERIE_DUST_DELIGHT, quantity: 1 },
  11: { type: 'points', amount: 300 },
  12: { type: 'item', itemId: 'rare_toy', quantity: 2 },
  13: { type: 'title', titleKey: 'dedicated_trainer' },
  14: { type: 'points', amount: 350 },
  15: { type: 'item', itemId: FULL_RESTORE, quantity: 1 },
  16: { type: 'points', amount: 400 },
  17: { type: 'item', itemId: 'treat', quantity: 3, itemId2: 'basic_food', quantity2: 2 },
  18: { type: 'points', amount: 450 },
  19: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  20: { type: 'title', titleKey: 'faithful_companion' },
  21: { type: 'points', amount: 500 },
  22: { type: 'item', itemId: FAERIE_DUST_DELIGHT, quantity: 2 },
  23: { type: 'points', amount: 550 },
  24: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  25: { type: 'points', amount: 600 },
  26: { type: 'item', itemId: 'rare_toy', quantity: 3 },
  27: { type: 'title', titleKey: 'pawket_champion' },
  28: { type: 'points', amount: 700 },
  29: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  30: { type: 'title', titleKey: 'style_master' },
  31: { type: 'points', amount: 800 },
  32: { type: 'item', itemId: 'treat', quantity: 5, itemId2: 'basic_food', quantity2: 3 },
  33: { type: 'points', amount: 900 },
  34: { type: 'title', titleKey: 'legendary_tamer' },
  35: { type: 'points', amount: 1000 },
  36: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 2 },
  37: { type: 'points', amount: 1100 },
  38: { type: 'item', itemId: FAERIE_DUST_DELIGHT, quantity: 3, itemId2: FULL_RESTORE, quantity2: 2 },
  39: { type: 'points', amount: 1200 },
  40: { type: 'title', titleKey: 'mythic_breaker' },
  41: { type: 'points', amount: 1300 },
  42: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 2 },
  43: { type: 'points', amount: 1400 },
  44: { type: 'item', itemId: GOLDEN_CROWN_ROAST, quantity: 3 },
  45: { type: 'points', amount: 1500 },
  46: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 3 },
  47: { type: 'title', titleKey: 'pawket_master' },
  48: { type: 'points', amount: 2000 },
  49: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 3 },
  50: { type: 'title', titleKey: 'ultimate_collector' }
}

// The Skin Key item row. Legacy writes this UUID inline in PASS_REWARDS and
// special-cases it when naming the reward in a toast.
export const SKIN_KEY_ITEM_ID = '00000000-0000-0000-0000-000000000001'

// How each item reference reads in the track and in the claim toast.
//
// Needed because the reward track is a list of raw references: without this a
// fixed reward would display its UUID, and a category token would display its
// slug ("basic food"). Legacy showed the slug — "📦 +2x basic_food" — which is
// how obvious it is that these were never finished.
//
// Category entries are phrased as a description because the actual item is not
// known until the claim resolves it server-side.
export const PASS_ITEM_LABELS = {
  basic_food: 'a basic food',
  treat: 'a treat',
  rare_toy: 'a toy',
  [FAERIE_DUST_DELIGHT]: 'Faerie Dust Delight',
  [FULL_RESTORE]: 'Full Restore',
  [GOLDEN_CROWN_ROAST]: 'Golden Crown Roast',
  [SKIN_KEY_ITEM_ID]: '🔑 Skin Key'
}

// Falls back to the reference itself so an unmapped id is still readable
// rather than rendering as nothing.
export const passItemLabel = ref => PASS_ITEM_LABELS[ref] || String(ref).replace(/_/g, ' ')

export const PASS_MAX_LEVEL = 50
export const PASS_SEASON = 1

// XP needed to reach `level` from the one below: 100 * 1.1^(level-1).
export const xpForLevel = level => Math.floor(100 * Math.pow(1.1, level - 1))

// Per-source daily XP ceilings (ports resetDailyXPCaps, game.js:10956).
//
// A source absent from this table is UNCAPPED — `remainingToday()` returns
// Infinity for it — which matches legacy, where the ten below are the only
// capped sources despite the app granting XP from twenty-five.
//
// The server is the authority (`pass_xp_sources.daily_cap`); this table is what
// the fallback path uses when those RPCs are unavailable, so the two must agree.
// If you retune a cap here, change the matching row in `pass_xp_sources` too.
export const DAILY_XP_CAPS = {
  login: 10,
  feed: 20,
  play: 20,
  battle: 50,
  expedition: 30,
  race: 20,
  level_up: 30,
  bingo_square: 135,
  bingo_line: 400,
  bingo_blackout: 200,
  // Not a legacy cap. Cooking pays up to 30 XP per batch with nothing bounding
  // how many batches a player cooks, which makes it the only farmable source in
  // the set; capped at the user's direction, on the same footing as expedition
  // and level_up. Mirrors pass_xp_sources_backfill.sql.
  cooking: 30
}
