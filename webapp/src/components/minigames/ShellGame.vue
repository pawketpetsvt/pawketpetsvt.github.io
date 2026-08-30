<template>
  <div class="game-card">
    <div class="game-title">🥚 Shell Game</div>
    <div class="game-desc">Follow the egg! 3 rounds, guess correctly all 3 times to win 30 PP!</div>
    <span class="game-reward">Up to 30 PP per day</span>
    <div class="game-area">
      <div v-if="onCooldown" class="cooldown-msg">Already played today! Come back tomorrow.</div>
      <template v-else-if="playing">
        <div class="shell-stats">Round: <strong>{{ round }}</strong>/3</div>
        <div class="shell-row-wrap">
          <div
            v-for="shell in shells"
            :key="shell.id"
            class="shell position-absolute d-flex align-items-center justify-content-center"
            :class="{ shuffle: shuffling }"
            :style="{ left: shell.slotIndex * SLOT_WIDTH + 'px' }"
            @click="guess(shell.id)"
          >
            <span class="shell-glyph">{{ shell.glyph }}</span>
            <span v-if="shell.sparkle" class="shell-sparkle position-absolute">✨</span>
          </div>
        </div>
      </template>
      <button v-else class="btn btn-primary" @click="start">Start Shuffle!</button>
      <div class="game-result" :style="{ color: resultColor }">{{ resultText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { minigamesService } from '../../services/MinigamesService.js'

const onCooldown = ref(true)
const playing = ref(false)
const shuffling = ref(false)
const round = ref(1)
const correctCount = ref(0)
const winningId = ref(0)
const resultText = ref('')
const resultColor = ref('')

// Position is driven declaratively by slotIndex (0/1/2) via a plain CSS
// `left` transition — deliberately not using <TransitionGroup>'s automatic
// FLIP-based move animation (which reorders DOM nodes and infers motion
// from before/after layout rects). That approach didn't render visible
// movement reliably here; binding `left` directly to a value that changes
// on every swap is simpler to reason about and guaranteed to animate.
//
// The "✨" reveal marker is a separately-positioned overlay span rather
// than being appended into the same text as the egg glyph (as game.js's
// '🥚✨' string did) — appending it widened that one shell's content to two
// glyphs, which either overlapped the neighboring slot or, once slots were
// widened to fit it, wrapped onto a second line and pushed that egg's
// vertical position out of alignment with the other two. Keeping the egg
// glyph single-character-wide at all times avoids both problems.
const SLOT_WIDTH = 92
const shells = ref([{ id: 0, slotIndex: 0, glyph: '🥚', sparkle: false }, { id: 1, slotIndex: 1, glyph: '🥚', sparkle: false }, { id: 2, slotIndex: 2, glyph: '🥚', sparkle: false }])

function resetShells() {
  shells.value = [{ id: 0, slotIndex: 0, glyph: '🥚', sparkle: false }, { id: 1, slotIndex: 1, glyph: '🥚', sparkle: false }, { id: 2, slotIndex: 2, glyph: '🥚', sparkle: false }]
}

function start() {
  if (onCooldown.value) return
  playing.value = true
  round.value = 1
  correctCount.value = 0
  resultText.value = ''
  resetShells()
  shuffleShells()
}

function shuffleShells() {
  if (shuffling.value) return
  shuffling.value = true
  winningId.value = Math.floor(Math.random() * 3)
  shells.value.forEach(s => { s.glyph = '🥚'; s.sparkle = s.id === winningId.value })

  setTimeout(() => {
    shells.value.forEach(s => { s.sparkle = false })
    let swapsLeft = 8
    const doSwap = () => {
      if (swapsLeft <= 0) { shuffling.value = false; return }
      const pos1 = Math.floor(Math.random() * 3)
      let pos2 = Math.floor(Math.random() * 3)
      while (pos2 === pos1) pos2 = Math.floor(Math.random() * 3)
      const s1 = shells.value.find(s => s.slotIndex === pos1)
      const s2 = shells.value.find(s => s.slotIndex === pos2)
      s1.slotIndex = pos2
      s2.slotIndex = pos1
      swapsLeft--
      setTimeout(doSwap, 300)
    }
    doSwap()
  }, 1000)
}

async function guess(id) {
  if (shuffling.value) return
  const shell = shells.value.find(s => s.id === id)
  const correct = id === winningId.value
  shell.glyph = correct ? '🥚' : '❌'
  shell.sparkle = correct

  if (correct) {
    correctCount.value++
    setTimeout(async () => {
      if (round.value < 3) {
        round.value++
        resetShells()
        shuffleShells()
      } else {
        await finish(30)
      }
    }, 1500)
  } else {
    setTimeout(async () => {
      if (round.value < 3) {
        resultText.value = 'Miss! Round ' + round.value + ' over.'
        resultColor.value = '#e74c3c'
        round.value++
        setTimeout(() => { resetShells(); shuffleShells() }, 1200)
      } else {
        const ppWon = correctCount.value >= 3 ? 30 : correctCount.value === 2 ? 20 : correctCount.value === 1 ? 10 : 0
        await finish(ppWon, true)
      }
    }, 1200)
  }
}

async function finish(ppWon, partial) {
  await minigamesService.completeGame('shell', ppWon, 'shell_game')
  if (partial) {
    resultText.value = correctCount.value + '/3 correct!' + (ppWon > 0 ? ' +' + ppWon + ' PP' : ' Better luck tomorrow!')
    resultColor.value = ppWon > 0 ? '#5dde7a' : '#e74c3c'
  } else {
    resultText.value = 'Perfect! +30 PP!'
    resultColor.value = '#5dde7a'
  }
  onCooldown.value = true
  playing.value = false
}

onMounted(async () => {
  onCooldown.value = await minigamesService.isOnCooldown('shell')
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.shell-stats {
  text-align: center;
  margin-bottom: 20px;
  font-size: 1.1rem;
}
.shell.shuffle { animation: shell-shuffle 0.4s ease-in-out; }

@keyframes shell-shuffle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.shell-row-wrap {
  position: relative;
  height: 84px;
  width: 276px; // 3 slots * 92px SLOT_WIDTH
  max-width: 100%;
  margin: 20px auto;
}

.shell {
  top: 0;
  width: 84px;
  height: 84px;
  transition: left 0.3s ease, transform 0.2s;
}

.shell-glyph {
  line-height: 1;
}

.shell-sparkle {
  top: -2px;
  right: 4px;
  font-size: 1.5rem;
  line-height: 1;
  pointer-events: none;
}
</style>
