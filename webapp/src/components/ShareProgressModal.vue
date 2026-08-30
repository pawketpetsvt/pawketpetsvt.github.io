<template>
  <PetModal title="📤 Share Your Progress" width="440px" @close="$emit('close')">
    <div v-if="loading" class="text-center py-3"><div class="spinner"></div></div>

    <template v-else>
      <textarea :value="text" readonly class="sp-text w-100 p-px10 rounded-1"></textarea>

      <div class="row row-cols-2 g-2 mb-2">
        <div class="col"><button class="btn btn-primary w-100" @click="share('twitter')">🐦 Twitter</button></div>
        <div class="col"><button class="btn btn-primary w-100" @click="share('bluesky')">🦋 Bluesky</button></div>
        <div class="col"><button class="btn btn-outline w-100" @click="copy">📋 Copy Text</button></div>
        <div class="col"><button class="btn btn-outline w-100" @click="nativeShare">📱 Share…</button></div>
      </div>

      <p class="sp-note text-center m-0">Sharing earns you <strong>+100 PP</strong>, once a day.</p>
    </template>
  </PetModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PetModal from './pet/PetModal.vue'
import { shareService } from '../services/ShareService.js'
import { toastService } from '../services/ToastService.js'

// Ports showShareModal(). Legacy's desktop path offered only Twitter and Copy,
// while its mobile path used navigator.share — both are offered here regardless
// of device, with the native sheet degrading to a copy where it is unsupported.
defineEmits(['close'])

const loading = ref(true)
const text = ref('')

onMounted(async () => {
  try {
    text.value = await shareService.progressText()
  } catch (err) {
    toastService.error(err.message)
  }
  loading.value = false
})

async function share(platform) {
  await shareService.share(platform, text.value, true)
  shareService.awardBonus()
}

async function copy() {
  try {
    const url = await shareService.shareUrl(true)
    await navigator.clipboard.writeText(text.value + ' ' + url)
    toastService.success('Copied to clipboard!')
    shareService.awardBonus()
  } catch {
    toastService.error('Could not copy — your browser blocked clipboard access.')
  }
}

async function nativeShare() {
  const url = await shareService.shareUrl(true)
  if (!navigator.share) {
    await copy()
    return
  }
  try {
    await navigator.share({ title: 'My PawketPetsVT Progress', text: text.value, url })
    shareService.awardBonus()
  } catch (err) {
    // A cancelled share sheet is not an error worth surfacing.
    if (err.name !== 'AbortError') toastService.error('Could not open the share sheet.')
  }
}
</script>

<style lang="scss" scoped>
.sp-text {
  height: 100px;
  border: 2px solid var(--border);
  font-family: inherit;
  font-size: 0.85rem;
  margin-bottom: 15px;
  resize: none;
  box-sizing: border-box;
}

.sp-note {
  font-size: 0.78rem;
  color: var(--text-light);
}
</style>
