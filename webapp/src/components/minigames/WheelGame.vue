<template>
  <div class="game-card">
    <div class="game-title">🎰 Treasure Wheel</div>
    <div class="game-desc">Spin the wheel once per day! Land on prizes from 10 to 100 PP!</div>
    <span class="game-reward">10-100 PP per day</span>
    <div class="game-area">
      <div v-if="onCooldown" class="cooldown-msg">Already played today! Come back tomorrow.</div>
      <div v-else>
        <div class="wheel-wrap">
          <canvas ref="canvasEl" width="300" height="300" class="wheel-canvas" :style="{ transform: 'rotate(' + rotation + 'deg)' }"></canvas>
          <div class="wheel-pointer"></div>
        </div>
        <button class="btn btn-primary" :disabled="spinning" @click="spin">{{ spinning ? 'Spinning...' : 'Spin the Wheel!' }}</button>
      </div>
      <div class="game-result" :style="{ color: resultColor }">{{ resultText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { minigamesService } from '../../services/MinigamesService.js'
import { WHEEL_PRIZES } from '../../data/minigamesData.js'

const onCooldown = ref(true)
const canvasEl = ref(null)
const spinning = ref(false)
const rotation = ref(0)
const resultText = ref('')
const resultColor = ref('')

function drawWheel() {
  const canvas = canvasEl.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const centerX = 150, centerY = 150, radius = 140
  const sliceAngle = (2 * Math.PI) / WHEEL_PRIZES.length

  WHEEL_PRIZES.forEach((prize, i) => {
    const startAngle = i * sliceAngle
    const endAngle = startAngle + sliceAngle
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, startAngle, endAngle)
    ctx.closePath()
    ctx.fillStyle = i % 2 === 0 ? '#9966ff' : '#ff66cc'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(startAngle + sliceAngle / 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 18px Fredoka'
    ctx.fillText(prize + ' PP', radius - 40, 5)
    ctx.restore()
  })
}

async function spin() {
  if (spinning.value || onCooldown.value) return
  spinning.value = true

  const winningIndex = Math.floor(Math.random() * WHEEL_PRIZES.length)
  const winningPrize = WHEEL_PRIZES[winningIndex]
  const rotations = 5 + Math.random() * 3
  const degreesPerSlice = 360 / WHEEL_PRIZES.length
  // Middle angle of the winning slice, measured clockwise from the canvas's
  // 0deg (3 o'clock / +x axis), matching ctx.arc()'s angle convention.
  const targetAngle = degreesPerSlice * winningIndex + degreesPerSlice / 2
  // The pointer sits at 12 o'clock, which is 270deg in that same clockwise-
  // from-3-o'clock convention (0=East, 90=South, 180=West, 270=North) — NOT
  // 0/360deg. The original game.js formula solved for the winning slice
  // landing at 0deg (East) while the pointer is drawn at the top, a mismatch
  // that made the awarded prize disagree with whatever slice visually ended
  // up under the pointer. Fixed here by targeting 270deg instead.
  let finalPosition = (270 - targetAngle) % 360
  if (finalPosition < 0) finalPosition += 360
  const totalRotation = rotations * 360 + finalPosition

  const startTime = Date.now()
  const duration = 4000

  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOut = 1 - Math.pow(1 - progress, 3)
    rotation.value = totalRotation * easeOut

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      finishSpin(winningPrize)
    }
  }
  animate()
}

async function finishSpin(winningPrize) {
  spinning.value = false
  await minigamesService.completeGame('wheel', winningPrize, 'treasure_wheel')
  resultText.value = 'You won ' + winningPrize + ' PP!'
  resultColor.value = '#5dde7a'
  onCooldown.value = true
}

onMounted(async () => {
  onCooldown.value = await minigamesService.isOnCooldown('wheel')
  if (!onCooldown.value) drawWheel()
})
</script>

<style lang="scss" scoped>
.wheel-wrap {
  position: relative;
  display: inline-block;
}

.wheel-canvas {
  display: block;
}

// A downward-pointing marker (wide base up top, tip touching the wheel) —
// border-top (not border-bottom) puts the point at the bottom of the box.
.wheel-pointer {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 25px solid #ffdd00;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
  z-index: 10;
  pointer-events: none;
}
</style>
