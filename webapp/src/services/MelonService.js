import { reactive } from 'vue'
import { AppState } from '../AppState.js'
import { notificationService } from './NotificationService.js'

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
  }
]

class MelonService {
  showMessage(title, text, opts) {
    show(title, text, opts)
  }

  dismissNow() {
    melonState.visible = false
  }

  // Ports checkMelonMilestones(), game.js:2462-2536, trimmed to the two
  // milestones this phase can evaluate (streak-based). The boss-kill/
  // corruption-level/pet-level milestones depend on Battle/World-State
  // systems not yet migrated — deferred to their own phases.
  checkMilestones() {
    if (!AppState.user) return
    const sent = JSON.parse(localStorage.getItem('melon_milestones') || '{}')
    MILESTONES.forEach(m => {
      if (sent[m.key]) return
      if (m.check()) {
        sent[m.key] = Date.now()
        localStorage.setItem('melon_milestones', JSON.stringify(sent))
        setTimeout(() => {
          show(m.title, m.message, { displayMs: 12000 })
          notificationService.create(AppState.user.id, 'melon_message', m.title, m.message, 'tab:shop')
        }, 4000)
      }
    })
  }
}

export const melonService = new MelonService()
