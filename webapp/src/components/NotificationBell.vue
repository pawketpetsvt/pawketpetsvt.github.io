<template>
  <div class="notification-bell" @click.stop="toggleDropdown">
    <span class="bell-icon">🔔</span>
    <span v-if="AppState.unreadNotificationCount > 0" class="notification-badge">
      {{ AppState.unreadNotificationCount > 99 ? '99+' : AppState.unreadNotificationCount }}
    </span>
  </div>
  <div v-if="open" class="notification-dropdown" @click.stop>
    <div class="notif-panel">
      <div class="notification-dropdown-header">
        <h3>Notifications</h3>
        <button class="btn-text" @click="markAllRead">Mark all read</button>
      </div>
      <div class="notification-list">
        <div v-if="!AppState.notifications.length" class="notification-empty">No notifications</div>
        <div
          v-for="n in AppState.notifications"
          :key="n.id"
          class="notification-item"
          :class="{ unread: !n.is_read }"
          @click="handleClick(n)"
        >
          <span class="notification-item-icon">{{ notificationService.getIcon(n.type) }}</span>
          <div class="notification-item-body">
            <div class="notification-item-title">{{ n.title }}</div>
            <div class="notification-item-message">{{ n.message }}</div>
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
import { toastService } from '../services/ToastService.js'
import { getTimeAgo } from '../utils/timeAgo.js'

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

// Ports handleNotificationClick(), game.js:22201-22221. Profile links have
// nowhere to go yet (Profile/MyProfile land in Phase 6) — an honest "not
// available yet" toast rather than a dead navigation, same pattern used for
// the Tutorial "Replay" button in Phase 2.
async function handleClick(n) {
  await notificationService.markRead(n.id)
  const target = notificationService.resolveLink(n.link)
  open.value = false
  if (target && target.kind === 'tab') router.push('/' + target.value)
  else if (target && target.kind === 'profile') toastService.info('Profile pages are coming soon!')
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
// The prior `display: block` override here didn't hold — something in the
// 18,791-line global style.css still forces `.notification-dropdown`'s
// children into a horizontal row (couldn't find the exact rule despite an
// exhaustive grep; likely an untraceable cascade/specificity interaction).
// Sidestepping it entirely: wrap the header+list in `.notif-panel`, a class
// that provably doesn't exist anywhere else in style.css, so there's no
// competing rule to lose to at all — same fix pattern used for the
// Treasure Wheel/#dice-don-btns id collisions in Phase 4.
.notification-dropdown {
  display: block;
}

.notif-panel {
  display: block;
  width: 100%;
}

.notification-list {
  display: flex;
  flex-direction: column;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
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
  flex-shrink: 0;
}

.notification-item-body {
  flex: 1;
  min-width: 0;
}

.notification-item-time {
  font-size: 0.68rem;
  color: var(--text-light);
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
  margin-top: 2px;
}
</style>
