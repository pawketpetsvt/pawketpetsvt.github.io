import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { inventoryService } from './InventoryService.js'
import { awardService } from './AwardService.js'
import { toastService } from './ToastService.js'
import { taskTracker } from './TaskTrackerService.js'
import {
  COMMUNITY_GOAL_NARRATIVES, COMMUNITY_GENERIC_NARRATIVE, COMMUNITY_MILESTONE_TIERS
} from '../data/communityGoalData.js'

// Ports the community goals system (community_*, game.js:36290-36660) — shared
// targets the whole player base pushes toward together, each telling a story as
// it fills.
//
// Progress is batched: contributions accumulate locally and flush through
// `increment_goal_progress` rather than one round trip per action.
export const communityState = reactive({
  goals: [],
  claimedIds: [],
  loaded: false
})

const CACHE_MS = 300000       // legacy re-reads every 5 minutes
const FLUSH_MS = 60000
const FLUSH_AT = 10           // …or once 10 contributions have piled up

// Which bus events feed which goal metric. Legacy calls community_increment()
// from each site directly; subscribing keeps this system from having to be
// wired into a dozen services.
const TASK_TO_METRIC = {
  feed_pet: 'feed_pets',
  complete_expedition: 'expeditions',
  win_battle: 'battle_wins',
  complete_race: 'races',
  train_pet_racing: 'races_trained'
}

class CommunityGoalService {
  constructor() {
    this.pending = {}
    this.fetchedAt = 0
    this.timer = null
  }

  async loadGoals(force = false) {
    if (!force && communityState.loaded && Date.now() - this.fetchedAt < CACHE_MS) {
      return communityState.goals
    }
    const nowIso = new Date().toISOString()
    try {
      const res = await supabase
        .from('community_goals')
        .select('*')
        .eq('is_active', true)
        .eq('is_completed', false)
        .lte('started_at', nowIso)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      if (res.error) throw res.error
      communityState.goals = res.data || []
      this.fetchedAt = Date.now()
      communityState.loaded = true
      await this.loadClaims()
      for (const g of communityState.goals) this.checkMilestone(g)
    } catch (e) {
      console.error('[community] goal load failed:', e)
    }
    return communityState.goals
  }

  async loadClaims() {
    if (!AppState.user) {
      communityState.claimedIds = []
      return
    }
    const res = await supabase
      .from('community_goal_claims').select('goal_id').eq('user_id', AppState.user.id)
    communityState.claimedIds = res.error ? [] : (res.data || []).map(c => c.goal_id)
  }

  // Ports community_increment(). The optimistic local bump is applied to the
  // reactive goal so the bar moves immediately, exactly as legacy's direct DOM
  // write did.
  increment(metricKey, amount = 1) {
    if (!metricKey) return
    this.pending[metricKey] = (this.pending[metricKey] || 0) + amount

    const goal = communityState.goals.find(g => g.metric_key === metricKey)
    if (goal) {
      goal.current_progress = (goal.current_progress || 0) + amount
      this.checkMilestone(goal)
    }

    if (!this.timer) this.timer = setInterval(() => this.flush(), FLUSH_MS)
    const total = Object.values(this.pending).reduce((s, n) => s + n, 0)
    if (total >= FLUSH_AT) this.flush()
  }

  async flush() {
    const keys = Object.keys(this.pending)
    if (!keys.length) return
    const batch = { ...this.pending }
    this.pending = {}

    for (const metricKey of Object.keys(batch)) {
      try {
        const res = await supabase.rpc('increment_goal_progress', {
          p_metric_key: metricKey,
          p_amount: batch[metricKey]
        })
        if (res.error) throw res.error
      } catch (e) {
        console.error('[community] sync failed, will retry:', e)
        this.pending[metricKey] = (this.pending[metricKey] || 0) + batch[metricKey]
      }
    }
    await this.loadGoals(true)
  }

  percent(goal) {
    if (!goal || !goal.goal_target) return 0
    return Math.min(100, ((goal.current_progress || 0) / goal.goal_target) * 100)
  }

  // Ports community_getNarrative(). The highest beat at or below the current
  // percentage wins.
  narrative(goal) {
    const arc = COMMUNITY_GOAL_NARRATIVES[goal.goal_key] || COMMUNITY_GENERIC_NARRATIVE
    const pct = this.percent(goal)
    let beat = arc[0]
    for (const b of arc) if (pct >= b.threshold) beat = b
    return (beat.text || '').split('{title}').join(goal.title || '')
  }

