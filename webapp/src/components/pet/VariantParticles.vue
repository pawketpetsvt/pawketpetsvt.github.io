<template>
  <!-- Ports createVariantParticles() (game.js:37801 at 826475d): emoji that
       drift up and fade over a card or the companion sprite while a variant is
       applied. Legacy appended raw DOM nodes on every repaint; here they're
       derived from the variant, so changing or clearing it replaces or removes
       them with no cleanup pass. The parent must be positioned. -->
  <div v-for="(p, i) in particles" :key="variant + i" class="variant-particle position-absolute" :style="p.style">{{ p.emoji }}</div>
</template>

<script setup>
import { computed } from 'vue'
import { VARIANT_PARTICLES } from '../../data/petCardData.js'

const props = defineProps({
  variant: { type: String, default: null },
  // Legacy used 12 on a pet card and 5 on the companion buddy.
  count: { type: Number, default: 12 }
})

const pick = list => list[Math.floor(Math.random() * list.length)]

// Randomised once per variant, not per render, so a reactive update elsewhere
// on the card doesn't reshuffle every particle mid-flight.
const particles = computed(() => {
  if (!props.variant) return []
  const emojis = VARIANT_PARTICLES[props.variant] || ['✨']
  return Array.from({ length: props.count }, () => ({
    emoji: pick(emojis),
    style: {
      fontSize: (14 + Math.random() * 10) + 'px',
      left: (Math.random() * 90) + '%',
      top: (Math.random() * 90) + '%',
      animation: `varParticleFloat ${2 + Math.random() * 2.5}s ease-out ${Math.random() * 3}s infinite`
    }
  }))
})
</script>

<style lang="scss" scoped>
// `varParticleFloat` is global (assets/scss/_animations.scss) and fades in from
// opacity 0, so the resting opacity has to start at 0 too or each particle
// would flash fully visible during its animation delay.
.variant-particle {
  pointer-events: none;
  z-index: 100;
  opacity: 0;
}
</style>
