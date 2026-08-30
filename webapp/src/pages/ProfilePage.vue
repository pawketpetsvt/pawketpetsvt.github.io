<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div v-if="loading" class="spinner"></div>

    <div v-else-if="error" class="empty-state">
      <div class="empty-icon mb-tight">😕</div>
      <p>{{ error }}</p>
      <router-link class="btn btn-outline btn-sm" to="/friends">Back to Friends</router-link>
    </div>

    <template v-else>
      <ProfileHeader :profile="profile" />

      <div v-if="relationship.kind !== 'self'" class="d-flex gap-2 flex-wrap mt-px14">
        <template v-if="relationship.kind === 'blocked'">
          <button class="btn btn-outline" :disabled="busy" @click="unblock">Unblock User</button>
        </template>
        <template v-else-if="relationship.kind === 'accepted'">
          <button class="btn btn-success" disabled>✅ Friends</button>
          <!-- Stubbed since Phase 5/6 while Gifting was unmigrated. -->
          <button class="btn btn-primary" :disabled="busy" @click="showGift = true">🎁 Send Gift</button>
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

    <SendGiftModal
      v-if="showGift && profile"
      :to-user-id="profile.id"
      :to-username="profile.username"
      @close="showGift = false"
    />
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
import SendGiftModal from '../components/gift/SendGiftModal.vue'
import { petMoodService } from '../services/PetMoodService.js'

const route = useRoute()
const router = useRouter()

const showGift = ref(false)
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
    // A pet can wish to be shown off — legacy sweeps every pet on a profile
    // visit (main:1854 / 11694).
    petMoodService.completeWishAll('view_profile')
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
}
</style>
