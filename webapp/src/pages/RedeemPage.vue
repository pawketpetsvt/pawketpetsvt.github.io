<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
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

      <div v-if="reward" class="redeem-success-panel mt-gap rounded-4 text-center">
        <div class="redeem-success-icon">🎉</div>
        <div class="redeem-success-title mt-px6">{{ successTitle }}</div>
        <div class="redeem-success-msg mt-px6">{{ successMsg }}</div>
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
      <div v-else-if="!history.length" class="redeem-empty py-wide px-3 text-center">
        No codes redeemed yet!<br>Check streams and socials for codes. 🎟
      </div>
      <div v-else class="redeem-history d-flex flex-column gap-2">
        <div v-for="(h, i) in history" :key="i" class="redeem-history-item d-flex align-items-center flex-wrap gap-2 py-tight px-3 rounded-3">
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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.redeem-card {
  background: var(--white) !important;
  border: 4px solid var(--border) !important;
  border-radius: var(--radius-xl) !important;
  padding: 40px 36px !important;
  max-width: 550px !important;
  margin: 30px auto !important;
  box-shadow: 0 10px 30px rgba(153,102,255,0.25) !important;
  text-align: center !important;
}
.redeem-icon {
  font-size: 4rem !important;
  margin-bottom: 16px !important;
  animation: float 3s ease-in-out infinite !important;
}
.redeem-card h2 {
  font-family: 'Chewy', cursive !important;
  font-size: 2.2rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 12px !important;
  text-shadow: 2px 2px 0 var(--pink-light) !important;
}
.redeem-card p {
  font-size: 1rem !important;
  color: var(--text) !important;
  line-height: 1.7 !important;
  margin-bottom: 24px !important;
  font-weight: 500 !important;
}
.redeem-input-row {
  display: flex !important;
  gap: 12px !important;
  margin-bottom: 20px !important;
}
.redeem-input {
  flex: 1 !important;
  padding: 16px 20px !important;
  border: 4px solid var(--border) !important;
  border-radius: 25px !important;
  font-family: 'Fredoka', cursive !important;
  font-size: 1.1rem !important;
  text-align: center !important;
  background: var(--white) !important;
  color: var(--text) !important;
  text-transform: uppercase !important;
  font-weight: 700 !important;
  letter-spacing: 2px !important;
  transition: all 0.2s !important;
}
.redeem-input:focus {
  outline: none !important;
  border-color: var(--purple) !important;
  box-shadow: 0 0 0 4px rgba(153,102,255,0.2) !important;
  transform: scale(1.02) !important;
}
.redeem-input::placeholder {
  color: var(--text-light) !important;
  opacity: 0.6 !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}
.redeem-lore-btn {
  display: inline-block;
  padding: 12px 24px;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d0d0d 100%);
  color: #ff3838;
  border: 2px solid #ff3838;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 0 20px rgba(255, 56, 56, 0.3), inset 0 0 10px rgba(255, 56, 56, 0.1);
  position: relative;
  overflow: hidden;
  animation: glitch-pulse 3s infinite;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}
.redeem-lore-btn:hover {
  background: linear-gradient(135deg, #2d0d0d 0%, #1a1a1a 100%);
  border-color: #ff0000;
  color: #fff;
  box-shadow: 0 0 30px rgba(255, 0, 0, 0.6), inset 0 0 20px rgba(255, 0, 0, 0.2);
  transform: translateY(-2px);
  animation: glitch-shake 0.5s infinite;
}
.redeem-lore-btn::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, transparent, rgba(255, 56, 56, 0.3), transparent);
  animation: glitch-sweep 4s infinite;
  pointer-events: none;
}

@keyframes glitch-pulse {
  0%, 100% {
    opacity: 1;
    filter: brightness(1);
  }
  50% {
    opacity: 0.9;
    filter: brightness(1.1);
  }
  85% {
    opacity: 1;
    filter: brightness(1);
  }
  87% {
    opacity: 0.7;
    filter: brightness(0.8);
  }
  89% {
    opacity: 1;
    filter: brightness(1);
  }
}

@keyframes glitch-shake {
  0%, 100% { transform: translateY(-2px) translateX(0); }
  25% { transform: translateY(-2px) translateX(-2px); }
  75% { transform: translateY(-2px) translateX(2px); }
}

@keyframes glitch-sweep {
  0% { transform: translateX(-100%) rotate(45deg); }
  100% { transform: translateX(200%) rotate(45deg); }
}

// The success panel and the history list have NO rules anywhere in the global stylesheet —
// `.redeem-success-panel`, `.redeem-history`, `.redeem-history-item`, `.rhi-*`
// and `.redeem-empty` are all referenced by the legacy markup and defined by
// nothing, so on the live site they render as unstyled text. Owned here, in the
// same spirit as `.ach-badge` on the pet card.
.redeem-success-panel {
  padding: 22px 18px;
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.12), rgba(255, 102, 204, 0.12));
  border: 2px solid var(--purple-light);
}

.redeem-success-icon { font-size: 2.4rem; line-height: 1; }

.redeem-success-title {
  font-weight: 900;
  font-size: 1.35rem;
  color: var(--purple-dark);
}

.redeem-success-msg {
  font-size: 0.9rem;
  color: var(--text-light);
}

.redeem-history-wrap { margin-top: 36px; }

.redeem-history-item {
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
  color: var(--text-light);
  font-size: 0.9rem;
  line-height: 1.7;
}
</style>
