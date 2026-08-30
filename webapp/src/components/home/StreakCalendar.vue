<template>
  <!-- Ports calendar_displayWidget() + calendar_showFullModal(): a seven-dot
       streak strip that opens the full 30-day reward track. All `.calendar-*`
       classes are owned by the global stylesheet. -->
  <div v-if="loaded">
    <button class="calendar-widget sc-widget w-100" @click="open = true">
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
          <!-- Utilities rather than a class, deliberately: any class name
               containing "header" is caught by the global `[class*="header"]`
               rule, which forces `justify-content: space-between !important` on
               the container and `display: inline-flex !important` on its
               children — flattening the title and close button onto one line. -->
          <div class="d-flex align-items-center justify-content-between gap-px10 mb-tight">
            <h2 class="sc-modal-title m-0">📅 30-Day Login Calendar</h2>
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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
@media (max-width: 900px) {
  .modal-content {
    width: 95% !important;
    max-width: 95vw !important;
    margin: 10px !important;
    box-sizing: border-box !important;
  }
}
.night-mode .modal-content, body[data-theme="dark"] .modal-content {
  background: #2a2a3a !important;
  color: #ffffff !important;
}
.modal-content h1, .modal-content h2, .modal-content h3, .modal-content h4 { color: inherit !important; }
.calendar-widget {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}
.calendar-widget:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.calendar-title {
  font-size: 16px;
  font-weight: bold;
  color: #fbbf24;
}
.calendar-next {
  font-size: 14px;
  color: #cbd5e1;
}
.calendar-dots {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.dot.completed {
  background: #4ade80;
  color: white;
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
}
.calendar-modal {
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}
.calendar-streak-display {
  text-align: center;
  font-size: 20px;
  margin-bottom: 25px;
  padding: 15px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 12px;
  color: #fbbf24;
}
.calendar-streak-display strong { font-size: 24px; }
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  padding: 20px 0;
}
.calendar-day {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 15px;
  text-align: center;
  transition: all 0.3s ease;
}
.calendar-day:hover { background: rgba(255, 255, 255, 0.08); }
.calendar-day.completed {
  background: rgba(74, 222, 128, 0.1);
  border-color: #4ade80;
}
.calendar-day.current {
  background: rgba(251, 191, 36, 0.15);
  border-color: #fbbf24;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
}
.calendar-day.milestone {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%);
  border: 2px solid #f59e0b;
}
.day-number {
  font-weight: bold;
  font-size: 14px;
  color: #cbd5e1;
  margin-bottom: 10px;
}
.day-reward { margin: 10px 0; }
.reward-pp {
  font-size: 16px;
  font-weight: bold;
  color: #fbbf24;
}
.reward-keys {
  font-size: 14px;
  color: #60a5fa;
  margin-top: 4px;
}
.reward-milestone {
  font-size: 12px;
  color: #f59e0b;
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(245, 158, 11, 0.2);
  border-radius: 6px;
}
.day-status {
  font-size: 12px;
  margin-top: 10px;
  padding: 4px 8px;
  border-radius: 6px;
}
.calendar-day.completed .day-status {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}
.current-day {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  font-weight: bold;
}
@media (max-width: 768px) {
  .calendar-dots {
    overflow-x: auto;
    justify-content: flex-start;
    padding-bottom: 8px;
  }
  .calendar-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }
}

// `.calendar-widget` is a <button> here rather than legacy's clickable div, so
// the browser's button chrome has to go.
// `.calendar-widget` is a <button> here rather than legacy's clickable div, so
// the browser's button chrome has to go.
.sc-widget {
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
}

.sc-modal-title {
  font-size: 1.1rem;
  color: var(--purple);
}
</style>
