import { reactive } from 'vue'
import { STREAMER_LANDING_MEMBERS } from '../data/streamerLandingData.js'

// Ports streamerLanding_init() (game.js:3939) — the branded front door a
// streamer links their viewers to: `pawketpets.net/?streamer=embertail`.
//
// This was live on the deployed site (called from the app-boot block at
// main:2032) and was dropped when Phase 1/6.75 deleted that block; nothing in
// the Vue app has handled `?streamer=` since. Restored here.
//
// Read at module load, before the router, because the query string is consumed
// and stripped — the same reason TwitchService reads its OAuth fragment early.

export const streamerLandingState = reactive({
  member: null
})

// Legacy's own map: a few pet image filenames don't match the pet name.
const PET_IMAGE_FILE = {
  Ember: 'ember.png', Pyxie: 'pyxie.png', Aria: 'aria.png',
  Blushimia: 'blushimia.png', Steve: 'cowbee.png', Kleat: 'kelta.png',
  Jess: 'jess.png', Gnarly: 'gnarly.png', Cypurr: 'cy.png'
}

export function petImageFor(member) {
  return '/images/pets/' +
    (PET_IMAGE_FILE[member.petName] || member.petName.toLowerCase() + '.png')
}

function detect() {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  const raw = (params.get('streamer') || '').toLowerCase().trim()
  if (!raw) return

  const member = STREAMER_LANDING_MEMBERS.find(m =>
    m.login.toLowerCase() === raw ||
    m.name.toLowerCase() === raw ||
    m.petName.toLowerCase() === raw
  )
  if (!member) return

  streamerLandingState.member = member

  // Remembered so the Adopt page can pre-select the streamer's own pet — the
  // whole point of arriving through their link. Cleared once a pet is adopted.
  try {
    localStorage.setItem('suggestedFirstPet', member.petName)
  } catch { /* private mode */ }

  // Accent drives the streamer-themed borders the legacy stylesheet expects.
  document.body.style.setProperty('--streamer-accent', member.accentColor || '#9966ff')
  document.body.classList.add('streamer-landing-active')
}

detect()

class StreamerLandingService {
  get member() { return streamerLandingState.member }

  // The pet this visitor should land on in the Adopt grid, if any.
  suggestedFirstPet() {
    try { return localStorage.getItem('suggestedFirstPet') } catch { return null }
  }

  clearSuggestion() {
    try { localStorage.removeItem('suggestedFirstPet') } catch { /* private mode */ }
  }
}

export const streamerLandingService = new StreamerLandingService()
