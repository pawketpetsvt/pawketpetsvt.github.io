import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'

// Ports calendar_init()/calendar_loadRewards() (game.js:38329-38350) — the
// 30-day login reward track behind the Home page's streak widget.
//
// The streak itself is NOT stored here. Legacy kept a `loginCalendar
// .currentStreak` copy that had to be assigned from two separate places to stay
// correct (its own source carries a comment about that having been a bug). The
// streak already lives in AppState, so this reads it there and cannot drift.
export const calendarState = reactive({
  rewards: [],
  loaded: false
})

class LoginCalendarService {
  async load() {
    if (calendarState.loaded) return calendarState.rewards
    const res = await supabase.from('login_calendar_rewards').select('*').order('day')
    if (res.error) {
      console.error('[loginCalendarService.load]', res.error)
      calendarState.rewards = []
    } else {
      calendarState.rewards = res.data || []
    }
    calendarState.loaded = true
    return calendarState.rewards
  }

  streak() {
    return (AppState.player && AppState.player.login_streak) || AppState.sidebarStats.streak || 0
  }

  rewardForDay(day) {
    return calendarState.rewards.find(r => r.day === day) || null
  }

  // The reward you get for showing up tomorrow, capped at the 30-day track.
  nextReward() {
    return this.rewardForDay(Math.min(this.streak() + 1, 30))
  }
}

export const loginCalendarService = new LoginCalendarService()
