<template>
  <!-- Ports racing_renderTrainTab() + racing_doTrain(). Three training drills
       raise one rating each and cost energy; Rest restores fitness for free. -->
  <div>
    <h3 class="mb-px6">🏋️ Training</h3>
    <p class="rt-sub mb-px14">Three sessions a day. Fitness decays {{ RACING_FITNESS_DECAY }} points per day without training.</p>

    <RacingPetSelector v-model="selectedId" />

    <template v-if="pet && racingState.stats">
      <!-- Four stat tiles. Was `auto-fit, minmax(130px, 1fr)`, which resolved to
           four across in the ~740px panel. -->
      <div class="row row-cols-2 row-cols-md-4 g-px10 mb-tight">
        <div class="col">
          <div class="rt-stat px-tight py-px10 rounded-3 h-100">
            <div class="rt-stat-label">Fitness</div>
            <div class="rt-stat-value" :class="{ 'rt-low': fitness < 30 }">{{ fitness }}%</div>
            <div class="rt-bar mt-px6 rounded-5 overflow-hidden">
              <div class="rt-bar-fill h-100 rounded-5" :style="{ width: fitness + '%' }"></div>
            </div>
          </div>
        </div>
        <div v-for="s in RATING_ROWS" :key="s.key" class="col">
          <div class="rt-stat px-tight py-px10 rounded-3 h-100">
            <div class="rt-stat-label">{{ s.label }}</div>
            <div class="rt-stat-value">{{ racingState.stats[s.key] || 0 }}</div>
            <div class="rt-bar mt-px6 rounded-5 overflow-hidden">
              <div class="rt-bar-fill h-100 rounded-5" :style="{ width: (racingState.stats[s.key] || 0) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2 mb-tight">
        <span v-for="(v, k) in derived" :key="k" class="rt-derived-pill px-px10 py-1 rounded-5">
          {{ DERIVED_LABELS[k] }} <strong>{{ v }}</strong>
        </span>
      </div>

      <div class="rt-sessions mb-px10">
        Sessions left today: <strong>{{ racingState.sessionsLeft }}</strong> / {{ RACING_DAILY_SESSIONS }}
      </div>

      <p v-if="fitness < 30" class="rt-warn mb-px10">
        ⚠️ Fitness is too low to drill — only Rest &amp; Recovery is available.
      </p>

      <!-- Four drills. Was `auto-fit, minmax(180px, 1fr)` — four across at full
           width, two once the column narrows past ~540px. -->
      <div class="row row-cols-2 row-cols-md-4 g-px10">
        <div v-for="(t, key) in RACING_TRAINING_TYPES" :key="key" class="col">
          <button
            class="rt-drill w-100 h-100 text-start px-px14 py-tight rounded-3"
            :disabled="busy || racingState.sessionsLeft <= 0 || (fitness < 30 && key !== 'rest') || !canAfford(t)"
            @click="doTrain(key)"
          >
            <div class="rt-drill-label fw-bold mb-px2">{{ t.label }}</div>
            <div class="rt-drill-desc mb-1">{{ t.desc }}</div>
            <div class="rt-drill-cost fw-bold">{{ t.energyCost > 0 ? `⚡ ${t.energyCost} energy` : 'Free' }}</div>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import RacingPetSelector from './RacingPetSelector.vue'
import { AppState } from '../../AppState.js'
import { racingService, racingState } from '../../services/RacingService.js'
import {
  RACING_TRAINING_TYPES, RACING_DAILY_SESSIONS, RACING_FITNESS_DECAY
} from '../../data/racingData.js'

const RATING_ROWS = [
  { key: 'pace_rating', label: 'Pace' },
  { key: 'stamina_rating', label: 'Stamina' },
  { key: 'interference_rating', label: 'Interference' }
]
const DERIVED_LABELS = {
  pace: '💨 Pace', stamina: '🫁 Stamina',
  interference: '⚔️ Interference', resilience: '🛡️ Resilience'
}

const busy = ref(false)

const selectedId = computed({
  get: () => racingState.selectedPetId,
  set: (id) => racingService.selectPet(id)
})

const pet = computed(() => (AppState.ownedPets || []).find(p => p.id === racingState.selectedPetId) || null)
const fitness = computed(() => (racingState.stats && racingState.stats.fitness) || 0)
const derived = computed(() => racingService.calcStats(pet.value))

// Rest costs nothing, so it stays available when a pet is out of energy.
const canAfford = (t) => t.energyCost === 0 || !pet.value || (pet.value.energy || 0) >= t.energyCost

async function doTrain(key) {
  busy.value = true
  try {
    await racingService.train(key, pet.value)
  } finally {
    busy.value = false
  }
}

// Auto-select the first pet so the panel isn't empty on arrival.
watch(() => AppState.ownedPets, (pets) => {
  if (!racingState.selectedPetId && pets && pets.length) racingService.selectPet(pets[0].id)
}, { immediate: true })
</script>

<style lang="scss" scoped>
// Both card grids and all spacing are Bootstrap's. What remains is colour,
// border treatment, the bars' drawn thickness, and the transitions.
.rt-sub {
  color: var(--text-light);
  font-size: 0.82rem;
}

.rt-stat {
  background: var(--white);
  border: 2px solid var(--border);
}

.rt-stat-label {
  font-size: 0.72rem;
  color: var(--text-light);
}

.rt-stat-value {
  font-size: 1.4rem;
  font-weight: 700;

  &.rt-low { color: #e74c3c; }
}

// 6px here is the bar's drawn thickness, not a spacing step.
.rt-bar {
  height: 6px;
  background: rgba(153, 102, 255, 0.12);
}

.rt-bar-fill {
  background: linear-gradient(90deg, #9966ff, #ff66cc);
  transition: width 0.4s;
}

.rt-derived-pill {
  font-size: 0.78rem;
  background: rgba(153, 102, 255, 0.08);
  border: 1px solid var(--purple-light);
}

.rt-sessions { font-size: 0.85rem; }

.rt-warn {
  font-size: 0.8rem;
  color: #e74c3c;
  font-weight: 600;
}

.rt-drill {
  border: 2px solid var(--border);
  background: var(--white);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--purple);
    transform: translateY(-2px);
  }

  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

.rt-drill-label { font-size: 0.88rem; }

.rt-drill-desc {
  font-size: 0.74rem;
  color: var(--text-light);
}

.rt-drill-cost {
  font-size: 0.72rem;
  color: var(--purple);
  font-weight: 700;
}
</style>
