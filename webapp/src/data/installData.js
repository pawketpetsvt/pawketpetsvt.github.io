// The retro "PAWKET.EXE" install sequence — the fake 90s setup wizard a
// first-time visitor sees before the login screen, and the origin of the
// beta-tester framing the rest of the site's lore builds on.
//
// Ported from the standalone inline <script> in the legacy index.html
// (index.html:1635-1917) — separate from game.js, which is why it survived
// every earlier deletion pass and would have been dropped silently at cutover.
// Phase 1 logged it as "a stretch item, not a blocker" and it was never done.
//
// Step text extracted programmatically; several lines carry typographic
// apostrophes that are easy to mangle by hand.
export const INSTALL_STEPS = [
    { pct: 8,  status: 'Initializing setup wizard...',              sub: 'Loading PAWKET.EXE, please do not close this window.' },
    { pct: 22, status: 'Checking system requirements...',            sub: 'OK. 640KB ought to be enough for anybody' },
    { pct: 35, status: 'Unpacking pet data...',                      sub: 'Installing 8+ VTubers... installing happiness... installing questionable safety standards...' },
    { pct: 51, status: 'Restoring previous session data...',         sub: '⚠ 1 previous user data conflict detected — skipping', errorBar: true },
    { pct: 67, status: 'Connecting to Melon Interactive servers...', sub: 'Connection established. Welcome back.' },
    { pct: 80, status: 'Configuring companion AI...',                sub: 'Loading pet personalities... WARNING: do not feed corrupted pets after midnight.' },
    { pct: 93, status: 'Installing weather engine...',               sub: 'ERR_TRACE: 0x0000007B, non-critical, continuing. 100% Piper-free since yesterday.' },
    { pct: 99, status: 'Finalizing installation...',                 sub: 'Your pets definitely won’t unionize. Probably.' },
]

// Per-step dwell time, index-aligned with INSTALL_STEPS.
export const STEP_DELAYS = [900, 1300, 1600, 2400, 1800, 2200, 2000, 2800]

// Width of the red segment on the "user data conflict" step.
export const ERROR_BAR_PCT = 7

export const ERROR_MESSAGE = '⚠ ERR: user_data_conflict [0x4F]: previous session unresolved'

// Which popup appears on which step, how long after that step begins, and how
// long it stays before dismissing itself. Legacy hardcoded three `if (i === n)`
// branches; the schedule is the same, just stated as data.
export const POPUP_SCHEDULE = [
  { step: 1, id: 'prize',  delay: 600,  visible: 7000 },
  { step: 3, id: 'creepy', delay: 1200, visible: 9000 },
  { step: 5, id: 'petcare', delay: 400, visible: 7000 }
]

// The subliminal frame during the closing fade. It shows for ~280ms about 0.7s
// into a 1.2s blackout — deliberately almost missable.
export const FLICKER_TEXT = 'YOU SHOULDN\u2019T BE HERE'
export const FLICKER_AT_MS = 700
export const FADE_MS = 1200

export const INSTALL_KEY = 'pawketpets_installed_v1'
