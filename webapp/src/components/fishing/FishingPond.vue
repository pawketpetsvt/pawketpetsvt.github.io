<template>
  <div class="fishing-pond position-relative d-flex align-items-center justify-content-center flex-column gap-px6" id="fishing-pond-area">
    <div class="fishing-line" v-if="phase === 'charging' || phase === 'reeling'">
      <div class="fishing-hook">🪝</div>
    </div>
    <div class="pond-text" :style="{ color: pondColor }">{{ pondText }}</div>
  </div>

  <div v-if="phase === 'charging'" class="bar-block">
    <div class="bar-hint">🎣 Release at the right moment!</div>
    <div class="bar-track">
      <div class="bar-fill" :style="{ width: power + '%', background: powerColor }"></div>
    </div>
    <div class="bar-labels"><span>Weak</span><span>Good</span><span>Perfect</span></div>
  </div>

  <div v-if="phase === 'waiting' || phase === 'spiking'" class="bar-block">
    <div class="bar-hint">🐟 Watch for a bite — reel in when the bar turns red!</div>
    <div class="bar-track" :class="{ spiking: phase === 'spiking' }">
      <div class="bar-fill" :style="{ width: tensionLevel + '%', background: tensionColor }"></div>
    </div>
    <div class="bar-labels">
      <span>Calm</span>
      <span class="label-biting">Biting!</span>
      <span class="label-reel" :class="{ armed: phase === 'spiking' }">REEL NOW</span>
    </div>
  </div>

  <button class="btn btn-primary fishing-cast-btn w-100 mt-1 p-tight" id="fishing-btn" :disabled="disabled && phase === 'idle'"
    @mousedown="handlePress" @mouseup="handleRelease" @mouseleave="handleRelease" @touchstart.prevent="handlePress"
    @touchend="handleRelease">{{ buttonLabel }}</button>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['caught'])

const phase = ref('idle') // idle | charging | waiting | spiking | reeling | escaped | early
const power = ref(0)
const tensionLevel = ref(0)

let startTime = 0
let powerTimer = null
let tensionTimer = null
let biteTimeout = null
let escapeTimeout = null
let reelResolve = null
let spikeCaught = false

const pondText = ref('🌊 Select a spot and cast your line! 🌊')
const pondColor = ref('')

const powerColor = ref('#44bb44')

const tensionColor = ref('#5dde7a')

const buttonLabel = ref('🎣 Click to Cast!')

function handlePress(e) {
  if (e && e.preventDefault) e.preventDefault()
  if (phase.value === 'idle') startCast()
  else if (phase.value === 'waiting' || phase.value === 'spiking') reelIn()
}

function handleRelease() {
  if (phase.value === 'charging') releaseCast()
}

function startCast() {
  if (props.disabled) return
  phase.value = 'charging'
  startTime = Date.now()
  power.value = 0
  pondText.value = '🎣 Hold to build power... Release to cast!'
  pondColor.value = 'var(--purple)'
  buttonLabel.value = '⚡ Casting... Release!'

  powerTimer = setInterval(() => {
    const pct = Math.min(100, ((Date.now() - startTime) / 2000) * 100)
    power.value = pct
    powerColor.value = pct > 70 ? '#ff4444' : pct > 40 ? '#ffaa00' : '#44bb44'
  }, 50)
}

function releaseCast() {
  clearInterval(powerTimer)
  const castPower = Math.min(1.0, (Date.now() - startTime) / 2000)
  power.value = 0
  waitForBite(castPower)
}

