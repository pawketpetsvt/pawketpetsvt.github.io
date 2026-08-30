// A small event bus for "the player just did X".
//
// Legacy has no such thing: every one of these events is announced by calling
// `updateBingoProgress(taskType, n)` directly, and the systems that also care —
// Melon's Requests (`melonRequests_checkProgress`), Weekly Challenges, the
// PawketPass — hook themselves in by monkey-patching that one function or by
// being called from inside it. That is why the Bingo system ends up owning
// progress reporting for features it has nothing to do with.
//
// Here the announcement and the listeners are separate. Whoever performs the
// action calls `taskTracker.report(...)`; whoever cares subscribes. Melon's
// Requests is the first subscriber; Bingo, Weekly Challenges and the Pass join
// it when they migrate, without anything having to be re-plumbed.
//
// The vocabulary below starts from exactly the set legacy reports, taken from
// every `updateBingoProgress('…')` call site, so no listener has to translate.
export const TASK_TYPES = [
  'adopt_pet', 'feed_pet', 'play_pet', 'use_toy', 'use_treat', 'level_up_pet',
  'pet_companion', 'visit_shop', 'earn_points', 'cook_meal', 'complete_minigame',
  'win_battle', 'complete_expedition', 'find_recipe_book', 'find_secret_dungeon',
  'complete_quest', 'vote_poll', 'send_gift', 'login',
  // Racing emits all six of these as of Phase 8c (RacingService,
  // GrandPrixService, PetRaceService).
  'train_pet_racing', 'complete_race', 'race_podium', 'enter_grand_prix',
  'train_grand_prix', 'grand_prix_top_10', 'grand_prix_winner',
  // Guild — all three live as of Phase 9.
  'donate_guild', 'vote_in_guild', 'guild_dungeon',

  // ── Beyond legacy's Bingo vocabulary ────────────────────────────────────
  // Legacy announces these six by calling `weeklyChallenge_increment()`
  // directly rather than going through `updateBingoProgress()`, so they were
  // never part of the Bingo task set and did not come across with it. Without
  // them SIX of the twelve weekly challenges can never complete — and five are
  // drawn each week, so roughly half a given board would be unwinnable. Same
  // shape as the six dead Bingo squares found in increment 3; that sweep
  // checked Bingo's board and not this one.
  //
  // No Bingo square uses them, which is fine — the bus is a vocabulary, not a
  // contract that every listener cares about every word.
  'use_skill', 'use_battle_item', 'boss_fight', 'flawless_win',
  'catch_fish', 'catch_rare_fish'
]

class TaskTrackerService {
  constructor() {
    this.listeners = new Set()
  }

  // Returns an unsubscribe function, so a component can clean up on unmount.
  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  // `detail` carries whatever a listener might need to match on — an item id
  // for `feed_pet`, for instance, since a Melon request can name a food.
  report(taskType, amount = 1, detail = null) {
    for (const fn of this.listeners) {
      try {
        fn(taskType, amount, detail)
      } catch (e) {
        // One bad listener must not stop the others, or block the action that
        // triggered it — reporting progress is never the point of the click.
        console.error('[taskTracker] listener failed for ' + taskType + ':', e)
      }
    }
  }
}

export const taskTracker = new TaskTrackerService()
