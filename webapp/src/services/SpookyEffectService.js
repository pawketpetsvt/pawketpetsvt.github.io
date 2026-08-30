import { reactive } from 'vue'
import { settingsState } from './SettingsService.js'
import { musicService, musicState } from './MusicService.js'

// Ports triggerSpookyEffect() — the 3-second corruption that fires when the
// THEYWENTMISSING lore code is redeemed.
//
// IMPORTANT: there are TWO functions by this name in the legacy codebase. One
// sits in game.js (flat black overlay + CRT scanlines + Piper's flute); the
// other is in an inline <script> in index.html. The inline one loads AFTER
// game.js, so it is the one that has actually been running on the live site —
// the same duplicate-definition trap as PET_SKILLS and STATUS_EFFECTS. This
// port follows the INLINE version, which is richer and quite different:
// background music ducks and resumes, a glitch sound plays, a radial vignette
// and animated SVG noise cover the page, the whole body desaturates, an inset
// red glow pulses, and 5-8 random text elements corrupt into block glyphs and
// restore themselves.
export const spookyState = reactive({
  active: false
})

const GLITCH_SRC = '/sounds/glitch.mp3'
const DURATION_MS = 3000
const GLITCH_CHARS = '█▓▒░▄▀■□▪▫◘◙'
const CORRUPT_SELECTOR = 'h1, h2, h3, p, button, .sidebar-title, .nav-tab'

// Corrupts a handful of on-screen text nodes, each restoring itself.
//
// This reaches into the DOM directly, which a Vue app normally shouldn't — but
// the effect IS "the page itself glitches", and there is no component tree to
// express that through. Each element restores from its own saved text, and if
// Vue happens to re-render one mid-corruption it simply repaints the correct
// text, which ends the effect early for that element and breaks nothing.
function corruptText(cleanupFns) {
  const els = Array.from(document.querySelectorAll(CORRUPT_SELECTOR))
    .filter(el => el.textContent.trim().length > 0)
  if (!els.length) return

  const chosen = new Set()
  const count = Math.floor(Math.random() * 4) + 5 // 5-8, as legacy
  for (let i = 0; i < count; i++) {
    const el = els[Math.floor(Math.random() * els.length)]
    if (chosen.has(el)) continue
    chosen.add(el)

    const original = el.textContent
    const delay = Math.random() * 2000
    const startTimer = setTimeout(() => {
      el.textContent = original.split('').map(c =>
        c === ' ' ? c
          : Math.random() > 0.7 ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : c
      ).join('')
      el.classList.add('pp-text-corrupt')

      const endTimer = setTimeout(() => {
        el.textContent = original
        el.classList.remove('pp-text-corrupt')
      }, Math.random() * 500 + 300)
      cleanupFns.push(() => {
        clearTimeout(endTimer)
        el.textContent = original
        el.classList.remove('pp-text-corrupt')
      })
    }, delay)
    cleanupFns.push(() => clearTimeout(startTimer))
  }
}

class SpookyEffectService {
  // Resolves once the effect has fully played, so a caller can hold its own
  // reveal back until the screen is clear — legacy did this with an explicit
  // 3-second await at the call site.
  trigger() {
    if (spookyState.active) return Promise.resolve()
    spookyState.active = true

    const cleanupFns = []

    // Duck the background music and put it back afterwards. Legacy grabbed
    // `#bg-music` by id; MusicService owns that element here.
    const wasPlaying = musicState.playing
    if (wasPlaying) musicService.pause()

    try {
      const glitch = new Audio(GLITCH_SRC)
      glitch.volume = 0.6
      glitch.play().catch(() => {}) // autoplay is routinely blocked
    } catch {
      // No audio is not a reason to skip the visual half.
    }

    document.body.classList.add('pp-spooky-desaturate')
    corruptText(cleanupFns)

    return new Promise(resolve => {
      setTimeout(() => {
        document.body.classList.remove('pp-spooky-desaturate')
        cleanupFns.forEach(fn => { try { fn() } catch { /* already gone */ } })
        spookyState.active = false
        if (wasPlaying) musicService.play()
        resolve()
      }, DURATION_MS)
    })
  }

  // Every spooky surface in the game is gated on the player's own opt-in.
  get enabled() {
    return !!settingsState.spooky_enabled
  }
}

export const spookyEffectService = new SpookyEffectService()
