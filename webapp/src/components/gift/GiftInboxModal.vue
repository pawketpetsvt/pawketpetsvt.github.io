<template>
  <PetModal title="📬 Gift Inbox" :subtitle="subtitle" width="520px" @close="$emit('close')">
    <div v-if="loading" class="text-center py-3"><div class="spinner"></div></div>

    <div v-else-if="!giftState.inbox.length" class="gi-empty text-center">
      <div class="gi-empty-icon mb-px6">📭</div>
      <p class="mb-0">No pending gifts!</p>
    </div>

    <div v-else class="d-flex flex-column gap-2">
      <div v-for="gift in giftState.inbox" :key="gift.id" class="gift-inbox-item">
        <div class="gift-inbox-icon">🎁</div>
        <div class="gift-inbox-body min-w-0">
          <div class="gift-inbox-from">
            <strong>{{ gift.senderName }}</strong> sent you:
            <strong>{{ gift.itemName }} x{{ gift.quantity }}</strong>
          </div>
          <div v-if="gift.message" class="gift-inbox-msg">"{{ gift.message }}"</div>
          <div class="gift-inbox-meta">
            Expires in {{ gift.expiresInDays }} day{{ gift.expiresInDays === 1 ? '' : 's' }}
          </div>
        </div>
        <div class="gift-inbox-actions">
          <button class="btn btn-primary btn-sm" :disabled="busy === gift.id" @click="accept(gift)">Accept</button>
          <button class="btn btn-outline btn-sm" :disabled="busy === gift.id" @click="decline(gift)">Decline</button>
        </div>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from '../pet/PetModal.vue'
import { giftService, giftState } from '../../services/GiftService.js'
import { toastService } from '../../services/ToastService.js'

// Ports gift_showInboxModal() / gift_loadInbox() / gift_accept() / gift_decline().
//
// Every `.gift-inbox-*` class already exists in style.css, so this owns only the
// empty state (which legacy wrote inline).
defineEmits(['close'])

const loading = ref(true)
const busy = ref(null)

const subtitle = computed(() =>
  giftState.inbox.length ? `${giftState.inbox.length} waiting` : '')

onMounted(async () => {
  await giftService.loadInbox()
  loading.value = false
})

async function accept(gift) {
  busy.value = gift.id
  try {
    await giftService.accept(gift.id)
    toastService.success('🎁 Gift accepted!')
  } catch (err) {
    toastService.error('Error accepting gift: ' + err.message)
  }
  busy.value = null
}

async function decline(gift) {
  busy.value = gift.id
  try {
    await giftService.decline(gift.id)
    toastService.info('Gift declined.')
  } catch (err) {
    toastService.error('Error declining gift')
  }
  busy.value = null
}
</script>

<style lang="scss" scoped>
.gi-empty {
  padding: 30px;
  color: var(--text-light);
}

.gi-empty-icon {
  font-size: 3rem;
}
</style>
