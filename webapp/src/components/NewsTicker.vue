<template>
  <!-- `news-ticker` is kept as a class hook: `body.night-mode .news-ticker` in
       the root style.css recolours the bar, and the global night-mode
       transition group lists it too. Only the base appearance moved here. -->
  <div class="news-ticker">
    <!-- The `:key` bump replaces the element on every rotation, which restarts
         the single-run scroll animation. Legacy achieved the same restart by
         cloning the node and re-attaching its listener (game.js:13436-13445);
         letting Vue swap the element is the same effect without the clone. -->
    <span
      :key="tickerState.tick"
      class="news-ticker-inner"
      @animationend="advance"
    >
      <template v-if="tickerState.eventAnnouncement">
        <span class="event-announcement">{{ tickerState.eventAnnouncement }}</span>
        <span> | </span>
      </template>
      <span v-if="tickerState.isSpooky" class="glitch-text">{{ tickerState.message }}</span>
      <template v-else>📰 {{ tickerState.message }} ✨</template>
    </span>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { newsTickerService, tickerState } from '../services/NewsTickerService.js'

// Shortest time a headline stays up. Normally irrelevant — the scroll runs 40s,
// so `animationend` is always well past this. It matters under the accessibility
// "reduced motion" setting, where `body.reduced-motion *` forces
// `animation-duration: 0.01ms`: the animation still completes and still fires
// `animationend`, just immediately, which would spin the rotation as fast as the
// browser can re-render. Legacy has the same flaw (its animationend handler had
// no floor either); flooring the dwell here turns reduced-motion into a calm
// non-scrolling rotation instead of a runaway loop.
const MIN_DWELL_MS = 8000

let lastAdvance = 0
let pending = null

function advance() {
  const elapsed = Date.now() - lastAdvance
  if (elapsed < MIN_DWELL_MS) {
    clearTimeout(pending)
    pending = setTimeout(advance, MIN_DWELL_MS - elapsed)
    return
  }
  lastAdvance = Date.now()
  newsTickerService.next()
}

onMounted(() => {
  lastAdvance = Date.now()
  newsTickerService.start()
})

onUnmounted(() => {
  clearTimeout(pending)
})
</script>

<style lang="scss" scoped>
// Ported from style.css:108-127. The `!important` flags there existed to win
// against other global rules; nothing competes for these selectors inside a
// scoped component, so they are dropped. `body.night-mode .news-ticker` still
// carries `!important` globally and so still overrides the background below.
.news-ticker {
  background: linear-gradient(90deg, #ffdd00, #ff9933, #ff66cc);
  color: var(--text);
  padding: 10px 0;
  overflow: hidden;
  white-space: nowrap;
  font-family: 'Chewy', cursive;
  font-size: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-bottom: 3px solid rgba(255, 255, 255, 0.5);
}

.news-ticker-inner {
  display: inline-block;
  // Single run: `animationend` is what advances to the next headline, so a
  // looping animation would never fire it.
  animation: ticker 40s linear 1;
  padding-left: 100%;
  font-weight: 600;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);
}

@keyframes ticker {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}

// Matches the legacy `.glitch-text` treatment (style.css:4171-4176), scoped
// here so the ticker keeps it even after that global rule's other users go.
.glitch-text {
  color: #ff0000;
  font-weight: 800;
  text-shadow: 2px 0 #ff0000, -2px 0 #00ff00;
  animation: ticker-glitch 0.3s infinite;
}

@keyframes ticker-glitch {
  0%   { text-shadow: 2px 0 #ff0000, -2px 0 #00ff00; transform: translateX(0); }
  25%  { text-shadow: -2px 0 #ff0000, 2px 0 #00ff00; transform: translateX(2px); }
  50%  { text-shadow: 2px 0 #00ff00, -2px 0 #ff0000; transform: translateX(-2px); }
  100% { text-shadow: 2px 0 #ff0000, -2px 0 #00ff00; transform: translateX(0); }
}

// `.event-announcement` has no rule anywhere in the legacy stylesheet — the
// span renders as plain ticker text. Kept as a real hook without inventing a
// look for it, so the bar reads exactly as it does on the live site.
</style>
