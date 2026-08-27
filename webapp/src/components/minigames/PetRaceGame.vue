<template>
  <!-- Ports the Pet Racing mini-game (race_*). A wager on one simulated dash —
       distinct from the Racing tab, which is training, leagues and turn-by-turn
       play. Legacy attaches this to the Minigames tab through a
       `tabsLoaded['minigames']` monkey-patch. -->
  <div class="game-card">
    <div class="game-title">🏇 Pet Racing</div>
    <div class="game-desc">
      Back your pets against the field. Place 1st for up to 3× your stake, 2nd to break even,
      3rd for half back.
    </div>
    <div class="game-reward">🪙 {{ petRaceState.racesLeft }} / {{ RACE_DAILY_MAX }} races left today</div>

    <div v-if="!petRaceState.loaded" class="spinner"></div>

    <!-- ── results ──────────────────────────────────────────────────────── -->
    <template v-else-if="result">
      <div class="pr-result" :class="result.won ? 'pr-won' : 'pr-lost'">
        <div class="pr-result-icon">{{ result.won ? '🏆' : result.best && result.best.finishOrder <= 3 ? '🎖️' : '🏁' }}</div>
        <div class="pr-result-line">
          {{ result.best ? `${result.best.pet.nickname} finished ${ORDINALS[result.best.finishOrder - 1]}` : 'Race complete' }}
        </div>
        <div class="pr-result-pp" :class="{ 'pr-profit': result.profit > 0, 'pr-loss': result.profit < 0 }">
          {{ result.profit >= 0 ? '+' : '' }}{{ result.profit }} PP
        </div>
      </div>

      <ol class="pr-standings">
        <li v-for="r in result.runners" :key="r.pet.id" :class="{ 'pr-mine': !r.pet.isCpu }">
          {{ r.pet.emoji || '🐾' }} {{ r.pet.nickname }}
          <span class="pr-speed">spd {{ r.effectiveSpeed }}</span>
        </li>
      </ol>

      <button class="btn btn-primary w-100" @click="result = null">
        {{ petRaceState.racesLeft > 0 ? '🏇 Race Again' : 'Done' }}
      </button>
    </template>

    <!-- ── setup ────────────────────────────────────────────────────────── -->
    <template v-else>
      <div v-if="petRaceState.tracks.length" class="pr-block">
        <div class="pr-label">Track</div>
        <div class="pr-chips">
          <button class="pr-chip" :class="{ 'pr-chip-on': !petRaceState.selectedTrack }"
            @click="petRaceState.selectedTrack = null">Any</button>
          <button v-for="t in petRaceState.tracks" :key="t.track_key" class="pr-chip"
            :class="{ 'pr-chip-on': petRaceState.selectedTrack === t.track_key }"
            :title="t.description || ''"
            @click="petRaceState.selectedTrack = t.track_key">{{ t.name || t.track_key }}</button>
        </div>
      </div>

      <div class="pr-block">
        <div class="pr-label">Your runners <span class="pr-hint">(up to 4 · {{ RACE_ENERGY_COST }} energy each)</span></div>
        <p v-if="!pets.length" class="pr-empty">
          No pets yet — <router-link to="/adopt">adopt one</router-link> to race!
        </p>
        <div v-else class="pr-chips">
          <button v-for="pet in pets" :key="pet.id" class="pr-chip"
            :class="{ 'pr-chip-on': picked.includes(pet.id), 'pr-chip-tired': tooTired(pet) }"
            :disabled="tooTired(pet) && !picked.includes(pet.id)"
            :title="tooTired(pet) ? 'Too tired to race' : ''"
            @click="toggle(pet.id)">
            {{ pet.nickname }}<span class="pr-chip-spd">{{ pet.base_speed || 4 }}</span>
          </button>
        </div>
      </div>

      <div class="pr-block">
        <div class="pr-label">Stake</div>
        <div class="pr-chips">
          <button v-for="b in RACE_BETS" :key="b" class="pr-chip"
            :class="{ 'pr-chip-on': bet === b }" :disabled="points < b" @click="bet = b">
            🪙 {{ b }}
          </button>
        </div>
      </div>

      <button class="btn btn-primary w-100" :disabled="!canRace || running" @click="race">
        {{ running ? 'Racing…' : `🏇 Race for ${bet} PP` }}
      </button>
      <p v-if="blockedReason" class="pr-blocked">{{ blockedReason }}</p>

      <!-- Ports race_renderWeeklyLeaderboard(). Weeks start on Sunday. -->
      <details class="pr-board">
        <summary class="pr-board-summary">🏆 This Week's Top Racers</summary>
        <div v-if="!leaders.length" class="pr-empty pr-board-empty">No wins recorded yet this week.</div>
        <ol v-else class="pr-standings pr-board-list">
          <li v-for="(row, i) in leaders" :key="i">
            {{ (row.user_pets && row.user_pets.nickname) || 'A pet' }}
            <span class="pr-speed">{{ row.wins_this_week }} win{{ row.wins_this_week === 1 ? '' : 's' }}</span>
          </li>
        </ol>
      </details>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../../AppState.js'
