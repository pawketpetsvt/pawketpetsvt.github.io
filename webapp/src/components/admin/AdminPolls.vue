<template>
  <PetModal title="🗳️ Poll Management" @close="$emit('close')">
    <!-- Create form -->
    <template v-if="creating">
      <button class="btn btn-outline btn-sm mb-3" @click="creating = false">← Back to polls</button>

      <label class="ad-label">Question</label>
      <input v-model="form.question" type="text" placeholder="What should we do next?" class="ad-input mb-3" />

      <label class="ad-label">Type</label>
      <select v-model="form.pollType" class="ad-input mb-3">
        <option v-for="t in POLL_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>

      <label class="ad-label">Duration</label>
      <select v-model.number="form.durationDays" class="ad-input mb-3">
        <option v-for="d in POLL_DURATIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
      </select>

      <label class="ad-label">Options (min 2, max {{ MAX_POLL_OPTIONS }})</label>
      <div v-for="(o, i) in form.options" :key="i" class="d-flex gap-1 mb-1">
        <input v-model="o.icon" type="text" placeholder="📌" class="ad-input ad-icon-input" />
        <input v-model="o.text" type="text" :placeholder="`Option ${i + 1} text`" class="ad-input flex-fill" />
        <input v-model="o.description" type="text" placeholder="Description" class="ad-input ad-desc-input" />
        <button v-if="form.options.length > 2" class="ad-remove-opt" @click="form.options.splice(i, 1)">✕</button>
      </div>
      <button
        class="btn btn-outline btn-sm mb-3"
        :disabled="form.options.length >= MAX_POLL_OPTIONS"
        @click="addOption"
      >+ Add Option</button>

      <button class="btn btn-primary w-100" :disabled="busy" @click="create">
        {{ busy ? 'Creating...' : 'Create Poll' }}
      </button>
    </template>

    <!-- Results -->
    <template v-else-if="results">
      <button class="btn btn-outline btn-sm mb-3" @click="results = null">← Back to polls</button>
      <p class="text-center ad-results-q">
        <strong>{{ results.poll.question }}</strong><br />
        <span class="ad-muted">{{ results.total }} total votes</span>
      </p>
      <div v-for="(r, i) in results.rows" :key="i" class="mb-3">
        <div class="d-flex justify-content-between mb-1">
          <span>{{ r.icon }} {{ r.text }}</span>
          <span class="ad-muted">{{ r.count }} ({{ r.pct }}%)</span>
        </div>
        <div class="ad-bar-track"><div class="ad-bar-fill" :style="{ width: r.pct + '%' }"></div></div>
      </div>
    </template>

    <!-- List -->
    <template v-else>
      <button class="btn btn-primary w-100 mb-3" @click="creating = true">+ Create New Poll</button>
      <div v-if="loading" class="spinner"></div>
      <div v-else-if="!polls.length" class="ad-empty">No polls yet.</div>
      <div v-for="p in polls" :key="p.id" class="ad-card">
        <div class="ad-card-title">{{ p.question }}</div>
        <div class="ad-card-meta">
          Status: {{ p.is_active ? '🟢 Active' : '🔴 Ended' }} |
          Ends: {{ new Date(p.ends_at).toLocaleDateString() }} |
          Votes: {{ p.total_votes || 0 }}
        </div>
        <div class="d-flex gap-1 flex-wrap">
          <button class="btn btn-sm btn-outline" @click="viewResults(p)">📊 Results</button>
          <button v-if="p.is_active" class="btn btn-sm btn-outline" @click="end(p)">⏹️ End</button>
          <button class="btn btn-sm btn-outline ad-danger" @click="confirmDelete = p">🗑️ Delete</button>
        </div>
      </div>
    </template>

    <!-- Delete confirmation. Legacy used window.confirm; an in-app dialog keeps
         the destructive action inside the same surface. -->
    <PetModal
      v-if="confirmDelete"
      title="Delete this poll?"
      @close="confirmDelete = null"
    >
      <p class="ad-confirm">
        "{{ confirmDelete.question }}" and all of its votes will be permanently removed.
      </p>
      <div class="d-flex gap-2">
        <button class="btn btn-outline flex-fill" @click="confirmDelete = null">Cancel</button>
        <button class="btn btn-primary flex-fill ad-danger-btn" :disabled="busy" @click="remove">Delete</button>
      </div>
    </PetModal>
  </PetModal>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import PetModal from '../pet/PetModal.vue'
import { toastService } from '../../services/ToastService.js'
import {
  adminService, POLL_TYPES, POLL_DURATIONS, MAX_POLL_OPTIONS
} from '../../services/AdminService.js'

defineEmits(['close'])

const polls = ref([])
const loading = ref(true)
const creating = ref(false)
const results = ref(null)
const confirmDelete = ref(null)
const busy = ref(false)

const form = reactive({
  question: '',
  pollType: 'community',
  durationDays: 3,
  options: [
    { icon: '', text: '', description: '' },
    { icon: '', text: '', description: '' }
  ]
})

function addOption() {
  if (form.options.length >= MAX_POLL_OPTIONS) return
  form.options.push({ icon: '', text: '', description: '' })
}

async function load() {
  loading.value = true
  try {
    polls.value = await adminService.listPolls()
  } finally {
    loading.value = false
  }
}

async function create() {
  busy.value = true
  try {
    await adminService.createPoll(form)
    toastService.success('✅ Poll created!')
    form.question = ''
    form.options = [{ icon: '', text: '', description: '' }, { icon: '', text: '', description: '' }]
    creating.value = false
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

async function viewResults(p) {
  try {
    results.value = await adminService.pollResults(p.id)
  } catch (e) {
    toastService.error(e.message)
  }
}

async function end(p) {
  try {
    await adminService.endPoll(p.id)
    toastService.info('Poll ended')
    await load()
  } catch (e) {
    toastService.error(e.message)
  }
}

async function remove() {
  busy.value = true
  try {
    await adminService.deletePoll(confirmDelete.value.id)
    toastService.info('Poll deleted')
    confirmDelete.value = null
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '../../assets/scss/admin.scss';
</style>
