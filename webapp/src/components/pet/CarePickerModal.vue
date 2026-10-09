<template>
  <!-- Ports the Feed and Play pickers from feed()/play() (game.js:6093/6430 at
       826475d): a free once-a-day option first, then every matching item the
       player owns. Picking one closes the modal and hands the choice back to
       the card, which runs it and shows the result on the card itself. -->
  <PetModal :title="title" :subtitle="pet.nickname" width="520px" @close="$emit('close')">
    <div class="row row-cols-2 row-cols-sm-3 g-2">
      <div class="col">
        <button class="pp-care pp-care-free" :class="[`pp-care-${mode}`, { 'pp-care-off': !free.available }]"
          :disabled="!free.available" @click="$emit('pick', null)">
          <div class="pp-care-icon">{{ free.icon }}</div>
          <div class="pp-care-name">{{ free.name }}</div>
          <div class="pp-care-sub mt-px2">{{ free.sub }}</div>
        </button>
      </div>

      <div v-for="item in items" :key="item.invId" class="col">
        <button class="pp-care" :disabled="!itemUsable" @click="$emit('pick', item)">
          <div class="pp-care-icon d-flex align-items-center justify-content-center"><ItemIcon :item="item" /></div>
          <div class="pp-care-name">{{ item.name }}</div>
          <div class="pp-care-sub mt-px2">x{{ item.qty }}<template v-if="item.effectText"> · {{ item.effectText }}</template></div>
        </button>
      </div>
    </div>

    <p v-if="!items.length" class="pp-care-empty text-center mt-3 mb-0">
      💡 {{ mode === 'feed' ? 'No food items in your inventory.' : 'No toys in your inventory.' }}
      <router-link to="/shop" @click="$emit('close')">Visit the Shop</router-link>
      {{ mode === 'feed' ? 'or use the free daily treat!' : 'or use the free playtime!' }}
    </p>
    <p v-else-if="mode === 'play' && !itemUsable" class="pp-care-empty text-center mt-3 mb-0">
      ⚡ {{ pet.nickname }} needs at least 5 energy to play with a toy.
    </p>
  </PetModal>
</template>

<script setup>
import { computed } from 'vue'
import PetModal from './PetModal.vue'
import ItemIcon from '../ItemIcon.vue'
import { ownedPetsService } from '../../services/OwnedPetsService.js'

const props = defineProps({
  pet: { type: Object, required: true },
  inventory: { type: Array, required: true },
  mode: { type: String, required: true, validator: v => v === 'feed' || v === 'play' }
})
defineEmits(['pick', 'close'])

const title = computed(() => props.mode === 'feed' ? '🍽️ Feed Your Pet' : '🎮 Play With Your Pet')

const items = computed(() => props.inventory.filter(i => props.mode === 'feed' ? i.isFood : i.isToy))

// Food has no energy gate; a toy needs 5 (legacy playWithToy).
const itemUsable = computed(() => props.mode === 'feed' || props.pet.canPlayWithToy)

// Legacy's tile copy, verbatim, for each of the free option's states.
const free = computed(() => {
  if (props.mode === 'feed') {
    return ownedPetsService.freeFeedUsed(props.pet)
      ? { available: false, icon: '✅', name: 'Free Daily Treat', sub: 'Used Today!' }
      : { available: true, icon: '✨', name: 'Free Daily Treat', sub: '+30 Hunger +10 XP' }
  }
  if (ownedPetsService.freePlayUsed(props.pet)) return { available: false, icon: '✅', name: 'Free Playtime', sub: 'Used Today!' }
  if (!props.pet.canPlay) return { available: false, icon: '🎾', name: 'Free Playtime', sub: 'Need 10 Energy' }
  return { available: true, icon: '🎾', name: 'Free Playtime', sub: '+15 Happiness +15 XP' }
})
</script>

<style lang="scss" scoped>
// Tile styling follows VariantModal's `.pp-variant` so the pet-card pickers
// read as one family; the free tile keeps legacy's green (feed) / orange (play).
.pp-care {
  width: 100%;
  height: 100%;
  padding: 12px 8px;
  border: 3px solid var(--purple);
  border-radius: 12px;
  background: var(--white);
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s;
  // Grows down and outward, never up: the modal body has room for that below
  // and to the sides (PetModal's bleed padding) but none above the first row.
  transform-origin: center top;

  &:hover:not(:disabled) { transform: scale(1.05); }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.pp-care-free {
  color: var(--white);

  &.pp-care-feed {
    border-color: #5dde7a;
    background: linear-gradient(135deg, #5dde7a 0%, #4caf50 100%);
  }

  &.pp-care-play {
    border-color: #ff9f43;
    background: linear-gradient(135deg, #ff9f43 0%, #ffa726 100%);
  }

  // Specificity has to beat the two colour variants above.
  &.pp-care-off.pp-care-feed,
  &.pp-care-off.pp-care-play {
    border-color: #ccc;
    background: #f0f0f0;
    color: #999;
  }

  .pp-care-name,
  .pp-care-sub { color: inherit; }
}

.pp-care-icon {
  font-size: 2rem;
  min-height: 48px;
}

.pp-care-name {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
}

.pp-care-sub {
  font-size: 0.7rem;
  color: var(--text-light);
}

.pp-care-empty {
  font-size: 0.88rem;
  color: var(--text-light);
}
</style>
