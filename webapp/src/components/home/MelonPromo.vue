<template>
  <!-- Ports the `.melon-promo` block. The staggered word spans are what
       the global stylesheet animates, so they stay as separate elements rather than one
       string. -->
  <div class="melon-promo">
    <div class="melon-promo-text">
      <span class="melon-promo-word">Visit</span>
      <span class="melon-promo-word melon-promo-word-melons">Melon's</span>
      <span class="melon-promo-word melon-promo-word-melons-2">Melons</span>
      <span class="melon-promo-word">to buy treats for your pets!</span>
    </div>
    <router-link to="/shop" class="melon-promo-image d-block" aria-label="Go to the Shop">
      <img v-if="!imgError" class="d-block w-100 mx-auto" src="/images/Melon2.png"
        alt="Melon, the shopkeeper" @error="imgError = true" />
    </router-link>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Legacy's <img> carried an onerror that drew a red debug border and logged to
// the console, plus an onload log — leftover debugging. A quiet fallback is the
// same pattern PetCard and the profile pets grid already use.
const imgError = ref(false)
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.melon-promo-text {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.6;
  margin-bottom: 16px;
}
.melon-promo-word {
  display: inline-block;
  margin: 0 4px;
  color: var(--text);
}
.melon-promo-word-melons {
  color: #ff6b9d;
  animation: title-bounce 2s ease-in-out infinite;
  text-shadow: 3px 3px 6px rgba(255, 107, 157, 0.4);
  font-size: 1.6rem;
}
.melon-promo-word-melons-2 {
  color: #ffa502;
  animation: title-bounce 2s ease-in-out infinite;
  animation-delay: 0.2s;
  text-shadow: 3px 3px 6px rgba(255, 165, 2, 0.4);
  font-size: 1.6rem;
}
body.night-mode .melon-promo {
  background: rgba(42, 36, 64, 0.9) !important;
  border: 3px solid #6644aa !important;
}
body.night-mode .melon-promo-text { color: #e8d5ff !important; }

@keyframes title-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

// `.melon-promo`, `.melon-promo-text` and `.melon-promo-word` are all owned by
// the global stylesheet. `.melon-promo-image` has no rule anywhere — legacy styled the
// <img> inline — so it lives here.
.melon-promo-image {
  cursor: pointer;

  // A cap on the artwork's rendered size, not a layout step.
  img { max-width: 300px; }
}
</style>
