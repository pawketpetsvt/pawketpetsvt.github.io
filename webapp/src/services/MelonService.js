import { reactive } from 'vue'
import { AppState } from '../AppState.js'
import { notificationService } from './NotificationService.js'
import { worldStateService } from './WorldStateService.js'

export const melonState = reactive({
  visible: false,
  title: '',
  text: '',
  spooky: false
})

const queue = []
let active = false
let dismissTimer = null

function dismiss() {
  melonState.visible = false
  setTimeout(() => {
    active = false
    if (queue.length > 0) {
      const next = queue.shift()
      setTimeout(() => show(next.title, next.text, next.opts), 800)
    }
  }, 600)
}

function show(title, text, opts = {}) {
  if (active) {
    queue.push({ title, text, opts })
    return
  }
  active = true
  melonState.title = title
  melonState.text = text
  melonState.spooky = opts.spooky || false
  setTimeout(() => { melonState.visible = true }, 50)
  clearTimeout(dismissTimer)
  dismissTimer = setTimeout(dismiss, opts.displayMs || 12000)
}

const MILESTONES = [
  {
    key: 'day3',
    check: () => AppState.sidebarStats.streak >= 3,
    title: 'Melon says hi! 🍉',
    message: "Hey! You've been around for a few days now. That makes you one of our more dedicated testers. I hope the pets are treating you well. ...They are, right?"
  },
  {
    key: 'day7',
    check: () => AppState.sidebarStats.streak >= 7,
    title: 'Melon checks in 🍉',
    message: "One week! Have you noticed the news ticker yet? Sometimes it says... unusual things. I'm sure it's nothing. Probably just a display bug. Anyway, keep feeding your pets!"
  },
  // The three below were deferred at Phase 1 because Battle and World State
  // weren't migrated. Both are now, so they evaluate for real.
  {
    key: 'first_boss',
    // Legacy reads a `player_local_stats` localStorage blob that only it ever
    // wrote; `players.bosses_killed` is the real, server-side counter and is
    // what the Stats page already reads.
    check: () => (AppState.player && AppState.player.bosses_killed || 0) >= 1,
    title: 'Melon has a question 🍉',
    message: "...That wasn't supposed to happen. The boss, I mean. I didn't think anyone would actually get that far this quickly. Are you doing okay? The pets seem unsettled."
  },
  {
    key: 'corruption_50',
    check: () => worldStateService.corruptionSync() >= 50,
    title: 'Melon sounds different 🍉',
    message: "The world integrity is getting lower. I notice things like that. I notice a lot of things. Don't tell anyone I said this, but... you might want to keep your pets close tonight.",
    spooky: true
  },
  {
    key: 'level10',
    check: () => (AppState.ownedPets || []).some(p => (p.level || 0) >= 10),
    title: 'Melon is impressed 🍉',
    message: "Level 10! That's real dedication. I've seen a lot of testers come through here. Not many make it this far. ...Well. Most of them don't. But you're doing great!"
  }
]

class MelonService {
  showMessage(title, text, opts) {
    show(title, text, opts)
  }

  dismissNow() {
    melonState.visible = false
  }

  // Ports checkMelonMilestones() (game.js:2462-2536) — now all five, since
  // Battle and World State have both migrated.
  //
  // The `spooky` flag rides through to the popup, so the corruption milestone
  // reads differently from the friendly ones.
  checkMilestones() {
    if (!AppState.user) return
    // The corruption check is a cache-only read, so warm it first — otherwise
    // that milestone could never fire on a fresh session.
    worldStateService.loadFlags().catch(() => {})
    const sent = JSON.parse(localStorage.getItem('melon_milestones') || '{}')
    MILESTONES.forEach(m => {
      if (sent[m.key]) return
      if (m.check()) {
        sent[m.key] = Date.now()
        localStorage.setItem('melon_milestones', JSON.stringify(sent))
        setTimeout(() => {
          show(m.title, m.message, { displayMs: 12000, spooky: m.spooky })
          notificationService.create(AppState.user.id, 'melon_message', m.title, m.message, 'tab:shop')
        }, 4000)
      }
    })
  }
}

export const melonService = new MelonService()
