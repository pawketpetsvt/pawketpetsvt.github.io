import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { awardService } from './AwardService.js'

// The badge/title awards scattered across legacy's feature functions, collected
// here so each migrated service calls one named hook instead of carrying its own
// copy of the thresholds. Battle's set is larger and lives in BattleBadges.js.
//
// Every hook is fire-and-forget and swallows its own errors: a badge is always a
// side effect of something else, and it must never fail the action that earned it.

function safe(fn) {
  return (...args) => {
    Promise.resolve()
      .then(() => fn(...args))
      .catch(e => console.error('[badgeHooks] failed:', e))
  }
}

// ── Pet levels (checkAndApplyLevelUp / feedFree / playFree) ─────────────────
export const onPetLevel = safe(async level => {
  if (level >= 5) await awardService.awardBadge('level_5')
  if (level >= 10) { await awardService.awardBadge('level_10'); await awardService.awardBadge('baby_steps') }
  if (level >= 20) { await awardService.awardBadge('level_20'); await awardService.awardBadge('teen_spirit') }
  if (level >= 40) await awardService.awardBadge('adult_swim')
  if (level >= 60) await awardService.awardBadge('elder_wisdom')
  // `trainer` / `master_trainer` / `the_veteran` key off total level.
  await awardService.checkTitleUnlocks()
})

// ── Adoption (confirmAdopt) ────────────────────────────────────────────────
export const onAdopt = safe(async () => {
  await awardService.awardPlayerTitle('newcomer', 'Adopted a first pet')
  await awardService.awardBadge('first_pet')
  await awardService.checkTitleUnlocks()   // pet_lover / collector / hoarder
})

// ── Daily streak (awardStreakReward) ───────────────────────────────────────
export const onStreak = safe(async streak => {
  if (streak >= 3) await awardService.awardBadge('early_bird')
  if (streak >= 7) {
    await awardService.awardBadge('on_fire')
    await awardService.awardPlayerTitle('daily_player')
  }
  if (streak >= 30) {
    await awardService.awardBadge('badge_30_days')
    await awardService.awardBadge('dedicated')
    await awardService.awardPlayerTitle('dedicated')
  }
  if (streak >= 100) {
    await awardService.awardBadge('badge_100_days')
    await awardService.awardBadge('living_legend')
    await awardService.awardPlayerTitle('loyal')
  }
})

// Ports checkMidnightLogin()'s title. Legacy's window is 00:00-04:00 local.
export const onLogin = safe(async () => {
  const h = new Date().getHours()
  if (h >= 0 && h < 4) await awardService.awardPlayerTitle('night_owl', 'Logged in after midnight')
  await awardService.checkTitleUnlocks()
})

// ── Fishing (castLine) ─────────────────────────────────────────────────────
//
// LEGACY BUG: the angler titles are requested as
// `checkPlayerTitleUnlocks('avid_angler')` — but that function takes NO
// arguments and just runs its own threshold sweep, so the argument is dropped
// and `avid_angler`, `master_angler`, `legendary_angler` and `first_legendary`
// have never been awarded to anyone. They are granted properly here; if a title
// row doesn't exist, awardPlayerTitle returns null and nothing happens.
export const onFishCaught = safe(async ({ totalCaught, isNew, rarity, fishId }) => {
  if (totalCaught === 1 && isNew) await awardService.awardBadge('fishing_first_catch')
  if (totalCaught >= 50) {
    await awardService.awardBadge('fishing_50')
    await awardService.awardPlayerTitle('avid_angler', 'Caught 50 fish')
  }
  if (totalCaught >= 100) {
    await awardService.awardBadge('fishing_100')
    await awardService.awardPlayerTitle('master_angler', 'Caught 100 fish')
  }
  if (totalCaught >= 250) {
    await awardService.awardBadge('fishing_250')
    await awardService.awardPlayerTitle('legendary_angler', 'Caught 250 fish')
  }
  if (rarity === 'legendary' && isNew) {
    await awardService.awardBadge('fishing_legendary')
    await awardService.awardPlayerTitle('first_legendary', 'Caught a legendary fish')
  }
  if (fishId === 'piper_fish') await awardService.awardBadge('fishing_piper_fish')
})