function waitForBite(castPower) {
  phase.value = 'waiting'
  buttonLabel.value = '🎣 Reel In!'
  tensionLevel.value = 0
  spikeCaught = false
  let tensionDir = 1

  // Normal oscillation is capped below 100 (WAIT_CEILING) so it can never
  // visually reach the bar's full width — that's reserved for the real
  // spike below. Without this cap, ordinary oscillation peaks looked
  // identical to (and were easy to mistake for) the actual bite, since both
  // could fill the bar; the color was the only distinguishing cue, and it's
  // easy to misread bar *width* as the "reel now" signal instead.
  const WAIT_CEILING = 82
  tensionTimer = setInterval(() => {
    const ceiling = phase.value === 'spiking' ? 100 : WAIT_CEILING
    tensionLevel.value += tensionDir * (4 + Math.random() * 6)
    if (tensionLevel.value > ceiling) { tensionLevel.value = ceiling; tensionDir = -1 }
    if (tensionLevel.value < 0) { tensionLevel.value = 0; tensionDir = 1 }
    if (phase.value === 'spiking') {
      tensionColor.value = '#ff4444'
    } else {
      tensionColor.value = tensionLevel.value > 65 ? '#ffd700' : '#5dde7a'
      pondText.value = '🌊 Waiting for a bite...'
      pondColor.value = ''
    }
  }, 80)

  const waitMs = 2000 + Math.random() * 4000
  const biteWindow = 1200

  new Promise(resolve => {
    reelResolve = resolve
    biteTimeout = setTimeout(() => {
      phase.value = 'spiking'
      tensionLevel.value = 100
      tensionColor.value = '#ff4444'
      pondText.value = '🐟 FISH ON! REEL IN NOW!'
      pondColor.value = '#ff4444'
      escapeTimeout = setTimeout(() => {
        if (!spikeCaught) resolve('escaped')
      }, biteWindow)
    }, waitMs)
  }).then(result => resolveWait(result, castPower))
}

function reelIn() {
  if (phase.value === 'spiking') {
    spikeCaught = true
    clearTimeout(escapeTimeout)
    reelResolve && reelResolve('caught')
  } else if (phase.value === 'waiting') {
    clearTimeout(biteTimeout)
    clearTimeout(escapeTimeout)
    reelResolve && reelResolve('early')
  }
}

function resolveWait(result, castPower) {
  clearInterval(tensionTimer)

  if (result === 'escaped') {
    phase.value = 'escaped'
    pondText.value = '💨 The fish got away!'
    pondColor.value = '#ff6b6b'
    buttonLabel.value = '🎣 Hold to Cast!'
    setTimeout(resetIdle, 1500)
    return
  }
  if (result === 'early') {
    phase.value = 'early'
    pondText.value = '😬 Too early! You spooked the fish.'
    pondColor.value = '#ffd700'
    buttonLabel.value = '🎣 Hold to Cast!'
    setTimeout(resetIdle, 1200)
    return
  }

  const bonusMultiplier = spikeCaught ? 1.3 : 1.0
  phase.value = 'reeling'
  pondText.value = '🎣 Reeling in...'
  pondColor.value = ''
  buttonLabel.value = '⏳ Reeling...'
  emit('caught', castPower * bonusMultiplier)
}

function resetIdle() {
  phase.value = 'idle'
  pondText.value = '🌊 Cast your line...'
  pondColor.value = ''
  buttonLabel.value = '🎣 Hold to Cast!'
}

// Called by the parent once it has finished resolving the catch (DB writes,
// toasts, etc.) so the pond returns to idle for the next cast.
function markResolved() {
  resetIdle()
}

defineExpose({ markResolved })

onUnmounted(() => {
  clearInterval(powerTimer)
  clearInterval(tensionTimer)
  clearTimeout(biteTimeout)
  clearTimeout(escapeTimeout)
})
</script>

<style lang="scss" scoped>
.fishing-pond {
  min-height: 90px;
}

.pond-text {
  font-size: 0.85rem;
  font-weight: 500;
}

.bar-block {
  margin: 6px 0 4px;
}

.bar-hint {
  font-size: 0.72rem;
  color: var(--text-light);
  text-align: center;
  margin-bottom: 3px;
}

.bar-track {
  background: var(--border);
  border-radius: 8px;
  height: 18px;
  overflow: hidden;
  transition: box-shadow 0.15s;

  &.spiking {
    box-shadow: 0 0 0 2px #ff4444, 0 0 12px rgba(255, 68, 68, 0.6);
  }
}

.bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: background 0.1s;
}

.bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  color: var(--text-light);
  margin-top: 2px;
}

.label-biting {
  color: #ffd700;
}

.label-reel {
  color: #ff4444;

  &.armed {
    font-weight: 700;
    animation: reel-pulse 0.5s ease-in-out infinite;
  }
}

@keyframes reel-pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

.fishing-cast-btn {
  font-size: 1rem;
  user-select: none;
  touch-action: manipulation;
}
</style>
