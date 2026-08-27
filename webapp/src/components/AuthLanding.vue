<template>
  <!-- Ports the `landing-v2` marketing shell that wrapped both the login and
       register forms (index.html:1219-1313 / 1317-1397). Phase 1 ported only
       the form itself, so the whole landing — screenshots, feature list,
       Discord CTA and lore panel — was missing until now.

       No scoped block: every `.landing-v2*` and `.ss-lightbox*` class is fully
       owned by the root style.css, including the 3-column grid and its mobile
       breakpoint. Per the Phase 6.5 rule, a component doesn't restyle what a
       global rule already owns. -->
  <div class="landing-v2">
    <div class="landing-v2-screenshots">
      <template v-for="shot in SHOTS" :key="shot.src">
        <img :src="shot.src" :alt="shot.alt" @click="openLightbox(shot)" />
        <div class="landing-v2-ss-label">{{ shot.label }}</div>
      </template>
    </div>

    <div class="landing-v2-form">
      <!-- Shown only when the visitor arrived through a streamer's
           `?streamer=` link. Legacy swapped this in over the generic hero in
           both auth sections; here one component covers both, since they share
           this shell. -->
      <StreamerHero v-if="streamerLandingState.member" :member="streamerLandingState.member" />

      <div class="landing-v2-logo">
        <img src="/images/logo.png" alt="PawketPetsVT" />
        <div>
          <div class="landing-v2-title">PawketPets<span>VT</span></div>
          <div class="landing-v2-beta">{{ betaLabel }}</div>
        </div>
      </div>

      <!-- The page supplies its own form card here. -->
      <slot />

      <a
        href="https://discord.gg/9TbRZkSJpU"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-discord landing-v2-discord"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        Join our Discord community
      </a>
    </div>

    <div class="landing-v2-info">
      <slot name="info" />
    </div>

    <!-- Ports ssLightbox()/ssLightboxClose() (index.html inline script). The
         `open` class drives the CSS fade, so it is applied one frame after
         mount rather than at creation. -->
    <div
      v-if="lightbox"
      class="ss-lightbox-overlay"
      :class="{ open: lightboxOpen }"
      @click="closeLightbox"
    >
      <button class="ss-lightbox-close" aria-label="Close" @click.stop="closeLightbox">✕</button>
      <img class="ss-lightbox-img" :src="lightbox.src" :alt="lightbox.alt" @click.stop />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onUnmounted } from 'vue'
import StreamerHero from './StreamerHero.vue'
import { streamerLandingState } from '../services/StreamerLandingService.js'

defineProps({
  // "Beta v0.9.2 · 100% Free" on login, "Join the Beta · 100% Free" on register.
  betaLabel: { type: String, required: true }
})

const SHOTS = [
  { src: '/images/screenshot-adopt.png', alt: 'Adopt a Pet', label: '8+ unique VTuber pets' },
  { src: '/images/screenshot-shop.png', alt: 'Item Shop', label: 'Shop, items & equipment' },
  { src: '/images/screenshot-battle.png', alt: 'Battle Arena', label: 'Battle, race & explore' }
]

const lightbox = ref(null)
const lightboxOpen = ref(false)

async function openLightbox(shot) {
  lightbox.value = shot
  await nextTick()
  lightboxOpen.value = true
  window.addEventListener('keydown', onKey)
}

function closeLightbox() {
  lightboxOpen.value = false
  window.removeEventListener('keydown', onKey)
  // Let the 0.2s fade finish before unmounting.
  setTimeout(() => { lightbox.value = null }, 200)
}

function onKey(e) {
  if (e.key === 'Escape') closeLightbox()
}

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