  // Ports community_checkMilestoneCrossed(). One celebration per goal per tier,
  // per browser — legacy's own arrangement, and the reason for the "don't fire a
  // false milestone on a first-ever page load" guard.
  checkMilestone(goal) {
    const pct = this.percent(goal)
    let tier = 0
    for (const t of COMMUNITY_MILESTONE_TIERS) if (pct >= t) tier = t

    const key = 'com_milestone_' + goal.goal_key
    let last = 0
    try { last = parseInt(localStorage.getItem(key), 10) || 0 } catch { return }
    if (tier <= last) return
    try { localStorage.setItem(key, String(tier)) } catch { /* private mode */ }
    if (last === 0 && tier !== 100) return

    const messages = {
      25: `📖 "${goal.title}" has reached 25%! The story is just beginning...`,
      50: `📖 "${goal.title}" is halfway complete! Keep it up!`,
      75: `📖 "${goal.title}" is at 75%! The finish line is in sight!`,
      100: `🎉 "${goal.title}" is complete! Claim your reward!`
    }
    if (messages[tier]) toastService.success(messages[tier])
  }

  isClaimed(goal) {
    return communityState.claimedIds.includes(goal.id)
  }

  isComplete(goal) {
    return (goal.current_progress || 0) >= goal.goal_target
  }

  // Ports community_handleClaim() + community_grantReward().
  //
  // LEGACY BUG — the reward is never actually granted for two of its three
  // types. `grantReward` calls `window.addPawketPoints` for points and
  // `unlockTitle` for a title, and NEITHER FUNCTION EXISTS anywhere in the
  // codebase. Both are behind `typeof` guards, so nothing throws: the points
  // branch falls through to mutating `window.currentUser.pawketPoints` — a field
  // that does not exist on the Supabase auth object, and misspelled against the
  // real `pawketpoints` column — then returns TRUE. The claim row is inserted on
  // that `true`, so the player permanently burns their one claim on the goal and
  // receives nothing. Only the `items` branch works. All three go through the
  // game's real award paths here.
  async claim(goal) {
    if (!AppState.user) throw new Error('Not logged in')
    if (this.isClaimed(goal)) throw new Error('Reward already claimed!')
    if (!this.isComplete(goal)) throw new Error('Goal not completed yet!')

    const granted = await this.grantReward(goal)
    if (!granted) throw new Error('Could not grant that reward — nothing was claimed.')

    const res = await supabase.from('community_goal_claims')
      .insert({ goal_id: goal.id, user_id: AppState.user.id })
    if (res.error) {
      // Unique violation means it was already claimed in another tab; anything
      // else is a real failure worth surfacing.
      if (res.error.code !== '23505') throw new Error(res.error.message)
    }
    communityState.claimedIds.push(goal.id)
    return this.rewardText(goal)
  }

  async grantReward(goal) {
    const type = goal.reward_type
    const value = goal.reward_value
    try {
      if (type === 'points') {
        const amount = parseInt(value, 10)
        if (!(amount > 0)) return false
        const total = await playerService.awardPoints(amount, 'community_goal')
        return total !== null
      }
      if (type === 'items') {
        // `id:qty,id:qty` — legacy's own encoding.
        for (const entry of String(value).split(',')) {
          const [itemId, qty] = entry.split(':')
          if (!itemId) continue
          await inventoryService.grant(AppState.user.id, itemId.trim(), parseInt(qty, 10) || 1)
        }
        return true
      }
      if (type === 'title') {
        const title = await awardService.awardPlayerTitle(String(value).trim(), 'community_goal')
        return !!title
      }
      return false
    } catch (e) {
      console.error('[community] reward grant failed:', e)
      return false
    }
  }

  rewardText(goal) {
    if (goal.reward_type === 'points') return goal.reward_value + ' PawketPoints'
    if (goal.reward_type === 'items') return goal.reward_value
    if (goal.reward_type === 'title') return `Title: "${goal.reward_value}"`
    return goal.reward_value
  }

  // Registered once from main.js, like Bingo and the weekly challenges.
  subscribe() {
    return taskTracker.subscribe((taskType, amount) => {
      const metric = TASK_TO_METRIC[taskType]
      if (metric) this.increment(metric, amount || 1)
    })
  }

  // Ports the beforeunload flush, so a partial batch isn't lost on navigation.
  installUnloadFlush() {
    window.addEventListener('beforeunload', () => {
      if (Object.keys(this.pending).length) this.flush()
    })
  }
}

export const communityGoalService = new CommunityGoalService()
