<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🎟 ✦ 🎟</div>
      <h1>Redeem a Code</h1>
      <p>Got a special code? Enter it below to claim your reward! ✨</p>
    </div>

    <div class="points-banner">
      <span class="pb-label">🪙 Your PawketPoints</span>
      <span class="pb-amount">{{ points.toLocaleString() }} PP</span>
    </div>

    <div class="redeem-card">
      <div class="redeem-icon">🎟</div>
      <h2>Enter Your Code</h2>
      <p>Codes are handed out during streams, events, and special ARG moments. Check our Twitch and socials!</p>

      <div class="redeem-input-row d-flex flex-wrap gap-2 justify-content-center">
        <input
          v-model="code"
          type="text"
          class="redeem-input"
          placeholder="e.g. PAWKET2025"
          maxlength="40"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="characters"
          spellcheck="false"
          :disabled="busy"
          @keyup.enter="submit"
        />
        <button class="btn btn-primary" :disabled="busy" @click="submit">
          {{ busy ? 'Checking...' : '✨ Redeem!' }}
        </button>
      </div>

      <div v-if="error" class="alert alert-error show mt-3">{{ error }}</div>

      <div v-if="reward" class="redeem-success-panel">
        <div class="redeem-success-icon">🎉</div>
        <div class="redeem-success-title">{{ successTitle }}</div>
        <div class="redeem-success-msg">{{ successMsg }}</div>
        <a
          v-if="reward.lorePage"
          :href="reward.lorePage"
          class="redeem-lore-btn d-inline-block mt-3"
        >🔍 Something feels... off. Click here.</a>
      </div>
    </div>

    <div class="redeem-history-wrap">
      <div class="section-header"><h2>Recently Redeemed</h2><div class="section-line"></div></div>
      <div v-if="loadingHistory" class="spinner"></div>
      <div v-else-if="!history.length" class="redeem-empty">
        No codes redeemed yet!<br>Check streams and socials for codes. 🎟
      </div>
      <div v-else class="redeem-history d-flex flex-column gap-2">
        <div v-for="(h, i) in history" :key="i" class="redeem-history-item d-flex align-items-center flex-wrap gap-2">
          <span class="rhi-code">🎟 {{ h.code }}</span>
          <span class="rhi-desc flex-fill min-w-0">{{ h.description }}</span>
          <span class="rhi-pp" :class="{ lore: !h.pp }">{{ h.pp ? '+' + h.pp + ' PP' : '🔍 Lore' }}</span>
          <span class="rhi-date">{{ h.date }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { redeemService } from '../services/RedeemService.js'
import { spookyEffectService } from '../services/SpookyEffectService.js'
import { toastService } from '../services/ToastService.js'

const code = ref('')
const busy = ref(false)
const error = ref('')
const reward = ref(null)
const history = ref([])
const loadingHistory = ref(true)

const points = computed(() => (AppState.player && AppState.player.pawketpoints) || 0)

const successTitle = computed(() => {
  if (!reward.value) return ''
  // A lore code deliberately says nothing about itself — the ellipsis IS the
  // reward, and the button below is the whole point.
  if (reward.value.lorePage) return '...'
  return reward.value.pp > 0 ? '+' + reward.value.pp + ' PawketPoints!' : 'Code Accepted.'
})

const successMsg = computed(() => {
  if (!reward.value) return ''
  if (reward.value.lorePage) return ''
  return reward.value.description ||
    (reward.value.pp > 0 ? 'Code redeemed successfully!' : 'Something has been unlocked...')
})

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  reward.value = null

  try {
    const res = await redeemService.redeem(code.value)
    if (!res.ok) {
      error.value = res.error
      return
    }

    // The blackout plays before the success panel appears, so the reveal lands
    // as the screen clears rather than being buried under the overlay.
    if (res.reward.spooky) await spookyEffectService.trigger()

    code.value = ''
    reward.value = res.reward
    toastService.success('Code redeemed! 🎉')
    loadHistory()
  } finally {
    busy.value = false
  }
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    history.value = await redeemService.history()
  } finally {
    loadingHistory.value = false
  }
}

onMounted(loadHistory)
</script>

<style lang="scss" scoped>
// The success panel and the history list have NO rules anywhere in style.css —
// `.redeem-success-panel`, `.redeem-history`, `.redeem-history-item`, `.rhi-*`
// and `.redeem-empty` are all referenced by the legacy markup and defined by
// nothing, so on the live site they render as unstyled text. Owned here, in the
// same spirit as `.ach-badge` on the pet card.
.redeem-success-panel {
  margin-top: 20px;
  padding: 22px 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.12), rgba(255, 102, 204, 0.12));
  border: 2px solid var(--purple-light);
  text-align: center;
}

.redeem-success-icon { font-size: 2.4rem; line-height: 1; }

.redeem-success-title {
  font-weight: 900;
  font-size: 1.35rem;
  color: var(--purple-dark);
  margin-top: 6px;
}

.redeem-success-msg {
  font-size: 0.9rem;
  color: var(--text-light);
  margin-top: 6px;
}

.redeem-history-wrap { margin-top: 36px; }

.redeem-history-item {
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--white);
  border: 2px solid var(--border);
}

.rhi-code { font-weight: 800; color: var(--purple-dark); }

.rhi-desc {
  font-size: 0.82rem;
  color: var(--text-light);
}

.rhi-pp {
  font-weight: 800;
  color: var(--green);
  &.lore { color: var(--purple); }
}

.rhi-date {
  font-size: 0.76rem;
  color: var(--text-light);
}

.redeem-empty {
  padding: 28px 16px;
  text-align: center;
  color: var(--text-light);
  font-size: 0.9rem;
  line-height: 1.7;
}
</style>
