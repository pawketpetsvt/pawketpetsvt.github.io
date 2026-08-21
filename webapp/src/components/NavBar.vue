<template>
  <nav class="navbar">
    <div class="navbar-left">
      <div class="navbar-logo" @click="router.push('/home')">
        <img src="/images/pawket-logo.png" alt="PawketPetsVT" />
        <span>PawketPets</span>
      </div>
      <div class="beta-badge">In Beta</div>
    </div>

    <template v-if="AppState.user">
      <div class="navbar-center">
        <NotificationBell />
      </div>

      <div class="navbar-right">
        <span>⭐ {{ AppState.player?.username }}</span>
        <span>{{ points.toLocaleString() }} PP</span>
        <button class="btn-nav-action" @click="router.push('/myprofile')"><span>👤 Profile</span></button>
        <button class="btn-nav-action" @click="handleLogout"><span>🚪 Logout</span></button>
        <div class="music-controls">
          <button class="music-btn" @click="musicService.toggle()">{{ musicState.playing ? '⏸' : '▶' }}</button>
          <button class="music-btn" @click="musicService.stop()">⏹</button>
          <input type="range" class="music-volume" min="0" max="100" step="5" :value="musicState.volume" @input="musicService.setVolume($event.target.valueAsNumber)" />
        </div>
      </div>
    </template>
    <audio ref="bgMusicEl" loop>
      <source src="/music.mp3" type="audio/mpeg" />
    </audio>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
import { authService } from '../services/AuthService.js'
import { musicService, musicState } from '../services/MusicService.js'
import NotificationBell from './NotificationBell.vue'

const router = useRouter()
const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)

const bgMusicEl = ref(null)

onMounted(() => {
  musicService.registerElement(bgMusicEl.value)
  const startOnFirstClick = () => {
    if (musicState.enabled) musicService.play()
    document.removeEventListener('click', startOnFirstClick)
  }
  document.addEventListener('click', startOnFirstClick, { once: true })
})

async function handleLogout() {
  await authService.logout()
  router.push('/login')
}
</script>
