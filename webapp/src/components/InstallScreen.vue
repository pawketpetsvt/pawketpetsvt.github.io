<template>
  <Teleport to="body">
    <div v-if="visible" id="install-screen">
      <div id="install-scanlines"></div>
      <div id="install-inner">

        <div id="install-header">
          <span id="install-header-dots"><span></span><span></span><span></span></span>
          <span id="install-header-title">PawketPets Setup: v0.9.2 BETA</span>
          <span id="install-header-x">✕</span>
        </div>

        <div id="install-body">
          <div id="install-congrats">🎉 Congratulations, Beta Tester!</div>
          <div id="install-sub">
            You have been selected by <strong>Melon Interactive</strong> to participate<br>
            in the exclusive pre-release testing program for<br>
            <strong>PawketPets Virtual Pet System™</strong>
          </div>

          <!-- Both click and dblclick start it, as legacy did — the double-click
               is the period-authentic gesture, the single click is the mercy. -->
          <div v-if="!started" id="install-disc-wrap" :class="{ 'is-starting': starting }" @click="startInstall"
            @dblclick="startInstall">
            <img id="install-disc" src="/images/disc.png" alt="PAWKET.EXE" draggable="false" />
            <div id="install-disc-label">PAWKET<span>.EXE</span></div>
            <div id="install-disc-hint">Double-click to install</div>
          </div>

          <div v-else id="install-progress-area">
            <div id="install-status-text">{{ statusText }}</div>
            <div id="install-bar-wrap">
              <div id="install-bar" :style="{ width: barPct + '%' }"></div>
              <div class="install-bar-error" :style="{ width: errorPct + '%' }"></div>
            </div>
            <div id="install-error-msg" :class="{ 'is-shown': errorPct > 0 }">
              {{ errorPct > 0 ? ERROR_MESSAGE : '' }}
            </div>
            <div id="install-sub-status">{{ subStatus || ' ' }}</div>
          </div>

          <div id="install-fine-print">
            * By installing you agree to participate in beta testing.<br>
            * Your experience data will be recorded for quality assurance purposes.<br>
            * <span id="install-tester-id">Tester ID: {{ testerId }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Popup ads ──────────────────────────────────────────────────────── -->
    <div v-if="visible" class="install-popup" :class="{ show: popups.prize }" id="install-popup-1">
      <div class="install-popup-titlebar">
        <span>🎉 Congratulations!!</span>
        <button class="install-popup-close" @click="popups.prize = false">✕</button>
      </div>
      <div class="install-popup-body">
        <div class="popup-counter">{{ counter.toLocaleString() }}</div>
        <div class="popup-headline">YOU ARE OUR ONE MILLIONTH<br>VISITOR TODAY!!!</div>
        <div class="popup-sub">You have been selected to receive a<br><strong>FREE Virtual Pet Bundle</strong><br>valued
          at $49.99!! Act NOW!!</div>
        <div class="popup-btn" @click="popups.prize = false">CLAIM FREE GIFT!!</div>
        <div class="popup-fine">* Offer valid for new PawketPets beta testers only. Previous offer recipients not
          eligible. We cannot be held responsible for what your pet does next.</div>
      </div>
    </div>

    <div v-if="visible" class="install-popup" :class="{ show: popups.petcare }" id="install-popup-2">
      <div class="install-popup-titlebar">
        <span>PetCare Pro™: Special Offer!</span>
        <button class="install-popup-close" @click="popups.petcare = false">✕</button>
      </div>
      <div class="install-popup-body">
        <div class="popup-pills">🐾💊</div>
        <div class="popup-headline popup-headline-green">IS YOUR PET FEELING SAD??</div>
        <div class="popup-sub">
          Try <strong>PetCare Pro™</strong>, the #1 virtual pet<br>
          wellness supplement trusted by<br>
          <strong>MILLIONS</strong> of beta testers worldwide!!<br><br>
          <span class="popup-limited">LIMITED TIME: BUY 1 GET 1 FREE!!</span>
        </div>
        <div class="popup-btn" @click="popups.petcare = false">ORDER NOW — $9.99</div>
        <div class="popup-fine">* PetCare Pro™ not responsible for side effects including but not limited to: increased
          pet sentience, unexplained attachment, or sessions that do not end.</div>
      </div>
    </div>

    <div v-if="visible" class="install-popup creepy" :class="{ show: popups.creepy }" id="install-popup-3">
      <div class="install-popup-titlebar">
        <span>MISSING: please read</span>
        <button class="install-popup-close" @click="closeCreepy">✕</button>
      </div>
      <div class="install-popup-body">
        <div class="popup-img">❓</div>
        <div class="popup-headline">{{ creepyHeadline }}</div>
        <div class="popup-sub">Last seen: Session 7<br>If located, do <strong>NOT</strong> attempt to feed it.<br>Do
          <strong>NOT</strong> make eye contact.<br>Contact Melon Interactive immediately.</div>
        <div class="popup-btn" @click="closeCreepy">I HAVE NOT SEEN IT</div>
        <div class="popup-fine">This message will not appear again.</div>
      </div>
    </div>

    <div v-if="visible || fading" id="install-fade" :class="{ fading }"></div>
    <div v-if="flicker" id="install-flicker">{{ FLICKER_TEXT }}</div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { musicService, musicState } from '../services/MusicService.js'
import {
  INSTALL_STEPS, STEP_DELAYS, ERROR_BAR_PCT, ERROR_MESSAGE,
  POPUP_SCHEDULE, FLICKER_TEXT, FLICKER_AT_MS, FADE_MS, INSTALL_KEY
} from '../data/installData.js'

const visible = ref(false)
const started = ref(false)
const starting = ref(false)
const fading = ref(false)
const flicker = ref(false)
const statusText = ref('Initializing setup wizard...')
const subStatus = ref('')
const barPct = ref(0)
const errorPct = ref(0)
const counter = ref(1000000)
const creepyHeadline = ref('Have you seen this pet?')
const popups = reactive({ prize: false, petcare: false, creepy: false })

const testerId = 'PT-' + Math.floor(10000 + Math.random() * 89999) +
  '-' + String.fromCharCode(65 + Math.floor(Math.random() * 26))

// Every timer started here, so leaving the page mid-install can't leave one
// running against a component that no longer exists.
const timers = []
const after = (fn, ms) => { timers.push(setTimeout(fn, ms)); }
let counterTimer = null
let urlRef = null

// ── audio ──────────────────────────────────────────────────────────────────
// Legacy reached for the `#bg-music` element directly and kept its own volume
// and autoplay-retry logic. MusicService already owns the audio element and the
// enabled setting, so this just asks it to play.
let musicStarted = false
function startMusic() {
  if (musicStarted) return
  musicStarted = true
  if (musicState.enabled) musicService.play()
}

// The XP-style setup click: a short noise burst with a steep decay.
function playClickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 6)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start()
  } catch (e) {}
}

