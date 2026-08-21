<template>
  <div class="right-sidebar">
    <div class="streamers-widget">
      <div class="sidebar-title">Our Streamers</div>
      <div v-for="s in STREAMERS" :key="s.id" class="streamer-item">
        <div class="streamer-avatar">
          <img :src="'/images/' + s.image" :alt="s.name" />
        </div>
        <div class="streamer-info">
          <div class="streamer-name">
            {{ s.name }}
            <span v-if="streamStatus[s.id].live" class="live-indicator">🔴 LIVE</span>
          </div>
          <div class="streamer-status">{{ streamStatus[s.id].live ? 'LIVE' : 'OFFLINE' }}</div>
          <a v-if="streamStatus[s.id].live" :href="'https://twitch.tv/' + s.login" target="_blank" class="watch-stream-btn">Watch Stream →</a>
        </div>
      </div>
      <button class="btn btn-outline" style="width:100%;margin-top:12px;" @click="router.push('/team')">👥 View All Team Members</button>
    </div>

    <div class="news-widget">
      <div class="sidebar-title">Latest News</div>
      <div class="news-placeholder">Coming soon!</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { STREAMERS, streamStatus, streamStatusService } from '../services/StreamStatusService.js'

const router = useRouter()
let pollTimer = null

onMounted(() => {
  streamStatusService.refresh()
  pollTimer = setInterval(() => {
    if (!document.hidden) streamStatusService.refresh()
  }, 300000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})
</script>

<style lang="scss" scoped>
.news-placeholder {
  text-align: center;
  padding: 20px;
  color: var(--text-light);
}
</style>
