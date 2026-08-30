import { reactive } from 'vue'
import { settingsState } from './SettingsService.js'

// Ports the ambient "666 PP" money glitch (maybeGlitchPointsDisplay,
// game.js:1078-1110) — a ~1.5% chance on any PP change that every points
// display flashes to 666 with a wobble for 3.5-6 seconds before snapping back.
//
// Another piece of the spooky/ARG layer that never made it across: nothing in
// the Vue app has ever glitched a PP counter. Small, but it is one of the few
// ambient scares a player runs into during ordinary play.
//
// Legacy drove this by reaching into seven elements by id and rewriting their
// textContent, then calling updateAllPoints() to put the real number back —
// which is why it needed the value passed in and a re-entry flag. Here the
// glitch is a flag the displays read, so nothing has to restore anything.
export const ppGlitchState = reactive({
  active: false
})

const CHANCE = 0.015
const MIN_MS = 3500
const EXTRA_MS = 2500

let timer = null

export function rollPPGlitch() {
  if (!settingsState.spooky_enabled) return
  if (ppGlitchState.active) return          // don't stack one on another
  if (Math.random() >= CHANCE) return

  ppGlitchState.active = true
  clearTimeout(timer)
  timer = setTimeout(() => { ppGlitchState.active = false }, MIN_MS + Math.random() * EXTRA_MS)
}

// What a PP counter should render right now. Every display goes through this so
// they glitch together rather than one at a time.
export function displayPP(value) {
  return ppGlitchState.active ? '666' : Number(value || 0).toLocaleString()
}