// ── the sequence ───────────────────────────────────────────────────────────
function startInstall() {
  if (started.value || starting.value) return
  starting.value = true
  startMusic()
  playClickSound()
  // The disc spins and shrinks away before the progress panel replaces it.
  after(() => { started.value = true; runStep(0) }, 500)
}

function runStep(i) {
  if (i >= INSTALL_STEPS.length) return finish()

  const step = INSTALL_STEPS[i]
  statusText.value = step.status
  subStatus.value = step.sub || ''

  // The conflict step splits the bar into a green run and a red tail.
  if (step.errorBar) {
    barPct.value = step.pct - ERROR_BAR_PCT
    errorPct.value = ERROR_BAR_PCT
  } else {
    errorPct.value = 0
    barPct.value = step.pct
  }

  for (const p of POPUP_SCHEDULE) {
    if (p.step !== i) continue
    after(() => {
      popups[p.id] = true
      // Auto-dismisses even if the player already closed it — legacy reopened
      // it on the same timer, reasoning they might have missed it.
      after(() => { popups[p.id] = false }, p.visible)
    }, p.delay)
  }

  after(() => runStep(i + 1), STEP_DELAYS[i] || 700)
}

function finish() {
  after(() => {
    fading.value = true
    // The subliminal frame, ~0.7s into a 1.2s blackout.
    after(() => {
      flicker.value = true
      after(() => { flicker.value = false }, 300)
    }, FLICKER_AT_MS)

    after(() => {
      popups.prize = popups.petcare = popups.creepy = false
      visible.value = false
      document.body.classList.remove('installing')
      try { localStorage.setItem(INSTALL_KEY, '1') } catch (e) {}
      // A referral link that landed here has to survive the sequence, or the
      // referrer never gets credited.
      if (urlRef) {
        try { history.replaceState(null, '', '?ref=' + urlRef) } catch (e) {}
      }
      after(() => { fading.value = false }, 100)
    }, FADE_MS)
  }, 600)
}

