<template>
  <!-- Ports renderEventCalendar() — the "This Week" strip. Every class here
       (`.event-calendar-widget`, `.event-cal-*`) is owned by the global stylesheet; only
       the per-day accent colours live inline, as they do in legacy, because
       they come from the data. -->
  <div class="event-calendar-widget">
    <div class="event-cal-header">📅 This Week</div>

    <div class="event-cal-strip">
      <button
        v-for="d in DAY_ORDER"
        :key="d"
        class="event-cal-day"
        :class="{ 'event-cal-today': d === today }"
        :title="`${EVENT_CALENDAR[d].name}: ${EVENT_CALENDAR[d].bonus}`"
        @click="announce(d)"
      >
        <div class="event-cal-day-label">{{ DAY_SHORT[d] }}</div>
        <div class="event-cal-day-icon">{{ EVENT_CALENDAR[d].icon }}</div>
      </button>
    </div>

    <div v-if="todayEvent" class="event-cal-today-banner"
      :style="{ borderColor: todayEvent.color, background: todayEvent.color + '18' }">
      <span class="ec-banner-icon">{{ todayEvent.icon }}</span>
      <div>
        <div class="ec-banner-name" :style="{ color: todayEvent.color }">{{ todayEvent.name }}</div>
        <div class="ec-banner-bonus">{{ todayEvent.bonus }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { EVENT_CALENDAR } from '../../data/homeData.js'
import { toastService } from '../../services/ToastService.js'

// Sunday-first, matching legacy's `[0,1,2,3,4,5,6]` and `Date#getDay()`.
const DAY_ORDER = [0, 1, 2, 3, 4, 5, 6]
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const today = new Date().getDay()
const todayEvent = computed(() => EVENT_CALENDAR[today])

// Legacy built this as an inline `onclick="showToast('…')"` string, which meant
// every apostrophe in a day name or bonus had to be stripped first. A handler
// needs no escaping.
function announce(d) {
  const ev = EVENT_CALENDAR[d]
  toastService.info(`${ev.icon} ${ev.name}: ${ev.bonus}`)
}
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.event-calendar-widget { padding: 2px 0 4px; }
.event-cal-header { font-weight: 700; font-size: 0.78rem; color: var(--purple-dark); margin-bottom: 8px; }
.event-cal-strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-bottom: 8px; }
.event-cal-day {
  text-align: center; padding: 4px 2px; border-radius: 6px;
  border: 1px solid var(--border); cursor: default;
  transition: transform 0.15s;
}
.event-cal-day:hover { transform: scale(1.08); z-index: 2; position: relative; }
.event-cal-today {
  background: rgba(153,102,255,0.12);
  border-color: var(--purple);
  box-shadow: 0 0 0 2px rgba(153,102,255,0.3);
}
.event-cal-day-label { font-size: 0.55rem; color: var(--text-light); margin-bottom: 2px; }
.event-cal-day-icon { font-size: 1rem; line-height: 1; }
.event-cal-today-banner {
  display: flex; align-items: center; gap: 10px;
  border: 2px solid; border-radius: 10px;
  padding: 8px 10px;
}

// `.event-cal-day` is a <button> here rather than legacy's clickable <div>, so
// it needs the browser's button chrome removed to look identical.
.event-cal-day {
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.ec-banner-icon { font-size: 1.3rem; }

.ec-banner-name {
  font-weight: 700;
  font-size: 0.82rem;
}

.ec-banner-bonus {
  font-size: 0.74rem;
  color: var(--text-light);
}
</style>
