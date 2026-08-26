<template>
  <!-- Ports the battle-page expedition panel (battleExp_renderActive/
       renderForm/renderHistory, game.js:10763-11097): what's out now, a form to
       send a pet, and recent returns. -->
  <div class="pp-exp mb-4">
    <div class="pp-exp-active">
      <div class="pp-exp-heading">🌲 Active Explorations</div>

      <div v-if="loading" class="pp-exp-muted">Loading…</div>
      <div v-else-if="!active.length" class="pp-exp-muted">No pets currently exploring.</div>

      <div v-else class="d-flex flex-column gap-2">
        <div v-for="row in active" :key="row.id" class="pp-exp-row">
          <span class="pp-exp-emoji">{{ zoneOf(row).emoji }}</span>
          <div class="flex-grow-1 min-w-0">
            <div class="pp-exp-name">{{ petName(row.pet_id) }} — {{ zoneOf(row).label }}</div>
            <div class="pp-exp-sub">
              <template v-if="ready(row)">Back home with {{ row.reward_pp }} PP</template>
              <template v-else>Returns in {{ remaining(row) }}</template>
            </div>
          </div>
          <button v-if="ready(row)" class="btn btn-primary btn-sm" :disabled="claiming === row.id"
            @click="claim(row)">
            {{ claiming === row.id ? 'Claiming…' : '🎒 Collect' }}
          </button>
          <span v-else class="pp-exp-timer">{{ remaining(row) }}</span>
        </div>
      </div>
    </div>

    <details class="pp-exp-send">
      <summary>🚀 Send a Pet on Expedition</summary>
      <div class="pp-exp-form">
        <div v-if="!availablePets.length" class="pp-exp-muted">
          Every pet is already out exploring.
        </div>
        <template v-else>
          <label class="pp-exp-label" for="exp-pet">Pet</label>
          <select id="exp-pet" v-model="formPetId" class="pp-exp-select">
            <option v-for="p in availablePets" :key="p.id" :value="p.id">
              {{ p.nickname }} (Lv.{{ p.level }} · ⚡{{ p.energy }})
            </option>
          </select>

          <div class="pp-exp-label mt-2">Destination</div>
          <div class="row row-cols-1 row-cols-sm-2 g-2">
            <div v-for="z in zones" :key="z.key" class="col">
              <button class="pp-exp-zone w-100 h-100" :class="{ 'pp-selected': formZone === z.key }"
                @click="formZone = z.key">
                <div class="pp-exp-zone-top">{{ z.emoji }} {{ z.label }}</div>
                <div class="pp-exp-zone-desc">{{ z.desc }}</div>
                <div class="pp-exp-zone-meta">
                  ⏱ {{ z.duration }}m · ⚡{{ z.energyCost }} · 💰{{ z.minPP }}-{{ z.maxPP }} PP
                </div>
              </button>
            </div>
          </div>

          <button class="btn btn-primary w-100 mt-3" :disabled="!canSend || sending" @click="send">
            {{ sending ? 'Sending…' : '🚀 Send on Expedition' }}
          </button>
          <p v-if="blockedReason" class="pp-exp-blocked">{{ blockedReason }}</p>
        </template>
      </div>
    </details>

    <div class="mt-3">
      <div class="pp-exp-heading">📜 Recent Expeditions</div>
      <div v-if="!history.length" class="pp-exp-muted">No expeditions yet.</div>
      <div v-else class="d-flex flex-column gap-1">
        <div v-for="row in history" :key="row.id" class="pp-exp-hist">
          <span>{{ zoneOf(row).emoji }} {{ zoneOf(row).label }}</span>
          <span class="pp-exp-hist-pp">+{{ row.reward_pp }} PP</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { AppState } from '../../AppState.js'
import { expeditionService } from '../../services/ExpeditionService.js'
import { toastService } from '../../services/ToastService.js'
import { modalService } from '../../services/ModalService.js'
import { EXPEDITION_ZONES } from '../../data/expeditionData.js'

const props = defineProps({
  // Raw user_pets rows, as BattlePage already loads them.
  pets: { type: Array, default: () => [] }
})
const emit = defineEmits(['changed'])

const zones = EXPEDITION_ZONES
const active = ref([])
const history = ref([])
const loading = ref(true)
const sending = ref(false)
const claiming = ref(null)
const formPetId = ref('')
const formZone = ref('')

// Re-read every second so the countdowns tick without refetching.
const now = ref(Date.now())
let ticker = null

