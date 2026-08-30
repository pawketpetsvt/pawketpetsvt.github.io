<template>
  <div class="game-card">
    <div class="game-title">🎰 Treasure Wheel</div>
    <div class="game-desc">Spin the wheel once per day! Land on prizes from 10 to 100 PP!</div>
    <span class="game-reward">10-100 PP per day</span>
    <div class="game-area">
      <div v-if="onCooldown" class="cooldown-msg">Already played today! Come back tomorrow.</div>
      <div v-else>
        <div class="position-relative d-inline-block">
          <canvas ref="canvasEl" width="300" height="300" class="d-block" :style="{ transform: 'rotate(' + rotation + 'deg)' }"></canvas>
          <div class="wheel-pointer position-absolute"></div>
        </div>
        <button class="btn btn-primary" :disabled="spinning" @click="spin">{{ spinning ? 'Spinning...' : 'Spin the Wheel!' }}</button>
      </div>
      <div class="game-result" :style="{ color: resultColor }">{{ resultText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { minigamesService } from '../../services/MinigamesService.js'
import { WHEEL_PRIZES } from '../../data/minigamesData.js'
import { wheelFinalRotation } from '../../utils/wheelGeometry.js'

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
  // A WHOLE number of turns. Legacy's `5 + Math.random() * 3` (main:8596) is
  // fractional, so `turns * 360` was not a whole number of revolutions and
  // added a uniformly random 0-360deg offset on top of the landing angle. Over
  // 20,000 simulated spins the award matched the slice under the pointer 9.6%
  // of the time, against 10% for pure chance — i.e. the wheel's result was
  // unrelated to where it stopped. See utils/wheelGeometry.js and
  // wheel-smoke.mjs, which assert the two agree.
  const turns = Math.floor(5 + Math.random() * 3)
  const totalRotation = wheelFinalRotation(winningIndex, WHEEL_PRIZES.length, turns)

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
  // The canvas lives inside `v-else`, so it does not exist in the DOM until
  // this flips onCooldown to false — and Vue applies that change on the next
  // tick. Drawing synchronously here found `canvasEl.value === null` and bailed
  // out via its own guard, leaving the wheel permanently blank. Introduced when
  // the cooldown check became async (Phase 4's server-side claim gating);
  // before that onCooldown was known synchronously and the canvas already
  // existed at mount.
  if (!onCooldown.value) {
    await nextTick()
    drawWheel()
  }
})
</script>

<style lang="scss" scoped>
// A downward-pointing marker (wide base up top, tip touching the wheel) —
// border-top (not border-bottom) puts the point at the bottom of the box.
.wheel-pointer {
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
