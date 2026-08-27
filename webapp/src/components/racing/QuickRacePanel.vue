<template>
  <!-- Ports racing_renderQuickRaceTab() / racing_renderRaceInProgress() /
       racing_playerAction(). Eight turns, four actions, first to 100. -->
  <div>
    <!-- ── setup ────────────────────────────────────────────────────────── -->
    <template v-if="!race">
      <h3 class="qr-title">🏎️ Quick Race</h3>
      <p class="qr-sub">
        Eight turns against {{ '3–4' }} streamer rivals. First past {{ RACING_FINISH_LINE }} wins.
      </p>

      <RacingPetSelector v-model="selectedId" />

      <div v-if="pet && racingState.stats" class="qr-ready">
        <div class="qr-derived">
          <span v-for="(v, k) in derived" :key="k" class="qr-pill">
            {{ DERIVED_LABELS[k] }} <strong>{{ v }}</strong>
          </span>
        </div>
        <div class="qr-races-left">
          Races left today: <strong>{{ racingState.racesLeft }}</strong> / {{ RACING_DAILY_RACES }}
        </div>
        <button class="btn btn-primary qr-start" :disabled="racingState.racesLeft <= 0" @click="start">
          {{ racingState.racesLeft > 0 ? '🏁 Start Race' : 'No races left today' }}
        </button>
      </div>
    </template>

    <!-- ── in progress ──────────────────────────────────────────────────── -->
    <template v-else-if="!race.finished">
      <div class="qr-turn">Turn {{ race.turn + 1 }} / {{ race.maxTurns }}</div>

      <div class="qr-track">
        <div v-for="r in race.racers" :key="r.id" class="qr-lane" :class="{ 'qr-lane-player': r.isPlayer }">
          <div class="qr-lane-head">
            <span class="qr-lane-name">{{ r.emoji }} {{ r.isPlayer ? r.name + ' (you)' : shortName(r.name) }}</span>
            <span class="qr-lane-pos">{{ r.position }} / {{ RACING_FINISH_LINE }}</span>
          </div>
          <div class="qr-lane-track">
            <div class="qr-lane-fill" :style="{ width: pct(r.position) + '%' }"></div>
            <span class="qr-runner" :style="{ left: pct(r.position) + '%' }">{{ r.emoji }}</span>
          </div>
          <div v-if="r.isPlayer" class="qr-lane-meta">
            🫁 Stamina {{ r.stamina }} / {{ r.maxStamina }}
            <span v-if="r.jostlePenalty > 0" class="qr-penalty">· −{{ r.jostlePenalty }} pace next turn</span>
          </div>
        </div>
      </div>

      <div class="qr-actions">
        <button v-for="a in ACTIONS" :key="a.key" class="qr-action"
          :disabled="!race.awaitingPlayerAction" :title="a.desc" @click="act(a.key)">
          <div class="qr-action-label">{{ a.label }}</div>
          <div class="qr-action-desc">{{ a.desc }}</div>
        </button>
      </div>

      <div class="qr-log">
        <p v-for="(line, i) in recentLog" :key="i" class="qr-log-line">{{ line }}</p>
      </div>
    </template>

    <!-- ── results ──────────────────────────────────────────────────────── -->
    <template v-else>
      <div class="qr-results">
        <div class="qr-result-icon">{{ playerRank === 1 ? '🏆' : playerRank <= 3 ? '🎖️' : '🏁' }}</div>
        <h2 class="qr-result-title">Race Complete!</h2>
        <div class="qr-place">{{ PLACE_LABELS[playerRank - 1] || playerRank + 'th' }}</div>

        <div v-if="reward" class="qr-reward">
          <div>🪙 <strong>+{{ reward.pp }} PP</strong></div>
          <div class="qr-reward-sub">+{{ reward.pts }} league point{{ reward.pts === 1 ? '' : 's' }}</div>
          <div v-if="reward.beatAll" class="qr-beat-all">
            🌟 Beat every streamer! +{{ reward.bonus }} PP bonus
          </div>
        </div>
        <div v-else class="qr-reward"><div class="spinner"></div></div>

        <ol class="qr-standings">
          <li v-for="r in ranked" :key="r.id" :class="{ 'qr-standing-player': r.isPlayer }">
            {{ r.emoji }} {{ r.isPlayer ? r.name + ' (you)' : shortName(r.name) }}
            <span class="qr-standing-pos">{{ r.position }}</span>
          </li>
        </ol>

        <button class="btn btn-primary qr-again" @click="reset">
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
.qr-title { margin-bottom: 6px; }

.qr-sub {
  color: var(--text-light);
  font-size: 0.82rem;
  margin-bottom: 14px;
}

.qr-derived {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.qr-pill {
  font-size: 0.78rem;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(153, 102, 255, 0.08);
  border: 1px solid var(--purple-light);
}

.qr-races-left {
  font-size: 0.85rem;
  margin-bottom: 12px;
}

.qr-start { width: 100%; }

.qr-turn {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--text-light);
  text-transform: uppercase;
  margin-bottom: 10px;
}

.qr-track {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.qr-lane {
  padding: 8px 10px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--white);

  &.qr-lane-player { border-color: var(--purple); }
}

.qr-lane-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 0.8rem;
  margin-bottom: 4px;
}

.qr-lane-name {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qr-lane-pos {
  color: var(--text-light);
  font-size: 0.74rem;
  flex-shrink: 0;
}

.qr-lane-track {
  position: relative;
  height: 14px;
  border-radius: 20px;
  background: rgba(153, 102, 255, 0.1);
}

.qr-lane-fill {
  height: 100%;
  border-radius: 20px;
  background: linear-gradient(90deg, #9966ff, #ff66cc);
  transition: width 0.4s ease;
}

.qr-runner {
  position: absolute;
  top: -4px;
  transform: translateX(-50%);
  font-size: 1rem;
  transition: left 0.4s ease;
}

.qr-lane-meta {
  font-size: 0.72rem;
  color: var(--text-light);
  margin-top: 4px;
}

.qr-penalty { color: #e74c3c; }

.qr-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.qr-action {
  padding: 10px 12px;
  border: 2px solid var(--purple-light);
  border-radius: 12px;
  background: var(--white);
  cursor: pointer;
  text-align: center;
  transition: transform 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: var(--purple);
  }

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.qr-action-label {
  font-weight: 700;
  font-size: 0.85rem;
}

.qr-action-desc {
  font-size: 0.7rem;
  color: var(--text-light);
}

.qr-log {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 0.8rem;
  line-height: 1.6;
  min-height: 60px;
}

.qr-log-line { margin: 0; }

.qr-results {
  text-align: center;
  padding: 8px;
}

.qr-result-icon { font-size: 2.5rem; }

.qr-result-title { margin: 8px 0 6px; }

.qr-place {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--purple);
  margin-bottom: 10px;
}

.qr-reward {
  background: rgba(93, 222, 122, 0.1);
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 12px;
}

.qr-reward-sub {
  font-size: 0.8rem;
  color: var(--text-light);
}

.qr-beat-all {
  margin-top: 4px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #e6a800;
}

.qr-standings {
  text-align: left;
  margin: 0 0 14px;
  padding-left: 24px;
  font-size: 0.85rem;

  li { padding: 3px 0; }
}

.qr-standing-player { font-weight: 700; }

.qr-standing-pos {
  float: right;
  color: var(--text-light);
  font-size: 0.78rem;
}

.qr-again { width: 100%; }
</style>
