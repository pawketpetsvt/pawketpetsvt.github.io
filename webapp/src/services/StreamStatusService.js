import { reactive, computed } from 'vue'
import { WORKER_URL } from '../data/twitchData.js'

export const STREAMERS = [
  { id: 'ember', name: 'Embertail', login: 'embertail', image: 'pets/ember.png' },
  { id: 'pyxs', name: 'Pyxshuul', login: 'pyxshuul', image: 'pets/pyxie.png' },
  { id: 'aria', name: 'Aria', login: 'ariadoestwitch', image: 'pets/aria.png' },
  { id: 'blushimia', name: 'Blushimia', login: 'realblushimia', image: 'pets/blushimia.png' },
  { id: 'cowbee', name: 'Cowbee', login: 'cowbeevt', image: 'pets/cowbee.png' },
  { id: 'kelta', name: 'Kelta', login: 'keltathepomeranian', image: 'pets/kelta.png' },
  { id: 'gnarly', name: 'Gnarly', login: 'gnarly_neon_smilodon', image: 'pets/gnarly.png' },
  { id: 'cy', name: 'CypurrActive', login: 'cypurractive', image: 'pets/cy.png' }
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

class StreamStatusService {
  // Ports checkSidebarStreamStatus(), game.js:7638+. Asks the worker
  // (/api/live), which checks Twitch with the app's own token.
  //
  // Legacy asked Twitch directly with the PLAYER's token, so anyone who hadn't
  // linked Twitch saw every streamer as offline, and so did a Log In With Twitch
  // player once their ~4-hour token expired. A failed check still leaves
  // everyone OFFLINE rather than erroring, as the original's fallback did.
  async refresh() {
    try {
      const logins = STREAMERS.map(s => s.login).join(',')
      const resp = await fetch(`${WORKER_URL}/api/live?logins=${logins}`)
      if (!resp.ok) return
      const data = await resp.json()
      STREAMERS.forEach(s => {
        streamStatus[s.id].live = false
        streamStatus[s.id].viewers = 0
        streamStatus[s.id].title = ''
      })
      ;(data.live || []).forEach(stream => {
        const match = STREAMERS.find(s => s.login.toLowerCase() === stream.login.toLowerCase())
        if (!match) return
        streamStatus[match.id].live = true
        streamStatus[match.id].viewers = stream.viewers || 0
        streamStatus[match.id].title = stream.title || ''
      })
    } catch (err) {
      // Network/CORS hiccups shouldn't break the sidebar
    }
  }
}

export const streamStatusService = new StreamStatusService()
