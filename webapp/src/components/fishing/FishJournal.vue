<template>
  <div class="journal-section">
    <button class="journal-toggle" @click="open = !open">
      📖 Fish Journal <span class="journal-chevron">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open">
      <div class="journal-summary">📖 Fish Journal: {{ discoveredCount }}/{{ totalFish }} discovered</div>
      <div v-for="spot in SPOTS" :key="spot">
        <div v-if="fishBySpot(spot).length" class="journal-spot-label">{{ spot }}</div>
        <div class="journal-grid">
          <div v-for="fish in fishBySpot(spot)" :key="fish.id" class="journal-fish-card" :class="{ caught: collection[fish.id] }">
            <div class="fish-emoji">{{ collection[fish.id] ? fish.emoji : '❓' }}</div>
            <div class="fish-name">{{ collection[fish.id] ? fish.name : '???' }}</div>
            <div class="fish-rarity">{{ fish.rarity }}</div>
            <template v-if="collection[fish.id]">
              <div class="fish-count">×{{ collection[fish.id].count || 1 }} caught</div>
              <div v-if="collection[fish.id].bestWeight" class="fish-best">best: {{ formatWeight(collection[fish.id].bestWeight) }}</div>
              <button v-if="(collection[fish.id].count || 0) > 0" class="btn btn-sm btn-outline cook-btn" @click="$emit('cook-feed', fish)">🍳 Cook</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { FISH_POOL, formatWeight } from '../../data/fishingData.js'

const props = defineProps({
  collection: { type: Object, required: true }
})
defineEmits(['cook-feed'])

const SPOTS = ['pond', 'river', 'lake', 'ocean']
const open = ref(false)

const nonJunkFish = FISH_POOL.filter(f => f.rarity !== 'junk')
const totalFish = nonJunkFish.length
const discoveredCount = computed(() => Object.keys(props.collection).filter(id => nonJunkFish.some(f => f.id === id)).length)

function fishBySpot(spot) {
  return nonJunkFish.filter(f => f.spots.includes(spot))
}
</script>

<style lang="scss" scoped>
.journal-section {
  margin-top: 20px;
  border-top: 1px solid rgba(153, 102, 255, 0.15);
  padding-top: 16px;
}

.journal-toggle {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--purple-dark);
  margin-bottom: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.journal-chevron {
  font-size: 0.7rem;
  opacity: 0.6;
}

.journal-summary {
  font-weight: 700;
  color: var(--purple-dark);
  margin-bottom: 12px;
}

.journal-spot-label {
  font-weight: 700;
  margin: 10px 0 6px;
  text-transform: capitalize;
}

.journal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}

.journal-fish-card {
  padding: 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  text-align: center;
  opacity: 0.45;

  &.caught {
    background: rgba(153, 102, 255, 0.12);
    opacity: 1;
  }
}

.fish-emoji {
  font-size: 1.5rem;
}

.fish-name {
  font-size: 0.75rem;
  font-weight: 700;
}

.fish-rarity {
  font-size: 0.7rem;
  color: var(--text-light);
}

.fish-count {
  font-size: 0.68rem;
  color: var(--text-light);
  margin-top: 2px;
}

.fish-best {
  font-size: 0.68rem;
  color: var(--purple);
  font-weight: 700;
}

.cook-btn {
  margin-top: 4px;
  font-size: 0.65rem;
  padding: 3px 6px;
}
</style>
