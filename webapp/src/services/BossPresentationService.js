import { reactive } from 'vue'

// Ports triggerBossEntrance() / startBossWarningText() / spawnWarningText() /
// findNonOverlappingY() / stopBossWarningText() (legacy game.js:19013-19187).
//
// This was missed entirely when Battle was migrated in Phase 7. The port took
// the two BRIEF glitches — `boss-ui-glitch` for 800ms at each of Piper's phase
// transitions — and left out the sustained one, which is the whole effect:
// legacy adds the class at the start of a boss fight and its own comment reads
// "DON'T remove the glitch - it stays until battle ends!". So on the Vue site
// the page barely twitched twice a fight instead of coming apart for the whole
// of it, and the scrolling warnings never appeared at all.
//
// Applies to EVERY boss, not just Piper — legacy calls triggerBossEntrance()
// from the `enemy.is_boss` branch, before choosing which theme to play.
export const bossPresentation = reactive({
  // Drives the fixed `.screen-glitch` overlay and the in-arena boss chrome.
  active: false,
  // Live warning texts. Each is { id, y, dir } and removes itself after the
  // 6s scroll animation completes.
  warnings: []
})

// Legacy's own threshold: the UI fragmentation is desktop-only because the
// drift animations were too heavy on phones. The warning texts still spawn on
// mobile, just capped (see MOBILE_WARNING_CAP).
const DESKTOP_MIN_WIDTH = 768
const MOBILE_WARNING_CAP = 3
const WARNING_LIFETIME_MS = 6000
const WARNING_STAGGER_MS = 800
const WARNING_WAVE_MS = 4000
const MIN_GAP_PX = 140
const PLACEMENT_ATTEMPTS = 30

let warningTimer = null
let pending = []
let nextId = 1
// True while a whole boss fight is glitching. `pulse()` must not clear the
// class in that case — the phase-transition blips fire DURING the sustained
// effect, and a naive add/remove would end it early. This is why the body
// class is owned here rather than in BattleArena, which used to do exactly
// that add-then-remove.
let sustained = false

// Guards the Node smoke harness, which imports BattleService for real. It stubs
// startBattle/endBattle today so this is never reached, but `reset()` also calls
// stop() and is not Supabase-touching — the same reasoning as SoundService's
// `typeof Audio` guard.
function hasDom() {
  return typeof document !== 'undefined' && typeof window !== 'undefined'
}

function isDesktop() {
  return hasDom() && window.innerWidth >= DESKTOP_MIN_WIDTH
}

function schedule(fn, ms) {
  const t = setTimeout(fn, ms)
  pending.push(t)
  return t
}

// Ports findNonOverlappingY(). Tries random positions first, then falls back to
// whichever fifth of the screen is least crowded, so warnings stay legible
// rather than stacking on one line.
function pickY() {
  const span = Math.max(120, window.innerHeight - 200)
  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
    const y = Math.random() * span + 50
    if (!bossPresentation.warnings.some(w => Math.abs(y - w.y) < MIN_GAP_PX)) return y
  }

  const zones = 5
  const zoneHeight = span / zones
  let bestZone = 0
  let bestCount = Infinity
  for (let z = 0; z < zones; z++) {
    const start = 50 + z * zoneHeight
    const count = bossPresentation.warnings
      .filter(w => w.y >= start && w.y < start + zoneHeight).length
    if (count < bestCount) { bestCount = count; bestZone = z }
  }
  return 50 + bestZone * zoneHeight + Math.random() * (zoneHeight * 0.8)
}

// Ports spawnWarningText(). Legacy built and appended a <div> per warning; here
// the array is the source of truth and BossOverlay renders it, so nothing has
// to be cleaned out of the DOM by hand when a fight ends.
function spawnWarning() {
  if (!isDesktop() && bossPresentation.warnings.length >= MOBILE_WARNING_CAP) return

  const w = {
    id: nextId++,
    y: pickY(),
    dir: Math.random() > 0.5 ? 'right' : 'left'
  }
  bossPresentation.warnings.push(w)

  schedule(() => {
    const i = bossPresentation.warnings.indexOf(w)
    if (i > -1) bossPresentation.warnings.splice(i, 1)
  }, WARNING_LIFETIME_MS)
}

// 3-4 warnings, staggered 0.8s apart — legacy's counts and cadence exactly.
function spawnWave() {
  const count = Math.floor(Math.random() * 2) + 3
  for (let i = 0; i < count; i++) schedule(spawnWarning, i * WARNING_STAGGER_MS)
}

class BossPresentationService {
  // Called from BattleService.startBattle for any boss.
  start() {
    this.stop()
    bossPresentation.active = true

    if (isDesktop()) {
      sustained = true
      document.body.classList.add('boss-ui-glitch')
    }

    spawnWave()
    warningTimer = setInterval(spawnWave, WARNING_WAVE_MS)
  }

  // The brief phase-transition glitch, moved off BattleArena so the sustained
  // effect above cannot be cut short by it. During a boss fight on desktop the
  // class is already on and stays on; the pulse only does real work when the
  // sustained effect is not running (a phone, or a non-boss fight that somehow
  // stamps the flag).
  pulse(ms = 800) {
    if (sustained || !hasDom()) return
    document.body.classList.add('boss-ui-glitch')
    schedule(() => {
      if (!sustained) document.body.classList.remove('boss-ui-glitch')
    }, ms)
  }

  // Ports stopBossWarningText() plus the class teardown. Called from endBattle
  // and from reset(), the latter covering a player navigating away mid-fight.
  stop() {
    if (warningTimer) { clearInterval(warningTimer); warningTimer = null }
    for (const t of pending) clearTimeout(t)
    pending = []
    sustained = false
    bossPresentation.active = false
    bossPresentation.warnings.splice(0)
    if (hasDom()) document.body.classList.remove('boss-ui-glitch')
  }
}

export const bossPresentationService = new BossPresentationService()
