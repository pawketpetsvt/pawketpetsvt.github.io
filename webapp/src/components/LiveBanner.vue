<template>
  <!-- Ports updateLiveBanner() + liveBannerToggle(), game.js:7583-7636. The
       legacy version built this by hand with innerHTML and appended it to
       <body>; here it is a normal component whose markup Vue keeps in sync
       with `liveStreamers`, so the "rebuild the whole banner on every poll"
       step disappears.

       `live-banner-collapsed`, `live-banner-single` and `live-banner-open`
       used to be bound here and have been dropped: none of the three has a
       rule anywhere, in this stylesheet or the original. They are vestigial
       from the legacy version, which drove the banner's open/closed state by
       toggling classes; this one uses `v-if` and `open` directly. -->
  <div v-if="liveStreamers.length" id="live-banner">
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

<style lang="scss" scoped>
// Moved here wholesale from the global stylesheet (Phase 11). Deliberately NOT converted to
// Bootstrap utilities: almost every declaration is a colour, gradient, shadow
// or a non-token pixel size, and the two or three that a utility could express
// (`d-flex`, `align-items-center`) would split single rules across the template
// and this block — two places to look instead of one, which is the opposite of
// what this phase is for.
#live-banner {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 8000;
  min-width: 260px;
  max-width: 340px;
  background: linear-gradient(135deg, #1a0a2e 0%, #2d1254 100%);
  border: 2px solid rgba(153, 102, 255, 0.5);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  animation: live-banner-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;

  // Full-width along the bottom edge on a phone, where a 340px card pinned to
  // one corner leaves the streamer names too cramped to read.
  @media (max-width: 600px) {
    bottom: 16px;
    right: 12px;
    left: 12px;
    max-width: none;
  }
}

.live-banner-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
}

.live-banner-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff4444;
  flex-shrink: 0;
  animation: live-dot-pulse 1.4s ease-in-out infinite;
  box-shadow: 0 0 6px #ff4444;
}

.live-banner-dot-sm {
  width: 8px;
  height: 8px;
}

.live-banner-text {
  // `flex: 1` is `1 1 0%` — the zero basis is what lets a long streamer name
  // shrink instead of pushing the Watch button off the card. Bootstrap's
  // `flex-grow-1` is not equivalent: it leaves the basis at `auto`.
  flex: 1;
  font-size: 0.88rem;
  color: #e8d5ff;
  font-weight: 500;
  line-height: 1.3;

  strong {
    color: #fff;
    font-weight: 700;
  }
}

.live-banner-btn {
  display: inline-block;
  background: #9147ff;
  color: #fff !important;
  text-decoration: none !important;
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  transition: background 0.15s;
  flex-shrink: 0;

  &:hover { background: #772ce8; }
}

.live-banner-badge {
  background: #ff4444;
  color: #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
}

.live-banner-chevron {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.live-banner-list {
  border-top: 1px solid rgba(153, 102, 255, 0.25);
  padding: 6px 0;
}

.live-banner-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  text-decoration: none !important;
  transition: background 0.12s;

  &:hover { background: rgba(153, 102, 255, 0.15); }
}

.live-banner-list-name {
  flex: 1;
  font-size: 0.84rem;
  color: #e8d5ff;
  font-weight: 600;
}

.live-banner-viewers {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
}

.live-banner-list-btn {
  font-size: 0.74rem;
  color: #9147ff;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

@keyframes live-banner-slide-in {
  from { transform: translateY(120px); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

@keyframes live-dot-pulse {
  0%, 100% { opacity: 1;   transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.85); }
}
</style>
