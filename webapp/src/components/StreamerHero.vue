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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.streamer-landing-hero {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 32px 20px 24px;
  text-align: left;
  justify-content: center;
}
.streamer-landing-pet-wrap { flex-shrink: 0; }
.streamer-landing-pet-img {
  width: 130px;
  height: 130px;
  object-fit: contain;
  filter: drop-shadow(0 6px 16px rgba(153,102,255,0.4));
  animation: float 3s ease-in-out infinite;
}
.streamer-landing-info { max-width: 380px; }
.streamer-landing-invited {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--text-light);
  font-weight: 600;
  margin-bottom: 4px;
}
.streamer-landing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--purple);
  flex-shrink: 0;
}
.streamer-landing-links {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.streamer-landing-twitch-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #9147ff;
  color: #fff !important;
  text-decoration: none !important;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 0.84rem;
  font-weight: 700;
  transition: background 0.15s, transform 0.15s;
  box-shadow: 0 3px 10px rgba(145,71,255,0.35);
}
.streamer-landing-twitch-btn:hover {
  background: #772ce8;
  transform: translateY(-1px);
}
.streamer-landing-socials {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.streamer-landing-social-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none !important;
  transition: opacity 0.15s, transform 0.12s;
  background: rgba(255,255,255,0.06);
}
.streamer-landing-social-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}
.landing-title {
  font-family: 'Chewy', cursive;
  font-size: clamp(2.2rem, 6vw, 3.2rem);
  color: var(--purple-dark);
  text-shadow: 3px 3px 0 var(--pink-light), -1px -1px 0 rgba(255,255,255,0.8);
  margin: 0 0 12px 0;
  letter-spacing: 1px;
}
@media (max-width: 600px) {
  .streamer-landing-hero {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }
  .streamer-landing-links { justify-content: center; }
}

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
