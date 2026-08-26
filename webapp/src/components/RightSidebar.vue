<template>
  <!-- `right-sidebar` kept as a styling hook — see LeftSidebar.vue. -->
  <div class="right-sidebar d-flex flex-column gap-3 align-self-start">
    <div class="streamers-widget">
      <div class="sidebar-title">Our Streamers</div>
      <button class="btn btn-outline w-100 mb-3" @click="router.push('/team')">👥 View All Team Members</button>
      <!-- The scrolling lives on this inner list, not on `.streamers-widget`
           itself. The widget carries a decorative dot as a ::before at
           `top: -8px` — deliberately outside its own box — so any overflow
           clipping on the widget would cut that dot in half. -->
      <div class="streamers-scroll">
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
            <a v-if="streamStatus[s.id].live" :href="'https://twitch.tv/' + s.login" target="_blank"
              class="watch-stream-btn">Watch Stream →</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Ports loadSidebarNews() (game.js:10366-10390) — the three most recent
         published posts. `newsService.fetchSidebarNews()` was already ported in
         Phase 2; this widget just never consumed it and sat on a placeholder. -->
    <div class="news-widget">
      <div class="sidebar-title">Latest News</div>
      <div v-if="newsLoading" class="news-placeholder">Loading news...</div>
      <div v-else-if="!newsPosts.length" class="news-placeholder">No news yet!</div>
      <div v-else>
        <div v-for="post in newsPosts" :key="post.id" class="news-item">
          <div class="news-date">{{ formatNewsDate(post) }}</div>
          <div class="news-title">{{ post.content || 'No content' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { STREAMERS, streamStatus, streamStatusService } from '../services/StreamStatusService.js'
import { newsService } from '../services/NewsService.js'

const router = useRouter()
let pollTimer = null

const newsPosts = ref([])
const newsLoading = ref(true)

// Matches legacy's short "Aug 24" style (game.js:10385).
function formatNewsDate(post) {
  return new Date(post.published_at || post.created_at)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

onMounted(async () => {
  streamStatusService.refresh()
  pollTimer = setInterval(() => {
    if (!document.hidden) streamStatusService.refresh()
  }, 300000)

  try {
    newsPosts.value = await newsService.fetchSidebarNews()
  } catch (e) {
    console.error('[RightSidebar] sidebar news failed:', e)
  } finally {
    newsLoading.value = false
  }
})

onUnmounted(() => {
  clearInterval(pollTimer)
})
</script>

<style lang="scss" scoped>
// Scrolls with no visible scrollbar. Moved off `.streamers-widget` so that
// widget can keep `overflow: visible` for its decorative corner dot.
.streamers-scroll {
  max-height: 480px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none; // Firefox
  -ms-overflow-style: none; // legacy Edge/IE

  // Separate rule: a pseudo-element cannot be merged into the block above.
  &::-webkit-scrollbar {
    display: none;
  }
}

.news-placeholder {
  text-align: center;
  padding: 20px;
  color: var(--text-light);
}
</style>
