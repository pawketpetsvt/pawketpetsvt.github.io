<template>
  <div class="notification-bell" @click.stop="toggleDropdown">
    <span class="bell-icon">🔔</span>
    <span v-if="AppState.unreadNotificationCount > 0" class="notification-badge">
      {{ AppState.unreadNotificationCount > 99 ? '99+' : AppState.unreadNotificationCount }}
    </span>
  </div>
  <div v-if="open" class="notification-dropdown" @click.stop>
    <div class="notification-dropdown-header">
      <h3>Notifications</h3>
      <button class="btn-text" @click="markAllRead">Mark all read</button>
    </div>
    <div class="notification-list">
      <div v-if="!AppState.notifications.length" class="notification-empty">No notifications</div>
      <div v-for="n in AppState.notifications" :key="n.id" class="notification-item" :class="{ unread: !n.is_read }">
        <div class="notification-item-title">{{ n.title }}</div>
        <div class="notification-item-message">{{ n.message }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { AppState } from '../AppState.js'
import { notificationService } from '../services/NotificationService.js'

const open = ref(false)
let pollTimer = null

function toggleDropdown() {
  open.value = !open.value
  if (open.value) notificationService.loadRecent(AppState.user.id)
}

function markAllRead() {
  notificationService.markAllRead(AppState.user.id)
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
// Defensive layout rules — force correct box behavior regardless of any
// unrelated global CSS, since this dropdown previously rendered with its
// contents laid out horizontally instead of stacked.
.notification-dropdown {
  display: block;
}

.notification-list {
  display: flex;
  flex-direction: column;
}

.notification-item {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);

  &.unread {
    background: rgba(153, 102, 255, 0.06);
  }
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
