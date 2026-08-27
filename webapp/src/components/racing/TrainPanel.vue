<template>
  <!-- Ports racing_renderTrainTab() + racing_doTrain(). Three training drills
       raise one rating each and cost energy; Rest restores fitness for free. -->
  <div>
    <h3 class="rt-title">🏋️ Training</h3>
    <p class="rt-sub">Three sessions a day. Fitness decays {{ RACING_FITNESS_DECAY }} points per day without training.</p>

    <RacingPetSelector v-model="selectedId" />

    <template v-if="pet && racingState.stats">
      <div class="rt-stats">
        <div class="rt-stat">
          <div class="rt-stat-label">Fitness</div>
          <div class="rt-stat-value" :class="{ 'rt-low': fitness < 30 }">{{ fitness }}%</div>
          <div class="rt-bar"><div class="rt-bar-fill" :style="{ width: fitness + '%' }"></div></div>
        </div>
        <div v-for="s in RATING_ROWS" :key="s.key" class="rt-stat">
          <div class="rt-stat-label">{{ s.label }}</div>
          <div class="rt-stat-value">{{ racingState.stats[s.key] || 0 }}</div>
          <div class="rt-bar"><div class="rt-bar-fill" :style="{ width: (racingState.stats[s.key] || 0) + '%' }"></div></div>
        </div>
      </div>

      <div class="rt-derived">
        <span v-for="(v, k) in derived" :key="k" class="rt-derived-pill">
          {{ DERIVED_LABELS[k] }} <strong>{{ v }}</strong>
        </span>
      </div>

      <div class="rt-sessions">
        Sessions left today: <strong>{{ racingState.sessionsLeft }}</strong> / {{ RACING_DAILY_SESSIONS }}
      </div>

      <p v-if="fitness < 30" class="rt-warn">
        ⚠️ Fitness is too low to drill — only Rest &amp; Recovery is available.
      </p>

      <div class="rt-drills">
        <button
          v-for="(t, key) in RACING_TRAINING_TYPES"
          :key="key"
          class="rt-drill"
          :disabled="busy || racingState.sessionsLeft <= 0 || (fitness < 30 && key !== 'rest') || !canAfford(t)"
          @click="doTrain(key)"
        >
          <div class="rt-drill-label">{{ t.label }}</div>
          <div class="rt-drill-desc">{{ t.desc }}</div>
          <div class="rt-drill-cost">{{ t.energyCost > 0 ? `⚡ ${t.energyCost} energy` : 'Free' }}</div>
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
.rt-title { margin-bottom: 6px; }

.rt-sub {
  color: var(--text-light);
  font-size: 0.82rem;
  margin-bottom: 14px;
}

.rt-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.rt-stat {
  background: var(--white);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
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

.rt-bar {
  height: 6px;
  margin-top: 6px;
  border-radius: 20px;
  background: rgba(153, 102, 255, 0.12);
  overflow: hidden;
}

.rt-bar-fill {
  height: 100%;
  border-radius: 20px;
  background: linear-gradient(90deg, #9966ff, #ff66cc);
  transition: width 0.4s;
}

.rt-derived {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.rt-derived-pill {
  font-size: 0.78rem;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(153, 102, 255, 0.08);
  border: 1px solid var(--purple-light);
}

.rt-sessions {
  font-size: 0.85rem;
  margin-bottom: 10px;
}

.rt-warn {
  font-size: 0.8rem;
  color: #e74c3c;
  font-weight: 600;
  margin-bottom: 10px;
}

.rt-drills {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.rt-drill {
  text-align: left;
  padding: 12px 14px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--white);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--purple);
    transform: translateY(-2px);
  }

  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

.rt-drill-label {
  font-weight: 700;
  font-size: 0.88rem;
  margin-bottom: 2px;
}

.rt-drill-desc {
  font-size: 0.74rem;
  color: var(--text-light);
  margin-bottom: 4px;
}

.rt-drill-cost {
  font-size: 0.72rem;
  color: var(--purple);
  font-weight: 700;
}
</style>
