<template>
  <!-- Ports todayCard_render() — "Today in PawketPets", the Home page's status
       board. All `.today-card*` classes are owned by the global stylesheet.

       Both of legacy's previously-absent sections are live as of Phase 9.5:
       the mini-season banner and the featured community goal. Legacy renders
       both conditionally, so each still hides itself when nothing is running. -->
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

    <!-- Mini-season banner. `.today-card-season` is legacy's own rule for
         exactly this row — a gradient pill — and had been sitting unused in
         the global stylesheet the whole time the system was unmigrated. -->
    <div v-if="seasons.length" class="mt-2">
      <div v-for="s in seasons" :key="s.season_key" class="today-card-season">
        {{ s.icon || '🎪' }} <strong>{{ s.name || s.season_key }}</strong>
        <span v-if="s.description"> — {{ s.description }}</span>
      </div>
    </div>

    <!-- Featured community goal: the one closest to completion. -->
    <div v-if="featuredGoal" class="today-card-stats tc-goal mt-2 px-tight py-2 rounded-1">
      <div class="tc-goal-title">🌍 {{ featuredGoal.title }}</div>
      <div class="tc-goal-bar rounded-5 overflow-hidden mt-1 mb-px2">
        <div class="tc-goal-fill h-100 rounded-5" :style="{ width: goalPct + '%' }"></div>
      </div>
      <div class="tc-goal-meta">
        {{ (featuredGoal.current_progress || 0).toLocaleString() }} /
        {{ featuredGoal.goal_target.toLocaleString() }} ({{ goalPct }}%)
      </div>
    </div>

    <!-- Beta Integrity — world-state corruption, inverted. The two rituals are
         the only way a player can deliberately move it; everything else shifts
         it as a side-effect of boss kills. -->
    <div v-if="integrity !== null" class="today-card-section today-card-section-world mt-2">
      <div class="today-card-worldstate">
        🖥️ Beta Integrity: {{ integrity }}%. {{ integrityDesc }}
        <button class="tc-integrity-info p-0 ps-1" title="What is this?" @click="explainIntegrity">❓</button>
        <!-- The once-per-day limit is enforced by `perform_corruption_ritual`
             (`user_corruption_ritual.last_ritual_date`) but was stated nowhere,
             so a second attempt just returned an error the player had no way to
             anticipate.

             This note sits OUTSIDE `.today-card-ritual-buttons` deliberately.
             That element is `display: flex` (legacy style.css:5724), so as a child the
             note became a third flex item and took a share of the row — leaving
             each button about a third of the width, at which point their labels
             broke into a vertical stack. It is a caption for the row, not an
             item in it. -->
        <div class="tc-ritual-note mb-1">Each ritual shifts integrity by 1% · once per day</div>
        <div class="today-card-ritual-buttons">
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
import { communityGoalService } from '../../services/CommunityGoalService.js'
import { miniSeasonService } from '../../services/MiniSeasonService.js'

const stats = ref({})
const onlineCount = ref(null)
const integrity = ref(null)
const seasons = ref([])
const featuredGoal = ref(null)

// Legacy surfaces the goal CLOSEST to completion (main:14277-14284).
const goalPct = computed(() =>
  featuredGoal.value ? Math.round(communityGoalService.percent(featuredGoal.value)) : 0)
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

  miniSeasonService.active().then(s => { seasons.value = s || [] }).catch(() => {})
  communityGoalService.loadGoals().then(goals => {
    if (!goals || !goals.length) return
    featuredGoal.value = goals.slice().sort((a, b) =>
      communityGoalService.percent(b) - communityGoalService.percent(a))[0]
  }).catch(() => {})
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.today-card {
  background: linear-gradient(135deg, #f3ecff, #ffffff);
  border: 3px solid #9966ff;
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  margin: 20px 0;
  box-shadow: 0 4px 12px rgba(153, 102, 255, 0.2);
}
.today-card-title {
  font-family: 'Fredoka One', cursive;
  font-size: 1.15rem;
  color: #7a3fd6;
  margin-bottom: 10px;
}
.today-card-weather, .today-card-stats, .today-card-live {
  font-size: 0.92rem;
  color: var(--text);
  padding: 6px 0;
}
.today-card-season {
  font-size: 0.92rem;
  color: var(--text);
  padding: 8px 12px;
  margin-bottom: 8px;
  background: linear-gradient(135deg, rgba(255, 102, 204, 0.12), rgba(153, 102, 255, 0.12));
  border: 1px solid rgba(153, 102, 255, 0.3);
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.today-card-season:hover { transform: scale(1.01); }
.today-card-worldstate {
  font-size: 0.88rem;
  font-style: italic;
  color: #b899ff;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: rgba(153, 102, 255, 0.06);
  border-left: 3px solid #9966ff;
  border-radius: 8px;
}
.today-card-ritual-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  font-style: normal;
}
.today-card-ritual-btn {
  flex: 1;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  transition: transform 0.15s ease;
}
.today-card-ritual-btn:hover { transform: scale(1.03); }
.today-card-ritual-btn.purify {
  background: linear-gradient(135deg, #ffe89e, #fff6d9);
  color: #8a6d00;
}
.today-card-ritual-btn.corrupt {
  background: linear-gradient(135deg, #4a3466, #6b4a8e);
  color: #f0e0ff;
}
.today-card-icon { font-size: 1.1rem; }
.today-card-live {
  color: #e0245e;
  font-weight: 600;
}
body.night-mode .today-card { background: rgba(255,255,255,0.04) !important; }
@media (max-width: 768px) {
  .today-card { padding: 12px !important; }
}

// The season banner and featured-goal rows are new to this card in the Vue app;
// the global stylesheet has no rule for either, so they are defined here.

.tc-goal { background: rgba(153, 102, 255, 0.06); }

.tc-goal-title { font-size: 0.82rem; font-weight: 700; color: var(--purple-dark); }

// 8px is the bar's drawn thickness, not a spacing step.
.tc-goal-bar {
  background: rgba(153, 102, 255, 0.15);
  height: 8px;
}

.tc-goal-fill {
  background: linear-gradient(90deg, var(--purple), var(--pink));
}

.tc-goal-meta { font-size: 0.72rem; color: var(--text-light); }

// `.today-card-worldstate`, `.today-card-ritual-buttons` and
// `.today-card-ritual-btn` are owned by the global stylesheet. The tooltip button and the
// ritual note have no rule anywhere — legacy styled the note inline and gave
// `.beta-integrity-tooltip` no definition at all — so they live here.
.tc-integrity-info {
  border: none;
  background: none;
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
}

.today-card-ritual-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
