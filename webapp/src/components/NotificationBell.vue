<template>
  <!-- In the mobile drawer the bell is a row like every other entry, not a
       floating icon: a lone round icon in a vertical list of labelled buttons
       reads as decoration rather than a control. Same component either way, so
       the dropdown, the poll timer and the click-outside handling below are
       shared rather than reimplemented. -->
  <button v-if="asRow" class="nc-item" @click.stop="toggleDropdown">
    🔔<span class="nc-label">Notifications</span>
    <span v-if="AppState.unreadNotificationCount > 0" class="nc-count">
      {{ AppState.unreadNotificationCount > 99 ? '99+' : AppState.unreadNotificationCount }}
    </span>
  </button>
  <div v-else class="notification-bell" @click.stop="toggleDropdown">
    <span class="bell-icon">🔔</span>
    <span v-if="AppState.unreadNotificationCount > 0" class="notification-badge">
      {{ AppState.unreadNotificationCount > 99 ? '99+' : AppState.unreadNotificationCount }}
    </span>
  </div>
  <div v-if="open" class="notification-dropdown d-block" @click.stop>
    <div class="notif-panel d-block w-100">
      <div class="notification-dropdown-header">
        <h3>Notifications</h3>
        <button class="btn-text" @click="markAllRead">Mark all read</button>
      </div>
      <div class="notification-list d-flex flex-column">
        <div v-if="!AppState.notifications.length" class="notification-empty">No notifications</div>
        <div
          v-for="n in AppState.notifications"
          :key="n.id"
          class="notification-item d-flex align-items-start gap-2 w-100 px-px14 py-px10"
          :class="{ unread: !n.is_read }"
          @click="handleClick(n)"
        >
          <span class="notification-item-icon flex-shrink-0">{{ notificationService.getIcon(n.type) }}</span>
          <div class="flex-grow-1 min-w-0">
            <div class="notification-item-title">{{ n.title }}</div>
            <div class="notification-item-message mt-px2">{{ n.message }}</div>
            <div class="notification-item-time">{{ getTimeAgo(new Date(n.created_at)) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
import { notificationService } from '../services/NotificationService.js'
import { getTimeAgo } from '../utils/timeAgo.js'

// `asRow` renders the trigger as a mobile-drawer row instead of the navbar's
// round bell. `.nc-item` / `.nc-label` / `.nc-count` are global (the global stylesheet), so
// this component and NavBar's own rows share one definition.
defineProps({
  asRow: { type: Boolean, default: false }
})

const emit = defineEmits(['open-gifts'])

const router = useRouter()
const open = ref(false)
let pollTimer = null

function toggleDropdown() {
  open.value = !open.value
  if (open.value) notificationService.loadRecent(AppState.user.id)
}

function markAllRead() {
  notificationService.markAllRead(AppState.user.id)
}

// Ports handleNotificationClick(), game.js:22201-22221.
async function handleClick(n) {
  await notificationService.markRead(n.id)
  const target = notificationService.resolveLink(n.link)
  open.value = false
  if (target && target.kind === 'tab') router.push('/' + target.value)
  else if (target && target.kind === 'profile') router.push('/profile/' + encodeURIComponent(target.value))
  // The gift inbox is a modal on the navbar rather than a route, so this asks
  // the navbar to open it.
  else if (target && target.kind === 'gift') emit('open-gifts')
}

// Close on any click outside the bell/dropdown. Both the bell and the
// dropdown stop propagation on their own clicks (see template), so this only
// ever fires for genuine outside clicks — no need to guess at target matching.
function handleOutsideClick() {
  open.value = false
}

onMounted(() => {
  notificationService.refreshBadge(AppState.user.id)
  pollTimer = setInterval(() => {
    if (!document.hidden) notificationService.refreshBadge(AppState.user.id)
  }, 120000)
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  clearInterval(pollTimer)
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.notification-bell {
  position: relative;
  cursor: pointer;
  margin-right: 20px;
  padding: 8px 12px;
  border-radius: 50%;
  transition: background 0.2s, transform 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.notification-bell:hover {
  background: rgba(176, 106, 255, 0.1);
  transform: scale(1.1);
}
.bell-icon {
  font-size: 1.4rem;
  display: block;
}
.notification-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: var(--pink);
  color: white;
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  font-size: 0.7rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 2px solid var(--white);
  animation: pulse-notification 2s ease-in-out infinite;
}
.notification-dropdown {
  position: fixed;
  top: 70px;
  right: 20px;
  width: 380px;
  max-height: 500px;
  background: var(--white);
  border: 2.5px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px var(--shadow);
  z-index: 9999;
  overflow: hidden;
  animation: dropdown-slide-in 0.2s ease-out;
}
.notification-dropdown-header {
  background: linear-gradient(135deg, var(--purple-light), var(--pink-light));
  padding: 16px 20px;
  border-bottom: 2px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.notification-dropdown-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--purple-dark);
  font-family: 'Fredoka One', cursive;
}
.btn-text {
  background: none;
  border: none;
  color: var(--purple);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}
.btn-text:hover { background: rgba(176, 106, 255, 0.1); }
.notification-list {
  max-height: 420px;
  overflow-y: auto;
}
.notification-item {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}
.notification-item:hover { background: rgba(176, 106, 255, 0.05); }
.notification-item.unread {
  background: rgba(255, 192, 203, 0.1);
  border-left: 4px solid var(--pink);
}
.notification-item.unread::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 20px;
  width: 8px;
  height: 8px;
  background: var(--pink);
  border-radius: 50%;
  transform: translateY(-50%);
}
.notification-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-light);
  font-size: 0.9rem;
}
.notification-bell {
  font-size: 18px !important;
  padding: 2px !important;
}
.notification-bell {
  font-size: 20px !important;
  padding: 4px !important;
}
.notification-bell {
  display: inline-flex !important;
  align-items: center !important;
}
.notification-bell {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  padding: 4px 8px !important;
  position: relative !important;
}
.bell-icon { font-size: 1.3rem !important; }
.notification-bell {
  position: relative !important;
  cursor: pointer !important;
  font-size: 1.3rem !important;
  padding: 6px !important;
  background: rgba(255,255,255,0.15) !important;
  border-radius: 50% !important;
  width: 38px !important;
  height: 38px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s !important;
}
.notification-bell:hover {
  background: rgba(255,255,255,0.25) !important;
  transform: scale(1.05) !important;
}
.notification-badge {
  position: absolute !important;
  top: -2px !important;
  right: -2px !important;
  background: #ff4444 !important;
  color: white !important;
  border-radius: 12px !important;
  padding: 2px 6px !important;
  font-size: 10px !important;
  font-weight: bold !important;
}
body.night-mode .notification-dropdown {
  background: #2a2a3a !important;
  border: 2px solid #9966ff !important;
}
body.night-mode .notification-dropdown-header {
  background: linear-gradient(135deg, #4a3a6a, #3a2a5a) !important;
  border-bottom: 2px solid #9966ff !important;
}
body.night-mode .notification-dropdown-header h3 { color: #ffcc66 !important; }
body.night-mode .notification-item {
  border-bottom: 1px solid #4a3a6a !important;
  color: #e8d5ff !important;
}
body.night-mode .notification-item:hover { background: rgba(153,102,255,0.15) !important; }
body.night-mode .notification-item.unread { background: rgba(255,165,2,0.12) !important; border-left: 4px solid #ffa502 !important; }
body.night-mode .notification-empty { color: #b399dd !important; }
.notification-bell {
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(153,102,255,0.1);
  border: 1px solid rgba(153,102,255,0.2);
  transition: background 0.15s;
  flex-shrink: 0;
}
.notification-bell:hover { background: rgba(153,102,255,0.18); }
.bell-icon { font-size: 1rem; line-height: 1; }
.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #e0245e;
  color: #fff;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid var(--bg, #fff);
  pointer-events: none;
  animation: badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1);
}
@media (max-width: 768px) {
  .notification-dropdown {
    right: 10px;
    left: 10px;
    width: auto;
  }
  .notification-dropdown {
    width: 95vw !important;
    right: -10px !important;
    left: auto !important;
  }
}
@media (max-width: 450px) {
  .notification-bell { font-size: 18px !important; }
}

@keyframes pulse-notification {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

@keyframes dropdown-slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes badgePop {
  from { transform: scale(0); }
  to   { transform: scale(1); }
}

// A scoped `display: block` here previously didn't hold — something in the
// 18,791-line global the global stylesheet forces `.notification-dropdown`'s children into
// a horizontal row (the exact rule was never found despite an exhaustive grep).
// The `.notif-panel` wrapper was added to sidestep it, and both now carry
// Bootstrap display utilities instead of scoped declarations. That is strictly
// stronger than what was here before: a utility is `!important`, so it beats
// any non-important rule whatever its specificity — which the plain scoped
// declaration could not do.
.notification-item {
  border-bottom: 1px solid var(--border);
  cursor: pointer;

  &:hover {
    background: rgba(153, 102, 255, 0.1);
  }

  &.unread {
    background: rgba(153, 102, 255, 0.06);
  }
}

.notification-item-icon {
  font-size: 1.1rem;
  line-height: 1.3;
}

.notification-item-time {
  font-size: 0.68rem;
  color: var(--text-light);
  // 3px is below the spacing scale's finest step.
  margin-top: 3px;
}

.notification-item-title {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
}

.notification-item-message {
  font-size: 0.8rem;
  color: var(--text-light);
}
</style>
