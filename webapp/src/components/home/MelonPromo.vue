<template>
  <!-- Ports the `.melon-promo` block. The staggered word spans are what
       style.css animates, so they stay as separate elements rather than one
       string. -->
  <div class="melon-promo">
    <div class="melon-promo-text">
      <span class="melon-promo-word">Visit</span>
      <span class="melon-promo-word melon-promo-word-melons">Melon's</span>
      <span class="melon-promo-word melon-promo-word-melons-2">Melons</span>
      <span class="melon-promo-word">to buy treats for your pets!</span>
    </div>
    <router-link to="/shop" class="melon-promo-image" aria-label="Go to the Shop">
      <img v-if="!imgError" src="/images/Melon2.png" alt="Melon, the shopkeeper" @error="imgError = true" />
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
// `.melon-promo`, `.melon-promo-text` and `.melon-promo-word` are all owned by
// style.css. `.melon-promo-image` has no rule anywhere — legacy styled the
// <img> inline — so it lives here.
.melon-promo-image {
  display: block;
  cursor: pointer;

  img {
    max-width: 300px;
    width: 100%;
    display: block;
    margin: 0 auto;
  }
}
</style>
