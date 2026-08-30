<template>
  <PetModal :title="`🎁 Send a Gift`" :subtitle="`To ${toUsername}`" width="430px" @close="$emit('close')">
    <div v-if="loading" class="text-center py-3"><div class="spinner"></div></div>

    <div v-else-if="blocked" class="gm-blocked rounded-2 p-px14 text-center">
      🚫 {{ blocked }}
    </div>

    <template v-else>
      <label class="gm-label" for="gm-item">Select item:</label>
      <select id="gm-item" v-model="itemId" class="gm-input" @change="qty = 1">
        <option v-if="!items.length" value="">No items available</option>
        <option v-for="it in items" :key="it.id" :value="it.id">
          {{ it.name }} (x{{ it.quantity }})
        </option>
      </select>

      <label class="gm-label">Quantity:</label>
      <div class="d-flex align-items-center gap-3 mb-3">
        <button class="gm-qty-btn" :disabled="qty <= 1" @click="qty = Math.max(1, qty - 1)">−</button>
        <span class="gm-qty text-center">{{ qty }}</span>
        <button class="gm-qty-btn" :disabled="qty >= maxQty" @click="qty = Math.min(maxQty, qty + 1)">+</button>
      </div>

      <label class="gm-label" for="gm-msg">Message (optional):</label>
      <textarea id="gm-msg" v-model="message" maxlength="140" placeholder="Say something nice! 💕" class="gm-input gm-textarea mb-1"></textarea>
      <div class="gm-count text-end mb-px10">{{ message.length }}/140</div>

      <div class="gm-meta rounded-2 py-px10 px-px14 mb-px14">
        📦 Gifts remaining today: <strong>{{ remaining }}</strong>
        &nbsp;|&nbsp; Expires in: <strong>{{ GIFT_LIMITS.EXPIRY_DAYS }} days</strong>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-outline flex-fill" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary flex-grow-1" :disabled="sending || !itemId" @click="send">
          {{ sending ? 'Sending…' : '🎁 Send Gift' }}
        </button>
      </div>
    </template>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from '../pet/PetModal.vue'
import { giftService, GIFT_LIMITS } from '../../services/GiftService.js'
import { toastService } from '../../services/ToastService.js'

// Ports gift_showSendModal() / gift_changeQty() / gift_sendGift().
//
// Legacy stashed the quantity on the modal DOM node (`modal._giftQty`) and read
// the item's maximum out of a `data-max` attribute on the <option>; both are
// plain reactive state here, which is also what stops the quantity from
// out-running a newly selected item's stock.
const props = defineProps({
  toUserId: { type: String, required: true },
  toUsername: { type: String, required: true }
})
const emit = defineEmits(['close', 'sent'])

const loading = ref(true)
const blocked = ref('')
const items = ref([])
const itemId = ref('')
const qty = ref(1)
const message = ref('')
const sending = ref(false)
const remaining = ref(0)

const maxQty = computed(() => {
  const it = items.value.find(i => i.id === itemId.value)
  return it ? it.quantity : 1
})

onMounted(async () => {
  const check = await giftService.canSend(props.toUserId)
  if (!check.ok) {
    blocked.value = check.reason
    loading.value = false
    return
  }
  remaining.value = check.remaining
  items.value = await giftService.giftableInventory()
  if (items.value.length) itemId.value = items.value[0].id
  loading.value = false
})

async function send() {
  sending.value = true
  try {
    await giftService.send({
      toUserId: props.toUserId,
      toUsername: props.toUsername,
      itemId: itemId.value,
      quantity: qty.value,
      message: message.value
    })
    toastService.success(`🎁 Gift sent to ${props.toUsername}!`)
    emit('sent')
    emit('close')
  } catch (err) {
    toastService.error(err.message)
  }
  sending.value = false
}
</script>

<style lang="scss" scoped>
// Legacy built this form from an inline-styled HTML string; there is no
// `.gift-send-*` rule in the global stylesheet, so the component owns it. The gift INBOX
// classes do exist globally and are reused by GiftInboxModal.
.gm-label {
  font-weight: 600;
  display: block;
  margin-bottom: 6px;
}

.gm-input {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: 2px solid var(--border);
  font-size: 1rem;
  margin-bottom: 16px;
  box-sizing: border-box;
  font-family: inherit;
}

.gm-textarea {
  resize: none;
  height: 70px;
  font-size: 0.9rem;
}

.gm-count {
  font-size: 0.7rem;
  color: var(--text-light);
}

.gm-qty-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: none;
  font-size: 1.2rem;
  cursor: pointer;
  line-height: 1;

  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.gm-qty {
  font-size: 1.3rem;
  font-weight: 700;
  min-width: 30px;
}

.gm-meta {
  background: rgba(153, 102, 255, 0.08);
  font-size: 0.85rem;
  color: var(--text-light);
}

.gm-blocked {
  background: rgba(231, 76, 60, 0.08);
  border: 1px solid rgba(231, 76, 60, 0.25);
  font-size: 0.88rem;
  color: #c0392b;
}
</style>
