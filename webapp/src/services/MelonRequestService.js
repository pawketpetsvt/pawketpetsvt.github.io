import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { toastService } from './ToastService.js'
import { melonService } from './MelonService.js'
import { taskTracker } from './TaskTrackerService.js'
import {
  MELON_REQUESTS, MELON_MYSTERY_REQUESTS, MELON_FOOD_LINES, MYSTERY_CHANCE
} from '../data/melonRequestData.js'

// Ports the melonRequests_* family (game.js:32400-32590): three daily errands
// from Melon, each completed by simply doing the thing it asks for.
export const melonRequestState = reactive({
  requests: [],
  completed: {},   // { [requestId]: true }
  ready: false
})

const DAY = () => new Date().toDateString()

class MelonRequestService {
  constructor() {
    this.foodItems = []
    this.day = null
    this.unsubscribe = null
  }

  // Food requests name a real item, so the pool comes from the DB rather than a
  // hardcoded list that could drift out of sync with the shop.
  async loadFoodItems() {
    if (this.foodItems.length) return
    const res = await supabase.from('items')
      .select('id,name,hunger_effect')
      .gt('hunger_effect', 0)
      .order('hunger_effect', { ascending: false })
      .limit(20)
    this.foodItems = res.data || []
  }

  // Legacy draws from the top 12 by hunger_effect, not all 20.
  buildFoodRequest() {
    if (!this.foodItems.length) return null
    const food = this.foodItems[Math.floor(Math.random() * Math.min(this.foodItems.length, 12))]
    const line = MELON_FOOD_LINES[Math.floor(Math.random() * MELON_FOOD_LINES.length)]
    return {
      id: 'feed_' + food.id,
      icon: '🍽️',
      reward: 20 + Math.floor(food.hunger_effect / 2),
      trackKey: 'feed_pet',
      trackItemId: food.id,
      text: line(food.name)
    }
  }

  // Today's set: one food request, two fixed ones, and a 15% chance the last is
  // swapped for a mystery. Capped at three, as legacy caps it.
  async load() {
    if (!AppState.user) return
    const today = DAY()
    if (this.day === today && melonRequestState.ready) return
    this.day = today

    await this.loadFoodItems()

    const requests = []
    const food = this.buildFoodRequest()
    if (food) requests.push(food)

    const shuffled = MELON_REQUESTS.slice().sort(() => Math.random() - 0.5)
    requests.push(...shuffled.slice(0, 2))

    if (Math.random() < MYSTERY_CHANCE) {
      requests[requests.length - 1] =
        MELON_MYSTERY_REQUESTS[Math.floor(Math.random() * MELON_MYSTERY_REQUESTS.length)]
    }

    melonRequestState.requests = requests.slice(0, 3)
    await this.refreshCompleted()
    melonRequestState.ready = true

    if (!this.unsubscribe) {
      this.unsubscribe = taskTracker.subscribe((type, amount, detail) => this.onTask(type, detail))
    }
  }

  // Which of today's requests are already claimed, asked of the server rather
  // than assumed — see the claim note on complete().
  async refreshCompleted() {
    const done = {}
    await Promise.all(melonRequestState.requests.map(async (req) => {
      const { data, error } = await supabase.rpc('has_claimed_daily', { p_game_key: this.claimKey(req) })
      if (!error && data) done[req.id] = true
    }))
    melonRequestState.completed = done
  }

  claimKey(req) {
    return 'melon_request_' + req.id
  }

  // Fired by the task bus whenever the player does anything trackable.
  onTask(taskType, detail) {
    for (const req of melonRequestState.requests) {
      if (melonRequestState.completed[req.id]) continue
      if (req.trackKey !== taskType) continue
      // A food request names a specific item, so a different food doesn't count.
      if (req.trackItemId && detail && detail.itemId && req.trackItemId !== detail.itemId) continue
      this.complete(req)
    }
  }

  // Claimed through Phase 4's claim_daily_secure, which checks and awards in one
  // transaction.
  //
  // Legacy tracked completion in localStorage (`melon_requests_<date>_<uid>`)
  // and then called awardPP separately, so clearing site data let every request
  // be re-completed for real PP — the same replay hole Phase 4 closed for the
  // minigames. That RPC takes an arbitrary claim key, so this needs no new SQL.
  async complete(req) {
    if (melonRequestState.completed[req.id]) return
    // Mark locally first so a burst of matching events can't double-fire while
    // the RPC is in flight; the server is still the authority on the award.
    melonRequestState.completed = { ...melonRequestState.completed, [req.id]: true }

    const { data, error } = await supabase.rpc('claim_daily_secure', {
      p_game_key: this.claimKey(req),
      p_amount: req.reward,
      p_reason: 'melon_request'
    })
    if (error || data === null || data === undefined) {
      // Already claimed today, or the claim failed — either way it stays ticked.
      if (error) console.error('[melonRequestService.complete]', error.message)
      return
    }

    if (AppState.player) AppState.player.pawketpoints = data
    toastService.success(`🍉 Melon's Request complete! +${req.reward} PP`)
    melonService.showMessage(
      'Melon says thanks 🍉',
      `Thank you! That really helps. Here's ${req.reward} PP.`,
      { displayMs: 6000 }
    )
  }

  allDone() {
    return melonRequestState.requests.length > 0 &&
      melonRequestState.requests.every(r => melonRequestState.completed[r.id])
  }
}

export const melonRequestService = new MelonRequestService()
