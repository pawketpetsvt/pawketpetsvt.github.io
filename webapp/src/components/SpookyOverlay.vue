<template>
  <div v-if="spookyState.active" class="pp-spooky" aria-hidden="true">
    <div class="pp-spooky-glow"></div>
    <div class="pp-spooky-vignette"></div>
    <div class="pp-spooky-noise"></div>
  </div>
</template>

<script setup>
import { spookyState } from '../services/SpookyEffectService.js'
</script>

<style lang="scss">
// NOT scoped: the desaturation and text-corruption classes are applied to
// <body> and to arbitrary elements across the page by SpookyEffectService, so
// scoping them would stop them matching. Every selector is prefixed `pp-spooky`
// or `pp-text-corrupt`, neither of which exists anywhere in style.css.
//
// Legacy injected all of this as a <style> element at trigger time and removed
// it afterwards; here it just lives in the stylesheet and costs nothing while
// the effect is idle.
.pp-spooky > * {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.pp-spooky-vignette {
  background: radial-gradient(circle at center, transparent 0%, rgba(10, 0, 0, 0.7) 50%, rgba(0, 0, 0, 0.95) 100%);
  z-index: 99998;
  animation: pp-creepy-vignette 3s ease-in-out forwards;
}

.pp-spooky-noise {
  z-index: 99999;
  opacity: 0;
  animation: pp-noise-fade 3s ease-in-out forwards;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.3'/%3E%3C/svg%3E");
}

.pp-spooky-glow {
  box-shadow: inset 0 0 100px rgba(139, 0, 0, 0.3);
  z-index: 99997;
  opacity: 0;
  animation: pp-red-glow 3s ease-in-out forwards;
}

body.pp-spooky-desaturate {
  animation: pp-body-desaturate 3s ease-in-out;
}

.pp-text-corrupt {
  animation: pp-text-corrupt 0.3s ease-in-out;
}

@keyframes pp-creepy-vignette {
  0% { opacity: 0 }
  20% { opacity: 1 }
  80% { opacity: 1 }
  100% { opacity: 0 }
}

@keyframes pp-noise-fade {
  0% { opacity: 0 }
  10% { opacity: 0.4 }
  30% { opacity: 0.2 }
  50% { opacity: 0.5 }
  70% { opacity: 0.3 }
  90% { opacity: 0.4 }
  100% { opacity: 0 }
}

@keyframes pp-red-glow {
  0% { opacity: 0 }
  30% { opacity: 1 }
  70% { opacity: 1 }
  100% { opacity: 0 }
}

@keyframes pp-body-desaturate {
  0% { filter: saturate(1) contrast(1) }
  20% { filter: saturate(0.3) contrast(1.2) brightness(0.8) }
  50% { filter: saturate(0) contrast(1.5) brightness(0.7) }
  80% { filter: saturate(0.3) contrast(1.2) brightness(0.8) }
  100% { filter: saturate(1) contrast(1) brightness(1) }
}

@keyframes pp-text-corrupt {
  0%, 100% { opacity: 1 }
  50% { opacity: 0.6 }
}

// The flicker and the full-page desaturation are exactly what this setting
// exists to suppress. The vignette still plays, so the moment still lands.
body.reduced-motion {
  &.pp-spooky-desaturate { animation: none }
  .pp-spooky-noise, .pp-text-corrupt { animation: none }
}
</style>