const activePetIds = computed(() => active.value.map(r => r.pet_id))
const availablePets = computed(() => props.pets.filter(p => !activePetIds.value.includes(p.id)))
const formPet = computed(() => props.pets.find(p => p.id === formPetId.value) || null)

const blockedReason = computed(() => {
  if (!formPet.value) return 'Pick a pet.'
  if (!formZone.value) return 'Pick a destination.'
  const z = expeditionService.zone(formZone.value)
  if ((formPet.value.energy || 0) < z.energyCost) {
    return `${formPet.value.nickname} needs ${z.energyCost} energy (has ${formPet.value.energy || 0}).`
  }
  return ''
})
const canSend = computed(() => !blockedReason.value)

function zoneOf(row) {
  return expeditionService.zone(row.zone) || { emoji: '🌲', label: row.zone }
}

function petName(petId) {
  const p = props.pets.find(x => x.id === petId)
  return p ? p.nickname : 'Your pet'
}

// `now` is referenced so these recompute on every tick.
function ready(row) {
  return now.value >= new Date(row.ends_at).getTime()
}

function remaining(row) {
  return expeditionService.formatRemaining(new Date(row.ends_at).getTime() - now.value)
}

async function load() {
  loading.value = true
  try {
    const [a, h] = await Promise.all([
      expeditionService.getActive(AppState.user.id),
      expeditionService.getHistory(AppState.user.id)
    ])
    active.value = a
    history.value = h
    if (!formPetId.value && availablePets.value.length) {
      formPetId.value = availablePets.value[0].id
    }
  } finally {
    loading.value = false
  }
}

async function send() {
  sending.value = true
  try {
    const { zone } = await expeditionService.start(formPet.value, formZone.value)
    toastService.success(`🌲 ${formPet.value.nickname} set off for the ${zone.label}!`)
    formZone.value = ''
    await load()
    emit('changed')
  } catch (e) {
    toastService.error(e.message)
  } finally {
    sending.value = false
  }
}

async function claim(row) {
  claiming.value = row.id
  try {
    const result = await expeditionService.claim(row.id)
    const itemText = result.items.length
      ? result.items.map(i => `${i.icon} ${i.name}`).join(', ')
      : 'No items'
    modalService.alert(
      `${petName(row.pet_id)} returned!`,
      `+${result.pp} PP · +${result.xp} XP — ${itemText}`,
      '🎒'
    )
    await load()
    emit('changed')
  } catch (e) {
    toastService.error(e.message)
  } finally {
    claiming.value = null
  }
}

onMounted(() => {
  load()
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => clearInterval(ticker))
</script>

<style lang="scss" scoped>
.pp-exp-active {
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.08), rgba(255, 102, 204, 0.05));
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.pp-exp-heading {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--purple-dark);
  margin-bottom: 10px;
}

.pp-exp-muted {
  color: var(--text-light);
  font-size: 0.82rem;
  font-style: italic;
}

.pp-exp-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pp-exp-emoji { font-size: 1.4rem; }

.pp-exp-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
}

.pp-exp-sub {
  font-size: 0.75rem;
  color: var(--text-light);
}

.pp-exp-timer {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--purple);
  white-space: nowrap;
}

.pp-exp-send {
  border: 2px solid var(--border);
  border-radius: 14px;
  overflow: hidden;

  > summary {
    padding: 12px 16px;
    font-weight: 700;
    font-size: 0.88rem;
    color: var(--purple-dark);
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker { display: none; }
  }
}

.pp-exp-form {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}

.pp-exp-label {
  font-weight: 700;
  font-size: 0.78rem;
  color: var(--purple-dark);
  margin-bottom: 4px;
}

.pp-exp-select {
  width: 100%;
  padding: 8px 12px;
  border: 3px solid var(--border);
  border-radius: 20px;
  background: var(--cream);
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.pp-exp-zone {
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--white);
  text-align: left;
  cursor: pointer;

  &.pp-selected {
    border-color: var(--purple);
    background: var(--purple-light);
  }
}

.pp-exp-zone-top {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
}

.pp-exp-zone-desc {
  font-size: 0.7rem;
  color: var(--text-light);
  margin: 2px 0 4px;
}

.pp-exp-zone-meta {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--purple);
}

.pp-exp-blocked {
  font-size: 0.78rem;
  color: var(--text-light);
  text-align: center;
  margin-top: 6px;
}

.pp-exp-hist {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-light);
}

.pp-exp-hist-pp {
  font-weight: 700;
  color: var(--green);
}
</style>
