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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.news-title {
  font-family: 'Chewy', cursive !important;
  font-size: 1.8rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 12px !important;
  text-shadow: 2px 2px 0 var(--pink-light) !important;
}
.streamer-avatar {
  width: 100px !important;
  height: 100px !important;
  border-radius: 50% !important;
  border: 4px solid var(--purple) !important;
  background: linear-gradient(135deg, var(--purple-light), var(--pink-light)) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 3rem !important;
  margin: 0 auto 12px !important;
  box-shadow: 0 6px 20px rgba(153,102,255,0.3) !important;
  overflow: hidden !important;
}
.streamer-avatar img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.streamer-name {
  font-family: 'Chewy', cursive !important;
  font-size: 1.4rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 6px !important;
  text-shadow: 1px 1px 0 var(--pink-light) !important;
}
.streamers-widget {
  background: var(--white) !important;
  border: 4px solid var(--purple) !important;
  border-radius: var(--radius-xl) !important;
  padding: 16px !important;
  box-shadow:
  0 0 0 2px var(--pink),
  0 6px 20px rgba(153,102,255,0.25) !important;
  position: relative !important;
  flex: 1 !important;
  min-height: 220px !important;
  /* Deliberately NOT scrolling and NOT clipping: the scroll area is the inner
  `.streamers-scroll` list (see RightSidebar.vue), because this element's
  ::before dot sits at top:-8px — outside its own box — and any overflow
  value other than `visible` clips that dot in half. */
}
.streamers-widget::before {
  content: '' !important;
  position: absolute !important;
  top: -8px !important;
  left: 15px !important; /* top-left corner, matching .sidebar-section's dots */
  z-index: 3 !important; /* above the widget's 4px border */
  width: 14px !important;
  height: 14px !important;
  background: #ff0000 !important;
  border-radius: 50% !important;
  border: 3px solid var(--white) !important;
  box-shadow:
  0 2px 4px rgba(0,0,0,0.2),
  0 0 12px rgba(255,0,0,0.6) !important;
  animation: pulse-live-dot 2s ease-in-out infinite !important;
}
.streamer-item {
  background: rgba(153,102,255,0.08) !important;
  border: 3px solid transparent !important;
  border-radius: 16px !important;
  padding: 12px !important;
  margin-bottom: 10px !important;
  transition: all 0.2s !important;
  position: relative !important;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05) !important;
}
.streamer-item:hover {
  background: rgba(153,102,255,0.15) !important;
  transform: translateX(3px) !important;
  border-color: var(--purple-light) !important;
}
.streamer-item.live {
  background: linear-gradient(135deg, rgba(255,0,0,0.1), rgba(255,102,204,0.1)) !important;
  border-color: var(--pink) !important;
  box-shadow:
  0 0 0 2px rgba(255,0,0,0.2),
  0 3px 12px rgba(255,0,0,0.2),
  inset 0 1px 3px rgba(255,255,255,0.3) !important;
}
.streamer-item.live::before {
  content: '🔴 LIVE' !important;
  position: absolute !important;
  top: -8px !important;
  right: -8px !important;
  background: #ff0000 !important;
  color: var(--white) !important;
  font-family: 'Chewy', cursive !important;
  font-size: 0.7rem !important;
  padding: 4px 10px !important;
  border-radius: 12px !important;
  font-weight: 700 !important;
  border: 2px solid var(--white) !important;
  box-shadow:
  0 2px 6px rgba(0,0,0,0.3),
  0 0 16px rgba(255,0,0,0.6) !important;
  animation: pulse-live 2s ease-in-out infinite !important;
  z-index: 10 !important;
}
.streamer-avatar {
  width: 50px !important;
  height: 50px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, var(--purple-light), var(--pink-light)) !important;
  border: 4px solid var(--purple) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.5rem !important;
  overflow: hidden !important;
  flex-shrink: 0 !important;
  box-shadow: 0 0 0 2px var(--white), 0 3px 10px rgba(153,102,255,0.3) !important;
}
.streamer-avatar img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.streamer-info { flex: 1 !important; }
.streamer-name {
  font-family: 'Fredoka', cursive !important;
  font-weight: 700 !important;
  font-size: 1rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 3px !important;
}
.streamer-status {
  font-size: 0.8rem !important;
  color: var(--text-light) !important;
  font-weight: 600 !important;
}
.streamer-status.live {
  color: #ff0000 !important;
  font-weight: 700 !important;
  text-shadow: 0 0 8px rgba(255,0,0,0.4) !important;
}
.news-widget {
  background: var(--white) !important;
  border: 4px solid var(--yellow) !important;
  border-radius: var(--radius-xl) !important;
  padding: 16px !important;
  box-shadow:
  0 0 0 2px var(--orange),
  0 6px 20px rgba(255,153,51,0.25) !important;
  max-height: none !important;
  overflow-y: visible !important;
  flex: 1 !important;
  position: relative !important;
}
.news-widget::before {
  content: '' !important;
  position: absolute !important;
  top: -8px !important;
  right: 20px !important;
  width: 14px !important;
  height: 14px !important;
  background: var(--pink) !important;
  border-radius: 50% !important;
  border: 3px solid var(--white) !important;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
}
.news-item {
  background: rgba(255,221,0,0.1) !important;
  border: 3px solid var(--yellow) !important;
  border-radius: 16px !important;
  padding: 12px !important;
  margin-bottom: 10px !important;
  box-shadow: inset 0 1px 3px rgba(255,255,255,0.3) !important;
  position: relative !important;
}
.news-item:last-child { margin-bottom: 0 !important; }
.streamers-widget::before { animation: pulse-and-float 2.5s ease-in-out infinite !important; }
.news-widget::before { animation: sparkle-bounce 2.8s ease-in-out infinite !important; }
.live-indicator {
  display: inline-block;
  background: linear-gradient(135deg, #ff0000, #ff6b6b);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 8px;
  animation: pulse-live 2s ease-in-out infinite;
  box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.watch-stream-btn {
  display: inline-block !important;
  background: linear-gradient(135deg, var(--purple), var(--pink)) !important;
  color: white !important;
  padding: 6px 12px !important;
  border-radius: 12px !important;
  font-size: 0.85rem !important;
  font-weight: 600 !important;
  margin-top: 6px !important;
  text-decoration: none !important;
  transition: all 0.2s !important;
  box-shadow: 0 2px 8px rgba(153, 102, 255, 0.3) !important;
}
.watch-stream-btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 12px rgba(255, 102, 204, 0.5) !important;
  background: linear-gradient(135deg, var(--pink), var(--purple)) !important;
}
.streamer-status {
  font-size: 0.8rem;
  color: var(--text-light);
  margin-top: 2px;
}
body.night-mode .streamers-widget {
  background: rgba(42, 36, 64, 0.95) !important;
  border: 3px solid #6644aa !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
}
body.night-mode .streamer-item {
  background: rgba(102, 68, 170, 0.2) !important;
  border: 2px solid #6644aa !important;
}
body.night-mode .streamer-name, body.night-mode .streamer-status { color: #e8d5ff !important; }
body.night-mode .news-widget {
  background: rgba(42, 36, 64, 0.95) !important;
  border: 3px solid #6644aa !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
}
body.night-mode .news-widget .news-item {
  background: rgba(102, 68, 170, 0.2) !important;
  border-color: #6644aa !important;
  color: #e8d5ff !important;
}
body.night-mode .news-item { background: rgba(255,255,255,0.04) !important; }

@keyframes pulse-live-dot {
  0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
  50% { opacity: 0.7; transform: translateX(-50%) scale(1.1); }
}

@keyframes pulse-live {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
}

@keyframes pulse-and-float {
  0%, 100% { 
    opacity: 1; 
    transform: translateY(0) scale(1);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 0 12px rgba(255,0,0,0.6);
  }
  25% {
    opacity: 0.8;
    transform: translateY(-3px) scale(1.15);
    box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 20px rgba(255,0,0,0.8);
  }
  50% { 
    opacity: 0.7; 
    transform: translateY(0) scale(1.2);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 0 16px rgba(255,0,0,0.7);
  }
  75% {
    opacity: 0.85;
    transform: translateY(-2px) scale(1.1);
    box-shadow: 0 3px 6px rgba(0,0,0,0.25), 0 0 18px rgba(255,0,0,0.75);
  }
}

@keyframes sparkle-bounce {
  0%, 100% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  20% {
    transform: translateY(-4px) rotate(5deg) scale(1.15);
    opacity: 0.9;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 16px rgba(255,102,204,0.8);
  }
  40% {
    transform: translateY(0) rotate(-3deg) scale(1.1);
    opacity: 1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 0 12px rgba(255,102,204,0.6);
  }
  60% {
    transform: translateY(-2px) rotate(3deg) scale(1.2);
    opacity: 0.95;
    box-shadow: 0 3px 6px rgba(0,0,0,0.25), 0 0 20px rgba(255,102,204,0.9);
  }
  80% {
    transform: translateY(0) rotate(-2deg) scale(1.05);
    opacity: 1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 0 14px rgba(255,102,204,0.7);
  }
}

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
