<template>
  <PetModal :title="`📖 ${petName}'s Scrapbook`" :subtitle="subtitle" width="520px" @close="$emit('close')">
    <div v-if="loading" class="text-center py-3"><div class="spinner"></div></div>

    <div v-else-if="!memories.length" class="sb-empty text-center">
      <div class="sb-empty-icon mb-px6">📖</div>
      <p class="mb-0">No memories yet — they start filling in as you play together.</p>
    </div>

    <div v-else class="d-flex flex-column gap-2">
      <div v-for="mem in memories" :key="mem.id" class="sb-entry rounded-3 py-tight px-px14">
        <div class="sb-entry-text">{{ mem.memory_text }}</div>
        <div class="sb-entry-meta mt-1 d-flex flex-wrap">
          <span>{{ formatDate(mem.created_at) }}</span>
          <span v-if="mem.weather">· {{ weatherIcon(mem.weather) }}</span>
          <span v-if="mem.mood">· {{ mem.mood }}</span>
        </div>

        <div v-if="editingId === mem.id" class="mt-2">
          <textarea v-model="noteDraft" maxlength="200" class="sb-note-input w-100 rounded-1 py-px6 px-2" placeholder="Add your own note…"></textarea>
          <div class="d-flex gap-2 mt-1">
            <button class="btn btn-primary btn-sm" @click="saveNote(mem)">Save</button>
            <button class="btn btn-outline btn-sm" @click="editingId = null">Cancel</button>
          </div>
        </div>
        <template v-else>
          <div v-if="mem.entry_data && mem.entry_data.note" class="sb-note mt-px6 pt-px6">✍️ {{ mem.entry_data.note }}</div>
          <button class="sb-note-btn" @click="startNote(mem)">
            {{ mem.entry_data && mem.entry_data.note ? 'Edit note' : '✍️ Add a note' }}
          </button>
        </template>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from './PetModal.vue'
import { scrapbookService } from '../../services/ScrapbookService.js'
import { toastService } from '../../services/ToastService.js'
import { WEATHER_TYPES } from '../../data/weatherData.js'

// Ports scrapbook_init() / scrapbook_refreshMemories() / scrapbook_saveNote().
// Legacy mounted this into a `#scrapbook-...` container and tracked the open
// pet in a global (`window.scrapbook_currentPetId`) so a memory written
// elsewhere could refresh it; a component that loads on mount needs neither.
const props = defineProps({
  petId: { type: [String, Number], required: true },
  petName: { type: String, default: 'Your pet' }
})
defineEmits(['close'])

const loading = ref(true)
const memories = ref([])
const editingId = ref(null)
const noteDraft = ref('')

const subtitle = computed(() =>
  memories.value.length ? `${memories.value.length} memories` : '')

onMounted(async () => {
  memories.value = await scrapbookService.load(props.petId)
  loading.value = false
})

function weatherIcon(id) {
  const w = WEATHER_TYPES.find(t => t.id === id)
  return w ? w.icon : ''
}

// Ports scrapbook_formatDate().
function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function startNote(mem) {
  editingId.value = mem.id
  noteDraft.value = (mem.entry_data && mem.entry_data.note) || ''
}

async function saveNote(mem) {
  try {
    await scrapbookService.saveNote(mem.id, noteDraft.value)
    mem.entry_data = { ...(mem.entry_data || {}), note: noteDraft.value }
    editingId.value = null
    toastService.success('Note saved!')
  } catch (err) {
    toastService.error('Could not save note: ' + err.message)
  }
}
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.sb-empty {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

// the global stylesheet has no `.scrapbook-*` or `.sb-*` rule that belongs to this panel —
// the `.sb-*` names it does carry were removed in the Phase 6.75 orphan sweep —
// so the component owns all of it.
.sb-empty {
  padding: 30px;
  color: var(--text-light);
}

.sb-empty-icon {
  font-size: 3rem;
}

.sb-entry {
  background: #fdf6ff;
  border: 1px solid #d4b8ff;
}

.sb-entry-text {
  font-size: 0.88rem;
  color: var(--purple-dark);
  font-style: italic;
}

.sb-entry-meta {
  font-size: 0.7rem;
  color: var(--text-light);
  gap: 5px;
}

.sb-note {
  font-size: 0.78rem;
  color: #7a5ca0;
  border-top: 1px dashed rgba(153, 102, 255, 0.3);
}

.sb-note-btn {
  background: none;
  border: none;
  color: var(--purple);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 4px 0 0;

  &:hover { text-decoration: underline; }
}

.sb-note-input {
  border: 2px solid var(--border);
  font-size: 0.8rem;
  font-family: inherit;
  resize: vertical;
  min-height: 54px;
  box-sizing: border-box;
}
</style>
