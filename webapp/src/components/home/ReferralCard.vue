<template>
  <!-- Ports the `.referral-card` block and loadReferralData()'s milestone
       panel. All `.referral-*` classes are owned by style.css; the milestone
       rows were built from inline styles in legacy and are owned here. -->
  <div v-if="data" class="referral-card">
    <div class="referral-header">
      <span class="referral-icon">📨</span>
      <h3>Invite Friends &amp; Earn Rewards!</h3>
    </div>

    <div class="referral-description">
      Share your unique link and both you and your friend get bonus PawketPoints when they join!
    </div>

    <div class="referral-rewards">
      <div class="referral-reward">
        <div class="referral-reward-icon">🎁</div>
        <div class="referral-reward-text"><strong>You Earn:</strong> {{ REFERRER_PP }} PP per friend</div>
      </div>
      <div class="referral-reward">
        <div class="referral-reward-icon">🎁</div>
        <div class="referral-reward-text"><strong>They Earn:</strong> {{ REFEREE_PP }} PP bonus</div>
      </div>
    </div>

    <div class="referral-link-container">
      <input class="referral-link-input" type="text" :value="data.link" readonly @click="$event.target.select()" />
      <button class="referral-copy-btn" @click="copy">{{ copied ? 'Copied!' : 'Copy Link' }}</button>
    </div>

    <div class="referral-stats">
      <div class="referral-stat">
        <span class="referral-stat-label">Total Referrals:</span>
        <span class="referral-stat-value">{{ data.count }}</span>
      </div>
      <div class="referral-stat">
        <span class="referral-stat-label">PP Earned:</span>
        <span class="referral-stat-value">{{ data.count * REFERRER_PP }} PP</span>
      </div>
    </div>

    <div class="rc-milestones mt-3 pt-px14">
      <div class="rc-milestones-title mb-px10">🏆 Referral Milestones</div>

      <div v-if="progress.next" class="mb-tight">
        <div class="rc-progress-label d-flex justify-content-between mb-1">
          <span>Progress to <strong>{{ progress.next.label }}</strong></span>
          <span>{{ data.count }} / {{ progress.next.count }}</span>
        </div>
        <div class="rc-progress-track rounded-5 overflow-hidden">
          <div class="rc-progress-fill h-100 rounded-5" :style="{ width: progress.pct + '%' }"></div>
        </div>
      </div>

      <div v-for="m in REFERRAL_MILESTONES" :key="m.count" class="rc-row d-flex align-items-center gap-2">
        <span class="rc-row-tick">{{ data.count >= m.count ? '✅' : '🔘' }}</span>
        <span class="rc-row-label flex-grow-1 min-w-0" :class="{ 'rc-done': data.count >= m.count }">
          {{ m.label }} <em>({{ m.count }} referrals)</em>
        </span>
        <span class="rc-row-tier" :style="{ color: MILESTONE_TIER_COLORS[m.tier] || '#9966ff' }">
          {{ m.tier.toUpperCase() }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../../AppState.js'
import { referralService } from '../../services/ReferralService.js'
import { toastService } from '../../services/ToastService.js'
import {
  REFERRAL_MILESTONES, MILESTONE_TIER_COLORS, REFERRER_PP, REFEREE_PP
} from '../../data/referralData.js'

const data = ref(null)
const copied = ref(false)

const progress = computed(() => referralService.milestoneProgress(data.value ? data.value.count : 0))

async function copy() {
  try {
    await navigator.clipboard.writeText(data.value.link)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) {
    toastService.info(data.value.link)
  }
}

onMounted(async () => {
  if (!AppState.user) return
  try {
    data.value = await referralService.getOrCreateReferral(AppState.user.id)
  } catch (e) {
    // Same as legacy: if the referral row can't be read, the card simply
    // doesn't render rather than showing a broken shell.
    console.error('[ReferralCard]', e)
  }
})
</script>

<style lang="scss" scoped>
// `.referral-card` is a dark blue→purple gradient with `color: white`
// (style.css:5953), and every class style.css owns inside it uses white or
// rgba-white accordingly. Legacy's milestone panel was built from inline styles
// written against the PAGE background — `var(--purple-dark)` headings,
// `var(--text-light)` sub-text, `#aaa` for completed rows — none of which is
// legible on that gradient. Those greys are replaced with translucent white,
// which reads on the card and keeps the same visual hierarchy.
.rc-milestones {
  border-top: 1px solid rgba(255, 255, 255, 0.25);
}

.rc-milestones-title {
  font-weight: 700;
  font-size: 0.85rem;
  color: #fff;
}

.rc-progress-label {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.9);
}

// 10px is the bar's drawn thickness, not a spacing step.
.rc-progress-track {
  background: rgba(255, 255, 255, 0.2);
  height: 10px;
}

.rc-progress-fill {
  // Solid white rather than the purple→pink gradient: that gradient is barely
  // distinguishable from the card's own purple background behind it.
  background: #fff;
  transition: width 0.5s;
}

.rc-row {
  // 5px is below the spacing scale's finest step.
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 0.8rem;
}

.rc-row-tick { font-size: 1rem; }

.rc-row-label {
  color: #fff;

  em { color: rgba(255, 255, 255, 0.75); }

  // A completed milestone still has to be readable, so it dims rather than
  // greying out — the strikethrough already carries the "done" meaning.
  &.rc-done {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: line-through;

    em { color: rgba(255, 255, 255, 0.55); }
  }
}

.rc-row-tier {
  font-weight: 700;
  font-size: 0.72rem;
  // Tier colours come from the data and are mid-tone (grey/green/blue/purple/
  // orange); on this gradient they need a dark shadow to separate.
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}
</style>
