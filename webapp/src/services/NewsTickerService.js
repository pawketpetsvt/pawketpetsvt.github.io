import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { settingsState } from './SettingsService.js'
import {
  TICKER_MESSAGES,
  SPOOKY_MESSAGES,
  SPOOKY_TICKER_CHANCE,
  DYNAMIC_HEADLINE_CHANCE,
  EVENT_ANNOUNCEMENTS
} from '../data/newsTickerData.js'

// Ports the newsTicker object, game.js:13212-13457.
//
// The legacy version drove rotation by cloning the DOM node to restart its CSS
// animation and re-attaching an `animationend` listener to the clone. The Vue
// port keeps the same event-driven cadence (advance when the scroll finishes,
// no timer) but lets the component restart the animation with a `:key` bump —
// the same approach LeftSidebar's activity feed uses.
export const tickerState = reactive({
  message: '',
  eventAnnouncement: '',
  isSpooky: false,
  isDynamic: false,
  tick: 0
})

class NewsTickerService {
  constructor() {
    // Own copy so shuffling never mutates the imported module data.
    this.messages = [...TICKER_MESSAGES]
    this.usedIndices = []
    this.dailyStats = null
    this.dailyStatsDate = null

    // Set once the World Events system is migrated; until then no event
    // announcement is ever prepended. See newsTickerData.js.
    this.currentEventId = null
  }

  // Fisher-Yates, ported from newsTicker.shuffle().
  shuffle() {
    for (let i = this.messages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = this.messages[i]
      this.messages[i] = this.messages[j]
      this.messages[j] = tmp
    }
    this.usedIndices = []
  }

  // Draws without repeats until the pool is exhausted, then reshuffles.
  getRandomUnusedIndex() {
    if (this.usedIndices.length >= this.messages.length) this.shuffle()

    const available = []
    for (let i = 0; i < this.messages.length; i++) {
      if (this.usedIndices.indexOf(i) === -1) available.push(i)
    }
    const idx = available[Math.floor(Math.random() * available.length)]
    this.usedIndices.push(idx)
    return idx
  }

  // Ports loadDailyStats(). Cached per calendar day; failures degrade to no
  // dynamic headlines rather than surfacing an error in the chrome.
  async loadDailyStats() {
    const today = new Date().toISOString().slice(0, 10)
    if (this.dailyStats && this.dailyStatsDate === today) return this.dailyStats
    try {
      const { data, error } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('stat_date', today)
        .maybeSingle()
      if (error) throw error
      this.dailyStats = data || {}
      this.dailyStatsDate = today
    } catch (e) {
      console.error('[newsTickerService.loadDailyStats]', e)
      this.dailyStats = {}
      this.dailyStatsDate = today
    }
    return this.dailyStats
  }

  // Ports getDynamicHeadline() — real community numbers from today's row.
  getDynamicHeadline(s) {
    if (!s) return null
    const headlines = []
    if (s.battles_won > 0) {
      headlines.push(`Community update: ${s.battles_won} battles fought across PawketPets today. The monsters are getting nervous.`)
    }
    if (s.bosses_killed > 0) {
      headlines.push(`BREAKING: The community has defeated ${s.bosses_killed} boss${s.bosses_killed !== 1 ? 'es' : ''} today. Impressive.`)
    }
    if (s.pets_adopted > 0) {
      headlines.push(`Heartwarming: ${s.pets_adopted} new pet${s.pets_adopted !== 1 ? 's' : ''} adopted today. The team grows.`)
    }
    if (s.expeditions_completed > 0) {
      headlines.push(`Exploration report: ${s.expeditions_completed} expeditions completed today. Whatever they found out there, nobody is saying.`)
    }
    if (!headlines.length) return null
    return headlines[Math.floor(Math.random() * headlines.length)]
  }

  // Ports updateTicker()'s message-composition half; the DOM/animation half
  // lives in NewsTicker.vue.
  next() {
    let message = this.messages[this.getRandomUnusedIndex()]
    let isSpooky = false
    let isDynamic = false

    if (settingsState.spooky_enabled && Math.random() < SPOOKY_TICKER_CHANCE) {
      message = SPOOKY_MESSAGES[Math.floor(Math.random() * SPOOKY_MESSAGES.length)]
      isSpooky = true
    } else if (Math.random() < DYNAMIC_HEADLINE_CHANCE && this.dailyStats) {
      const dynamic = this.getDynamicHeadline(this.dailyStats)
      if (dynamic) {
        message = dynamic
        isDynamic = true
      }
    }

    tickerState.message = message
    tickerState.isSpooky = isSpooky
    tickerState.isDynamic = isDynamic
    // A spooky line replaces the whole headline, announcement included.
    tickerState.eventAnnouncement = isSpooky ? '' : this.getEventAnnouncement()
    tickerState.tick++
  }

  getEventAnnouncement() {
    if (!this.currentEventId) return ''
    return EVENT_ANNOUNCEMENTS[this.currentEventId] || ''
  }

  // Ports init(). The stats fetch is intentionally not awaited — the first
  // headline shows immediately and dynamic ones become eligible once it lands.
  start() {
    this.shuffle()
    this.next()
    this.loadDailyStats()
  }
}

export const newsTickerService = new NewsTickerService()