// Closing the creepy popup corrupts its headline for a moment first.
function closeCreepy() {
  const orig = 'Have you seen this pet?'
  const glitchChars = '█▉▊▓ ■ ▪'
  let n = 0
  const id = setInterval(() => {
    creepyHeadline.value = Array.from(orig)
      .map(c => Math.random() > 0.5 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : c)
      .join('')
    if (++n > 6) {
      clearInterval(id)
      popups.creepy = false
      creepyHeadline.value = orig
    }
  }, 80)
  timers.push(id)
}

// ── gate ───────────────────────────────────────────────────────────────────
const GESTURES = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click']
function onGesture() {
  startMusic()
  GESTURES.forEach(e => document.removeEventListener(e, onGesture))
}

onMounted(() => {
  let seen = false
  try { seen = !!localStorage.getItem(INSTALL_KEY) } catch (e) { seen = true }
  if (seen) return

  urlRef = (location.search.match(/[?&]ref=([^&]+)/) || [])[1] || null
  visible.value = true
  document.body.classList.add('installing')

  counterTimer = setInterval(() => {
    counter.value += Math.floor(Math.random() * 7) + 1
  }, 800)

  GESTURES.forEach(e => document.addEventListener(e, onGesture, { once: true, passive: true }))
})

onUnmounted(() => {
  timers.forEach(clearTimeout)
  timers.forEach(clearInterval)
  clearInterval(counterTimer)
  GESTURES.forEach(e => document.removeEventListener(e, onGesture))
  document.body.classList.remove('installing')
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
#install-screen * { font-family:Tahoma,Arial,sans-serif !important; color:#333 !important; }
#install-screen #install-header * { color:#fff !important; }
#install-screen #install-congrats { color:#000080 !important; }
#install-screen #install-sub { color:#333 !important; }
#install-screen #install-disc-label { color:#000080 !important; font-family:'Courier New',monospace !important; }
#install-screen #install-disc-label span { color:#000080 !important; }
#install-screen { background:#008080 !important; }
#install-screen #install-inner { background:#d4d0c8 !important; }
.install-popup * { font-family:Tahoma,Arial,sans-serif !important; color:#000 !important; }
.install-popup-titlebar * { color:#fff !important; }
.popup-headline { color:#cc0000 !important; }
.popup-sub { color:#333 !important; }

// Carried from the legacy index.html's `#install-styles` block
// (index.html:556-875). The `body.installing` chrome-hiding rule is NOT here —
// it targets elements outside this component and lives in the global stylesheet. The
// block's `body.guest` rules are not carried at all: they key off legacy
// elements (#auth-gate, #section-login, .app-container) and a body class the
// Vue app never sets.

#install-screen {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #008080;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Tahoma', 'Arial', sans-serif;
  overflow: hidden;
}

#install-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.04) 2px, rgba(0, 0, 0, 0.04) 4px);
  z-index: 1;
}

#install-inner {
  position: relative;
  z-index: 2;
  width: min(520px, 92vw);
  background: #d4d0c8;
  border: 2px solid #ffffff;
  border-right-color: #404040;
  border-bottom-color: #404040;
  box-shadow: 2px 2px 0 #000, inset 1px 1px 0 #fff;
}

#install-header {
  background: linear-gradient(90deg, #000080, #1084d0);
  padding: 4px 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

#install-header-dots {
  display: flex;
  gap: 3px;

  span {
    display: block;
    width: 13px;
    height: 13px;
    background: #d4d0c8;
    border: 1px solid #888;
    border-bottom-color: #fff;
    border-right-color: #fff;
    font-size: 8px;
    line-height: 13px;
    text-align: center;
    cursor: default;
  }
}

#install-header-title {
  flex: 1;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  font-family: Tahoma, Arial, sans-serif;
}

#install-header-x {
  color: #fff;
  font-size: 11px;
  cursor: default;
  opacity: 0.7;
}

#install-body {
  padding: 24px 28px 18px;
  text-align: center;
}

#install-congrats {
  font-size: clamp(1.1rem, 4vw, 1.5rem);
  font-weight: bold;
  color: #000080;
  margin-bottom: 10px;
  font-family: Tahoma, Arial, sans-serif;
}

#install-sub {
  font-size: clamp(0.72rem, 2.5vw, 0.85rem);
  color: #333;
  margin-bottom: 22px;
  line-height: 1.6;
  font-family: Tahoma, Arial, sans-serif;
}

