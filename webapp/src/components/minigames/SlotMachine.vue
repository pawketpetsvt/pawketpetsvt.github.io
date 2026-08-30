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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.slot-bet-selector {
  margin-bottom: 20px;
  text-align: center;
}
.bet-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;
}
.bet-btn {
  padding: 10px 20px;
  border: 2px solid var(--purple-light);
  background: white;
  color: var(--purple);
  font-weight: bold;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.bet-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(176, 106, 255, 0.3);
}
.bet-btn.active {
  background: var(--purple);
  color: white;
  border-color: var(--purple);
  box-shadow: 0 4px 12px rgba(176, 106, 255, 0.4);
}
.slot-machine {
  display: flex;
  gap: 15px;
  justify-content: center;
  padding: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  margin: 20px 0;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}
.slot-reel {
  width: 80px;
  height: 80px;
  background: white;
  border: 4px solid #FFD700;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.1s;
}
.slot-reel.spinning { animation: reel-spin 0.1s infinite; }

@keyframes reel-spin {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.bet-label {
  font-weight: bold;
  color: var(--purple);
}
</style>
