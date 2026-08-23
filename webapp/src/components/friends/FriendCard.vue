<template>
  <div class="friend-card" :class="{ request: variant === 'request', blocked: variant === 'blocked' }">
    <div class="friend-avatar">{{ profile.username.charAt(0).toUpperCase() }}</div>
    <div class="friend-info">
      <div class="friend-username" @click="$emit('view-profile', profile.username)">{{ profile.username }}</div>

      <div v-if="variant !== 'blocked'" class="friend-stats">
        <span class="friend-stat">🪙 {{ (profile.pawketpoints || 0).toLocaleString() }} PP</span>
        <span class="friend-stat">🐾 {{ profile.petCount || 0 }} Pets</span>
        <span class="friend-stat">⭐ Level {{ profile.totalLevel || 0 }}</span>
        <span class="friend-stat">🎖️ {{ profile.badgeCount || 0 }} Badges</span>
      </div>
      <div v-if="variant === 'friend'" class="friend-stats last-active">
        <span class="friend-stat" :class="{ online: profile.isOnline }">{{ profile.lastActiveText }}</span>
      </div>
    </div>

    <div class="friend-actions">
      <template v-if="variant === 'friend'">
        <button class="btn btn-outline btn-sm" @click="$emit('view-profile', profile.username)">View Profile</button>
        <button class="btn btn-outline btn-sm" @click="$emit('visit-room', profile.username)">🏠 Room</button>
        <button class="btn btn-outline btn-sm btn-danger" @click="$emit('remove', profile)">Remove Friend</button>
      </template>
      <template v-else-if="variant === 'request'">
        <button class="btn btn-primary btn-sm" @click="$emit('accept', profile)">Accept</button>
        <button class="btn btn-outline btn-sm" @click="$emit('decline', profile)">Decline</button>
      </template>
      <template v-else-if="variant === 'blocked'">
        <button class="btn btn-outline btn-sm" @click="$emit('unblock', profile)">Unblock</button>
      </template>
    </div>
  </div>
</template>

<script setup>
defineProps({
  profile: { type: Object, required: true },
  variant: { type: String, required: true } // 'friend' | 'request' | 'blocked'
})
defineEmits(['view-profile', 'visit-room', 'remove', 'accept', 'decline', 'unblock'])
</script>

<style lang="scss" scoped>
.friend-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card-bg, #fff);
  margin-bottom: 8px;
}

.friend-avatar {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--purple), var(--pink, #ff66cc));
  color: #fff;
  font-weight: 700;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.friend-username {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--purple-dark);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.friend-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;

  &.last-active {
    margin-top: 3px;
  }
}

.friend-stat {
  font-size: 0.74rem;
  color: var(--text-light);

  &.online {
    color: #5dde7a;
  }
}

.friend-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
</style>
