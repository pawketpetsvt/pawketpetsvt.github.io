<template>
  <div class="game-card">
    <div class="game-title">Lucky Dice</div>
    <div class="game-desc">Roll two dice once per day! Whatever you roll is how many PP you earn. Doubles = triple! Push your luck with Double or Nothing.</div>
    <span class="game-reward">Up to 36 PP per day</span>
    <div class="game-area">
      <div class="dice-wrap">
        <div class="die" :class="{ rolling: isRolling }">{{ die1 }}</div>
        <div class="die" :class="{ rolling: isRolling }">{{ die2 }}</div>
      </div>
      <div v-if="onCooldown" class="cooldown-msg">Already played today! Come back tomorrow.</div>
      <template v-else>
        <div v-if="showDonBtns" class="don-btns">
          <button class="btn btn-primary don-btn" @click="takeIt">💰 Take {{ currentEarned }} PP</button>
          <button class="btn don-btn don-btn-risk" @click="doubleOrNothing">🎲 Double or Nothing!</button>
        </div>
        <button v-else class="btn btn-primary" :disabled="isRolling || rollCount >= 4" @click="roll">Roll the Dice!</button>
      </template>
      <div class="game-result" :style="{ color: resultColor }">{{ resultText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { minigamesService } from '../../services/MinigamesService.js'

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

const die1 = ref(DICE_FACES[0])
const die2 = ref(DICE_FACES[0])
const isRolling = ref(false)
const resultText = ref('')
const resultColor = ref('')
const onCooldown = ref(true)
const showDonBtns = ref(false)
const currentEarned = ref(0)
const doubleOrNothingActive = ref(false)
const rollCount = ref(0)

onMounted(async () => { onCooldown.value = await minigamesService.isOnCooldown('dice') })

async function roll() {
  if (onCooldown.value || isRolling.value) return
  isRolling.value = true
  showDonBtns.value = false
  resultText.value = ''

  const flicker = setInterval(() => {
    die1.value = DICE_FACES[Math.floor(Math.random() * 6)]
    die2.value = DICE_FACES[Math.floor(Math.random() * 6)]
  }, 100)

  setTimeout(() => finishRoll(flicker), 1200)
}

async function finishRoll(flicker) {
  clearInterval(flicker)
  isRolling.value = false
  const v1 = Math.floor(Math.random() * 6) + 1
  const v2 = Math.floor(Math.random() * 6) + 1
  die1.value = DICE_FACES[v1 - 1]
  die2.value = DICE_FACES[v2 - 1]
  const total = v1 + v2
  const isDouble = v1 === v2
  rollCount.value++

  if (doubleOrNothingActive.value && (v1 === 1 || v2 === 1)) {
    resultText.value = '💀 Rolled a 1! Lost everything! +0 PP'
    resultColor.value = '#ff4444'
    currentEarned.value = 0
    await minigamesService.completeGame('dice', 0, 'dice_roll')
    onCooldown.value = true
    return
  }

  let earned = isDouble ? total * 3 : total
  if (doubleOrNothingActive.value) earned = currentEarned.value * 2
  currentEarned.value = earned

  const rollDesc = isDouble ? 'DOUBLE ' + v1 + 's!' : v1 + '+' + v2 + '=' + total
  resultText.value = rollDesc + ' | Bank: ' + earned + ' PP'
  resultColor.value = isDouble ? '#b06aff' : '#5dde7a'

  if (rollCount.value < 4) {
    showDonBtns.value = true
    doubleOrNothingActive.value = true
  } else {
    await takeIt()
  }
}

async function takeIt() {
  showDonBtns.value = false
  await minigamesService.completeGame('dice', currentEarned.value, 'dice_roll')
  resultText.value = 'Collected! +' + currentEarned.value + ' PP! 💰'
  resultColor.value = '#5dde7a'
  onCooldown.value = true
}

function doubleOrNothing() {
  resultText.value = 'Going for double! 🎲'
  showDonBtns.value = false
  doubleOrNothingActive.value = true
  setTimeout(roll, 400)
}
</script>

<style lang="scss" scoped>
.die.rolling {
  animation: dice-shake 0.1s linear infinite;
}

@keyframes dice-shake {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
}

// Overrides the global #dice-don-btns rule's display:none default —
// scoped here rather than left as an inline style override.
.don-btns {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.don-btn {
  flex: 1;
  font-size: 0.8rem;
}

.don-btn-risk {
  background: #cc0000;
  color: #fff;
}
</style>
