<template>
  <div>
    <div class="d-flex gap-2 mb-3">
      <input
        v-model="query"
        class="friend-search-input flex-grow-1 px-3 py-2 rounded-3"
        type="text"
        placeholder="Search players by username..."
        @keyup.enter="search"
      />
      <button class="btn btn-primary btn-sm" @click="search">Search</button>
    </div>

    <div v-if="searching" class="spinner"></div>
    <div v-else-if="searched && !results.length" class="empty-note text-center p-3">
      No players found matching "{{ lastQuery }}"
    </div>
    <div v-else>
      <div v-for="p in results" :key="p.id" class="friend-card d-flex align-items-center gap-3 px-3 py-2 mb-2 rounded-3">
        <div class="friend-avatar d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle">
          {{ p.username.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-grow-1 min-w-0">
          <div class="friend-username" @click="$emit('view-profile', p.username)">{{ p.username }}</div>
          <div class="d-flex flex-wrap gap-2 mt-1">
            <span class="friend-stat">🪙 {{ (p.pawketpoints || 0).toLocaleString() }} PP</span>
            <span class="friend-stat">🐾 {{ p.petCount || 0 }} Pets</span>
            <span class="friend-stat">⭐ Level {{ p.totalLevel || 0 }}</span>
            <span class="friend-stat">🎖️ {{ p.badgeCount || 0 }} Badges</span>
          </div>
        </div>
        <div class="d-flex flex-column align-items-end gap-1 flex-shrink-0">
          <span v-if="p.isSelf" class="self-note">This is you!</span>
          <button v-else-if="p.friendshipStatus === 'accepted'" class="btn btn-success btn-sm" disabled>✅ Friends</button>
          <button v-else-if="p.friendshipStatus === 'pending'" class="btn btn-outline btn-sm" disabled>⏳ Request Pending</button>
          <button v-else class="btn btn-primary btn-sm" :disabled="sendingId === p.id" @click="sendRequest(p)">➕ Add Friend</button>
          <button class="btn btn-outline btn-sm" @click="$emit('view-profile', p.username)">View Profile</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { AppState } from '../../AppState.js'
import { friendService } from '../../services/FriendService.js'
import { toastService } from '../../services/ToastService.js'

defineEmits(['view-profile'])

const query = ref('')
const lastQuery = ref('')
const results = ref([])
const searching = ref(false)
const searched = ref(false)
const sendingId = ref('')

async function search() {
  if (!query.value.trim()) { results.value = []; searched.value = false; return }
  searching.value = true
  lastQuery.value = query.value.trim()
  results.value = await friendService.searchPlayers(query.value, AppState.user.id)
  searching.value = false
  searched.value = true
}

async function sendRequest(p) {
  sendingId.value = p.id
  try {
    await friendService.sendFriendRequest(p.id, AppState.player ? AppState.player.username : '')
    toastService.success('Friend request sent to ' + p.username + '! 🎉')
    p.friendshipStatus = 'pending'
  } catch (err) {
    toastService.error(err.message)
  } finally {
    sendingId.value = ''
  }
}
</script>

<style lang="scss" scoped>
// Layout via Bootstrap utilities in the template; visuals only here.
// (These mirror FriendCard.vue's — the two can't share a block because
// scoped styles are per-component, but both are now down to visuals only.)
.friend-search-input {
  border: 1px solid var(--border);
  font-size: 0.85rem;
}

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
}

.empty-note,
.self-note {
  color: var(--text-light);
  font-size: 0.85rem;
}

</style>
