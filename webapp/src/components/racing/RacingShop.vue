<template>
  <!-- Ports racing_renderShopTab() + racing_buyShopItem(). Gear is per pet and
       league-gated; buying equips in the same step. -->
  <div>
    <h3 class="rs-title">🛒 Racing Shop</h3>
    <p class="rs-sub">Equipment just for racing. Select a pet, then buy to equip.</p>
    <p class="rs-league">
      Current League: <strong>{{ RACING_LEAGUE_LABELS[tier] || tier }}</strong> —
      {{ tierIndex < 4 ? 'Reach the next league to unlock its gear.' : 'Every tier unlocked!' }}
    </p>

    <RacingPetSelector v-model="selectedId" />

    <div v-for="(items, slot) in RACING_SHOP" :key="slot" class="rs-slot">
      <div class="rs-slot-label">{{ SLOT_LABELS[slot] || slot }}</div>
      <div class="rs-grid">
        <div
          v-for="item in items"
          :key="item.key"
          class="rs-card"
          :class="{
            'rs-equipped': isEquipped(slot, item),
            'rs-owned': owns(item) && !isEquipped(slot, item),
            // Owned gear never reads as locked — relegation must not strand
            // something already paid for.
            'rs-locked': isLocked(item) && !owns(item)
          }"
        >
          <div class="rs-card-head">
            <span class="rs-emoji">{{ item.emoji }}</span>
            <div class="min-w-0">
              <div class="rs-name">{{ item.name }}</div>
              <div class="rs-tier" :style="{ color: RACING_LEAGUE_COLORS[item.league] }">
                {{ tierWord(item.league) }} Tier
              </div>
            </div>
          </div>
          <div class="rs-desc">{{ item.desc }}</div>
          <div class="rs-foot">
            <span class="rs-price">{{ owns(item) ? 'Owned' : item.price + ' PP' }}</span>
            <span v-if="isEquipped(slot, item)" class="rs-equipped-tag">✅ Equipped</span>
            <!-- Owned but not worn: switching back is free. This state was
                 unreachable in legacy, which had no ownership record. -->
            <button v-else-if="owns(item)" class="rs-equip" :disabled="busy"
              @click="buy(slot, item.key)">Equip</button>
            <span v-else-if="isLocked(item)" class="rs-lock">
              🔒 Reach {{ RACING_LEAGUE_LABELS[item.league] || item.league }}
            </span>
            <button v-else class="rs-buy" :disabled="busy || !racingState.selectedPetId"
              @click="buy(slot, item.key)">Buy</button>
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
.rs-title { margin-bottom: 6px; }

.rs-sub {
  color: var(--text-light);
  font-size: 0.82rem;
  margin-bottom: 4px;
}

.rs-league {
  font-size: 0.8rem;
  color: var(--purple);
  margin-bottom: 14px;
}

.rs-slot { margin-bottom: 18px; }

.rs-slot-label {
  font-weight: 700;
  margin-bottom: 8px;
}

// A content-sized auto-fill track, which Bootstrap's fixed 12-column grid
// cannot express — the same reason CookingPage's ingredient tray stays CSS grid.
.rs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.rs-card {
  background: var(--white);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;

  &.rs-equipped { border-color: var(--purple); }
  &.rs-owned { border-color: #27ae60; }
  &.rs-locked { opacity: 0.45; }
}

.rs-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
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
  margin-bottom: 6px;
}

.rs-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
  padding: 4px 10px;
  border-radius: 8px;
  border: none;
  background: var(--purple);
  color: #fff;
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.rs-equip {
  font-size: 0.72rem;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--purple);
  background: none;
  color: var(--purple);
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
</style>
