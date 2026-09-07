import { reactive } from 'vue'
import { musicService } from './MusicService.js'

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
  warnings: [],

  // ── Death screen ──────────────────────────────────────────────────────────
  // Set while triggerBossDeathScreen()'s sequence is running. `dying` puts the
  // black overlay in the tree; `blackout` is the second-frame flip that starts
  // its 5s opacity transition; `deathWarnings` are the "WE WARNED YOU" texts.
  dying: false,
  blackout: false,
  deathWarnings: []
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

// Death-screen timings, all legacy's. The blackout is a 5s CSS transition
// started at 100ms; the wave at 5500 is the one that lands on a black screen.
const MUSIC_GLITCH_MS = 6000
const BLACKOUT_AT_MS = 5500
const HOLD_ON_BLACK_MS = 3000
const DEATH_WARNING_LIFETIME_MS = 5000

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

// Ports spawnDeathWarning(). Legacy positioned these with a pile of inline
// styles; only the random placement is genuinely per-element, so that stays a
// binding and the rest is a class in BossOverlay — the standing rule about
// inline styles in this project.
//
// The 5s lifetime matches `death-warning-fade`, which ends at opacity 0; legacy
// never removed these individually and instead swept them with a querySelectorAll
// at two fixed points, leaving invisible nodes stacked up in between.
function spawnDeathWarning() {
  const w = {
    id: nextId++,
    x: Math.random() * Math.max(0, window.innerWidth - 500) + 100,
    y: Math.random() * Math.max(0, window.innerHeight - 200) + 100
  }
  bossPresentation.deathWarnings.push(w)

  schedule(() => {
    const i = bossPresentation.deathWarnings.indexOf(w)
    if (i > -1) bossPresentation.deathWarnings.splice(i, 1)
  }, DEATH_WARNING_LIFETIME_MS)
}

// 3-4 warnings, staggered 0.8s apart — legacy's counts and cadence exactly.
function spawnWave() {
  const count = Math.floor(Math.random() * 2) + 3
  for (let i = 0; i < count; i++) schedule(spawnWarning, i * WARNING_STAGGER_MS)
}

class BossPresentationService {
  // Called from BattleService.startBattle for any boss.
  start() {
    // Forced: a new fight starting always means a clean slate, and the `dying`
    // guard in stop() would otherwise refuse if a previous sequence had somehow
    // been left standing.
    this.stop(true)
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

  // Ports triggerBossDeathScreen() (game.js:19189-19287) — the ARG beat for
  // losing to a boss. The screen fades to black over 5s while "WE WARNED YOU"
  // batters the page in five waves, then the player is signed out and the page
  // reloads to the login screen.
  //
  // LEGACY MISWIRING, corrected here. Legacy calls this from
  // `endBattlePlayback()` — the AUTO-battle teardown — gated on `isBossBattle`,
  // a module global that only the MANUAL battle entry ever assigns
  // (game.js:14381). The two are different engines, so on the live site the
  // sequence fires when a player loses a Starter Dungeon auto-battle AND the
  // last manual fight they happened to start was against a boss, which is not
  // a rule anyone could infer while playing. The evident intent is stated by
  // legacy's own comment at the call site — "Check if player lost to a boss -
  // trigger special death screen!" — so it now fires on exactly that: losing a
  // manual boss fight. Auto-battles do not trigger it at all.
  //
  // `onDone` performs the sign-out; the service does not import AuthService,
  // so the sequence stays free of a dependency on the session layer.
  deathScreen(onDone) {
    if (!hasDom() || bossPresentation.dying) return
    bossPresentation.dying = true

    // Stop the in-fight warnings and the spawner, but leave the body glitch and
    // the scanline overlay up — the page is supposed to stay broken through
    // this. `stop()` runs at the very end instead.
    if (warningTimer) { clearInterval(warningTimer); warningTimer = null }
    bossPresentation.warnings.splice(0)

    musicService.glitchFadeBattleTrack(MUSIC_GLITCH_MS)

    // Legacy sets opacity on the next tick so the 5s CSS transition has a frame
    // at 0 to start from; a Vue render pass serves the same purpose.
    schedule(() => { bossPresentation.blackout = true }, 100)

    // The five waves, verbatim: counts, offsets and per-wave stagger.
    const WAVES = [
      { at: 500, min: 3, spread: 2, stagger: 400 },
      { at: 1500, min: 2, spread: 2, stagger: 350 },
      { at: 2500, min: 3, spread: 2, stagger: 450 },
      { at: 3500, min: 2, spread: 2, stagger: 400 },
      { at: 4500, min: 2, spread: 2, stagger: 500 }
    ]
    for (const w of WAVES) {
      schedule(() => {
        const count = Math.floor(Math.random() * w.spread) + w.min
        for (let i = 0; i < count; i++) schedule(spawnDeathWarning, i * w.stagger)
      }, w.at)
    }

    // Screen is fully black by now: clear the field and put up eight more.
    schedule(() => {
      bossPresentation.deathWarnings.splice(0)
      for (let i = 0; i < 8; i++) schedule(spawnDeathWarning, i * 200)
    }, BLACKOUT_AT_MS)

    schedule(() => {
      this.stop(true)
      if (typeof onDone === 'function') onDone()
    }, BLACKOUT_AT_MS + HOLD_ON_BLACK_MS)
  }

  // Ports stopBossWarningText() plus the class teardown. Called from endBattle
  // and from reset(), the latter covering a player navigating away mid-fight.
  //
  // `force` is for the death sequence's own final call. Without the guard, any
  // ordinary teardown reaching this during those ~8.5 seconds — reset(), the
  // arena unmounting — would cancel the pending timers and abandon the player
  // on a half-black screen, still signed in. The sequence is the one thing here
  // that must be allowed to finish.
  stop(force = false) {
    if (bossPresentation.dying && !force) return
    if (warningTimer) { clearInterval(warningTimer); warningTimer = null }
    for (const t of pending) clearTimeout(t)
    pending = []
    sustained = false
    bossPresentation.active = false
    bossPresentation.dying = false
    bossPresentation.blackout = false
    bossPresentation.warnings.splice(0)
    bossPresentation.deathWarnings.splice(0)
    if (hasDom()) document.body.classList.remove('boss-ui-glitch')
  }
}

export const bossPresentationService = new BossPresentationService()
