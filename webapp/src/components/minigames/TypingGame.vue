<template>
  <div class="game-card">
    <div class="game-title">⌨️ Typing Challenge</div>
    <div class="game-desc">Type the words as fast as you can! 90s timer, 3 PP per correct word!</div>
    <span class="game-reward">Up to 90 PP per day</span>
    <div class="game-area">
      <div v-if="onCooldown" class="cooldown-msg">Already played today! Come back tomorrow.</div>
      <template v-else>
        <div class="typing-stats">
          <span>Time: <strong>{{ timeLeft }}</strong>s</span>
          <span>Score: <strong>{{ score }}</strong></span>
          <span>Earned: <strong>{{ earned }}</strong> PP</span>
        </div>
        <div class="typing-target">{{ playing ? currentWord : 'Click Start to begin!' }}</div>
        <input
          ref="inputEl"
          type="text"
          class="typing-input"
          v-model="typedValue"
          :disabled="!playing"
          placeholder="Type here..."
          @input="checkWord"
        />
        <button class="btn btn-primary" :disabled="playing" @click="start">{{ playing ? 'Playing...' : 'Start Game!' }}</button>
      </template>
      <div class="game-result" :style="{ color: resultColor }" v-html="resultHtml"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { minigamesService } from '../../services/MinigamesService.js'
import { TYPING_WORDS } from '../../data/minigamesData.js'

const onCooldown = ref(true)
const playing = ref(false)
const timeLeft = ref(90)
const score = ref(0)
const earned = ref(0)
const currentWord = ref('')
const typedValue = ref('')
const inputEl = ref(null)
const resultHtml = ref('')
const resultColor = ref('')

let timer = null
let highScore = 0
let ppCapReached = false

function nextWord() {
  currentWord.value = TYPING_WORDS[Math.floor(Math.random() * TYPING_WORDS.length)]
}

async function start() {
  if (onCooldown.value || playing.value) return
  playing.value = true
  score.value = 0
  earned.value = 0
  timeLeft.value = 90
  ppCapReached = false
  resultHtml.value = ''
  typedValue.value = ''
  nextWord()
  await nextTick()
  inputEl.value && inputEl.value.focus()

  timer = setInterval(() => {
    timeLeft.value--
    const currentEarned = score.value * 3
    if (currentEarned >= 90 && !ppCapReached) {
      ppCapReached = true
      resultHtml.value = '🎯 PP cap reached! Keep going for your high score!'
      resultColor.value = '#ffd700'
    }
    if (timeLeft.value <= 0) end()
  }, 1000)
}

function checkWord() {
  if (!playing.value || !currentWord.value) return
  if (typedValue.value === currentWord.value) {
    score.value++
    earned.value = Math.min(score.value * 3, 90)
    typedValue.value = ''
    nextWord()
  }
}

async function end() {
  clearInterval(timer)
  playing.value = false
  const finalEarned = Math.min(score.value * 3, 90)
  await minigamesService.completeGame('typing', finalEarned, 'typing_challenge')
  const newHigh = score.value > highScore
  if (newHigh) highScore = score.value
  resultHtml.value = "Time's up! <strong>" + score.value + ' words</strong> | +' + finalEarned + ' PP' +
    (newHigh ? ' <span class="new-best-badge">⭐ New Best!</span>' : '') +
    '<br><span class="session-best-note">Session best: ' + highScore + ' words</span>'
  resultColor.value = '#5dde7a'
  onCooldown.value = true
}

onMounted(async () => {
  onCooldown.value = await minigamesService.isOnCooldown('typing')
})

onUnmounted(() => clearInterval(timer))
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.typing-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
  font-size: 0.9rem;
}
.typing-target {
  background: var(--card-bg);
  border: 2px dashed var(--purple);
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  font-size: 1.8rem;
  font-weight: bold;
  text-align: center;
  color: var(--purple-dark);
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.typing-input {
  width: 100%;
  padding: 15px;
  font-size: 1.2rem;
  border: 2px solid var(--purple);
  border-radius: 12px;
  margin-bottom: 15px;
  text-align: center;
  font-family: 'Fredoka', cursive;
}
.typing-input:focus {
  outline: none;
  border-color: var(--pink);
  box-shadow: 0 0 0 3px rgba(255, 102, 204, 0.2);
}

.new-best-badge {
  color: #ffd700;
}

.session-best-note {
  font-size: 0.78rem;
  color: var(--text-light);
}
</style>
