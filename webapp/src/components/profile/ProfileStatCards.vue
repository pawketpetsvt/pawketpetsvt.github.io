<template>
  <div class="pf-stats">
    <div v-for="s in cards" :key="s.label" class="pf-stat-card">
      <div class="pf-stat-value">{{ s.value }}</div>
      <div class="pf-stat-label">{{ s.label }}</div>
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
.pf-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.pf-stat-card {
  padding: 14px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  text-align: center;
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
  margin-top: 2px;
}
</style>