#install-disc-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 22px;
  cursor: pointer;

  &:hover #install-disc {
    animation: none;
    transform: scale(1.08) rotate(-4deg);
    filter: drop-shadow(3px 6px 12px rgba(0, 0, 80, 0.35));
  }

  // Legacy applied the spin-away with inline styles on three elements; one
  // state class does the same job.
  &.is-starting {
    #install-disc {
      animation: none;
      transition: transform 0.5s ease, opacity 0.4s ease;
      transform: scale(0.6) rotate(720deg);
      opacity: 0.2;
    }

    #install-disc-label,
    #install-disc-hint {
      opacity: 0;
      transition: opacity 0.3s;
    }
  }
}

#install-disc {
  width: clamp(90px, 22vw, 130px);
  height: clamp(90px, 22vw, 130px);
  object-fit: contain;
  transition: transform 0.15s;
  filter: drop-shadow(2px 4px 8px rgba(0, 0, 0, 0.25));
  animation: discIdle 4s ease-in-out infinite;
}

@keyframes discIdle {
  0%, 100% { transform: rotate(-2deg) scale(1); }
  50%      { transform: rotate(2deg) scale(1.02); }
}

#install-disc-label {
  font-size: clamp(1rem, 3.5vw, 1.3rem);
  font-weight: bold;
  font-family: 'Courier New', monospace;
  color: #000;
  letter-spacing: 1px;

  span { color: #000080; }
}

#install-disc-hint {
  font-size: 0.72rem;
  color: #555;
  font-family: Tahoma, Arial, sans-serif;
}

#install-progress-area {
  margin-bottom: 16px;
}

#install-status-text {
  font-size: 0.82rem;
  color: #000;
  font-family: Tahoma, Arial, sans-serif;
  margin-bottom: 6px;
  text-align: left;
  min-height: 1.2em;
}

#install-bar-wrap {
  width: 100%;
  height: 20px;
  background: #fff;
  border: 2px inset #888;
  overflow: hidden;
  display: flex;
}

#install-bar {
  height: 100%;
  width: 0%;
  background: repeating-linear-gradient(90deg, #000080 0px, #000080 14px, #5588cc 14px, #5588cc 18px);
  transition: width 0.4s ease;
  flex-shrink: 0;
}

.install-bar-error {
  display: inline-block;
  height: 100%;
  background: repeating-linear-gradient(90deg, #cc0000 0px, #cc0000 14px, #880000 14px, #880000 18px);
  transition: width 0.4s ease;
}

#install-error-msg {
  font-size: 0.7rem;
  color: #cc0000;
  font-family: 'Courier New', monospace;
  text-align: left;
  margin-top: 3px;
  min-height: 1em;
  font-weight: bold;
  display: none;

  &.is-shown { display: block; }
}

#install-sub-status {
  font-size: 0.72rem;
  color: #555;
  font-family: 'Courier New', monospace;
  text-align: left;
  margin-top: 4px;
  min-height: 1.2em;
}

#install-fine-print {
  font-size: 0.65rem;
  color: #666;
  font-family: Tahoma, Arial, sans-serif;
  border-top: 1px solid #aaa;
  padding-top: 10px;
  margin-top: 6px;
  text-align: left;
  line-height: 1.7;
}

#install-fade {
  position: fixed;
  inset: 0;
  background: #000;
  opacity: 0;
  pointer-events: none;
  z-index: 999999;
  transition: opacity 1.2s ease;

  &.fading {
    opacity: 1;
    pointer-events: all;
  }
}

// Legacy built this element in JS with a cssText string and injected its
// keyframes into <head> on the fly.
#install-flicker {
  position: fixed;
  inset: 0;
  z-index: 9999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  pointer-events: none;
  font-family: 'Courier New', monospace;
  color: #ff0000;
  font-weight: bold;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-shadow: 0 0 20px #ff0000, 0 0 40px #ff000088;
  font-size: clamp(1.8rem, 5vw, 3rem);
  animation: installFlickerGlitch 0.28s steps(3) forwards;
}

