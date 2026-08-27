<template>
  <!-- Ports gp_load() and its four phase renderers. The weekly event moves
       registration → racing → reward_claim → complete on the server, and each
       phase is a different screen. -->
  <div>
    <div v-if="gpState.loading" class="spinner"></div>

    <!-- No event scheduled -->
    <div v-else-if="!gpState.event" class="empty-state">
      <div class="empty-icon">🎪</div>
      <h2>No Grand Prix running</h2>
      <p>The next event opens for registration soon. Train your pet in the meantime!</p>
      <button class="btn btn-outline" @click="goTrain">🏋️ Go Train</button>
    </div>

    <template v-else>
      <div class="gp-head">
        <div class="gp-title">🎪 Grand Prix — Week {{ gpState.event.week_number }}, {{ gpState.event.year }}</div>
        <div class="gp-status" :class="'gp-status-' + gpState.event.status">{{ STATUS_LABELS[gpState.event.status] || gpState.event.status }}</div>
      </div>
      <div class="gp-pool">💰 Prize pool: <strong>{{ gpState.event.prize_pool || 0 }} PP</strong></div>

      <!-- ── registration ────────────────────────────────────────────────── -->
      <template v-if="gpState.event.status === 'registration'">
        <template v-if="gpState.entry">
          <div class="gp-entered">
            ✅ You're entered with <strong>{{ entryPetName }}</strong>. Racing begins when registration closes.
          </div>
        </template>
        <template v-else>
          <p class="gp-sub">Pick the pet to enter. Entry costs {{ GP_ENTRY_FEE }} PP.</p>
          <RacingPetSelector v-model="pickedPetId" />
          <div v-if="pickedPet" class="gp-estimate">
            Estimated race score: <strong>{{ estimate }}</strong>
            <span class="gp-estimate-note">— speed, level, happiness, gear and variant</span>
          </div>
          <button class="btn btn-primary gp-enter" :disabled="busy || !pickedPetId" @click="enter">
            🎪 Enter Grand Prix ({{ GP_ENTRY_FEE }} PP)
          </button>
        </template>
        <div class="gp-prizes">
          <div class="gp-prizes-title">🏆 Prize Structure</div>
          <div v-for="(line, i) in GP_PRIZE_STRUCTURE" :key="i" class="gp-prize-line">{{ line }}</div>
        </div>
      </template>

      <!-- ── racing (training window) ────────────────────────────────────── -->
      <template v-else-if="gpState.event.status === 'racing'">
        <div v-if="!gpState.entry" class="gp-entered gp-missed">
          Registration has closed for this event. Catch the next one!
        </div>
        <template v-else>
          <div class="gp-entered">
            🏁 <strong>{{ entryPetName }}</strong> is racing. Training now still improves the result.
          </div>
          <div class="gp-training-bar">
            <div class="gp-training-label">
              Training bonus <strong>{{ grandPrixService.trainingBonus() }}</strong> / {{ TRAINING_CAP }}
            </div>
            <div class="gp-training-track">
              <div class="gp-training-fill" :style="{ width: trainingPct + '%' }"></div>
            </div>
          </div>
          <div class="gp-drills">
            <button
              v-for="(t, key) in GP_TRAINING_TYPES"
              :key="key"
              class="gp-drill"
              :disabled="busy || grandPrixService.trainingRoom() <= 0"
              @click="train(key)"
            >
              <div class="gp-drill-label">{{ t.label }}</div>
              <div class="gp-drill-desc">{{ t.desc }}</div>
            </button>
          </div>
          <p v-if="grandPrixService.trainingRoom() <= 0" class="gp-capped">
            Weekly training cap reached — your pet is as ready as it gets.
          </p>
        </template>
      </template>

      <!-- ── results / reward claim ──────────────────────────────────────── -->
      <template v-else>
        <div v-if="gpState.entry && gpState.entry.final_rank" class="gp-result">
          <div class="gp-result-icon">{{ gpState.entry.final_rank === 1 ? '🏆' : gpState.entry.final_rank <= 3 ? '🎖️' : '🏁' }}</div>
          <div class="gp-result-rank">You finished #{{ gpState.entry.final_rank }}</div>
          <div class="gp-result-score">Final score: {{ gpState.entry.final_score || 0 }}</div>
          <button
            v-if="!gpState.entry.rewards_claimed"
            class="btn btn-primary gp-claim"
            :disabled="busy"
            @click="claim"
          >🎁 Claim Rewards</button>
          <div v-else class="gp-claimed">✅ Rewards claimed</div>
        </div>
        <div v-else-if="gpState.entry" class="gp-entered">
          Results are still being tallied. Check back shortly!
        </div>

        <div v-if="gpState.leaderboard.length" class="gp-board">
          <div class="gp-board-title">🏁 Final Standings</div>
          <ol class="gp-board-list">
            <li v-for="row in gpState.leaderboard" :key="row.id || row.final_rank">
              <span class="gp-board-name">{{ row.username || 'Racer' }}</span>
              <span class="gp-board-score">{{ row.final_score || 0 }}</span>
            </li>
          </ol>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import RacingPetSelector from './RacingPetSelector.vue'
import { AppState } from '../../AppState.js'
import { grandPrixService, gpState } from '../../services/GrandPrixService.js'
import {
  GP_TRAINING_TYPES, TRAINING_CAP, GP_ENTRY_FEE, GP_PRIZE_STRUCTURE
} from '../../data/grandPrixData.js'

