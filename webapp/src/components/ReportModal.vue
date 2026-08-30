<template>
  <PetModal title="🚩 Report an Issue" width="440px" @close="$emit('close')">
    <label class="rp-label" for="rp-type">What's this about?</label>
    <select id="rp-type" v-model="type" class="rp-input">
      <option v-for="opt in REPORT_TYPES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>

    <label class="rp-label" for="rp-target">Who or what is this about? (optional)</label>
    <input
      id="rp-target"
      v-model="target"
      type="text"
      maxlength="50"
      placeholder="Username, guild name, etc."
      class="rp-input"
    />

    <label class="rp-label" for="rp-desc">Describe the issue</label>
    <textarea
      id="rp-desc"
      v-model="description"
      maxlength="1000"
      placeholder="Please give as much detail as you can..."
      class="rp-input rp-textarea mb-1"
    ></textarea>
    <div class="rp-count" :class="{ near: description.length > 900 }">
      {{ description.length }}/1000
    </div>

    <div class="d-flex gap-2 mt-2">
      <button class="btn btn-outline flex-fill" @click="$emit('close')">Cancel</button>
      <button class="btn btn-primary flex-fill" :disabled="submitting || !description.trim()" @click="submit">
        {{ submitting ? 'Sending…' : 'Submit Report' }}
      </button>
    </div>
  </PetModal>
</template>

<script setup>
import { ref } from 'vue'
import PetModal from './pet/PetModal.vue'
import { supabase } from '../services/SupabaseService.js'
import { AppState } from '../AppState.js'
import { toastService } from '../services/ToastService.js'
import { canPerformAction } from '../utils/RateLimit.js'

// Ports showReportModal() / submitReport() (game.js:16608-16660) — the navbar's
// 🚩 button, and the only way a player can file anything into the
// `player_reports` inbox the Phase 9 admin panel reads. Until now that inbox had
// no in-app way to receive a report at all.
const emit = defineEmits(['close'])

const REPORT_TYPES = [
  { value: 'bug', label: '🐛 Bug / glitch' },
  { value: 'bad_username', label: '🚫 Inappropriate username' },
  { value: 'bad_language', label: '🤬 Bad language / harassment' },
  { value: 'cheating', label: '⚖️ Cheating / exploiting' },
  { value: 'guestbook', label: '📖 Guestbook / chat message' },
  { value: 'other', label: '❓ Something else' }
]

const type = ref('bug')
const target = ref('')
const description = ref('')
const submitting = ref(false)

async function submit() {
  if (!AppState.user) {
    toastService.error('Please log in to submit a report.')
    return
  }
  if (!canPerformAction('submit_report', 5000)) {
    toastService.warning('Please wait before submitting another report.')
    return
  }
  const desc = description.value.trim()
  if (!desc) {
    toastService.warning('Please describe the issue before submitting.')
    return
  }

  submitting.value = true
  try {
    const { error } = await supabase.from('player_reports').insert({
      reporter_id: AppState.user.id,
      report_type: type.value,
      target_text: target.value.trim() || null,
      description: desc,
      status: 'open'
    })
    if (error) throw error
    toastService.success('🚩 Report submitted. Thank you for helping keep PawketPets safe!')
    emit('close')
  } catch (err) {
    toastService.error('Could not submit report: ' + err.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
// Legacy wrote this form as an inline-styled HTML string with no stylesheet
// rules of its own, so the component owns all of it. The one addition is the
// live character count: the field is capped at 1000 and legacy gave no warning
// before the browser silently stopped accepting keystrokes.
.rp-label {
  font-size: 0.82rem;
  font-weight: 700;
  display: block;
  margin-bottom: 4px;
}

.rp-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid var(--border);
  font-size: 0.9rem;
  margin-bottom: 14px;
  box-sizing: border-box;
  font-family: inherit;
}

.rp-textarea {
  font-size: 0.85rem;
  resize: vertical;
  min-height: 90px;
}

.rp-count {
  font-size: 0.7rem;
  color: var(--text-light);
  text-align: right;
  margin-bottom: 8px;

  &.near { color: #e67e22; font-weight: 700; }
}
</style>