@keyframes installFlickerGlitch {
  0%   { opacity: 1;   transform: translate(0, 0) skewX(0); }
  20%  { opacity: 1;   transform: translate(-4px, 2px) skewX(-6deg); color: #ff4444; }
  40%  { opacity: 0.7; transform: translate(4px, -2px) skewX(4deg); }
  60%  { opacity: 1;   transform: translate(-2px, 4px) skewX(-3deg); }
  80%  { opacity: 0.8; transform: translate(3px, -1px); color: #ff6666; }
  100% { opacity: 0; }
}

/* ── Popup ads ── */
.install-popup {
  position: fixed;
  z-index: 100001;
  background: #d4d0c8;
  border: 2px solid #fff;
  border-right-color: #404040;
  border-bottom-color: #404040;
  box-shadow: 2px 2px 0 #000;
  width: 560px;
  max-width: 94vw;
  font-family: Tahoma, Arial, sans-serif;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;

  &.show {
    opacity: 1;
    pointer-events: all;
  }
}

// Legacy positioned each popup with an inline style attribute.
#install-popup-1 { top: 12%; right: 4%; }
#install-popup-2 { top: 8%;  left: 2%; }
#install-popup-3 { bottom: 10%; right: 3%; }

.install-popup-titlebar {
  background: linear-gradient(90deg, #000080, #1084d0);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;

  span {
    color: #fff;
    font-size: 18px;
    font-weight: bold;
  }
}

.install-popup-close {
  background: #d4d0c8;
  border: 1px solid #888;
  border-bottom-color: #fff;
  border-right-color: #fff;
  color: #000;
  font-size: 16px;
  width: 24px;
  height: 14px;
  line-height: 12px;
  text-align: center;
  cursor: pointer;
  font-weight: bold;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background: #ff6b6b;
    color: #fff;
  }
}

.install-popup-body {
  padding: 24px 28px 26px;
  text-align: center;

  .popup-headline {
    font-size: 28px;
    font-weight: bold;
    color: #cc0000;
    margin-bottom: 10px;
    line-height: 1.3;
  }

  .popup-sub {
    font-size: 20px;
    color: #333;
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .popup-btn {
    display: inline-block;
    background: linear-gradient(180deg, #ffff00, #ffcc00);
    border: 2px outset #888;
    color: #000;
    font-size: 22px;
    font-weight: bold;
    padding: 10px 28px;
    cursor: pointer;
    font-family: Tahoma, Arial, sans-serif;
    text-decoration: none;

    &:hover { background: linear-gradient(180deg, #ffcc00, #ff9900); }
  }

  .popup-fine {
    font-size: 10px;
    color: #888;
    margin-top: 6px;
    line-height: 1.3;
  }

  .popup-counter {
    font-size: 22px;
    font-weight: bold;
    color: #008000;
    font-family: Impact, Arial, sans-serif;
    margin: 4px 0;
    animation: counterFlash 0.5s ease infinite alternate;
  }
}

// Inline styles on the PetCare popup in legacy.
.popup-pills {
  font-size: 28px;
  margin-bottom: 4px;
}

.popup-headline-green { color: #006600 !important; }

.popup-limited {
  color: #cc0000;
  font-weight: bold;
}

@keyframes counterFlash {
  from { color: #008000; }
  to   { color: #cc0000; }
}

/* ── Creepy popup ── */
.install-popup.creepy {
  border-color: #333 #000 #000 #333;
  box-shadow: 2px 2px 0 #000, 0 0 12px rgba(80, 0, 100, 0.6);

  .install-popup-titlebar { background: linear-gradient(90deg, #1a001a, #3d0050); }

  .popup-headline {
    color: #6600aa;
    font-family: 'Courier New', monospace;
  }

  .popup-sub {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    color: #444;
  }

  .popup-img {
    width: 80px;
    height: 60px;
    background: #111;
    margin: 6px auto;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    border: 1px solid #333;
    filter: grayscale(1) brightness(0.6);
    position: relative;
    overflow: hidden;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 200, 0, 0.04) 2px, rgba(0, 200, 0, 0.04) 4px);
    }
  }

  &.show { animation: creepyGlitch 6s ease-in-out infinite; }
}

@keyframes creepyGlitch {
  0%   { transform: translate(0, 0) skewX(0deg); filter: none; }
  85%  { transform: translate(0, 0) skewX(0deg); filter: none; }
  87%  { transform: translate(-3px, 1px) skewX(-4deg); filter: hue-rotate(90deg) brightness(1.5); }
  89%  { transform: translate(3px, -1px) skewX(2deg); filter: hue-rotate(200deg); }
  91%  { transform: translate(-2px, 2px) skewX(-2deg); filter: none; }
  93%  { transform: translate(0, 0) skewX(0deg); filter: none; }
  96%  { transform: translate(2px, 0); filter: brightness(0.4); }
  98%  { transform: translate(0, 0); filter: none; }
  100% { transform: translate(0, 0) skewX(0deg); filter: none; }
}

@media (max-width: 480px) {
  #install-inner { width: 96vw; }
  #install-body { padding: 16px 14px 12px; }
  #install-fine-print { font-size: 0.6rem; }
}
</style>
