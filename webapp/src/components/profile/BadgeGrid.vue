<template>
  <div v-if="!badges.length" class="empty-note text-center p-4">
    <p>{{ emptyText }}</p>
  </div>
  <div v-else class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-2">
    <div v-for="b in badges" :key="b.id" class="col">
      <div class="pf-badge-card position-relative h-100 text-center px-2 py-3 rounded-3" :class="{ locked: b.earned === false }">
        <div v-if="b.rarity && b.rarity !== 'common'" class="pf-badge-rarity position-absolute top-0 end-0 m-1 px-2 rounded-pill" :class="b.rarity">
          {{ b.rarity }}
        </div>
        <div class="pf-badge-icon">{{ b.icon }}</div>
        <div class="pf-badge-name mt-1">{{ b.earned === false ? '???' : b.name }}</div>
        <div class="pf-badge-desc mt-px2">{{ b.earned === false ? 'Not yet earned' : b.description }}</div>
        <div v-if="b.earnedAt" class="pf-badge-date mt-px6">Earned {{ formatDate(b.earnedAt) }}</div>
      </div>
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
// Layout via Bootstrap utilities in the template; visuals only here.
.pf-badge-card {
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);

  &.locked {
    opacity: 0.45;
    filter: grayscale(1);
  }
}

.pf-badge-rarity {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: rgba(153, 102, 255, 0.15);
  color: var(--purple-dark);
}

.pf-badge-icon {
  font-size: 1.9rem;
}

.pf-badge-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
}

.pf-badge-desc {
  font-size: 0.72rem;
  color: var(--text-light);
}

.pf-badge-date {
  font-size: 0.65rem;
  color: var(--text-light);
  opacity: 0.8;
}

.empty-note {
  color: var(--text-light);
}
</style>
