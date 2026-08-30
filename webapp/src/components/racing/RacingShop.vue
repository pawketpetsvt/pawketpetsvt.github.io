<template>
  <!-- Ports racing_renderShopTab() + racing_buyShopItem(). Gear is per pet and
       league-gated; buying equips in the same step. -->
  <div>
    <h3 class="mb-px6">🛒 Racing Shop</h3>
    <p class="rs-sub mb-1">Equipment just for racing. Select a pet, then buy to equip.</p>
    <p class="rs-league mb-px14">
      Current League: <strong>{{ RACING_LEAGUE_LABELS[tier] || tier }}</strong> —
      {{ tierIndex < 4 ? 'Reach the next league to unlock its gear.' : 'Every tier unlocked!' }}
    </p>

    <RacingPetSelector v-model="selectedId" />

    <div v-for="(items, slot) in RACING_SHOP" :key="slot" class="rs-slot">
      <div class="fw-bold mb-2">{{ SLOT_LABELS[slot] || slot }}</div>
      <!-- Four tiers per slot. Was `auto-fill, minmax(200px, 1fr)`, which
           resolved to three tracks in the ~740px panel. -->
      <div class="row row-cols-2 row-cols-lg-3 g-2">
        <div v-for="item in items" :key="item.key" class="col">
          <div
            class="rs-card h-100 px-tight py-px10 rounded-3"
            :class="{
              'rs-equipped': isEquipped(slot, item),
              'rs-owned': owns(item) && !isEquipped(slot, item),
              // Owned gear never reads as locked — relegation must not strand
              // something already paid for.
              'rs-locked': isLocked(item) && !owns(item)
            }"
          >
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="rs-emoji">{{ item.emoji }}</span>
              <div class="min-w-0">
                <div class="rs-name">{{ item.name }}</div>
                <div class="rs-tier" :style="{ color: RACING_LEAGUE_COLORS[item.league] }">
                  {{ tierWord(item.league) }} Tier
                </div>
              </div>
            </div>
            <div class="rs-desc mb-px6">{{ item.desc }}</div>
            <div class="d-flex align-items-center justify-content-between gap-2">
              <span class="rs-price">{{ owns(item) ? 'Owned' : item.price + ' PP' }}</span>
              <span v-if="isEquipped(slot, item)" class="rs-equipped-tag">✅ Equipped</span>
              <!-- Owned but not worn: switching back is free. This state was
                   unreachable in legacy, which had no ownership record. -->
              <button v-else-if="owns(item)" class="rs-equip px-px10 py-1 rounded-1" :disabled="busy"
                @click="buy(slot, item.key)">Equip</button>
              <span v-else-if="isLocked(item)" class="rs-lock">
                🔒 Reach {{ RACING_LEAGUE_LABELS[item.league] || item.league }}
              </span>
              <button v-else class="rs-buy px-px10 py-1 rounded-1" :disabled="busy || !racingState.selectedPetId"
                @click="buy(slot, item.key)">Buy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import RacingPetSelector from './RacingPetSelector.vue'
import { racingService, racingState } from '../../services/RacingService.js'
import {
  RACING_SHOP, RACING_LEAGUE_LABELS, RACING_LEAGUE_COLORS
} from '../../data/racingData.js'

const SLOT_LABELS = {
  shoes: '👟 Shoes / Hooves',
  outfit: '🧥 Outfit',
  goggles: '🥽 Goggles',
  charm: '🎀 Charm',
  mount: '🐴 Mount Accessory'
}

const busy = ref(false)

const selectedId = computed({
  get: () => racingState.selectedPetId,
  set: (id) => racingService.selectPet(id)
})

const tier = computed(() => racingService.tier())
const tierIndex = computed(() => racingService.tierIndex())

const isLocked = (item) => racingService.isLocked(item)
const isEquipped = (slot, item) => racingService.isEquipped(slot, item)
const owns = (item) => racingService.owns(item)

// "🥇 Gold" -> "Gold": the label carries its own medal emoji.
const tierWord = (league) => (RACING_LEAGUE_LABELS[league] || league).split(' ').slice(1).join(' ')

async function buy(slot, key) {
  busy.value = true
  try {
    await racingService.buy(slot, key)
  } finally {
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
// The tier grid is now `row row-cols-*`; spacing is utilities. What remains is
// the card's colour states and the two button treatments.
.rs-sub {
  color: var(--text-light);
  font-size: 0.82rem;
}

.rs-league {
  font-size: 0.8rem;
  color: var(--purple);
}

// 18px sits between the `tight` (12px) and `gap` (20px) tokens and is used too
// rarely across the app to earn one of its own.
.rs-slot { margin-bottom: 18px; }

.rs-card {
  background: var(--white);
  border: 2px solid var(--border);

  &.rs-equipped { border-color: var(--purple); }
  &.rs-owned { border-color: #27ae60; }
  &.rs-locked { opacity: 0.45; }
}

.rs-emoji { font-size: 1.4rem; }

.rs-name {
  font-weight: 700;
  font-size: 0.88rem;
}

.rs-tier {
  font-size: 0.65rem;
  font-weight: 700;
}

.rs-desc {
  font-size: 0.72rem;
  color: var(--text-light);
}

.rs-price {
  font-weight: 700;
  color: #e6a800;
}

.rs-equipped-tag {
  font-size: 0.72rem;
  color: var(--purple);
  font-weight: 700;
}

.rs-lock {
  font-size: 0.7rem;
  color: var(--text-light);
}

.rs-buy {
  font-size: 0.72rem;
  border: none;
  background: var(--purple);
  color: #fff;
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.rs-equip {
  font-size: 0.72rem;
  border: 1.5px solid var(--purple);
  background: none;
  color: var(--purple);
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
</style>
