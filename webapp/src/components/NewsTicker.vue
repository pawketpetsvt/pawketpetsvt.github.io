<template>
  <!-- `news-ticker` is kept as a class hook: `body.night-mode .news-ticker` in
       the global stylesheet recolours the bar, and the global night-mode
       transition group lists it too. Only the base appearance moved here. -->
  <div class="news-ticker position-relative overflow-hidden">
    <!-- The `:key` bump replaces the element on every rotation, which restarts
         the single-run scroll animation. Legacy achieved the same restart by
         cloning the node and re-attaching its listener (game.js:13436-13445);
         letting Vue swap the element is the same effect without the clone. -->
    <span :key="tickerState.tick" class="news-ticker-inner" @animationend="advance">
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
// or 20s below the phone breakpoint, so `animationend` is always well past this
// either way. It matters under the accessibility
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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
body.night-mode .news-ticker {
  background: linear-gradient(90deg, #4a2a6a, #6a4a8a, #4a6a8a) !important;
  border-bottom: 3px solid rgba(153, 102, 255, 0.5) !important;
}

.event-announcement {
  background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
  color: #fff;
  font-weight: bold;
  padding: 2px 12px;
  border-radius: 6px;
  margin-right: 8px;
  box-shadow: 0 2px 8px rgba(255, 68, 68, 0.4);
  animation: eventPulse 2s ease-in-out infinite
}

@keyframes eventPulse {

  0%,
  100% {
    box-shadow: 0 2px 8px rgba(255, 68, 68, 0.4)
  }

  50% {
    box-shadow: 0 2px 12px rgba(255, 68, 68, 0.7)
  }
}

// Ported from legacy style.css:108-127. The `!important` flags there existed to win
// against other global rules; nothing competes for these selectors inside a
// scoped component, so they are dropped. `body.night-mode .news-ticker` still
// carries `!important` globally and so still overrides the background below.
// The navbar's bottom corners are rounded (`border-radius: 0 0 24px 24px`,
// legacy style.css:14315), so the two corner wedges are transparent — and with the
// ticker starting flush below the navbar's box, what showed through there was
// the page background, not the ticker.
//
// The ticker is pulled up BEHIND the navbar by exactly that radius so its
// gradient fills those wedges, with the same amount added back as padding so
// the headline itself does not move. The navbar is `z-index: 100`, so 99 puts
// this underneath it and lets the curve mask the overlap.
$navbar-radius: 24px;

.news-ticker {
  background: linear-gradient(90deg, #ffdd00, #ff9933, #ff66cc);
  color: var(--text);
  padding: (10px + $navbar-radius) 0 10px;
  margin-top: -$navbar-radius;
  z-index: 99;
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
  font-weight: 400;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);
}

// The headline travels this element's OWN width — `padding-left: 100%` (one
// container width) plus the text — and it does so in a fixed 40s. That makes
// the pixel speed proportional to the viewport: roughly 50px/s across a 1400px
// desktop, but only ~25px/s on a 390px phone. Same duration, half the distance,
// so the same headline visibly crawls on mobile.
//
// Halving the duration below the phone breakpoint puts the phone rate back at
// about the desktop one. It is a step change rather than a true constant speed:
// right at 768px this reads brisk (~68px/s), and only a JS-measured duration
// could hold the rate exactly flat across every width. Not worth a resize
// listener for a decorative bar.
//
// Deliberately overriding only `animation-duration`, not the `animation`
// shorthand, so the name/timing/count above stay the single source of truth.
// No `!important`: `body.reduced-motion *` sets `animation-duration: 0.01ms
// !important`, and that must keep winning here.
@media (max-width: 768px) {
  .news-ticker-inner {
    animation-duration: 20s;
  }
}

@keyframes ticker {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-100%);
  }
}

// Matches the legacy `.glitch-text` treatment (legacy style.css:4171-4176), scoped
// here so the ticker keeps it even after that global rule's other users go.
.glitch-text {
  color: #ff0000;
  font-weight: 800;
  text-shadow: 2px 0 #ff0000, -2px 0 #00ff00;
  animation: ticker-glitch 0.3s infinite;
}

@keyframes ticker-glitch {
  0% {
    text-shadow: 2px 0 #ff0000, -2px 0 #00ff00;
    transform: translateX(0);
  }

  25% {
    text-shadow: -2px 0 #ff0000, 2px 0 #00ff00;
    transform: translateX(2px);
  }

  50% {
    text-shadow: 2px 0 #00ff00, -2px 0 #ff0000;
    transform: translateX(-2px);
  }

  100% {
    text-shadow: 2px 0 #ff0000, -2px 0 #00ff00;
    transform: translateX(0);
  }
}

// `.event-announcement` has no rule anywhere in the legacy stylesheet — the
// span renders as plain ticker text. Kept as a real hook without inventing a
// look for it, so the bar reads exactly as it does on the live site.
</style>
