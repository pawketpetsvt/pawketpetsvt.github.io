<template>
  <div class="game-card">
    <div class="game-title">Guess the Number</div>
    <div class="game-desc">Guess a number between 1 and 100. 6 tries — the fewer guesses, the more PP!</div>
    <span class="game-reward">Up to 100 PP if correct</span>
    <div class="game-area">
      <div v-if="onCooldown" class="cooldown-msg">Already played today! Come back tomorrow.</div>
      <div v-else>
        <input type="number" class="guess-input" v-model="guessValue" min="1" max="100" placeholder="?" @keyup.enter="makeGuess" />
        <br /><br />
        <button class="btn btn-primary" @click="makeGuess">Guess!</button>
        <div class="attempts-left">{{ guessesLeft }} guess{{ guessesLeft === 1 ? '' : 'es' }} remaining</div>
        <div v-if="hotCold" class="guess-hotcold" :style="{ color: hotColdColor }">{{ hotCold }}</div>
      </div>
      <div class="game-result" :style="{ color: resultColor }">{{ resultText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { minigamesService } from '../../services/MinigamesService.js'
import { GUESS_PP_REWARDS } from '../../data/minigamesData.js'

const onCooldown = ref(true)
const secretNumber = ref(0)
const guessesLeft = ref(6)
const guessAttempts = ref(0)
const guessValue = ref('')
const hotCold = ref('')
const hotColdColor = ref('')
const resultText = ref('')
const resultColor = ref('')

function initGuess() {
  secretNumber.value = Math.floor(Math.random() * 100) + 1
  guessesLeft.value = 6
  guessAttempts.value = 0
  guessValue.value = ''
  hotCold.value = ''
  resultText.value = ''
}

async function makeGuess() {
  if (onCooldown.value) return
  const guess = parseInt(guessValue.value)
  if (!guess || guess < 1 || guess > 100) {
    resultText.value = 'Enter a number 1-100!'
    resultColor.value = '#ff6eb4'
    return
  }

  guessesLeft.value--
  guessAttempts.value++

  if (guess === secretNumber.value) {
    const earned = GUESS_PP_REWARDS[Math.min(guessAttempts.value - 1, 5)]
    await minigamesService.completeGame('guess', earned, 'guess_game')
    hotCold.value = ''
    resultText.value = 'Correct in ' + guessAttempts.value + ' guess' + (guessAttempts.value === 1 ? '' : 'es') + '! +' + earned + ' PP! 🎯'
    resultColor.value = '#5dde7a'
    onCooldown.value = true
  } else if (guessesLeft.value === 0) {
    await minigamesService.completeGame('guess', 5, 'guess_consolation')
    hotCold.value = ''
    resultText.value = 'The number was ' + secretNumber.value + '. +5 PP consolation.'
    resultColor.value = '#ff6eb4'
    onCooldown.value = true
  } else {
    const diff = Math.abs(guess - secretNumber.value)
    const direction = guess < secretNumber.value ? 'Too low! ⬆️' : 'Too high! ⬇️'
    hotCold.value = diff <= 5 ? '🔥 Hot!' : diff <= 15 ? '♨️ Warm' : diff <= 30 ? '🌡️ Cool' : '🧊 Cold'
    hotColdColor.value = diff <= 5 ? '#ff4444' : diff <= 15 ? '#ff9900' : diff <= 30 ? '#5dde7a' : '#88bbff'
    resultText.value = direction + ' ' + guessesLeft.value + ' left.'
    resultColor.value = '#ff9f43'
    guessValue.value = ''
  }
}

onMounted(async () => {
  onCooldown.value = await minigamesService.isOnCooldown('guess')
  if (!onCooldown.value) initGuess()
})
</script>

<style lang="scss" scoped>
// The field already has `text-align: center` from the root style.css; the
// value only *looked* off-centre because the number-input spinner arrows
// occupy the right edge of the control, so the usable text box is narrower
// than the visible box. Removing the spinners centres both the value and the
// placeholder, and is what was wanted visually anyway.
//
// The two rules are kept separate deliberately: an unrecognised pseudo-element
// invalidates an entire selector list, so pairing the -webkit- spin buttons
// with a -moz- selector would silently break the rule in both engines.
.guess-input {
  appearance: textfield; // Firefox + spec-compliant engines
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    appearance: none;
    -webkit-appearance: none;
    margin: 0;
  }
}

.guess-hotcold {
  font-weight: 700;
  font-size: 0.85rem;
  margin-top: 4px;
}
</style>
