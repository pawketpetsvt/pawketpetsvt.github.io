<template>
  <!-- Ports todayCard_render() — "Today in PawketPets", the Home page's status
       board. All `.today-card*` classes are owned by style.css.

       Two of legacy's sections are absent because their systems are not
       migrated — the mini-season banner and the featured community goal. Legacy
       renders both conditionally, so their absence is a state the card already
       handles. -->
  <div class="today-card">
    <div class="today-card-title">🌟 Today in PawketPets</div>

    <div v-if="liveCount || onlineCount !== null" class="today-card-section today-card-section-live">
      <div class="today-card-row today-card-row-meta">
        <div v-if="liveCount" class="today-card-live">
          🔴 {{ liveCount }} team member{{ liveCount === 1 ? '' : 's' }} live right now!
        </div>
        <div v-if="onlineCount !== null" class="today-card-online">
          🟢 <strong>{{ onlineCount }}</strong> player{{ onlineCount === 1 ? '' : 's' }} online in the last hour
        </div>
      </div>
    </div>

    <div class="today-card-section">
      <div class="today-card-row today-card-row-split">
        <div class="today-card-col">
          <div class="today-card-weather">
            <template v-if="weather">
              <span class="today-card-icon">{{ weather.icon }}</span>
              <strong>{{ weather.name }}</strong>: {{ weather.effect }}
            </template>
            <template v-else>Loading weather...</template>
          </div>
        </div>
        <div class="today-card-col">
          <div class="today-card-streak">
            🔥 <strong>{{ streak }} day streak</strong>
            <template v-if="nextMilestone">
              &nbsp;·&nbsp; next milestone: <strong>Day {{ nextMilestone }}</strong>{{ milestoneIcon }}
            </template>
            <template v-else> 🏆 Max streak legend!</template>
          </div>
        </div>
      </div>
    </div>

    <!-- Beta Integrity — world-state corruption, inverted. The two rituals are
         the only way a player can deliberately move it; everything else shifts
         it as a side-effect of boss kills. -->
    <div v-if="integrity !== null" class="today-card-section today-card-section-world mt-2">
      <div class="today-card-worldstate">
        🖥️ Beta Integrity: {{ integrity }}%. {{ integrityDesc }}
        <button class="tc-integrity-info" title="What is this?" @click="explainIntegrity">❓</button>
        <div class="today-card-ritual-buttons">
          <div class="tc-ritual-note">Each ritual shifts integrity by ~1%</div>
          <button class="today-card-ritual-btn purify" :disabled="ritualBusy"
            title="Spend 100 PP to raise Beta Integrity by ~1%" @click="ritual('purify')">
            🛠️ Debug (+1% · 100 PP)
          </button>
          <button class="today-card-ritual-btn corrupt" :disabled="ritualBusy"
            title="Spend 100 PP to lower Beta Integrity by ~1%" @click="ritual('corrupt')">
            💀 Break It (−1% · 100 PP)
          </button>
        </div>
      </div>
    </div>

    <div class="today-card-section today-card-section-stats">
      <div class="today-card-stats">
        ⚔️ {{ stats.battles_won || 0 }} battles won &nbsp;•&nbsp;
        👑 {{ stats.bosses_killed || 0 }} bosses defeated &nbsp;•&nbsp;
        🐾 {{ stats.pets_adopted || 0 }} pets adopted today
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../../AppState.js'
import { supabase } from '../../services/SupabaseService.js'
import { newsTickerService } from '../../services/NewsTickerService.js'
import { weatherService, weatherState } from '../../services/WeatherService.js'
import { liveStreamers } from '../../services/StreamStatusService.js'
import { worldStateService } from '../../services/WorldStateService.js'
import { toastService } from '../../services/ToastService.js'

const stats = ref({})
const onlineCount = ref(null)
const integrity = ref(null)
const ritualBusy = ref(false)

const integrityDesc = computed(() =>
  integrity.value === null ? '' : worldStateService.describeIntegrity(integrity.value))

function explainIntegrity() {
  toastService.info('🖥️ Beta Integrity: Measures simulation stability. As it degrades, something in the code... wakes up.')
}

async function ritual(direction) {
  ritualBusy.value = true
  try {
    const next = await worldStateService.performRitual(direction)
    if (next !== null) integrity.value = next
  } finally {
    ritualBusy.value = false
  }
}

const weather = computed(() => weatherState.current)
const liveCount = computed(() => liveStreamers.value.length)
const streak = computed(() => (AppState.player && AppState.player.login_streak) || AppState.sidebarStats.streak || 0)

// Ports the milestone ladder: 3 / 5 / 7 / 14 / 30, then "max streak legend".
const MILESTONES = [3, 5, 7, 14, 30]
const nextMilestone = computed(() => MILESTONES.find(m => streak.value < m) || null)
const milestoneIcon = computed(() => {
  const m = nextMilestone.value
  if (m === 3) return ' 🍪'
  if (m === 5 || m === 7) return ' 🗝️'
  return ' 🌟'
})

// Ports getOnlinePlayerCount() — a head-only count of players seen in the last
// hour. Failure is silent, as in legacy: the row just doesn't render.
async function loadOnlineCount() {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .gte('last_login', since)
    if (error) throw error
    onlineCount.value = count || 0
  } catch (e) {
    onlineCount.value = null
  }
}

onMounted(async () => {
  // The news ticker already caches daily_stats per calendar day, so asking it
  // costs nothing if the ticker has loaded — the same sharing legacy relies on.
  newsTickerService.loadDailyStats().then(s => { stats.value = s || {} }).catch(() => { })
  if (!weatherState.loaded) weatherService.init().catch(() => { })
  loadOnlineCount()

  // Legacy wraps this whole block in try/catch and renders nothing on failure,
  // so an unreachable world_state_flags table hides the row rather than
  // breaking the card.
  worldStateService.corruption()
    .then(c => { integrity.value = worldStateService.integrityFrom(c) })
    .catch(() => { integrity.value = null })
})
</script>

<style lang="scss" scoped>
// `.today-card-worldstate`, `.today-card-ritual-buttons` and
// `.today-card-ritual-btn` are owned by style.css. The tooltip button and the
// ritual note have no rule anywhere — legacy styled the note inline and gave
// `.beta-integrity-tooltip` no definition at all — so they live here.
.tc-integrity-info {
  border: none;
  background: none;
  padding: 0 0 0 4px;
  font-size: 0.85rem;
  line-height: 1;
  cursor: help;
  color: inherit;
  opacity: 0.75;

  &:hover {
    opacity: 1;
  }
}

.tc-ritual-note {
  font-size: 0.72rem;
  color: var(--text-light);
  margin-bottom: 4px;
}

.today-card-ritual-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