const STATUS_LABELS = {
  registration: '📝 Registration open',
  racing: '🏁 Racing',
  reward_claim: '🎁 Claim rewards',
  complete: '✅ Complete'
}

const router = useRouter()
const busy = ref(false)
const pickedPetId = ref(null)
const equipBonus = ref(0)

const pickedPet = computed(() => (AppState.ownedPets || []).find(p => p.id === pickedPetId.value) || null)
const estimate = computed(() => grandPrixService.estimateScore(pickedPet.value, equipBonus.value))

const entryPetName = computed(() => {
  const id = gpState.entry && gpState.entry.pet_id
  const pet = (AppState.ownedPets || []).find(p => p.id === id)
  return (pet && pet.nickname) || 'your pet'
})

const trainingPct = computed(() =>
  Math.round((grandPrixService.trainingBonus() / TRAINING_CAP) * 100))

const entryPet = computed(() => {
  const id = gpState.entry && gpState.entry.pet_id
  return (AppState.ownedPets || []).find(p => p.id === id) || null
})

function goTrain() { router.push('/racing') }

async function enter() {
  busy.value = true
  try {
    await grandPrixService.enter(pickedPetId.value)
  } finally {
    busy.value = false
  }
}

async function train(key) {
  busy.value = true
  try {
    await grandPrixService.train(key, entryPet.value)
  } finally {
    busy.value = false
  }
}

async function claim() {
  busy.value = true
  try {
    await grandPrixService.claimRewards()
  } finally {
    busy.value = false
  }
}

// The score estimate needs the pet's battle gear, which is a separate query.
async function refreshEstimate(id) {
  equipBonus.value = id ? await grandPrixService.equipmentBonus(id) : 0
}

onMounted(async () => {
  await grandPrixService.load()
  if (!pickedPetId.value && AppState.ownedPets && AppState.ownedPets.length) {
    pickedPetId.value = AppState.ownedPets[0].id
  }
  refreshEstimate(pickedPetId.value)
})
</script>

<style lang="scss" scoped>
// Grand Prix has no dedicated CSS in style.css — legacy built the whole panel
// from inline styles — so all of it is owned here.
.gp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.gp-title {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--purple-dark);
}

.gp-status {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(153, 102, 255, 0.12);
  color: var(--purple);

  &.gp-status-racing { background: rgba(255, 170, 0, 0.15); color: #b37700; }
  &.gp-status-reward_claim { background: rgba(93, 222, 122, 0.15); color: #2e8b4f; }
}

.gp-pool {
  font-size: 0.85rem;
  margin-bottom: 14px;
}

.gp-sub {
  color: var(--text-light);
  font-size: 0.82rem;
  margin-bottom: 12px;
}

.gp-entered {
  background: rgba(153, 102, 255, 0.08);
  border: 2px solid var(--purple-light);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 0.88rem;
  margin-bottom: 14px;

  &.gp-missed {
    background: rgba(0, 0, 0, 0.04);
    border-color: var(--border);
    color: var(--text-light);
  }
}

.gp-estimate {
  font-size: 0.88rem;
  margin-bottom: 12px;
}

.gp-estimate-note {
  font-size: 0.74rem;
  color: var(--text-light);
}

.gp-enter { width: 100%; margin-bottom: 16px; }

.gp-prizes {
  background: rgba(153, 102, 255, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
}

.gp-prizes-title {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
  margin-bottom: 8px;
}

.gp-prize-line {
  font-size: 0.78rem;
  color: var(--text-light);
  line-height: 2;
}

.gp-training-bar { margin-bottom: 12px; }

.gp-training-label {
  font-size: 0.82rem;
  margin-bottom: 4px;
}

.gp-training-track {
  height: 10px;
  border-radius: 20px;
  background: rgba(153, 102, 255, 0.12);
  overflow: hidden;
}

.gp-training-fill {
  height: 100%;
  border-radius: 20px;
  background: linear-gradient(90deg, #9966ff, #ff66cc);
  transition: width 0.4s;
}

.gp-drills {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.gp-drill {
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

.gp-drill-label {
  font-weight: 700;
  font-size: 0.88rem;
}

.gp-drill-desc {
  font-size: 0.74rem;
  color: var(--text-light);
}

.gp-capped {
  font-size: 0.8rem;
  color: var(--text-light);
  margin-top: 10px;
}

.gp-result {
  text-align: center;
  padding: 12px;
  background: var(--white);
  border: 2px solid var(--purple-light);
  border-radius: 14px;
  margin-bottom: 16px;
}

.gp-result-icon { font-size: 2.4rem; }

.gp-result-rank {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--purple);
  margin: 6px 0 2px;
}

.gp-result-score {
  font-size: 0.85rem;
  color: var(--text-light);
  margin-bottom: 12px;
}

.gp-claim { width: 100%; }

.gp-claimed {
  font-size: 0.85rem;
  color: #2e8b4f;
  font-weight: 700;
}

.gp-board {
  background: rgba(153, 102, 255, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
}

.gp-board-title {
  font-weight: 700;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.gp-board-list {
  margin: 0;
  padding-left: 24px;
  font-size: 0.83rem;

  li {
    padding: 3px 0;
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
}

.gp-board-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gp-board-score {
  color: var(--text-light);
  flex-shrink: 0;
}
</style>
