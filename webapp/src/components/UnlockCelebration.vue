<template>
  <!-- Ports showBadgeNotification() and showUnlockCelebration()
       (game.js:3333-3450). Legacy appended a div to <body> per unlock; here the
       queue is drained one at a time so two unlocks in the same tick can't
       stack on top of each other. -->
  <div v-if="current" :class="panelClass" class="show">
    <button class="unlock-dismiss-btn celebration-dismiss-btn" title="Dismiss" @click="dismiss">✕</button>

    <template v-if="current.kind === 'badge'">
      <div class="badge-notif-icon">{{ current.badge.icon }}</div>
      <div class="badge-notif-content">
        <div class="badge-notif-title">Badge Earned!</div>
        <div class="badge-notif-name">{{ current.badge.name }}</div>
        <div class="badge-notif-desc">{{ current.badge.description || '' }}</div>
        <div class="badge-notif-share">
          <button class="btn-social-mini btn-twitter" @click="shareBadge('twitter')">🐦 Tweet</button>
          <button class="btn-social-mini btn-bluesky" @click="shareBadge('bluesky')">🦋 Post</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="unlock-cel-icon">👑</div>
      <div class="unlock-cel-body">
        <div class="unlock-cel-title">Title Unlocked!</div>
        <div class="unlock-cel-subtitle" :style="{ color: titleColor }">
          {{ current.title.icon || '👑' }} {{ current.title.display_name }}
        </div>
        <button class="unlock-cel-nav-btn" @click="goSetActive">Set as Active →</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { celebrationQueue } from '../services/AwardService.js'
import { shareService } from '../services/ShareService.js'
import { TITLE_RARITY_COLORS } from '../data/playerTitleUnlocks.js'

const router = useRouter()
const current = ref(null)
let timer = null

const panelClass = computed(() =>
  current.value && current.value.kind === 'badge' ? 'badge-notification' : 'unlock-celebration-panel'
)

const titleColor = computed(() => {
  const t = current.value && current.value.title
  if (!t) return '#9966ff'
  return t.color || TITLE_RARITY_COLORS[(t.rarity || '').toLowerCase()] || '#9966ff'
})

function next() {
  clearTimeout(timer)
  current.value = celebrationQueue.items.shift() || null
  // Legacy auto-dismissed after 10s.
  if (current.value) timer = setTimeout(next, 10000)
}

function dismiss() { next() }

function goSetActive() {
  router.push('/myprofile')
  next()
}

function shareBadge(platform) {
  const b = current.value.badge
  const text = `I just earned the "${b.name}" badge ${b.icon} in PawketPetsVT!\n\nJoin me!`
  shareService.share(platform, text, true)
}

// Drain whenever something lands in the queue and nothing is showing.
watch(() => celebrationQueue.items.length, len => {
  if (len > 0 && !current.value) next()
}, { immediate: true })

onUnmounted(() => clearTimeout(timer))
</script>

<style lang="scss" scoped>
// style.css owns .unlock-celebration-panel, .unlock-cel-*, .unlock-dismiss-btn,
// .badge-notification, .badge-notif-* and .btn-social-mini — every class here
// already has a rule. Only the dismiss button's size overrides are local, which
// legacy set inline on the element.
.badge-notification {
  position: relative;
  .celebration-dismiss-btn {
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
}
</style>
