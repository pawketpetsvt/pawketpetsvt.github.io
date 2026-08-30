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

    <template v-else-if="current.kind === 'title'">
      <div class="unlock-cel-icon">👑</div>
      <div class="unlock-cel-body">
        <div class="unlock-cel-title">Title Unlocked!</div>
        <div class="unlock-cel-subtitle" :style="{ color: titleColor }">
          {{ current.title.icon || '👑' }} {{ current.title.display_name }}
        </div>
        <button class="unlock-cel-nav-btn" @click="goSetActive">Set as Active →</button>
      </div>
    </template>

    <!-- Cosmetics (backgrounds, avatar frames, profile badge pips). Ports
         showUnlockCelebration('cosmetic', …), which legacy fires from
         phase1_unlockCosmetic. -->
    <template v-else>
      <div class="unlock-cel-icon">{{ current.emoji || '✨' }}</div>
      <div class="unlock-cel-body">
        <div class="unlock-cel-title">Cosmetic Unlocked!</div>
        <div class="unlock-cel-subtitle">{{ current.name }}</div>
        <div v-if="current.detail" class="unlock-cel-detail mt-px2">{{ current.detail }}</div>
        <button class="unlock-cel-nav-btn" @click="goCosmetics">Equip it →</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { celebrationQueue } from '../services/AwardService.js'
import { soundService } from '../services/SoundService.js'
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
  if (current.value) {
    // Ports the playChiptune() calls in showBadgeNotification() and
    // showUnlockCelebration(). Sounding it here rather than at each enqueue
    // site is what keeps it one bleep per panel: the queue is drained one item
    // at a time, so two unlocks landing in the same tick can't overlap.
    soundService.chiptune('badge')
    timer = setTimeout(next, 10000)
  }
}

function dismiss() { next() }

function goSetActive() {
  router.push('/myprofile')
  next()
}

// The cosmetics panel lives on the player's own profile page, same as the
// title picker.
function goCosmetics() {
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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.badge-notification {
  position: fixed;
  top: 80px;
  right: -400px;
  width: 350px;
  background: linear-gradient(135deg, var(--purple) 0%, var(--pink) 100%);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 8px 32px rgba(176, 106, 255, 0.4);
  transition: right 0.3s ease-out;
  z-index: 10000;
  border: 3px solid rgba(255, 255, 255, 0.3);
}
.badge-notification.show { right: 20px; }
.badge-notif-icon {
  font-size: 3rem;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}
.badge-notif-content { flex: 1; }
.badge-notif-title {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.8);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}
.badge-notif-name {
  font-size: 1.2rem;
  color: white;
  font-weight: bold;
  margin-bottom: 4px;
}
.badge-notif-desc {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.9);
  margin-bottom: 8px;
}
.badge-notif-share {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.btn-social-mini {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 0.75rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}
.btn-social-mini:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}
.btn-twitter { background: linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%); }
.btn-twitter:hover { background: linear-gradient(135deg, #0d8bd9 0%, #0a6fb8 100%); }
.btn-bluesky { background: linear-gradient(135deg, #0085ff 0%, #0066cc 100%); }
.btn-bluesky:hover { background: linear-gradient(135deg, #0066cc 0%, #004d99 100%); }
body.night-mode .badge-notification {
  background: linear-gradient(135deg,#2a2a3a,#1e1e2e) !important;
  border: 3px solid #ffa502 !important;
}
body.night-mode .badge-notif-title { color: #ffcc66 !important; }
body.night-mode .badge-notif-name { color: #e8d5ff !important; }
body.night-mode .badge-notif-desc { color: #b399dd !important; }
.celebration-dismiss-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.3);
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 10;
  line-height: 1;
}
.celebration-dismiss-btn:hover {
  background: rgba(0,0,0,0.6);
  transform: scale(1.15);
}
.unlock-celebration-panel {
  position: fixed;
  bottom: 90px;
  right: 24px;
  z-index: 8500;
  width: 300px;
  background: linear-gradient(135deg, #1a0a2e 0%, #2d1254 100%);
  border: 2px solid rgba(153,102,255,0.6);
  border-radius: 16px;
  padding: 18px 16px 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05);
  display: flex;
  align-items: flex-start;
  gap: 14px;
  opacity: 0;
  transform: translateX(120px);
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
  pointer-events: none;
}
.unlock-celebration-panel.show {
  opacity: 1;
  transform: translateX(0);
  pointer-events: all;
}
.unlock-dismiss-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  color: rgba(255,255,255,0.6);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.unlock-dismiss-btn:hover { background: rgba(255,255,255,0.2); }
.unlock-cel-icon {
  font-size: 2rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}
.unlock-cel-body {
  flex: 1;
  min-width: 0;
}
.unlock-cel-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255,255,255,0.55);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 3px;
}
.unlock-cel-subtitle {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 10px;
  line-height: 1.3;
  word-break: break-word;
}
.unlock-cel-nav-btn {
  display: inline-block;
  background: rgba(153,102,255,0.3);
  border: 1px solid rgba(153,102,255,0.5);
  border-radius: 8px;
  color: #e8d5ff;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 5px 12px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.unlock-cel-nav-btn:hover { background: rgba(153,102,255,0.5); }
.unlock-celebration-panel {
  position: fixed;
  bottom: 90px;
  right: 24px;
  z-index: 8500;
  width: 300px;
  background: linear-gradient(135deg, #1a0a2e 0%, #2d1254 100%);
  border: 2px solid rgba(153,102,255,0.6);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  opacity: 0;
  transform: translateY(30px) scale(0.95);
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
  pointer-events: none;
}
.unlock-celebration-panel.show {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: all;
}
.unlock-dismiss-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  color: rgba(255,255,255,0.5);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.unlock-dismiss-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
.unlock-cel-icon {
  font-size: 2.2rem;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 8px rgba(153,102,255,0.5));
}
.unlock-cel-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.unlock-cel-title {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.5);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.unlock-cel-subtitle {
  font-size: 0.95rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.unlock-cel-nav-btn {
  margin-top: 6px;
  background: rgba(153,102,255,0.25);
  border: 1px solid rgba(153,102,255,0.4);
  border-radius: 8px;
  color: #c4a0ff;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 5px 10px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  white-space: nowrap;
}
.unlock-cel-nav-btn:hover { background: rgba(153,102,255,0.4); color: #fff; }
@media (max-width: 600px) {
  .unlock-celebration-panel {
    bottom: 80px;
    right: 12px;
    left: 12px;
    width: auto;
  }
}

// the global stylesheet owns .unlock-celebration-panel, .unlock-cel-*, .unlock-dismiss-btn,
// .badge-notification, .badge-notif-* and .btn-social-mini — with one exception:
// `.unlock-cel-detail` has no rule anywhere, so it is defined here rather than
// rendering as unstyled body text. Only the dismiss button's size overrides are
// otherwise local, which legacy set inline on the element.
.unlock-cel-detail {
  font-size: 0.75rem;
  opacity: 0.75;
}

// `position: relative` stays scoped rather than becoming a utility: it exists
// to establish the containing block for the absolutely-positioned dismiss
// button nested below, so the two belong together.
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
