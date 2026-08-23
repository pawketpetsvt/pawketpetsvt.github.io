<template>
  <div class="game-card game-card-wide">
    <div class="game-title">Memory Match</div>
    <div class="game-desc">Match all 6 pairs! 5 PP per pair, 15 tries, once per day. Chain matches within 3 seconds for a combo bonus!</div>
    <span class="game-reward">Up to 30 PP per day</span>
    <div class="game-area">
      <div v-if="onCooldown" class="cooldown-msg">Already played today! Come back tomorrow.</div>
      <div v-else>
        <div class="memory-stats">
          <span>Matches: <strong>{{ matchedPairs }}</strong>/6</span>
          <span>Tries: <strong>{{ triesLeft }}</strong></span>
          <span>Earned: <strong>{{ earned }}</strong> PP</span>
        </div>
        <div class="memory-grid">
          <button
            v-for="(card, idx) in cards"
            :key="idx"
            class="memory-card"
            :class="{ flipped: card.flipped, matched: card.matched }"
            :disabled="locked"
            @click="flipCard(idx)"
          >{{ card.flipped || card.matched ? card.emoji : '' }}</button>
        </div>
        <button class="btn btn-outline btn-sm" @click="initGame">New Game</button>
      </div>
      <div class="game-result" :style="{ color: resultColor }">{{ resultText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { minigamesService } from '../../services/MinigamesService.js'
import { MEMORY_EMOJIS, MEMORY_PAIRS, MEMORY_TRIES } from '../../data/minigamesData.js'

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const onCooldown = ref(true)
const cards = ref([])
const flipped = ref([])
const matchedPairs = ref(0)
const triesLeft = ref(MEMORY_TRIES)
const earned = ref(0)
const locked = ref(false)
const combo = ref(0)
const lastMatchTime = ref(0)
const resultText = ref('')
const resultColor = ref('')

function initGame() {
  const emojiSet = MEMORY_EMOJIS.slice(0, MEMORY_PAIRS)
  cards.value = shuffle(emojiSet.concat(emojiSet)).map(emoji => ({ emoji, flipped: false, matched: false }))
  flipped.value = []
  matchedPairs.value = 0
  triesLeft.value = MEMORY_TRIES
  earned.value = 0
  locked.value = false
  combo.value = 0
  lastMatchTime.value = 0
  resultText.value = ''
}

function flipCard(idx) {
  if (locked.value) return
  const card = cards.value[idx]
  if (card.flipped || card.matched || flipped.value.length >= 2) return
  card.flipped = true
  flipped.value.push(idx)
  if (flipped.value.length === 2) resolvePair()
}

async function resolvePair() {
  locked.value = true
  triesLeft.value--
  const [i1, i2] = flipped.value
  const c1 = cards.value[i1]
  const c2 = cards.value[i2]

  if (c1.emoji === c2.emoji) {
    c1.matched = true
    c2.matched = true
    c1.flipped = false
    c2.flipped = false
    matchedPairs.value++
    earned.value += 5
    flipped.value = []
    locked.value = false

    const now = Date.now()
    if (now - lastMatchTime.value < 3000) combo.value++
    else combo.value = 1
    lastMatchTime.value = now
    if (combo.value > 1) {
      const comboBonus = combo.value * 3
      earned.value += comboBonus
      resultText.value = '🔥 Combo x' + combo.value + '! +' + comboBonus + ' bonus PP!'
      resultColor.value = '#ff9f43'
    }

    if (matchedPairs.value === cards.value.length / 2) {
      await minigamesService.completeGame('memory', earned.value, 'memory_match')
      resultText.value = 'All matched! +' + earned.value + ' PP!'
      resultColor.value = '#5dde7a'
      onCooldown.value = true
    }
  } else {
    setTimeout(async () => {
      c1.flipped = false
      c2.flipped = false
      flipped.value = []
      locked.value = false
      if (triesLeft.value === 0 && matchedPairs.value < MEMORY_PAIRS) {
        await minigamesService.completeGame('memory', earned.value, 'memory_match')
        resultText.value = 'Out of tries! Earned ' + earned.value + ' PP.'
        resultColor.value = '#ff9f43'
        onCooldown.value = true
        cards.value.forEach(c => { if (!c.matched) c.flipped = true })
        locked.value = true
      }
    }, 900)
  }
}

onMounted(async () => {
  onCooldown.value = await minigamesService.isOnCooldown('memory')
  if (!onCooldown.value) initGame()
})
</script>

<style lang="scss" scoped>
.game-card-wide {
  grid-column: 1 / -1;
}
</style>
