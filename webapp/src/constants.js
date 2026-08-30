// Phase-1-scoped constants only. The full GAME_CONSTANTS/ZONE_CONFIG grab-bags
// in game.js are mostly Battle/Pass/Equipment fields and travel with those
// systems in their own migration phases, not here.
// Corrected in Phase 10, when the tutorial was actually ported and these got
// their first consumer. Phase 1 recorded them as 50/25 — half the real figures.
// GAME_CONSTANTS (game.js:948-949) declared 100 and 50, the Tutorial object
// hardcoded the same 100 and 50, and its skip prompt tells the player "you'll
// still receive 50 PP". All three agreed; only this file disagreed, and it had
// no consumer, so nothing ever paid the wrong amount.
export const TUTORIAL_PP_REWARD = 100
export const TUTORIAL_SKIP_PP = 50
export const REFERRAL_PP_REWARD = 100
export const DAILY_BONUS_PP = 50
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100]
