<template>
  <PetModal title="🗓️ 7-Day Forecast" width="700px" @close="$emit('close')">
    <div v-if="loading" class="text-center py-4">
      <div class="spinner"></div>
      <div class="fc-loading mt-2">Loading forecast…</div>
    </div>

    <template v-else>
      <!-- Today's detail panel -->
      <div v-if="days[0] && (days[0].weather || days[0].event)" class="fc-today rounded-4">
        <div class="fc-today-label mb-2">TODAY'S CONDITIONS</div>
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <div v-if="days[0].weather" class="d-flex align-items-center gap-2">
            <span class="fc-today-icon">{{ days[0].weather.icon }}</span>
            <div>
              <div class="fc-today-name">{{ days[0].weather.name }}</div>
              <div class="fc-today-desc">{{ days[0].weather.description }}</div>
            </div>
          </div>
          <div v-if="days[0].event" class="d-flex align-items-center gap-2 fc-today-event ps-3">
            <span class="fc-today-icon">{{ days[0].event.icon }}</span>
            <div>
              <div class="fc-today-name fc-event-name">{{ days[0].event.name }}</div>
              <div class="fc-today-desc">{{ days[0].event.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="fc-outlook-label mb-px10">7-DAY OUTLOOK</div>
      <div class="row row-cols-2 row-cols-sm-4 g-2">
        <div v-for="day in days" :key="day.dateStr" class="col">
          <div class="fc-day" :class="{ today: day.isToday }" :title="day.weather?.description || ''">
            <div class="fc-day-label" :class="{ today: day.isToday }">{{ day.label }}</div>
            <div class="fc-day-icon mb-1">{{ day.weather?.icon || '❓' }}</div>
            <div class="fc-day-name">{{ day.weather?.name || 'Unknown' }}</div>
            <div v-if="day.event" class="fc-day-event mt-px6 rounded-5 d-inline-block">
              {{ day.event.icon }} {{ day.event.name }}
            </div>
          </div>
        </div>
      </div>

      <div class="fc-footnote text-center mt-px14">Hover a day for details · Future forecasts may change</div>
    </template>
  </PetModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PetModal from './pet/PetModal.vue'
import { supabase } from '../services/SupabaseService.js'
import { weatherService, weatherState } from '../services/WeatherService.js'
import { worldEventState } from '../services/WorldEventService.js'
import { WEATHER_TYPES } from '../data/weatherData.js'

// Ports calendar_open / calendar_load / calendar_render (game.js:1141-1345) —
// the modal the navbar's event/weather badge opens.
//
// Today comes from the live services; scheduled days come from
// `scheduled_events`; anything still blank is filled by a DATE-SEEDED weighted
// pick, so every player sees the same forecast for a given day.
defineEmits(['close'])

const loading = ref(true)
const days = ref([])

const EVENT_TYPE_ICONS = {
  weather: '🌤️', bonus_event: '⚡', holiday: '🎉', streamer_birthday: '🎂'
}

// Ports calendarHash + deterministicWeatherPick. Weight-aware, so rarity still
// means something in the forecast.
function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function pickFor(dateStr, pool) {
  const total = pool.reduce((s, w) => s + (w.weight || 10), 0)
  let roll = hash(dateStr) % total
  for (const w of pool) {
    roll -= (w.weight || 10)
    if (roll < 0) return w
  }
  return pool[0]
}

function buildDays() {
  const now = new Date()
  const out = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    out.push({
      dateStr: d.toISOString().slice(0, 10),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      weather: null,
      event: null,
      isToday: i === 0
    })
  }
  return out
}

async function load() {
  const list = buildDays()

  // Today: the live services are the source of truth, since they are what the
  // rest of the site is actually running on right now.
  if (weatherState.current) list[0].weather = weatherState.current
  if (worldEventState.event) list[0].event = worldEventState.event

  // …unless `daily_features` names something different for today, which is the
  // shared row every player's weather is synced from.
  try {
    const { data } = await supabase
      .from('daily_features').select('weather').eq('date', list[0].dateStr).maybeSingle()
    if (data && data.weather) {
      const id = typeof data.weather === 'object' ? data.weather.id : data.weather
      const found = weatherService.byId(id)
      if (found) list[0].weather = found
    }
  } catch (e) { /* the table may not carry a row yet */ }

  try {
    const { data } = await supabase
      .from('scheduled_events').select('*')
      .gte('event_date', list[1].dateStr)
      .lte('event_date', list[6].dateStr)
      .order('event_date', { ascending: true })
    for (const row of data || []) {
      const day = list.find(d => d.dateStr === row.event_date)
      if (!day) continue
      if (row.event_type === 'weather') {
        const known = weatherService.byId(row.weather_id || row.event_id)
        day.weather = known || {
          id: row.weather_id || row.event_id,
          name: row.name, icon: row.icon || '🌤️', description: row.description || ''
        }
      } else {
        day.event = {
          id: row.event_id || row.id,
          name: row.name,
          icon: row.icon || EVENT_TYPE_ICONS[row.event_type] || '⚡',
          description: row.description || ''
        }
      }
    }
  } catch (e) { /* scheduled_events is optional */ }

  // Fill the gaps.
  //
  // `cursed` is excluded because legacy excludes it too — too rare to forecast.
  //
  // ONE deliberate departure: `starry` is excluded as well. Legacy decides
  // whether to offer it by reading the VIEWER'S CURRENT HOUR, so two players
  // looking at the same Thursday get different forecasts depending on their
  // clock and timezone — which breaks the "same seed = same forecast for all
  // players" guarantee legacy's own comment states. Starry Night is a
  // night-only condition and a card here stands for a whole day.
  const pool = WEATHER_TYPES.filter(w => w.id !== 'starry' && w.id !== 'cursed')
  for (let i = 1; i < list.length; i++) {
    if (list[i].weather) continue
    const picked = pickFor(list[i].dateStr, pool)
    list[i].weather = { ...picked, description: picked.description || 'Forecasted weather.' }
  }

  days.value = list
  loading.value = false
}

onMounted(load)
</script>

<style lang="scss" scoped>
// Legacy built this entire modal from inline styles inside an HTML string —
// there is no `.calendar-*` rule anywhere in the global stylesheet — so the component owns
// all of it. Values carried over unchanged.
.fc-loading {
  color: var(--text-light);
  font-size: 0.85rem;
}

.fc-today {
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.1), rgba(255, 102, 204, 0.06));
  border: 1px solid rgba(153, 102, 255, 0.2);
  padding: 14px 18px;
  margin-bottom: 18px;
}

