<template>
  <div class="page-wrap">
    <div v-if="loading" class="spinner"></div>

    <div v-else-if="error" class="empty-state">
      <div class="empty-icon">😕</div>
      <p>{{ error }}</p>
      <router-link class="btn btn-outline btn-sm" to="/friends">Back to Friends</router-link>
    </div>

    <template v-else>
      <ProfileHeader :profile="profile" />

      <div v-if="relationship.kind !== 'self'" class="pf-actions">
        <template v-if="relationship.kind === 'blocked'">
          <button class="btn btn-outline" :disabled="busy" @click="unblock">Unblock User</button>
        </template>
        <template v-else-if="relationship.kind === 'accepted'">
          <button class="btn btn-success" disabled>✅ Friends</button>
          <button class="btn btn-outline btn-danger" :disabled="busy" @click="removeFriend">Remove Friend</button>
          <button class="btn btn-outline" :disabled="busy" @click="block">Block</button>
        </template>
        <template v-else-if="relationship.kind === 'pending'">
          <button class="btn btn-outline" disabled>⏳ Request Pending</button>
          <button class="btn btn-outline" :disabled="busy" @click="block">Block</button>
        </template>
        <template v-else>
          <button class="btn btn-primary" :disabled="busy" @click="addFriend">➕ Add Friend</button>
          <button class="btn btn-outline" :disabled="busy" @click="block">Block</button>
        </template>
      </div>

      <ProfileStatCards :profile="profile" :badge-count="badges.length" />

      <h2 class="pf-section-title">🐾 Pets</h2>
      <ProfilePetsGrid :pets="pets" />

      <h2 class="pf-section-title">🎖️ Badges</h2>
      <BadgeGrid :badges="badgeCards" />

      <GuestbookPanel
        v-if="relationship.kind !== 'blocked'"
        :profile-user-id="profile.id"
        :can-post="relationship.kind !== 'self'"
        @view-profile="goToProfile"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
import { profileService } from '../services/ProfileService.js'
import { friendService } from '../services/FriendService.js'
import { toastService } from '../services/ToastService.js'
import ProfileHeader from '../components/profile/ProfileHeader.vue'
import ProfileStatCards from '../components/profile/ProfileStatCards.vue'
import ProfilePetsGrid from '../components/profile/ProfilePetsGrid.vue'
import BadgeGrid from '../components/profile/BadgeGrid.vue'
import GuestbookPanel from '../components/profile/GuestbookPanel.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref('')
const profile = ref(null)
const pets = ref([])
const badges = ref([])
const relationship = ref({ kind: 'none' })
const busy = ref(false)

// A public profile shows only earned badges (game.js:12284-12341), so every
// card is unlocked — flatten the join rows and carry the earned date through.
const badgeCards = computed(() => badges.value.map(b => ({ ...b.badges, earnedAt: b.earned_at })))

function goToProfile(username) {
  router.push('/profile/' + encodeURIComponent(username))
}

async function refreshRelationship() {
  relationship.value = await friendService.getRelationship(profile.value.id)
}

async function load(username) {
  loading.value = true
  error.value = ''
  try {
    profile.value = await profileService.loadProfile(username)
    const [petRows, badgeRows] = await Promise.all([
      profileService.loadProfilePets(profile.value.id),
      profileService.loadEarnedBadges(profile.value.id)
    ])
    pets.value = petRows
    badges.value = badgeRows
    await refreshRelationship()
  } catch (err) {
    error.value = err.message
  }
  loading.value = false
}

async function addFriend() {
  busy.value = true
  try {
    await friendService.sendFriendRequest(profile.value.id, AppState.player ? AppState.player.username : '')
    toastService.success('Friend request sent!')
    await refreshRelationship()
  } catch (err) {
    toastService.error(err.message)
  }
  busy.value = false
}

async function removeFriend() {
  if (!window.confirm('Remove ' + profile.value.username + ' from your friends list?')) return
  busy.value = true
  try {
    await friendService.removeFriend(relationship.value.friendshipId)
    toastService.success('Friend removed')
    await refreshRelationship()
  } catch (err) {
    toastService.error(err.message)
  }
  busy.value = false
}

async function block() {
  if (!window.confirm('Block ' + profile.value.username + '? They will not be able to view your profile or send you messages.')) return
  busy.value = true
  try {
    await friendService.blockUser(profile.value.id)
    toastService.success('User blocked')
    await refreshRelationship()
  } catch (err) {
    toastService.error(err.message)
  }
  busy.value = false
}

async function unblock() {
  busy.value = true
  try {
    await friendService.unblockByUserId(profile.value.id)
    toastService.success('User unblocked')
    await refreshRelationship()
  } catch (err) {
    toastService.error(err.message)
  }
  busy.value = false
}

// Navigating profile→profile (e.g. clicking a guestbook author) reuses this
// same component, so the param has to be watched, not just read on mount.
watch(() => route.params.username, u => { if (u) load(u) })
onMounted(() => load(route.params.username))
</script>

<style lang="scss" scoped>
.pf-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.pf-section-title {
  font-size: 1.15rem;
  color: var(--purple-dark);
  margin: 24px 0 12px;
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
</style>
