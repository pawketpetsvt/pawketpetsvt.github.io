<template>
  <PetModal title="🏁 Grand Prix Admin" @close="$emit('close')">
    <div class="ad-warn">⚠️ ADMIN CONTROLS: USE WITH CAUTION</div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <!-- Event summary -->
      <div v-if="!event" class="ad-empty">
        No active event.
        <div class="mt-3">
          <button class="btn btn-primary btn-sm" :disabled="busy" @click="run(createEvent, 'Event created!')">
            ➕ Create This Week's Event
          </button>
        </div>
      </div>

      <template v-else>
        <div class="ad-kv">Week {{ event.week_number }} · {{ event.year }}</div>
        <div class="ad-kv">Status: <strong>{{ event.status }}</strong></div>
        <div class="ad-kv">Prize pool: <strong>🪙 {{ (event.prize_pool || 0).toLocaleString() }} PP</strong></div>
        <div class="ad-kv">Entries: <strong>{{ entries.length }}</strong></div>

        <div class="ad-section">Event status</div>
        <div class="d-flex gap-1 flex-wrap">
          <button
            v-for="s in STATUSES"
            :key="s"
            class="btn btn-sm btn-outline"
            :class="{ active: event.status === s }"
            :disabled="busy"
            @click="run(() => gpAdmin.forceStatus(s), 'Status set to ' + s)"
          >{{ s }}</button>
        </div>

        <div class="ad-section">Scoring</div>
        <div class="d-flex gap-1 flex-wrap">
          <button class="btn btn-sm btn-outline" :disabled="busy" @click="confirmAction = 'recalc'">
            🔢 Recalculate Scores
          </button>
          <button class="btn btn-sm btn-outline" :disabled="busy" @click="confirmAction = 'rankings'">
            📊 Fix Rankings
          </button>
          <button class="btn btn-sm btn-outline ad-danger" :disabled="busy" @click="confirmAction = 'simulate'">
            🏁 Run Full Simulation
          </button>
        </div>

        <div class="ad-section">Prize pool</div>
        <div class="d-flex gap-1 flex-wrap align-items-center">
          <button class="btn btn-sm btn-outline" :disabled="busy" @click="adjust(-500)">−500</button>
          <button class="btn btn-sm btn-outline" :disabled="busy" @click="adjust(500)">+500</button>
          <input v-model="prizeInput" type="number" min="0" placeholder="Set exact…" class="ad-input ad-prize-input" />
          <button class="btn btn-sm btn-primary" :disabled="busy" @click="setPrize">Set</button>
        </div>

        <div class="ad-section">Notify participants</div>
        <select v-model="notifTarget" class="ad-input mb-2">
          <option value="all">Everyone entered</option>
          <option value="top10">Top 10 only</option>
        </select>
        <textarea v-model="notifMessage" class="ad-input ad-notif-box mb-2" placeholder="Message…"></textarea>
        <button class="btn btn-sm btn-primary" :disabled="busy || !notifMessage.trim()" @click="sendNotif">
          ✉️ Send
        </button>

        <div class="ad-section">Entries ({{ entries.length }})</div>
        <div class="ad-scroll">
          <div v-if="!entries.length" class="ad-empty">No entries yet.</div>
          <div v-for="e in entries" :key="e.id" class="ad-entry">
            <span class="ad-rank">#{{ e.final_rank || '–' }}</span>
            <span class="flex-fill min-w-0">
              {{ (e.players && e.players.username) || 'Unknown' }}
              <span class="ad-muted">· {{ (e.user_pets && e.user_pets.nickname) || 'Pet' }}</span>
            </span>
            <span class="ad-muted">{{ Math.round(e.race_score || 0) }}</span>
            <button class="btn btn-sm btn-outline ad-mini" :disabled="busy" @click="editTraining(e)">
              🏋️ {{ e.training_bonus || 0 }}
            </button>
            <button class="btn btn-sm btn-outline ad-mini" :disabled="busy" @click="confirmAction = { kind: 'winner', entry: e }">
              👑
            </button>
            <button class="btn btn-sm btn-outline ad-mini ad-danger" :disabled="busy" @click="confirmAction = { kind: 'remove', entry: e }">
              ✕
            </button>
          </div>
        </div>
      </template>

      <div class="ad-section">Recent admin actions</div>
      <div class="ad-scroll">
        <div v-if="!logs.length" class="ad-empty">No logs found.</div>
        <div v-for="(l, i) in logs" :key="i" class="ad-log-row">
          <span class="ad-log-action">{{ l.action }}</span>
          <span class="ad-log-time">{{ new Date(l.created_at).toLocaleString() }}</span>
          <div class="ad-log-details">{{ JSON.stringify(l.details || {}) }}</div>
        </div>
      </div>
    </template>

    <!-- Confirmations. Legacy used window.confirm() for every one of these. -->
    <PetModal v-if="confirmAction" :title="confirmTitle" @close="confirmAction = null">
      <p class="ad-confirm">{{ confirmBody }}</p>
      <div class="d-flex gap-2">
        <button class="btn btn-outline flex-fill" @click="confirmAction = null">Cancel</button>
        <button class="btn btn-primary flex-fill" :disabled="busy" @click="doConfirmed">Confirm</button>
      </div>
    </PetModal>

    <!-- Training bonus editor. Legacy used prompt(). -->
    <PetModal v-if="trainingEdit" title="Edit training bonus" @close="trainingEdit = null">
      <label class="ad-label">New training bonus (0–{{ TRAINING_CAP }})</label>
      <input v-model.number="trainingValue" type="number" min="0" :max="TRAINING_CAP" class="ad-input mb-3" />
      <div class="d-flex gap-2">
        <button class="btn btn-outline flex-fill" @click="trainingEdit = null">Cancel</button>
        <button class="btn btn-primary flex-fill" :disabled="busy" @click="saveTraining">Save</button>
      </div>
    </PetModal>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from '../pet/PetModal.vue'
