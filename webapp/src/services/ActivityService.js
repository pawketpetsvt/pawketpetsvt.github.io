import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'

// Ports logActivity() (main:21978). Writes the `activity_feed` rows that
// EXTERNAL consumers subscribe to — the Discord announcement bot and the OBS
// ticker in obs.html both listen for `postgres_changes` INSERT on this table.
//
// THE POINT OF THIS SERVICE IS THE USERNAME INJECTION, and it is not optional.
// A Realtime subscriber receives the raw inserted row: there is no join, so it
// cannot resolve `user_id` into a name. Legacy therefore folds the username
// INTO `activity_data`, and obs.html reads it back as `data.username ||
// 'Someone'` (obs.html:258). The Vue app was inserting activity_feed rows
// without it, which is why every announcement from the new site read
// "Someone just earned the … badge!" instead of the player's name.
//
// `activity_data` is passed as an OBJECT, not a JSON string. obs.html does
// `var data = row.activity_data || {}` with no parse step, so an object is what
// the consumers expect. (Legacy JSON.stringify'd it, which is the likelier
// explanation for the stray "Someone" lines in the live feed than any race on
// its username cache.)
class ActivityService {
  constructor() {
    // Mirrors legacy's `currentUsername` cache so a burst of activity in one
    // battle doesn't fire a `players` lookup per row.
    this._username = null
  }

  async username() {
    if (this._username) return this._username
    const fromState = AppState.player && AppState.player.username
    if (fromState) {
      this._username = fromState
      return this._username
    }
    // Legacy's fallback: the cache is populated asynchronously after login, so
    // an early activity can land before it is ready.
    try {
      const { data } = await supabase
        .from('players').select('username').eq('id', AppState.user.id).single()
      if (data && data.username) this._username = data.username
    } catch { /* fall through to 'Someone' */ }
    return this._username
  }

  // Called on logout so the next player doesn't inherit this one's name.
  reset() {
    this._username = null
  }

  async log(activityType, activityData) {
    if (!AppState.user) return
    try {
      const username = (await this.username()) || 'Someone'
      await supabase.from('activity_feed').insert([{
        user_id: AppState.user.id,
        activity_type: activityType || 'unknown',
        activity_data: Object.assign({ username }, activityData || {}),
        is_public: true
      }])
    } catch (e) {
      // Legacy swallows this too — a failed announcement must never break the
      // action that triggered it.
      console.log('[activity] log failed (non-critical):', e)
    }
  }
}

export const activityService = new ActivityService()
