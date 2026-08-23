<template>
  <div class="friend-search">
    <div class="friend-search-row">
      <input
        v-model="query"
        class="friend-search-input"
        type="text"
        placeholder="Search players by username..."
        @keyup.enter="search"
      />
      <button class="btn btn-primary btn-sm" @click="search">Search</button>
    </div>

    <div v-if="searching" class="spinner"></div>
    <div v-else-if="searched && !results.length" class="empty-note">No players found matching "{{ lastQuery }}"</div>
    <div v-else class="search-results">
      <div v-for="p in results" :key="p.id" class="friend-card">
        <div class="friend-avatar">{{ p.username.charAt(0).toUpperCase() }}</div>
        <div class="friend-info">
          <div class="friend-username" @click="$emit('view-profile', p.username)">{{ p.username }}</div>
          <div class="friend-stats">
            <span class="friend-stat">🪙 {{ (p.pawketpoints || 0).toLocaleString() }} PP</span>
            <span class="friend-stat">🐾 {{ p.petCount || 0 }} Pets</span>
            <span class="friend-stat">⭐ Level {{ p.totalLevel || 0 }}</span>
            <span class="friend-stat">🎖️ {{ p.badgeCount || 0 }} Badges</span>
          </div>
        </div>
        <div class="friend-actions">
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
.friend-search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.friend-search-input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 0.85rem;
}

.empty-note {
  text-align: center;
  color: var(--text-light);
  font-size: 0.85rem;
  padding: 16px;
}

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
}

.friend-stat {
  font-size: 0.74rem;
  color: var(--text-light);
}

.friend-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
  align-items: flex-end;
}

.self-note {
  font-size: 0.8rem;
  color: var(--text-light);
}
</style>
