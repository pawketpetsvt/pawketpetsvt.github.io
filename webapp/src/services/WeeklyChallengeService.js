import { reactive } from 'vue'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { taskTracker } from './TaskTrackerService.js'
import { toastService } from './ToastService.js'
import {
  WEEKLY_CHALLENGE_POOL, WEEKLY_PICK_COUNT, WEEKLY_ALL_COMPLETE_PP
} from '../data/weeklyChallengeData.js'

// Ports the weekly challenges (game.js:12413-12560). Five of the twelve are
// drawn per week by a week-seeded shuffle, so every player gets the same five
// and they hold for the whole week.
//
// Progress is per-stat, and the stats are NOT TaskTracker's vocabulary —
// `wk_battles_won`, `wk_fish_caught` and so on. The mapping from task events to
// those stats lives in TASK_TO_STAT below, which is the whole reason this can
// subscribe to the bus rather than needing its own call sites.
export const weeklyState = reactive({
  challenges: [],
  progress: {},
  claimed: {},
  loaded: false
})

// Ports weeklyChallenge_getWeekKey(). Not a true ISO week — it is legacy's own
// day-of-year arithmetic, kept so a week boundary lands where players expect.
export function weekKey() {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
  return now.getFullYear() + '_w' + weekNum
}

// Ports weeklyChallenge_getThisWeeks(). Deterministic: the same week always
// yields the same five, for everyone.
export function thisWeeksChallenges() {
  const key = weekKey()
  let seed = key.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const pool = WEEKLY_CHALLENGE_POOL.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(seed) % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, WEEKLY_PICK_COUNT)
}

// All twelve challenge stats are reachable as of Phase 9.5. The last six were
// dead because legacy announces them through `weeklyChallenge_increment()`
// rather than `updateBingoProgress()`, so they were never in the Bingo
// vocabulary this bus was seeded from — see the note in TaskTrackerService.
const TASK_TO_STAT = {
  win_battle: 'wk_battles_won',
  complete_expedition: 'wk_expeditions',
  feed_pet: 'wk_feeds',
  earn_points: 'wk_pp_earned',
  complete_minigame: 'wk_minigames',
  login: 'wk_logins',
  use_skill: 'wk_skills_used',
  use_battle_item: 'wk_battle_items',
  boss_fight: 'wk_boss_fights',
  flawless_win: 'wk_untouchable',
  catch_fish: 'wk_fish_caught',
  catch_rare_fish: 'wk_fish_rare'
}

const storeKey = stat => 'wkc_' + AppState.user.id + '_' + weekKey() + '_' + stat
const claimedStoreKey = () => 'wkc_' + AppState.user.id + '_' + weekKey() + '_claimed'

class WeeklyChallengeService {
  load() {
    if (!AppState.user) return
    weeklyState.challenges = thisWeeksChallenges()
    weeklyState.progress = {}
    for (const ch of weeklyState.challenges) {
      weeklyState.progress[ch.stat] = this.progressFor(ch.stat)
    }
    try {
      weeklyState.claimed = JSON.parse(localStorage.getItem(claimedStoreKey()) || '{}')
    } catch {
      weeklyState.claimed = {}
    }
    weeklyState.loaded = true
  }

  progressFor(stat) {
    if (!AppState.user) return 0
    try { return parseInt(localStorage.getItem(storeKey(stat)) || '0', 10) } catch { return 0 }
  }

  async increment(stat, amount = 1) {
    if (!AppState.user || !stat) return
    if (!weeklyState.loaded) this.load()

    const next = this.progressFor(stat) + amount
    try { localStorage.setItem(storeKey(stat), String(next)) } catch { /* private mode */ }
    weeklyState.progress[stat] = next
    await this.checkCompletions(stat, next)
  }

  async checkCompletions(stat, value) {
    const claimed = weeklyState.claimed
    for (const ch of weeklyState.challenges) {
      if (ch.stat !== stat || value < ch.target || claimed[ch.id]) continue

      claimed[ch.id] = true
      try { localStorage.setItem(claimedStoreKey(), JSON.stringify(claimed)) } catch { /* private mode */ }

      await playerService.awardPoints(ch.reward, 'weekly_challenge_' + ch.id)
      toastService.success(`${ch.emoji} Weekly challenge complete: ${ch.label}! +${ch.reward} PP`)

      if (Object.keys(claimed).length >= WEEKLY_PICK_COUNT) {
        await playerService.awardPoints(WEEKLY_ALL_COMPLETE_PP, 'weekly_all_complete')
        toastService.success(`🏆 All weekly challenges complete! +${WEEKLY_ALL_COMPLETE_PP} bonus PP!`)

        // LEGACY BUG, deliberately NOT reproduced: completing all five weekly
        // challenges also called awardBadge('battle_100_wins') — the "win 100
        // battles" badge. That grants an achievement the player has not earned,
        // and awardBadge notifies their friends about it, so the claim goes
        // public. Almost certainly a copy-paste. No badge is granted here; if a
        // weekly-challenge badge is wanted, it needs its own key in `badges`.
      }
    }
  }

  // Registered once from main.js.
  subscribe() {
    return taskTracker.subscribe((taskType, amount) => {
      const stat = TASK_TO_STAT[taskType]
      if (!stat) return
      this.increment(stat, amount).catch(e => console.error('[weekly] increment failed:', e))
    })
  }
}

export const weeklyChallengeService = new WeeklyChallengeService()
