<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="page-hero">
      <div class="sparkle-row">👥 ✦ 👥</div>
      <h1>Friends</h1>
      <p>Find players, manage requests, and see who's online. 🌐</p>
    </div>

    <FriendSearchBar @view-profile="viewProfile" />

    <div class="d-flex flex-wrap gap-2 mb-3">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="friends-tab d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
        :class="{ active: activeTab === t.key }"
        @click="switchTab(t.key)"
      >
        {{ t.label }}
        <span v-if="t.count.value.length" class="tab-badge px-2 rounded-pill">{{ t.count.value.length }}</span>
      </button>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <div v-if="activeTab === 'list'">
        <div v-if="!friends.length" class="empty-state">
          <div class="empty-icon">👥</div>
          <p>No friends yet!</p>
          <p class="empty-sub mt-1">Search for players above to send friend requests.</p>
        </div>
        <FriendCard
          v-for="f in friends"
          :key="f.friendshipId"
          :profile="f"
          variant="friend"
          @view-profile="viewProfile"
          @visit-room="visitRoom"
          @remove="removeFriend"
        />
      </div>

      <div v-else-if="activeTab === 'requests'">
        <div v-if="!requests.length" class="empty-state">
          <div class="empty-icon">📬</div>
          <p>No pending friend requests</p>
        </div>
        <FriendCard
          v-for="r in requests"
          :key="r.friendshipId"
          :profile="r"
          variant="request"
          @accept="acceptRequest"
          @decline="declineRequest"
        />
      </div>

      <div v-else>
        <div v-if="!blocked.length" class="empty-state">
          <div class="empty-icon">✅</div>
          <p>No blocked users</p>
        </div>
        <FriendCard v-for="b in blocked" :key="b.blockId" :profile="b" variant="blocked" @unblock="unblockUser" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
import { friendService } from '../services/FriendService.js'
import { toastService } from '../services/ToastService.js'
import FriendSearchBar from '../components/friends/FriendSearchBar.vue'
import FriendCard from '../components/friends/FriendCard.vue'

const router = useRouter()

const loading = ref(true)
const activeTab = ref('list')
const friends = ref([])
const requests = ref([])
const blocked = ref([])
const loadedTabs = new Set(['list'])

// Refs are passed through so the badge counts stay reactive inside v-for.
const TABS = [
  { key: 'list', label: '👥 Friends', count: friends },
  { key: 'requests', label: '📬 Requests', count: requests },
  { key: 'blocked', label: '🚫 Blocked', count: blocked }
]

function viewProfile(username) {
  router.push('/profile/' + encodeURIComponent(username))
}

function visitRoom(username) {
  router.push('/room/' + encodeURIComponent(username))
}

async function switchTab(tab) {
  activeTab.value = tab
  if (loadedTabs.has(tab)) return
  loadedTabs.add(tab)
  if (tab === 'requests') requests.value = await friendService.loadFriendRequests(AppState.user.id)
  else if (tab === 'blocked') blocked.value = await friendService.loadBlockedUsers(AppState.user.id)
}

async function removeFriend(profile) {
  if (!window.confirm('Remove ' + profile.username + ' from your friends list?')) return
  try {
    await friendService.removeFriend(profile.friendshipId)
    friends.value = friends.value.filter(f => f.friendshipId !== profile.friendshipId)
    toastService.success('Friend removed')
  } catch (err) {
    toastService.error(err.message)
  }
}

async function acceptRequest(profile) {
  try {
    await friendService.acceptFriendRequest(profile.friendshipId, profile.requesterId, AppState.player ? AppState.player.username : '')
    requests.value = requests.value.filter(r => r.friendshipId !== profile.friendshipId)
    friends.value = await friendService.loadFriendsList(AppState.user.id)
    toastService.success('Friend request accepted! 🎉')
  } catch (err) {
    toastService.error(err.message)
  }
}

async function declineRequest(profile) {
  try {
    await friendService.declineFriendRequest(profile.friendshipId)
    requests.value = requests.value.filter(r => r.friendshipId !== profile.friendshipId)
    toastService.info('Friend request declined')
  } catch (err) {
    toastService.error(err.message)
  }
}

async function unblockUser(profile) {
  if (!window.confirm('Unblock ' + profile.username + '?')) return
  try {
    await friendService.unblockUser(profile.blockId)
    blocked.value = blocked.value.filter(b => b.blockId !== profile.blockId)
    toastService.success('User unblocked')
  } catch (err) {
    toastService.error(err.message)
  }
}

onMounted(async () => {
  friends.value = await friendService.loadFriendsList(AppState.user.id)
  loading.value = false
})
</script>

<style lang="scss" scoped>
// Layout via Bootstrap utilities in the template; visuals only here.
.friends-tab {
  border: 1px solid var(--border);
  background: transparent;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-light);
  cursor: pointer;

  &.active {
    background: var(--purple);
    border-color: var(--purple);
    color: #fff;
  }
}

.tab-badge {
  background: rgba(0, 0, 0, 0.15);
  font-size: 0.7rem;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-light);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.empty-sub {
  font-size: 0.85rem;
}
</style>
