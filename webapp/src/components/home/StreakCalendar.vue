<template>
  <!-- Ports calendar_displayWidget() + calendar_showFullModal(): a seven-dot
       streak strip that opens the full 30-day reward track. All `.calendar-*`
       classes are owned by style.css. -->
  <div v-if="loaded">
    <button class="calendar-widget sc-widget" @click="open = true">
      <div class="calendar-header">
        <span class="calendar-title">📅 Day {{ streak }} Streak</span>
        <span v-if="next" class="calendar-next">
          Next: {{ next.pp_reward }} PP<template v-if="next.skin_keys > 0"> + {{ next.skin_keys }} 🔑</template>
        </span>
      </div>
      <div class="calendar-dots">
        <span v-for="i in 7" :key="i" class="dot" :class="dotClass(i)">{{ i <= streak ? '✓' : i }}</span>
      </div>
    </button>

    <Teleport to="body">
      <div v-if="open" class="modal-overlay calendar-modal-overlay" @click.self="open = false">
        <div class="modal-content calendar-modal">
          <div class="sc-modal-head">
            <h2 class="sc-modal-title">📅 30-Day Login Calendar</h2>
            <button class="modal-close" aria-label="Close" @click="open = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="calendar-streak-display">Current Streak: <strong>{{ streak }} days</strong></div>
            <div class="calendar-grid">
              <div v-for="i in 30" :key="i" class="calendar-day" :class="dayClass(i)">
                <div class="day-number">Day {{ i }}</div>
                <div v-if="reward(i)" class="day-reward">
                  <div class="reward-pp">{{ reward(i).pp_reward }} PP</div>
                  <div v-if="reward(i).skin_keys > 0" class="reward-keys">{{ reward(i).skin_keys }} 🔑</div>
                  <div v-if="reward(i).is_milestone" class="reward-milestone">⭐ {{ reward(i).milestone_title }}</div>
                </div>
                <div v-if="i <= streak" class="day-status">✓ Claimed</div>
                <div v-else-if="i === streak + 1" class="day-status current-day">← Today</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { loginCalendarService } from '../../services/LoginCalendarService.js'

const open = ref(false)
const loaded = ref(false)

const streak = computed(() => loginCalendarService.streak())
const next = computed(() => loginCalendarService.nextReward())
const reward = (day) => loginCalendarService.rewardForDay(day)

function dotClass(i) {
  const r = reward(i)
  return {
    completed: i <= streak.value,
    active: i === streak.value + 1,
    milestone: !!(r && r.is_milestone)
  }
}

function dayClass(i) {
  const r = reward(i)
  return {
    completed: i <= streak.value,
    current: i === streak.value + 1,
    milestone: !!(r && r.is_milestone)
  }
}

// Legacy's modal had no Escape handling and no scroll lock — it was a bare div
// appended to <body> with only an ✕ to close it.
function onKey(e) { if (e.key === 'Escape') open.value = false }
watch(open, (isOpen) => { document.body.style.overflow = isOpen ? 'hidden' : '' })

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  await loginCalendarService.load()
  loaded.value = true
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
// `.calendar-widget` is a <button> here rather than legacy's clickable div, so
// the browser's button chrome has to go.
.sc-widget {
  width: 100%;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
}

// Named off "…header": the global `[class*="header"]` rule forces
// `justify-content: space-between !important` on the container and
// `display: inline-flex !important` on its children, which would put the title
// and the close button on one flattened line. `.calendar-header` above is
// legacy's own class and is left as-is, since space-between is what it wants.
.sc-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.sc-modal-title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--purple);
}
</style>
