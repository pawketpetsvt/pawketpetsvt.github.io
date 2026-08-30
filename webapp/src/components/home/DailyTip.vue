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

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.daily-tip-box {
  background: linear-gradient(135deg, #fff9e6, #ffffff);
  border: 3px solid #ffa502;
  border-radius: var(--radius-lg);
  padding: 20px;
  margin: 20px 0;
  box-shadow: 0 4px 12px rgba(255, 165, 2, 0.2);
}
.daily-tip-header {
  font-family: 'Fredoka One', cursive;
  font-size: 1.2rem;
  color: #ff8800;
  margin-bottom: 12px;
  text-align: center;
}
.daily-tip-content {
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.6;
  text-align: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  font-style: italic;
}
body.night-mode .daily-tip-box {
  background: rgba(42, 36, 64, 0.95) !important;
  border: 3px solid #6644aa !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
}
body.night-mode .daily-tip-header {
  background: rgba(102, 68, 170, 0.6) !important;
  color: #e8d5ff !important;
}
body.night-mode .daily-tip-content { color: #e8d5ff !important; }
</style>
