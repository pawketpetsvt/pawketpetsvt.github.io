<template>
  <!-- Ports the equipped-items section from makeMyPetCard (game.js:4014-4036)
       plus loadEquippedItems(). -->
  <div class="equipped-items-section">
    <div class="pp-equip-head">
      <span>⚔️ Equipment</span>
      <button class="btn-sm pp-manage" @click="$emit('manage', pet.id)">Manage</button>
    </div>

    <div class="pp-equip-body">
      <div v-if="loading" class="pp-equip-loading">Loading equipment...</div>
      <div v-else-if="!equipped.length" class="pp-equip-empty">Nothing equipped.</div>
      <div v-else class="d-flex flex-column gap-1">
        <div v-for="row in equipped" :key="row.id" class="pp-equip-row">
          <span class="pp-equip-name">{{ row.equipment?.name || 'Item' }}</span>
          <span class="pp-equip-bonuses">{{ bonusText(row.equipment) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { equipmentService } from '../services/EquipmentService.js'

const props = defineProps({
  pet: { type: Object, required: true }
})
defineEmits(['manage'])

const equipped = ref([])
const loading = ref(true)

// Only the bonuses an item actually carries are listed, so a pure-weapon shows
// "+5 ATK" rather than a row of zeroes.
function bonusText(eq) {
  if (!eq) return ''
  const parts = []
  if (eq.attack_bonus) parts.push(`+${eq.attack_bonus} ATK`)
  if (eq.defense_bonus) parts.push(`+${eq.defense_bonus} DEF`)
  if (eq.speed_bonus) parts.push(`+${eq.speed_bonus} SPD`)
  if (eq.hp_bonus) parts.push(`+${eq.hp_bonus} HP`)
  if (eq.luck_bonus) parts.push(`+${eq.luck_bonus} LCK`)
  if (eq.spirit_bonus) parts.push(`+${eq.spirit_bonus} SPI`)
  if (eq.hp_penalty_pct) parts.push(`−${Math.round(eq.hp_penalty_pct * 100)}% max HP`)
  return parts.join(' · ')
}

async function load() {
  loading.value = true
  try {
    equipped.value = await equipmentService.getEquippedFor(props.pet.id)
  } catch (e) {
    console.error('[PetEquipment] load failed:', e)
    equipped.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.pet.id, load)
</script>

<style lang="scss" scoped>
.equipped-items-section {
  margin: 10px 0;
  padding: 10px 12px;
  background: rgba(153, 102, 255, 0.06);
  border: 2px solid var(--purple-light);
  border-radius: 12px;
}

.pp-equip-head {
  font-weight: bold;
  color: var(--purple);
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pp-manage {
  font-size: 0.7rem;
  padding: 4px 8px;
  border: 2px solid var(--purple-light);
  border-radius: 8px;
  background: var(--white);
  color: var(--purple-dark);
  font-weight: 700;
  cursor: pointer;

  &:hover { border-color: var(--purple); }
}

.pp-equip-body {
  font-size: 0.85rem;
  color: var(--text);
}

.pp-equip-loading { opacity: 0.6; }

.pp-equip-empty {
  color: var(--text-light);
  font-style: italic;
  font-size: 0.8rem;
}

.pp-equip-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.8rem;
}

.pp-equip-name {
  font-weight: 700;
  color: var(--purple-dark);
}

.pp-equip-bonuses {
  color: var(--text-light);
  text-align: right;
}
</style>