.fc-today-label {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--purple);
  letter-spacing: 1px;
}

.fc-today-icon { font-size: 1.6rem; }
.fc-today-name { font-weight: 700; color: var(--purple-dark); }
.fc-event-name { color: #fbbf24; }
.fc-today-desc { font-size: 0.78rem; color: var(--text-light); }

.fc-today-event {
  border-left: 1px solid rgba(153, 102, 255, 0.2);
}

.fc-outlook-label {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--text-light);
  letter-spacing: 1px;
}

.fc-day {
  height: 100%;
  border-radius: 14px;
  padding: 14px 12px;
  text-align: center;
  border: 2px solid var(--border);
  background: rgba(255, 255, 255, 0.5);
  transition: transform 0.2s, box-shadow 0.2s;

  &.today {
    border-color: var(--purple);
    background: rgba(153, 102, 255, 0.08);
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 18px rgba(153, 102, 255, 0.15);
  }
}

.fc-day-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-light);
  margin-bottom: 6px;

  &.today { font-weight: 800; color: var(--purple); }
}

.fc-day-icon {
  font-size: 1.8rem;
}
.fc-day-name { font-size: 0.72rem; color: var(--purple-dark); font-weight: 600; }

.fc-day-event {
  padding: 3px 8px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  font-size: 0.75rem;
  color: #fbbf24;
  font-weight: 600;
}

.fc-footnote {
  font-size: 0.75rem;
  color: var(--text-light);
}
</style>
