<template>
  <div class="points-banner">
    <span class="pb-label">🪙 Your PawketPoints</span>
    <span class="pb-amount">{{ points }} PP</span>
  </div>
</template>

<script setup>
defineProps({
  points: { type: Number, required: true }
})
</script>

<style lang="scss" scoped>
// PointsBanner has no styling of its own yet — .points-banner/.pb-label/.pb-amount
// are shared classes defined in assets/scss/globals.scss.
</style>
