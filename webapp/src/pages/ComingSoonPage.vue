<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🚧 ✦ 🚧</div>
      <h1>{{ displayName }}</h1>
      <p>This section is being rebuilt — check back soon! ✨</p>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
const displayName = route.meta.displayName || 'Coming Soon'
</script>
