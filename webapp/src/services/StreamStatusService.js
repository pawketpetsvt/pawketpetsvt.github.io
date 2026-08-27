import { reactive, computed } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'

export const STREAMERS = [
  { id: 'ember', name: 'Embertail', login: 'embertail', image: 'pets/ember.png' },
  { id: 'pyxs', name: 'Pyxshuul', login: 'pyxshuul', image: 'pets/pyxie.png' },
  { id: 'aria', name: 'Aria', login: 'ariadoestwitch', image: 'pets/aria.png' },
  { id: 'blushimia', name: 'Blushimia', login: 'realblushimia', image: 'pets/blushimia.png' },
  { id: 'cowbee', name: 'Cowbee', login: 'cowbeevt', image: 'pets/cowbee.png' },
  { id: 'kelta', name: 'Kelta', login: 'keltathepomeranian', image: 'pets/kelta.png' },
  { id: 'jess', name: 'Jess', login: 'teatimejess', image: 'pets/jess.png' },
  { id: 'gnarly', name: 'Gnarly', login: 'gnarly_neon_smilodon', image: 'pets/gnarly.png' }
]

export const streamStatus = reactive(
  Object.fromEntries(STREAMERS.map(s => [s.id, { live: false, viewers: 0, title: '' }]))
)

// Ports the `_currentlyLiveStreamers` global (game.js:40936) that the live
// banner and any other "who's on right now" consumer read. Derived rather than
// maintained as a second source of truth, so it can't drift from streamStatus.
export const liveStreamers = computed(() =>
  STREAMERS
    .filter(s => streamStatus[s.id].live)
    .map(s => ({
      ...s,
      twitchUrl: 'https://twitch.tv/' + s.login,
      viewers: streamStatus[s.id].viewers,
      title: streamStatus[s.id].title
    }))
)

const TWITCH_CLIENT_ID = 'moqd3war5e7fleif8yte1d8n6kl25u'

class StreamStatusService {
  // Ports checkSidebarStreamStatus(), game.js:7638+. Checking live status
  // requires a linked viewer's Twitch token (twitch_token on `players`), which
  // the Twitch tab now writes (Phase 9 — TwitchService.completeLink). A player
  // who has not linked still leaves every streamer OFFLINE rather than erroring,
  // matching the original's fallback exactly.
  async refresh() {
    if (!AppState.user) return
    try {
      const pr = await supabase.from('players').select('twitch_token').eq('id', AppState.user.id).maybeSingle()
      const token = pr.data && pr.data.twitch_token
      if (!token) return

      const logins = STREAMERS.map(s => 'user_login=' + s.login).join('&')
      const resp = await fetch(`https://api.twitch.tv/helix/streams?${logins}`, {
        headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` }
      })
      const data = await resp.json()
      STREAMERS.forEach(s => {
        streamStatus[s.id].live = false
        streamStatus[s.id].viewers = 0
        streamStatus[s.id].title = ''
      })
      if (data.data) {
        data.data.forEach(stream => {
          const match = STREAMERS.find(s => s.login.toLowerCase() === stream.user_login.toLowerCase())
          if (!match) return
          streamStatus[match.id].live = true
          streamStatus[match.id].viewers = stream.viewer_count || 0
          streamStatus[match.id].title = stream.title || ''
        })
      }
    } catch (err) {
      // Network/CORS hiccups shouldn't break the sidebar
    }
  }
}

export const streamStatusService = new StreamStatusService()
