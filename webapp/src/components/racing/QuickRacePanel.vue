<template>
  <!-- Ports racing_renderQuickRaceTab() / racing_renderRaceInProgress() /
       racing_playerAction(). Eight turns, four actions, first to 100. -->
  <div>
    <!-- ── setup ────────────────────────────────────────────────────────── -->
    <template v-if="!race">
      <h3 class="mb-px6">🏎️ Quick Race</h3>
      <p class="qr-sub mb-px14">
        Eight turns against {{ '3–4' }} streamer rivals. First past {{ RACING_FINISH_LINE }} wins.
      </p>

      <RacingPetSelector v-model="selectedId" />

      <div v-if="pet && racingState.stats">
        <div class="d-flex flex-wrap gap-2 mb-px10">
          <span v-for="(v, k) in derived" :key="k" class="qr-pill px-px10 py-1 rounded-5">
            {{ DERIVED_LABELS[k] }} <strong>{{ v }}</strong>
          </span>
        </div>
        <div class="qr-races-left mb-tight">
          Races left today: <strong>{{ racingState.racesLeft }}</strong> / {{ RACING_DAILY_RACES }}
        </div>
        <button class="btn btn-primary w-100" :disabled="racingState.racesLeft <= 0" @click="start">
          {{ racingState.racesLeft > 0 ? '🏁 Start Race' : 'No races left today' }}
        </button>
      </div>
    </template>

    <!-- ── in progress ──────────────────────────────────────────────────── -->
    <template v-else-if="!race.finished">
      <div class="qr-turn mb-px10">Turn {{ race.turn + 1 }} / {{ race.maxTurns }}</div>

      <div class="d-flex flex-column gap-px10 mb-px14">
        <div v-for="r in race.racers" :key="r.id" class="qr-lane px-px10 py-2 rounded-3"
          :class="{ 'qr-lane-player': r.isPlayer }">
          <div class="d-flex justify-content-between align-items-baseline gap-2 mb-1 qr-lane-head">
            <span class="text-truncate fw-bold">{{ r.emoji }} {{ r.isPlayer ? r.name + ' (you)' : shortName(r.name) }}</span>
            <span class="qr-lane-pos flex-shrink-0">{{ r.position }} / {{ RACING_FINISH_LINE }}</span>
          </div>
          <div class="qr-lane-track position-relative rounded-5">
            <div class="qr-lane-fill h-100 rounded-5" :style="{ width: pct(r.position) + '%' }"></div>
            <span class="qr-runner position-absolute" :style="{ left: pct(r.position) + '%' }">{{ r.emoji }}</span>
          </div>
          <div v-if="r.isPlayer" class="qr-lane-meta mt-1">
            🫁 Stamina {{ r.stamina }} / {{ r.maxStamina }}
            <span v-if="r.jostlePenalty > 0" class="qr-penalty">· −{{ r.jostlePenalty }} pace next turn</span>
          </div>
        </div>
      </div>

      <!-- Was `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`. Four
           actions in the ~740px panel resolved to four across, which is what
           `row-cols-md-4` reproduces; below md they stack two-up rather than
           one-up, matching the 140px floor. -->
      <div class="row row-cols-2 row-cols-md-4 g-2 mb-tight">
        <div v-for="a in ACTIONS" :key="a.key" class="col">
          <button class="qr-action w-100 h-100 px-tight py-px10 rounded-3 text-center"
            :disabled="!race.awaitingPlayerAction" :title="a.desc" @click="act(a.key)">
            <div class="qr-action-label fw-bold">{{ a.label }}</div>
            <div class="qr-action-desc">{{ a.desc }}</div>
          </button>
        </div>
      </div>

      <div class="qr-log rounded-3 px-px14 py-px10">
        <p v-for="(line, i) in recentLog" :key="i" class="m-0">{{ line }}</p>
      </div>
    </template>

    <!-- ── results ──────────────────────────────────────────────────────── -->
    <template v-else>
      <div class="text-center p-2">
        <div class="qr-result-icon">{{ playerRank === 1 ? '🏆' : playerRank <= 3 ? '🎖️' : '🏁' }}</div>
        <h2 class="mt-2 mb-px6">Race Complete!</h2>
        <div class="qr-place mb-px10">{{ PLACE_LABELS[playerRank - 1] || playerRank + 'th' }}</div>

        <div v-if="reward" class="qr-reward rounded-3 px-px14 py-px10 mb-tight">
          <div>🪙 <strong>+{{ reward.pp }} PP</strong></div>
          <div class="qr-reward-sub">+{{ reward.pts }} league point{{ reward.pts === 1 ? '' : 's' }}</div>
          <div v-if="reward.beatAll" class="qr-beat-all mt-1">
            🌟 Beat every streamer! +{{ reward.bonus }} PP bonus
          </div>
        </div>
        <div v-else class="qr-reward rounded-3 px-px14 py-px10 mb-tight"><div class="spinner"></div></div>

        <ol class="qr-standings text-start mb-px14 ps-4">
          <li v-for="r in ranked" :key="r.id" :class="{ 'fw-bold': r.isPlayer }">
            {{ r.emoji }} {{ r.isPlayer ? r.name + ' (you)' : shortName(r.name) }}
            <span class="qr-standing-pos float-end">{{ r.position }}</span>
          </li>
        </ol>

        <button class="btn btn-primary w-100" @click="reset">
          {{ racingState.racesLeft > 0 ? '🏁 Race Again' : 'Done' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import RacingPetSelector from './RacingPetSelector.vue'
import { AppState } from '../../AppState.js'
import { racingService, racingState } from '../../services/RacingService.js'
import { buildRace, takeTurn, results } from '../../services/RaceEngine.js'
import { toastService } from '../../services/ToastService.js'
import { RACING_FINISH_LINE, RACING_DAILY_RACES } from '../../data/racingData.js'

const ACTIONS = [
  { key: 'sprint', label: '💨 Sprint', desc: 'Full pace, costs 1 stamina' },
  { key: 'jostle', label: '💥 Jostle', desc: 'Slow the racer ahead, move at 60%' },
  { key: 'block', label: '🛡️ Block', desc: 'Blunt incoming jostles, +2 stamina' },
  { key: 'conserve', label: '😮‍💨 Conserve', desc: 'Recover 2 stamina, move at 60%' }
]
const DERIVED_LABELS = {
  pace: '💨 Pace', stamina: '🫁 Stamina',
  interference: '⚔️ Interference', resilience: '🛡️ Resilience'
}
const PLACE_LABELS = ['1st 🥇', '2nd 🥈', '3rd 🥉', '4th', '5th', '6th']

const race = ref(null)
const reward = ref(null)

const selectedId = computed({
  get: () => racingState.selectedPetId,
  set: (id) => racingService.selectPet(id)
})

const pet = computed(() => (AppState.ownedPets || []).find(p => p.id === racingState.selectedPetId) || null)
const derived = computed(() => racingService.calcStats(pet.value))

const ranked = computed(() => race.value ? results(race.value).ranked : [])
const playerRank = computed(() => race.value ? results(race.value).playerRank : 0)
// Last turn's lines only — the full log runs to ~40 entries over eight turns.
const recentLog = computed(() => race.value ? race.value.log.slice(-(race.value.racers.length)) : [])

const pct = (position) => Math.min(100, Math.round((position / RACING_FINISH_LINE) * 100))
const shortName = (name) => String(name).split("'")[0]

function start() {
  if (!pet.value || !racingState.stats) return
  if (racingState.racesLeft <= 0) {
    toastService.info('No races left today!')
    return
  }
  reward.value = null
  race.value = buildRace({
    petName: pet.value.nickname || (pet.value.species && pet.value.species.name) || 'Your Pet',
    stats: derived.value,
    charm: racingState.equip.charm || null,
    league: racingService.tier()
  })
}

async function act(action) {
  takeTurn(race.value, action)
  // Vue tracks the ref, but the engine mutates the object in place, so nudge it.
  race.value = { ...race.value }
  if (race.value.finished) await finish()
}

async function finish() {
  const { playerRank: rank } = results(race.value)
  try {
    reward.value = await racingService.recordResult(rank, race.value.racers.length)
  } catch (e) {
    console.error('[QuickRace.finish]', e)
    reward.value = { pp: 0, pts: 0, beatAll: false, bonus: 0 }
  }
}

function reset() {
  race.value = null
  reward.value = null
}

watch(() => AppState.ownedPets, (pets) => {
  if (!racingState.selectedPetId && pets && pets.length) racingService.selectPet(pets[0].id)
}, { immediate: true })
</script>

<style lang="scss" scoped>
// Layout, spacing and the action grid are Bootstrap's. What stays here is what
// the utility scale genuinely cannot express: the game's colours and gradients,
// the fixed track geometry, and the transitions.
.qr-sub {
  color: var(--text-light);
  font-size: 0.82rem;
}

.qr-pill {
  font-size: 0.78rem;
  background: rgba(153, 102, 255, 0.08);
  border: 1px solid var(--purple-light);
}

.qr-races-left { font-size: 0.85rem; }

.qr-turn {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--text-light);
  text-transform: uppercase;
}

.qr-lane {
  border: 2px solid var(--border);
  background: var(--white);

  &.qr-lane-player { border-color: var(--purple); }
}

.qr-lane-head { font-size: 0.8rem; }

.qr-lane-pos {
  color: var(--text-light);
  font-size: 0.74rem;
}

.qr-lane-track {
  // 14px is the bar's drawn thickness, not a spacing step.
  height: 14px;
  background: rgba(153, 102, 255, 0.1);
}

.qr-lane-fill {
  background: linear-gradient(90deg, #9966ff, #ff66cc);
  transition: width 0.4s ease;
}

.qr-runner {
  // Rides the fill: `left` is bound inline, so only the offset and the easing
  // belong here.
  top: -4px;
  transform: translateX(-50%);
  font-size: 1rem;
  transition: left 0.4s ease;
}

.qr-lane-meta {
  font-size: 0.72rem;
  color: var(--text-light);
}

.qr-penalty { color: #e74c3c; }

.qr-action {
  border: 2px solid var(--purple-light);
  background: var(--white);
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: var(--purple);
  }

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.qr-action-label { font-size: 0.85rem; }

.qr-action-desc {
  font-size: 0.7rem;
  color: var(--text-light);
}

.qr-log {
  background: rgba(0, 0, 0, 0.04);
  font-size: 0.8rem;
  line-height: 1.6;
  min-height: 60px;
}

.qr-result-icon { font-size: 2.5rem; }

.qr-place {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--purple);
}

.qr-reward { background: rgba(93, 222, 122, 0.1); }

.qr-reward-sub {
  font-size: 0.8rem;
  color: var(--text-light);
}

.qr-beat-all {
  font-size: 0.82rem;
  font-weight: 700;
  color: #e6a800;
}

.qr-standings {
  font-size: 0.85rem;

  li { padding: 3px 0; }
}

.qr-standing-pos {
  color: var(--text-light);
  font-size: 0.78rem;
}
</style>
