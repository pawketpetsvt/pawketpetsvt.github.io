<template>
  <PetModal title="📸 Pet Snapshot" :subtitle="subtitle" width="560px" @close="$emit('close')">
    <div v-if="loading" class="text-center py-4">
      <div class="spinner"></div>
      <div class="sn-loading mt-2">Painting the card…</div>
    </div>

    <div v-else-if="error" class="sn-error rounded-2 p-px14 text-center">{{ error }}</div>

    <template v-else>
      <img :src="shot.url" :alt="`Snapshot of ${petName}`" class="sn-image w-100 rounded-4 d-block mb-tight" />

      <p class="sn-tagline text-center mb-tight">{{ shot.tagline }}</p>

      <div class="row row-cols-2 g-2 mb-2">
        <div class="col">
          <button class="btn btn-primary w-100" @click="share('twitter')">🐦 Twitter</button>
        </div>
        <div class="col">
          <button class="btn btn-primary w-100" @click="share('bluesky')">🦋 Bluesky</button>
        </div>
        <div class="col">
          <button class="btn btn-outline w-100" @click="copyText">📋 Copy Text</button>
        </div>
        <div class="col">
          <button class="btn btn-outline w-100" @click="saveImage">💾 Save Image</button>
        </div>
      </div>
    </template>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PetModal from './PetModal.vue'
import { snapshotService } from '../../services/SnapshotService.js'
import { shareService } from '../../services/ShareService.js'
import { toastService } from '../../services/ToastService.js'

// Ports screenshot_showModal(). Legacy built the overlay by hand and left the
// blob URL alive for the page's lifetime; this revokes it on unmount so a
// player who snapshots several pets doesn't accumulate them in memory.
const props = defineProps({
  petId: { type: [String, Number], required: true },
  petName: { type: String, default: 'your pet' }
})
defineEmits(['close'])

const loading = ref(true)
const error = ref('')
const shot = ref(null)

const subtitle = computed(() => (loading.value || error.value) ? '' : props.petName)

onMounted(async () => {
  try {
    shot.value = await snapshotService.generate(props.petId)
  } catch (err) {
    error.value = 'Failed to generate snapshot: ' + err.message
  }
  loading.value = false
})

onUnmounted(() => {
  if (shot.value && shot.value.url) URL.revokeObjectURL(shot.value.url)
})

function countShare() {
  snapshotService.recordShare()
}

function share(platform) {
  shareService.share(platform, shot.value.tagline, true)
  countShare()
}

async function copyText() {
  try {
    await navigator.clipboard.writeText(shot.value.tagline)
    toastService.success('Copied to clipboard!')
    countShare()
  } catch {
    toastService.error('Could not copy — your browser blocked clipboard access.')
  }
}

function saveImage() {
  const a = document.createElement('a')
  a.href = shot.value.url
  a.download = shot.value.fileName
  a.click()
  countShare()
}
</script>

<style lang="scss" scoped>
// `.snapshot-modal-overlay` and its children are legacy's own hand-built
// overlay, which PetModal replaces — so nothing here reuses those rules.
.sn-loading {
  color: var(--text-light);
  font-size: 0.85rem;
}

.sn-error {
  background: rgba(231, 76, 60, 0.08);
  border: 1px solid rgba(231, 76, 60, 0.25);
  color: #c0392b;
  font-size: 0.88rem;
}

.sn-image {
  max-width: 100%;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}

.sn-tagline {
  font-size: 0.82rem;
  color: var(--text-light);
}
</style>
