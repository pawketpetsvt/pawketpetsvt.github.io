<template>
  <div
    class="landing-hero streamer-landing-hero rounded-5 pt-wide px-gap pb-4 mb-gap"
    :style="{ background: member.bgGradient || DEFAULT_BG, borderColor: accent }"
  >
    <div class="streamer-landing-pet-wrap">
      <img
        :src="petImageFor(member)"
        :alt="member.petName"
        class="streamer-landing-pet-img"
        :style="{ filter: `drop-shadow(0 0 20px ${accent})` }"
        @error="onImgError"
      />
    </div>

    <div class="streamer-landing-info">
      <div class="streamer-landing-invited">
        <span class="streamer-landing-dot flex-shrink-0" :style="{ background: accent }"></span>
        <span>{{ member.name }} invited you to PawketPets<span :style="{ color: accent }">VT</span>!</span>
      </div>

      <h1 class="landing-title sh-title mt-px10 mb-px6" :style="{ textShadow: `0 2px 12px ${accent}` }">
        Adopt <span :style="{ color: accent }">{{ member.petName }}</span>!
      </h1>

      <p v-if="member.bio" class="sh-bio mb-tight">{{ member.bio }}</p>
      <p class="sh-free mb-px14">Free to play · Your first pet is on us!</p>

      <div class="streamer-landing-links">
        <a
          :href="member.twitchUrl"
          target="_blank"
          rel="noopener"
          class="streamer-landing-twitch-btn"
          :style="{ background: accent, boxShadow: `0 4px 14px ${accent}80` }"
        >🎮 Watch {{ member.name }} on Twitch</a>
      </div>

      <div v-if="member.socialLinks && member.socialLinks.length" class="streamer-landing-socials">
        <a
          v-for="link in member.socialLinks"
          :key="link.url"
          :href="link.url"
          target="_blank"
          rel="noopener"
          class="streamer-landing-social-btn"
          :style="{ borderColor: accent, color: accent }"
        >{{ link.icon }} {{ link.label }}</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { petImageFor } from '../services/StreamerLandingService.js'

const props = defineProps({ member: { type: Object, required: true } })

const DEFAULT_BG = 'linear-gradient(135deg,#1a0a2e 0%,#0a0a1a 100%)'
const accent = computed(() => props.member.accentColor || '#9966ff')

function onImgError(e) {
  e.target.src = '/images/logo.png'
}
</script>

<style lang="scss" scoped>
// Legacy set the hero's box geometry inline on the element and left the inner
// classes to the stylesheet. The per-streamer colours stay bindings (they vary
// per member); the fixed geometry moves here.
.streamer-landing-hero {
  border: 2px solid;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.sh-title {
  font-size: 1.9rem;
  color: #fff;
}

.sh-bio {
  font-size: 0.84rem;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.6;
  // A reading measure for the bio, not a layout step.
  max-width: 340px;
}

.sh-free {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.45);
}

.streamer-landing-invited { color: rgba(255, 255, 255, 0.65); }
</style>
