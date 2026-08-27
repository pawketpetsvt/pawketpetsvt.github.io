<template>
  <!-- Ports loadDailyTip() — the "Did You Know?" box. -->
  <div class="daily-tip-box">
    <div class="daily-tip-header">💡 Did You Know?</div>
    <div class="daily-tip-content">{{ tip }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { DAILY_TIPS } from '../../data/homeData.js'

// Legacy stores the index in sessionStorage so the tip stays put while you
// navigate but changes on a full reload or in a new tab — deliberate, and worth
// keeping: a tip that re-rolled on every visit to Home would read as noise.
const KEY = 'dailyTipIndex'
const tip = ref('')

onMounted(() => {
  let i = -1
  try { i = parseInt(sessionStorage.getItem(KEY), 10) } catch (e) { i = -1 }
  if (!Number.isInteger(i) || i < 0 || i >= DAILY_TIPS.length) {
    i = Math.floor(Math.random() * DAILY_TIPS.length)
    try { sessionStorage.setItem(KEY, String(i)) } catch (e) { /* private mode */ }
  }
  tip.value = DAILY_TIPS[i]
})
</script>
