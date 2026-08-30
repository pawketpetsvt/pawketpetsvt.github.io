<template>
  <div
    class="event-status-widget"
    ref="widgetEl"
    :title="isEvent ? 'Active event — click for the 7-day forecast' : 'Today\'s weather — click for the 7-day forecast'"
    @mouseenter="showTip = true"
    @mouseleave="showTip = false"
    @click="openForecast"
  >
    <span class="event-status-icon">{{ icon }}</span>
    <span class="event-status-text">{{ shortName }}</span>
    <span class="event-status-dot" :class="isEvent ? 'event-active' : 'active'"></span>
  </div>

  <!-- Teleported so the fixed-position tooltip is never clipped by the navbar's
       own stacking context or overflow. Legacy appended it to <body> for the
       same reason. -->
  <Teleport to="body">
    <div v-if="showTip" class="esw-tooltip" :style="tipStyle">
      <div class="esw-tooltip-title">
        <span>{{ icon }}</span>
        <span>
          {{ name }}
          <span v-if="isEvent" class="esw-event-tag px-px6 py-px2 ms-1">EVENT</span>
        </span>
      </div>
      <div class="esw-tooltip-desc">{{ description }}</div>
      <div v-if="bonusLines.length" class="esw-tooltip-bonus">
        <div v-for="(line, i) in bonusLines" :key="i">{{ line }}</div>
      </div>
      <div v-if="timerText" class="esw-tooltip-timer">{{ timerText }}</div>
    </div>
  </Teleport>

  <ForecastModal v-if="showForecast" @close="showForecast = false" />
</template>

<script setup>
import { ref, computed } from 'vue'
import ForecastModal from './ForecastModal.vue'
import { weatherState } from '../services/WeatherService.js'
import { worldEventService, worldEventState } from '../services/WorldEventService.js'
import { WEATHER_BONUS_TEXT } from '../data/worldEventData.js'

// Ports the #event-status-widget navbar chrome (updateEventStatusWidget /
// esw_showTooltip / esw_showModal, game.js:1001-1360).
//
// Legacy stashed everything the tooltip needed in `dataset` attributes on the
// element and re-read them on hover, refreshing the whole thing on a 60-second
// timer. Both services are reactive, so the widget just reads them — no timer,
// no dataset round trip, and no chance of the tooltip disagreeing with the
// badge next to it.
//
// Priority is event over weather, as legacy has it: an event is rarer and
// carries the bigger bonuses.
const showTip = ref(false)
const showForecast = ref(false)
const widgetEl = ref(null)

const isEvent = computed(() => !!worldEventState.event)
const weather = computed(() => weatherState.current)

const icon = computed(() =>
  isEvent.value ? (worldEventState.event.icon || '🎪') : (weather.value?.icon || '☀️'))

const name = computed(() =>
  isEvent.value ? worldEventState.event.name : (weather.value?.name || 'Clear'))

// The badge is narrow, so a long event name is trimmed there but shown in full
// in the tooltip.
const shortName = computed(() =>
  name.value.length > 18 ? name.value.slice(0, 15) + '…' : name.value)

const description = computed(() =>
  isEvent.value
    ? (worldEventState.event.description || '')
    : (weather.value?.description || 'Normal conditions today.'))

const bonusLines = computed(() => {
  if (isEvent.value) return worldEventService.bonusLines()
  const text = WEATHER_BONUS_TEXT[weather.value?.id]
  return text ? text.split('\n') : []
})

const timerText = computed(() => {
  if (!isEvent.value) return ''
  const hours = worldEventService.hoursRemaining()
  if (hours === null) return ''
  if (hours <= 0) return '⏰ Ending soon!'
  return `⏰ ${hours} hour${hours === 1 ? '' : 's'} remaining`
})

// Ports the manual positioning in esw_showTooltip: centred under the widget and
// clamped to the viewport so it can't run off the right edge.
const TIP_WIDTH = 290
const tipStyle = computed(() => {
  const el = widgetEl.value
  if (!el) return { display: 'none' }
  const rect = el.getBoundingClientRect()
  const left = Math.max(8, Math.min(
    rect.left + rect.width / 2 - TIP_WIDTH / 2,
    window.innerWidth - TIP_WIDTH - 8
  ))
  return { top: `${rect.bottom + 8}px`, left: `${left}px` }
})

// esw_showModal() opens the 7-day calendar rather than a single-condition
// panel — its own comment says the older modal was replaced.
function openForecast() {
  showTip.value = false
  showForecast.value = true
}
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.event-status-widget {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 30px;
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-left: 8px;
  user-select: none;
}
.event-status-widget:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.4);
}
.event-status-icon {
  font-size: 1.2rem;
  line-height: 1;
}
.event-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
  flex-shrink: 0;
}
.event-status-dot.active {
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
  animation: esw-pulse 2s ease-in-out infinite;
}
.event-status-dot.event-active {
  background: #fbbf24;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.8);
  animation: esw-pulse-event 1.5s ease-in-out infinite;
}
.esw-tooltip {
  position: fixed;
  background: rgba(15, 10, 30, 0.96);
  backdrop-filter: blur(8px);
  color: #e8d5ff;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 0.85rem;
  z-index: 10002;
  pointer-events: none;
  max-width: 290px;
  border: 1px solid rgba(153, 102, 255, 0.4);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
}
.esw-tooltip-title {
  font-weight: bold;
  font-size: 1rem;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}
.esw-tooltip-desc {
  font-size: 0.82rem;
  opacity: 0.85;
  margin-bottom: 8px;
  line-height: 1.4;
}
.esw-tooltip-bonus {
  font-size: 0.8rem;
  color: #fbbf24;
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  line-height: 1.6;
}
.esw-tooltip-timer {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 6px;
}
body.night-mode .event-status-widget {
  background: rgba(0, 0, 0, 0.3);
  border-color: rgba(153, 102, 255, 0.4);
}
body.night-mode .event-status-widget:hover {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(153, 102, 255, 0.6);
}
@media (max-width: 900px) {
  .event-status-widget { padding: 6px 10px; }
}
@media (max-width: 700px) {
  .event-status-widget { display: none !important; }
}
@media (max-width: 768px) {
  .event-status-widget { padding: 4px 8px !important; font-size: 0.78rem !important; }
}

@keyframes esw-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.6; transform: scale(0.8); }
}

@keyframes esw-pulse-event {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.85; transform: scale(1.25); }
}

// Every .event-status-* and .esw-tooltip-* rule already exists in the global stylesheet and
// is left globally owned. The one exception is the small EVENT pill, which
// legacy wrote as an inline style inside its tooltip HTML string.
.esw-event-tag {
  font-size: 0.7rem;
  background: #fbbf2433;
  color: #fbbf24;
  // 6px sits below the radius scale, which starts at 8px.
  border-radius: 6px;
}
</style>
