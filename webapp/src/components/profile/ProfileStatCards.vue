<template>
  <div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-2 mt-2">
    <div v-for="s in cards" :key="s.label" class="col">
      <div class="pf-stat-card h-100 text-center px-2 py-3 rounded-3">
        <div class="pf-stat-value">{{ s.value }}</div>
        <div class="pf-stat-label mt-px2">{{ s.label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  profile: { type: Object, required: true },
  badgeCount: { type: Number, default: 0 }
})

const cards = computed(() => [
  { label: '🪙 PawketPoints', value: (props.profile.pawketpoints || 0).toLocaleString() },
  { label: '🐾 Pets', value: props.profile.totalPets || 0 },
  { label: '⭐ Total Level', value: props.profile.totalLevels || 0 },
  { label: '🏆 Rank', value: props.profile.rank ? '#' + props.profile.rank : '-' },
  { label: '🎖️ Badges', value: props.badgeCount }
])
</script>

<style lang="scss" scoped>
// Layout via Bootstrap utilities in the template; visuals only here.
.pf-stat-card {
  border: 1px solid var(--border);
  background: rgba(153, 102, 255, 0.05);
}

.pf-stat-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--purple);
}

.pf-stat-label {
  font-size: 0.72rem;
  color: var(--text-light);
}
</style>
