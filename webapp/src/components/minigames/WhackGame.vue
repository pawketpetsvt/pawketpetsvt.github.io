<template>
  <div class="game-card">
    <div class="game-title">🔨 Whack-a-Mole</div>
    <div class="game-desc">Whack the mascots! 30 seconds, 5 PP per whack (more at higher combos, 3x for golden). Once per day!</div>
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
              <img :src="WHACK_MOLE_IMAGES[i % 2]" alt="mole" />
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
import { ref, onMounted, onUnmounted } from 'vue'
import { minigamesService } from '../../services/MinigamesService.js'
import { WHACK_MOLE_IMAGES } from '../../data/minigamesData.js'

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
const moles = ref(Array.from({ length: 6 }, () => ({ active: false, hit: false, golden: false })))

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
  moles.value.forEach(m => { m.active = false; m.hit = false; m.golden = false })

  popInterval = setInterval(() => {
    const i = Math.floor(Math.random() * 6)
    const mole = moles.value[i]
    if (!mole.active) {
      const golden = Math.random() < 0.10
      mole.active = true
      mole.golden = golden
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
  moles.value.forEach(m => { m.active = false; m.golden = false })
}

onMounted(async () => {
  onCooldown.value = await minigamesService.isOnCooldown('whack')
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
