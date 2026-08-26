<template>
  <div
    class="friend-card d-flex align-items-center gap-3 px-3 py-2 mb-2 rounded-3"
    :class="{ request: variant === 'request', blocked: variant === 'blocked' }"
  >
    <div class="friend-avatar d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle">
      {{ profile.username.charAt(0).toUpperCase() }}
    </div>
    <div class="flex-grow-1 min-w-0">
      <div class="friend-username" @click="$emit('view-profile', profile.username)">{{ profile.username }}</div>

      <div v-if="variant !== 'blocked'" class="d-flex flex-wrap gap-2 mt-1">
        <span class="friend-stat">🪙 {{ (profile.pawketpoints || 0).toLocaleString() }} PP</span>
        <span class="friend-stat">🐾 {{ profile.petCount || 0 }} Pets</span>
        <span class="friend-stat">⭐ Level {{ profile.totalLevel || 0 }}</span>
        <span class="friend-stat">🎖️ {{ profile.badgeCount || 0 }} Badges</span>
      </div>
      <div v-if="variant === 'friend'" class="mt-1">
        <span class="friend-stat" :class="{ online: profile.isOnline }">{{ profile.lastActiveText }}</span>
      </div>
    </div>

    <div class="d-flex flex-column gap-1 flex-shrink-0">
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
// Layout via Bootstrap utilities in the template; visuals only here.
.friend-card {
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);
}

.friend-avatar {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, var(--purple), var(--pink, #ff66cc));
  color: #fff;
  font-weight: 700;
  font-size: 1.1rem;
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

.friend-stat {
  font-size: 0.74rem;
  color: var(--text-light);

  &.online {
    color: #5dde7a;
  }
}

</style>
