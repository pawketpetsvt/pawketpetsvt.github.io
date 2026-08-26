<template>
  <div class="game-card">
    <div class="game-title">🎰 Slot Machine</div>
    <div class="game-desc">Bet your PP! Match 2 = get bet back. Match 3 = 4x profit!</div>
    <span class="game-reward">High risk, high reward!</span>
    <div class="game-area">
      <div class="slot-bet-selector">
        <label class="bet-label">Choose Your Bet:</label>
        <div class="bet-buttons">
          <button v-for="bet in SLOT_BETS" :key="bet" class="btn bet-btn" :class="{ active: selectedBet === bet }"
            :disabled="spinning" @click="selectedBet = bet">{{ bet }} PP</button>
        </div>
      </div>

      <div class="slot-machine">
        <div class="slot-reel" :class="{ spinning }">{{ reelDisplay[0] }}</div>
        <div class="slot-reel" :class="{ spinning }">{{ reelDisplay[1] }}</div>
        <div class="slot-reel" :class="{ spinning }">{{ reelDisplay[2] }}</div>
      </div>

      <button class="btn btn-primary btn-lg" :disabled="spinning" @click="spin">
        {{ spinning ? 'Spinning...' : '🎰 Spin! (' + selectedBet + ' PP)' }}
      </button>

      <div class="game-result" :style="{ color: resultColor }">{{ resultText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { AppState } from '../../AppState.js'
import { playerService } from '../../services/PlayerService.js'
import { toastService } from '../../services/ToastService.js'
import { SLOT_SYMBOLS, SLOT_BETS } from '../../data/minigamesData.js'

const selectedBet = ref(50)
const spinning = ref(false)
const reelDisplay = ref(['🍉', '🍉', '🍉'])
const resultText = ref('')
const resultColor = ref('')

const points = () => (AppState.player ? AppState.player.pawketpoints : 0)

async function spin() {
  if (spinning.value) return
  if (points() < selectedBet.value) {
    resultText.value = 'Not enough PP! Need ' + selectedBet.value + ' PP to play.'
    resultColor.value = '#ff6eb4'
    return
  }

  const newTotal = await playerService.deductPointsSecure(selectedBet.value, 'slot_machine')
  if (newTotal === null) {
    toastService.error('Error processing bet!')
    return
  }

  spinning.value = true
  resultText.value = ''

  const final = [
    Math.floor(Math.random() * SLOT_SYMBOLS.length),
    Math.floor(Math.random() * SLOT_SYMBOLS.length),
    Math.floor(Math.random() * SLOT_SYMBOLS.length)
  ]

  let spins = 0
  const maxSpins = 20
  const interval = setInterval(() => {
    reelDisplay.value = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
    ]
    spins++
    if (spins === 15) reelDisplay.value[0] = SLOT_SYMBOLS[final[0]]
    if (spins === 18) reelDisplay.value[1] = SLOT_SYMBOLS[final[1]]
    if (spins >= maxSpins) {
      clearInterval(interval)
      reelDisplay.value = [SLOT_SYMBOLS[final[0]], SLOT_SYMBOLS[final[1]], SLOT_SYMBOLS[final[2]]]
      resolveSpin(final)
    }
  }, 100)
}

async function resolveSpin(final) {
  let grossPrize = 0
  let netProfit = 0

  if (final[0] === final[1] && final[1] === final[2]) {
    grossPrize = selectedBet.value * 4
    netProfit = selectedBet.value * 3
  } else if (final[0] === final[1] || final[1] === final[2] || final[0] === final[2]) {
    grossPrize = selectedBet.value
    netProfit = 0
  }

  spinning.value = false

  if (grossPrize > 0) {
    await playerService.awardPoints(grossPrize, 'slot_machine')
    if (netProfit > 0) {
      resultText.value = '🎉 Triple Match! Won ' + netProfit + ' PP profit! (Paid ' + grossPrize + ' PP total)'
      resultColor.value = '#5dde7a'
    } else {
      resultText.value = '🎯 Two Match! Break even - got your ' + selectedBet.value + ' PP back!'
      resultColor.value = '#ffdd57'
    }
  } else {
    resultText.value = '❌ No match! Lost ' + selectedBet.value + ' PP. Try again!'
    resultColor.value = '#ff6eb4'
  }
}
</script>

<style lang="scss" scoped>
.bet-label {
  font-weight: bold;
  color: var(--purple);
}
</style>
