<template>
  <div class="notification-bell" @click.stop="toggleDropdown">
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
// A scoped `display: block` here previously didn't hold — something in the
// 18,791-line global style.css forces `.notification-dropdown`'s children into
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