import { toastService } from '../../services/ToastService.js'
import { grandPrixAdminService as gpAdmin } from '../../services/GrandPrixAdminService.js'
import { TRAINING_CAP } from '../../data/grandPrixData.js'

defineEmits(['close'])

const STATUSES = ['registration', 'racing', 'reward_claim', 'complete']

const loading = ref(true)
const busy = ref(false)
const event = ref(null)
const entries = ref([])
const logs = ref([])
const prizeInput = ref('')
const notifTarget = ref('all')
const notifMessage = ref('')
const confirmAction = ref(null)
const trainingEdit = ref(null)
const trainingValue = ref(0)

const confirmTitle = computed(() => {
  const a = confirmAction.value
  if (!a) return ''
  if (a === 'recalc') return 'Recalculate scores?'
  if (a === 'rankings') return 'Fix rankings?'
  if (a === 'simulate') return 'Run full simulation?'
  if (a.kind === 'winner') return 'Set winner?'
  if (a.kind === 'remove') return 'Remove entry?'
  return 'Confirm'
})

const confirmBody = computed(() => {
  const a = confirmAction.value
  if (!a) return ''
  if (a === 'recalc') return 'Recalculate scores for all entries in the current event.'
  if (a === 'rankings') return 'Re-sort and assign ranks for all entries by current score.'
  if (a === 'simulate') return 'This scores all entries, assigns ranks, writes replays, moves the event to reward_claim and notifies every participant.'
  if (a.kind === 'winner') {
    const name = (a.entry.players && a.entry.players.username) || 'this player'
    return `Set ${name} as rank #1? All other ranks shift down by 1.`
  }
  if (a.kind === 'remove') {
    const name = (a.entry.players && a.entry.players.username) || 'this player'
    return `Remove the entry for ${name}? This cannot be undone.`
  }
  return ''
})

async function load() {
  loading.value = true
  try {
    event.value = await gpAdmin.currentEvent()
    entries.value = event.value ? await gpAdmin.listEntries(event.value.id) : []
    logs.value = await gpAdmin.logs()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    loading.value = false
  }
}

async function run(fn, successMsg) {
  busy.value = true
  try {
    const r = await fn()
    toastService.success(typeof successMsg === 'function' ? successMsg(r) : successMsg)
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

const createEvent = () => gpAdmin.createEvent()

async function doConfirmed() {
  const a = confirmAction.value
  confirmAction.value = null
  if (a === 'recalc') return run(() => gpAdmin.recalcScores(), n => `Recalculated scores for ${n} entries`)
  if (a === 'rankings') return run(() => gpAdmin.fixRankings(), n => `Rankings fixed for ${n} entries`)
  if (a === 'simulate') return run(() => gpAdmin.simulate(), n => `🏆 Simulation complete! ${n} entries ranked.`)
  if (a.kind === 'winner') {
    const name = (a.entry.players && a.entry.players.username) || 'Player'
    return run(() => gpAdmin.setWinner(a.entry.id, name), `${name} set as winner!`)
  }
  if (a.kind === 'remove') {
    const name = (a.entry.players && a.entry.players.username) || 'Player'
    return run(() => gpAdmin.removeEntry(a.entry.id, name), 'Entry removed')
  }
}

const adjust = delta => run(() => gpAdmin.adjustPrize(delta), n => `Prize pool: ${n.toLocaleString()} PP`)

function setPrize() {
  run(() => gpAdmin.setPrize(prizeInput.value), n => `Prize pool set to ${n.toLocaleString()} PP`)
  prizeInput.value = ''
}

function sendNotif() {
  const msg = notifMessage.value
  run(() => gpAdmin.sendNotification(notifTarget.value, msg), n => `Sent to ${n} players`)
  notifMessage.value = ''
}

function editTraining(entry) {
  trainingEdit.value = entry
  trainingValue.value = entry.training_bonus || 0
}

function saveTraining() {
  const entry = trainingEdit.value
  trainingEdit.value = null
  run(() => gpAdmin.editTraining(entry.id, trainingValue.value), v => `Training bonus updated to ${v}`)
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '../../assets/scss/admin.scss';

.ad-prize-input { width: 120px; flex: 0 0 120px; }
.ad-notif-box { min-height: 70px; resize: vertical; }
.ad-mini { font-size: 0.7rem; padding: 2px 7px; flex: 0 0 auto; }

.btn.active {
  background: var(--purple);
  color: #fff;
  border-color: var(--purple);
}
</style>
