<template>
  <div class="game-card">
    <div class="game-title">🔨 Whack-a-Melon</div>
    <div class="game-desc">Whack Melon, but leave the pets alone! 30 seconds, 5 PP per hit (more at higher combos, 3x
      for golden). Hitting a pet costs you your combo. Once per day!</div>
    <span class="game-reward">Up to 50 PP per day</span>
    <div class="game-area">
      <div v-if="onCooldown" class="cooldown-msg">Already played today! Come back tomorrow.</div>
      <template v-else>
        <div class="whack-stats">
          <span>Time: <strong>{{ timeLeft }}</strong>s</span>
          <span>Score: <strong>{{ score }}</strong></span>
          <span>Earned: <strong>{{ earned }}</strong> PP</span>
        </div>
        <div class="whack-grid">
          <div v-for="(mole, i) in moles" :key="i" class="whack-hole" @click="whack(i)">
            <div class="mole" :class="{ active: mole.active, hit: mole.hit, golden: mole.golden }">
              <!-- The picture is decided per POP, not per hole. Legacy fixed one
                   of two pet images to each hole and scored every pop, so the
                   two pictures carried no meaning at all. -->
              <img :src="mole.img" :alt="mole.bait ? 'a pet — do not whack' : 'Melon'" />
            </div>
          </div>
        </div>
        <div id="whack-combo-flash" :style="{ opacity: comboFlash ? 1 : 0 }">{{ comboFlash }}</div>
        <button class="btn btn-primary" :disabled="playing" @click="start">{{ playing ? 'Whacking...' : 'Start Game!' }}</button>
      </template>
      <div class="game-result" :style="{ color: resultColor }">{{ resultText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { AppState } from '../../AppState.js'
import { minigamesService } from '../../services/MinigamesService.js'
import { petsService } from '../../services/PetsService.js'
import {
  WHACK_MELON_IMAGE, WHACK_BAIT_FALLBACK, WHACK_BAIT_CHANCE
} from '../../data/minigamesData.js'

const onCooldown = ref(true)
const playing = ref(false)
const timeLeft = ref(30)
const score = ref(0)
const earned = ref(0)
const combo = ref(0)
const ppPerHit = ref(5)
const comboFlash = ref('')
const resultText = ref('')
const resultColor = ref('')
const moles = ref(Array.from({ length: 6 }, () => (
  { active: false, hit: false, golden: false, bait: false, img: WHACK_MELON_IMAGE }
)))

// Bait is drawn from the LIVE catalog, so a pet added later shows up here with
// no code change. `image_file` already carries its own `pets/` subpath — the
// same `/images/` + image_file convention the adopt grid and racing selector
// use. Placeholders ("???") are excluded: they have no artwork.
const baitImages = computed(() => {
  const fromCatalog = (AppState.petCatalog || [])
    .filter(p => p.image_file && !p.isPlaceholder)
    .map(p => '/images/' + p.image_file)
  return fromCatalog.length ? fromCatalog : WHACK_BAIT_FALLBACK
})

const randomBait = () => {
  const pool = baitImages.value
  return pool[Math.floor(Math.random() * pool.length)]
}

let popInterval = null
let countdownTimer = null

function start() {
  if (onCooldown.value || playing.value) return
  playing.value = true
  score.value = 0
  earned.value = 0
  combo.value = 0
  ppPerHit.value = 5
  timeLeft.value = 30
  resultText.value = ''
  moles.value.forEach(m => { m.active = false; m.hit = false; m.golden = false; m.bait = false })

  popInterval = setInterval(() => {
    const i = Math.floor(Math.random() * 6)
    const mole = moles.value[i]
    if (!mole.active) {
      const bait = Math.random() < WHACK_BAIT_CHANCE
      // Only Melon can be golden — a golden pet would read as "worth extra"
      // when it is the one thing you must not hit.
      const golden = !bait && Math.random() < 0.10
      mole.bait = bait
      mole.golden = golden
      mole.img = bait ? randomBait() : WHACK_MELON_IMAGE
      mole.active = true
      setTimeout(() => { mole.active = false; mole.golden = false }, golden ? 600 : 800)
    }
  }, 600)

  countdownTimer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) end()
  }, 1000)
}

function whack(i) {
  const mole = moles.value[i]
  if (!mole.active) {
    combo.value = 0
    ppPerHit.value = 5
    return
  }
  // Bait: a pet, not the mascot. No points, and the combo is lost — the same
  // penalty as swinging at an empty hole, so the risk is in mis-identifying
  // rather than in reacting fast.
  if (mole.bait) {
    mole.hit = true
    mole.active = false
    combo.value = 0
    ppPerHit.value = 5
    comboFlash.value = '🚫 That is a pet! Combo lost.'
    setTimeout(() => { comboFlash.value = '' }, 700)
    setTimeout(() => { mole.hit = false }, 300)
    return
  }
  const golden = mole.golden
  mole.hit = true
  mole.active = false
  mole.golden = false
  score.value++
  combo.value++
  ppPerHit.value = combo.value >= 20 ? 15 : combo.value >= 10 ? 10 : 5
  const hitPP = golden ? ppPerHit.value * 3 : ppPerHit.value
  earned.value += hitPP

  if (combo.value >= 5) {
    comboFlash.value = (golden ? '✨ GOLDEN! ' : '') + 'x' + combo.value + ' combo! +' + hitPP + ' PP'
    setTimeout(() => { comboFlash.value = '' }, 700)
  }
  setTimeout(() => { mole.hit = false }, 300)
}

async function end() {
  clearInterval(countdownTimer)
  clearInterval(popInterval)
  playing.value = false
  await minigamesService.completeGame('whack', earned.value, 'whack_a_mole')
  resultText.value = 'Game over! Whacked ' + score.value + '! +' + earned.value + ' PP!'
  resultColor.value = '#5dde7a'
  onCooldown.value = true
  moles.value.forEach(m => { m.active = false; m.golden = false; m.bait = false })
}

onMounted(async () => {
  onCooldown.value = await minigamesService.isOnCooldown('whack')
  // Only fetched if some other page has not already cached it. A failure just
  // means bait falls back to the static list, so the game still plays.
  if (!AppState.petCatalog || !AppState.petCatalog.length) {
    petsService.getCatalog().catch(() => { /* fallback list covers it */ })
  }
})

onUnmounted(() => {
  clearInterval(countdownTimer)
  clearInterval(popInterval)
})
</script>

<style lang="scss" scoped>
#whack-combo-flash {
  font-size: 0.78rem;
  font-weight: 700;
  color: #ff9f43;
  text-align: center;
  min-height: 1.2em;
  transition: opacity 0.2s;
}
</style>
