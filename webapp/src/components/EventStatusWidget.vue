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
// Every .event-status-* and .esw-tooltip-* rule already exists in style.css and
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
