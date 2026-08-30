<template>
  <div class="journal-section mt-gap pt-3">
    <button class="journal-toggle d-flex align-items-center gap-2 mb-2 p-0" @click="open = !open">
      📖 Fish Journal <span class="journal-chevron">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open">
      <div class="journal-summary mb-3">📖 Fish Journal: {{ discoveredCount }}/{{ totalFish }} discovered</div>
      <div v-for="spot in SPOTS" :key="spot">
        <div v-if="fishBySpot(spot).length" class="journal-spot-label mt-px10 mx-0 mb-px6">{{ spot }}</div>
        <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-2">
          <div v-for="fish in fishBySpot(spot)" :key="fish.id" class="col">
            <div class="journal-fish-card h-100 text-center p-2 rounded-2" :class="{ caught: collection[fish.id] }">
              <div class="fish-emoji">{{ collection[fish.id] ? fish.emoji : '❓' }}</div>
              <div class="fish-name">{{ collection[fish.id] ? fish.name : '???' }}</div>
              <div class="fish-rarity">{{ fish.rarity }}</div>
              <template v-if="collection[fish.id]">
                <div class="fish-count mt-px2">×{{ collection[fish.id].count || 1 }} caught</div>
                <div v-if="collection[fish.id].bestWeight" class="fish-best">best: {{ formatWeight(collection[fish.id].bestWeight) }}</div>
                <button v-if="(collection[fish.id].count || 0) > 0" class="btn btn-sm btn-outline cook-btn mt-1" @click="$emit('cook-feed', fish)">🍳 Cook</button>
              </template>
            </div>
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
// Layout via Bootstrap utilities in the template; visuals only here.
.journal-section {
  border-top: 1px solid rgba(153, 102, 255, 0.15);
}

.journal-toggle {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--purple-dark);
  background: none;
  border: none;
  cursor: pointer;
}

.journal-chevron {
  font-size: 0.7rem;
  opacity: 0.6;
}

.journal-summary {
  font-weight: 700;
  color: var(--purple-dark);
}

.journal-spot-label {
  font-weight: 700;
  text-transform: capitalize;
}

.journal-fish-card {
  background: rgba(0, 0, 0, 0.04);
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
}

.fish-best {
  font-size: 0.68rem;
  color: var(--purple);
  font-weight: 700;
}

.cook-btn {
  font-size: 0.65rem;
  padding: 3px 6px;
}
</style>
