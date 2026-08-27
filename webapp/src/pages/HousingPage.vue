<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🏠 ✦ 🏠</div>
      <h1>My Room</h1>
      <p>Decorate your space and show it off! ✨</p>
    </div>

    <!-- Same column as the room below it — see RoomVisitPage's note. -->
    <div class="hp-actions d-flex justify-content-center gap-2 mb-3 flex-wrap">
      <router-link to="/shop" class="btn btn-outline hp-btn">🛒 Buy Furniture</router-link>
      <button class="btn btn-outline hp-btn" @click="share">🔗 Share Room Link</button>
    </div>

    <PlayerRoom />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import PlayerRoom from '../components/room/PlayerRoom.vue'
import { roomService } from '../services/RoomService.js'
import { toastService } from '../services/ToastService.js'
import { AppState } from '../AppState.js'

// Ports room_share(). Legacy fell back to `prompt()` where the clipboard API is
// unavailable; a toast carrying the URL is the same information without a modal
// dialog the page can't style.
async function share() {
  const username = (AppState.player && AppState.player.username) || 'player'
  const url = roomService.shareUrl(username)
  try {
    await navigator.clipboard.writeText(url)
    toastService.success('Room link copied! 🏠 Share it with friends.')
  } catch (e) {
    toastService.info(url)
  }
}

onMounted(() => {
  roomService.load().catch(() => toastService.error('Could not load your room.'))
})
</script>

<style lang="scss" scoped>
// Matches `.player-room-wrap`'s max-width so the row shares the room's column.
.hp-actions {
  max-width: 560px;
  margin-inline: auto;
}

.hp-btn {
  font-size: 0.85rem;
  text-decoration: none;
}
</style>