// ── Cooking (cooking_cook) ─────────────────────────────────────────────────
export const onCook = safe(async ({ totalCooked, recipeId }) => {
  if (totalCooked >= 1) await awardService.awardBadge('cook_first')
  if (totalCooked >= 10) await awardService.awardBadge('cook_10')
  if (totalCooked >= 50) await awardService.awardBadge('cook_50')
  if (recipeId && /piper/i.test(recipeId)) await awardService.awardBadge('cook_piper')
})

// ── Expeditions (expedition_claim) ─────────────────────────────────────────
export const onExpeditionClaim = safe(async () => {
  if (!AppState.user) return
  const { count } = await supabase
    .from('expeditions').select('id', { count: 'exact', head: true })
    .eq('user_id', AppState.user.id).eq('claimed', true)
  const total = count || 0
  if (total >= 10) await awardService.awardBadge('explorer_novice')
  if (total >= 50) {
    await awardService.awardBadge('explorer_expert')
    await awardService.awardPlayerTitle('adventurer')
  }
  if (total >= 100) await awardService.awardBadge('explorer_master')
})

// Ports checkExplorationStreak's title award at a 10-streak.
export const onExplorationStreak = safe(async streak => {
  if (streak >= 10) await awardService.awardPlayerTitle('forest_friend', 'Reached a 10-expedition streak')
})

// ── Shop (buyItem / _buyEquipmentCore) ─────────────────────────────────────
//
// LEGACY BUG: both call sites test `currentPoints` — the player's BALANCE at
// the moment of purchase — not the amount spent. So buying a 10 PP item while
// holding 500 PP earned "mega_spender", and a player who spent their way down
// to 90 PP could never earn "big_spender" no matter how much they had spent.
// Keyed off the actual price here, which is what the badge names describe.
// Nobody loses a badge they already hold: awards are permanent.
export const onPurchase = safe(async price => {
  if (price >= 500) await awardService.awardBadge('mega_spender')
  else if (price >= 100) await awardService.awardBadge('big_spender')
})

// ── Friends (acceptFriendRequest) ──────────────────────────────────────────
export const onFriendAccepted = safe(async () => {
  await awardService.awardBadge('first_friend')
  await awardService.awardPlayerTitle('friendly')
  await awardService.checkTitleUnlocks()   // popular / socialite
})

// ── Racing ─────────────────────────────────────────────────────────────────
export const onRaceFinished = safe(async ({ placement, league }) => {
  await awardService.awardBadge('rookie_racer')
  if (placement === 1) {
    await awardService.awardBadge('racing_champion')
    await awardService.awardPlayerTitle('speed_king', 'Won a race')
  }
  if (league) await awardService.checkTitleUnlocks()
})

export const onPetRaceStarted = safe(async () => {
  await awardService.awardBadge('speed_demon')
})

// ── Minigames ──────────────────────────────────────────────────────────────
export const onDicePlayed = safe(async ({ isDoubles, total }) => {
  await awardService.awardBadge('dice_first_play')
  if (isDoubles) await awardService.awardBadge('lucky_doubles')
  if (total === 2) await awardService.awardBadge('snake_eyes')
  if (total === 12) await awardService.awardBadge('boxcars')
})

export const onGuessPlayed = safe(async ({ attempts }) => {
  await awardService.awardBadge('guess_first_play')
  if (attempts === 1) await awardService.awardBadge('first_try')
  if (attempts <= 2) await awardService.awardBadge('mind_reader')
})

export const onMemoryPlayed = safe(async ({ perfect, seconds }) => {
  await awardService.awardBadge('memory_first_play')
  if (perfect) await awardService.awardBadge('perfect_memory')
  if (seconds && seconds <= 30) await awardService.awardBadge('speed_matcher')
})

// ── Misc ───────────────────────────────────────────────────────────────────
export const onRecipeBookFound = safe(() => awardService.awardBadge('recipe_book_found'))
export const onGuildDonation = safe(() => awardService.awardBadge('generous_soul'))
export const onSecretDungeonFound = safe(key => awardService.awardBadge('secret_dungeon_' + key))

// NOTE: there is deliberately no `onPPEarned` hook. The PP-threshold titles
// (point_hoarder / whale / millionaire) would need one on every awardPoints
// call, and checkTitleUnlocks costs three queries — far too much for something
// that fires dozens of times a session. They resolve on the next login instead,
// via onLogin, and after any battle, adoption or friend accept.
