<template>
  <!-- Ports updateLiveBanner() + liveBannerToggle(), game.js:7583-7636. The
       legacy version built this by hand with innerHTML and appended it to
       <body>; here it is a normal component whose markup Vue keeps in sync
       with `liveStreamers`, so the "rebuild the whole banner on every poll"
       step disappears.

       No scoped block on purpose: `#live-banner` and every `.live-banner-*`
       class are fully owned by the root style.css (fixed position, slide-in
       animation, mobile breakpoint). Per the Phase 6.5 rule, where a global
       rule is the sole owner the component does not restyle it. -->
  <div
    v-if="liveStreamers.length"
    id="live-banner"
    :class="[
      'live-banner-collapsed',
      { 'live-banner-single': liveStreamers.length === 1, 'live-banner-open': open }
    ]"
  >
    <div class="live-banner-inner" @click="toggle">
      <span class="live-banner-dot"></span>

      <template v-if="liveStreamers.length === 1">
        <span class="live-banner-text">
          🎮 <strong>{{ liveStreamers[0].name }}</strong> is LIVE!
        </span>
        <a
          class="live-banner-btn"
          :href="liveStreamers[0].twitchUrl"
          target="_blank"
          rel="noopener"
          @click.stop
        >Watch →</a>
      </template>

      <template v-else>
        <span class="live-banner-text">
          🎮 <strong>{{ liveStreamers.length }} streamers</strong> are LIVE!
        </span>
        <span class="live-banner-badge">{{ liveStreamers.length }}</span>
        <span class="live-banner-chevron">{{ open ? '▲' : '▼' }}</span>
      </template>
    </div>

    <div v-if="liveStreamers.length > 1 && open" class="live-banner-list">
      <a
        v-for="s in liveStreamers"
        :key="s.id"
        class="live-banner-list-item"
        :href="s.twitchUrl"
        target="_blank"
        rel="noopener"
      >
        <span class="live-banner-dot live-banner-dot-sm"></span>
        <span class="live-banner-list-name">{{ s.name }}</span>
        <span v-if="s.viewers" class="live-banner-viewers">{{ s.viewers.toLocaleString() }} viewers</span>
        <span class="live-banner-list-btn">Watch →</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { liveStreamers } from '../services/StreamStatusService.js'

const open = ref(false)

function toggle() {
  // A single streamer has no list to expand — its whole row is the link.
  if (liveStreamers.value.length <= 1) return
  open.value = !open.value
}

// Collapse if the count drops to one or zero while expanded, so the banner
// can't be left in an open state with nothing to show.
watch(() => liveStreamers.value.length, (n) => {
  if (n <= 1) open.value = false
})
</script>
