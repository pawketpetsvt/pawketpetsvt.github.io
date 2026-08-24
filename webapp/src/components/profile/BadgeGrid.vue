<template>
  <div v-if="!badges.length" class="empty-note">
    <p>{{ emptyText }}</p>
  </div>
  <div v-else class="pf-badge-grid">
    <div v-for="b in badges" :key="b.id" class="pf-badge-card" :class="{ locked: b.earned === false }">
      <div v-if="b.rarity && b.rarity !== 'common'" class="pf-badge-rarity" :class="b.rarity">{{ b.rarity }}</div>
      <div class="pf-badge-icon">{{ b.icon }}</div>
      <div class="pf-badge-name">{{ b.earned === false ? '???' : b.name }}</div>
      <div class="pf-badge-desc">{{ b.earned === false ? 'Not yet earned' : b.description }}</div>
      <div v-if="b.earnedAt" class="pf-badge-date">Earned {{ formatDate(b.earnedAt) }}</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  badges: { type: Array, required: true },
  emptyText: { type: String, default: 'No badges earned yet! 🎖️' }
})

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style lang="scss" scoped>
.pf-badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.pf-badge-card {
  position: relative;
  padding: 14px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  text-align: center;
  background: var(--card-bg, #fff);

  &.locked {
    opacity: 0.45;
    filter: grayscale(1);
  }
}

.pf-badge-rarity {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(153, 102, 255, 0.15);
  color: var(--purple-dark);
}

.pf-badge-icon {
  font-size: 1.9rem;
}

.pf-badge-name {
  font-weight: 700;
  font-size: 0.85rem;
  margin-top: 4px;
  color: var(--purple-dark);
}

.pf-badge-desc {
  font-size: 0.72rem;
  color: var(--text-light);
  margin-top: 2px;
}

.pf-badge-date {
  font-size: 0.65rem;
  color: var(--text-light);
  margin-top: 6px;
  opacity: 0.8;
}

.empty-note {
  text-align: center;
  padding: 24px;
  color: var(--text-light);
}
</style>