import {
  petRaceService, petRaceState, RACE_BETS, RACE_DAILY_MAX, RACE_ENERGY_COST
} from '../../services/PetRaceService.js'

const ORDINALS = ['1st', '2nd', '3rd', '4th']

const picked = ref([])
const bet = ref(RACE_BETS[0])
const running = ref(false)
const result = ref(null)
const leaders = ref([])

const pets = computed(() => AppState.ownedPets || [])
const points = computed(() => (AppState.player && AppState.player.pawketpoints) || 0)
const tooTired = (pet) => (pet.energy || 0) < RACE_ENERGY_COST

const pickedPets = computed(() => pets.value.filter(p => picked.value.includes(p.id)))

const blockedReason = computed(() => {
  if (petRaceState.racesLeft <= 0) return 'No races left today — come back tomorrow.'
  if (!picked.value.length) return 'Pick at least one runner.'
  if (points.value < bet.value) return `You need ${bet.value} PP for that stake.`
  return ''
})
const canRace = computed(() => !blockedReason.value)

// Up to four of your own pets; CPU runners fill any empty lanes.
function toggle(id) {
  if (picked.value.includes(id)) picked.value = picked.value.filter(x => x !== id)
  else if (picked.value.length < 4) picked.value = [...picked.value, id]
}

async function race() {
  running.value = true
  try {
    const r = await petRaceService.run(pickedPets.value, bet.value)
    if (r) {
      result.value = r
      loadLeaders()
    }
  } finally {
    running.value = false
  }
}

async function loadLeaders() {
  leaders.value = await petRaceService.weeklyLeaders()
}

onMounted(async () => {
  await petRaceService.load()
  loadLeaders()
})
</script>

<style lang="scss" scoped>
// `.game-card`, `.game-title`, `.game-desc` and `.game-reward` are the shared
// minigame classes owned by style.css; everything below is this game's own.
.pr-block { margin-bottom: 12px; }

.pr-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--purple-dark);
  margin-bottom: 6px;
}

.pr-hint {
  font-weight: 400;
  color: var(--text-light);
}

.pr-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pr-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 2px solid var(--border);
  border-radius: 20px;
  background: var(--white);
  font-size: 0.8rem;
  cursor: pointer;

  &.pr-chip-on {
    border-color: var(--purple);
    background: rgba(153, 102, 255, 0.14);
    font-weight: 700;
  }

  &.pr-chip-tired { opacity: 0.45; }
  &:disabled { cursor: not-allowed; }
}

.pr-chip-spd {
  font-size: 0.68rem;
  color: var(--text-light);
}

.pr-empty {
  font-size: 0.82rem;
  color: var(--text-light);
  margin: 0;
}

.pr-blocked {
  font-size: 0.76rem;
  color: var(--text-light);
  margin: 8px 0 0;
  text-align: center;
}

.pr-result {
  text-align: center;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 12px;
  background: rgba(153, 102, 255, 0.08);

  &.pr-won { background: rgba(93, 222, 122, 0.12); }
  &.pr-lost { background: rgba(0, 0, 0, 0.04); }
}

.pr-result-icon { font-size: 2rem; }

.pr-result-line {
  font-weight: 700;
  font-size: 0.9rem;
  margin: 4px 0;
}

.pr-result-pp {
  font-size: 1.2rem;
  font-weight: 800;

  &.pr-profit { color: #2e8b4f; }
  &.pr-loss { color: #e74c3c; }
}

.pr-standings {
  margin: 0 0 12px;
  padding-left: 22px;
  font-size: 0.82rem;

  li {
    padding: 2px 0;
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
}

.pr-mine { font-weight: 700; }

.pr-speed {
  color: var(--text-light);
  font-size: 0.72rem;
  flex-shrink: 0;
}

.pr-board {
  margin-top: 12px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.pr-board-summary {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--purple-dark);
  cursor: pointer;
}

.pr-board-empty { margin-top: 8px; }
.pr-board-list { margin-top: 8px; margin-bottom: 0; }
</style>
