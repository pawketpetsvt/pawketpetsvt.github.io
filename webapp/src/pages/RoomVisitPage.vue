<template>
  <div class="page-wrap">
    <div v-if="loading" class="text-center py-5">
      <div class="spinner"></div>
    </div>

    <div v-else-if="!visitor" class="empty-state">
      <div class="empty-icon">🏠</div>
      <h2>Player not found</h2>
      <p>No one here goes by "{{ username }}".</p>
      <router-link to="/housing" class="btn btn-primary">Back to my room</router-link>
    </div>

    <template v-else>
      <div class="page-hero">
        <div class="sparkle-row">🏠 ✦ 🏠</div>
        <h1>{{ visitor.username }}'s Room</h1>
        <p>Take a look around — you can't move anything. ✨</p>
      </div>

      <!-- Constrained to the room's own column (`.player-room-wrap` is 560px
           and centred) so the actions line up with the room's right edge
           instead of floating at the far edge of the 1100px page wrap. -->
      <div class="rv-actions d-flex justify-content-center gap-2 mb-3 flex-wrap">
        <router-link :to="`/profile/${visitor.username}`" class="btn btn-outline rv-btn">👤 View Profile</router-link>
        <router-link to="/housing" class="btn btn-outline rv-btn">🏠 My Room</router-link>
      </div>

      <PlayerRoom :visitor="visitor" />
    </template>
  </div>
</template>

<script setup>
// Ports room_visitPlayer(). Legacy opened this in a modal AND generated share
// links pointing at `#room/<username>` — but room_checkUrlHash(), the handler
// for that hash, is defined and never called anywhere in game.js, so every
// shared room link on the live site lands on the home page instead. A real route
// is the fix and the modal becomes unnecessary.
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PlayerRoom from '../components/room/PlayerRoom.vue'
import { roomService } from '../services/RoomService.js'

const route = useRoute()
const visitor = ref(null)
const loading = ref(true)
const username = ref('')

async function load(name) {
  username.value = name
  loading.value = true
  visitor.value = null
  try {
    visitor.value = await roomService.loadVisitorRoom(name)
  } catch (e) {
    console.error('[RoomVisitPage]', e)
  } finally {
    loading.value = false
  }
}

// Watched rather than loaded once: room→room navigation reuses this component
// instance, the same pattern ProfilePage uses for its `:username` param.
watch(() => route.params.username, (name) => { if (name) load(name) }, { immediate: true })
</script>

<style lang="scss" scoped>
// Matches `.player-room-wrap`'s max-width so the row shares the room's column.
.rv-actions {
  max-width: 560px;
  margin-inline: auto;
}

.rv-btn {
  font-size: 0.85rem;
  text-decoration: none;
}
</style>
