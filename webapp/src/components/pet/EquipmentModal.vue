<template>
  <!-- Ports showEquipmentModal() (game.js). Two exclusive slots per pet —
       weapon and armor — plus the pool of everything owned and unequipped. -->
  <PetModal :title="`⚔️ Manage Equipment — ${pet.nickname}`" :subtitle="subtitle" width="600px"
    @close="$emit('close')">
    <div v-if="loading" class="text-center py-3"><div class="spinner"></div></div>

    <template v-else>
      <div class="row row-cols-1 row-cols-sm-2 g-2 mb-3">
        <div v-for="slot in SLOTS" :key="slot.key" class="col">
          <div class="pp-slot" :class="{ 'pp-filled': slots[slot.key] }">
            <div class="pp-slot-label">{{ slot.icon }} {{ slot.label }}</div>
            <template v-if="slots[slot.key]">
              <div class="pp-slot-name">{{ slots[slot.key].equipment?.name }}</div>
              <div class="pp-slot-bonus">{{ bonusText(slots[slot.key].equipment) }}</div>
              <button class="pp-unequip" :disabled="busy" @click="doUnequip(slot.key)">Unequip</button>
            </template>
            <div v-else class="pp-slot-empty">Empty</div>
          </div>
        </div>
      </div>

      <div class="pp-section-label">Available Equipment</div>
      <div v-if="!available.length" class="pp-none">
        Nothing spare — buy gear from the Shop's Equipment tab.
      </div>
      <div v-else class="d-flex flex-column gap-1">
        <!-- Gear goes in the slot its own type dictates — a weapon cannot be
             worn as armor — so there is ONE Equip button, as in legacy. -->
        <div v-for="row in available" :key="row.id" class="pp-item">
          <div class="pp-item-icon">{{ slotOf(row) === 'weapon' ? '⚔️' : '🛡️' }}</div>
          <div class="flex-grow-1 min-w-0">
            <div class="pp-item-name">
              {{ row.equipment?.name }}
              <span class="pp-tier">T{{ row.equipment?.tier || 1 }}</span>
            </div>
            <div class="pp-item-bonus">{{ bonusText(row.equipment) }}</div>
            <div class="pp-item-slot">{{ slotOf(row) === 'weapon' ? 'Weapon' : 'Armor' }}</div>
          </div>
          <button class="pp-equip-btn" :class="{ 'pp-equip-locked': !canEquip(row) }"
            :disabled="busy || !canEquip(row)"
            :title="canEquip(row) ? '' : `This pet needs to reach level ${minLevel(row)} to equip this item.`"
            @click="doEquip(row)">
            {{ canEquip(row) ? 'Equip' : `🔒 Lv.${minLevel(row)}` }}
          </button>
        </div>
      </div>
    </template>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from './PetModal.vue'
import { equipmentService } from '../../services/EquipmentService.js'
import { toastService } from '../../services/ToastService.js'

const props = defineProps({
  pet: { type: Object, required: true }
})
const emit = defineEmits(['close', 'changed'])

const SLOTS = [
  { key: 'weapon', label: 'Weapon', icon: '⚔️' },
  { key: 'armor', label: 'Armor', icon: '🛡️' }
]

const slots = ref({ weapon: null, armor: null })
const available = ref([])
const loading = ref(true)
const busy = ref(false)

const subtitle = computed(() => `Level ${props.pet.level || 1} · higher-tier gear needs a higher level`)

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
  return parts.join(' · ') || 'No stat bonuses'
}

const slotOf = (row) => equipmentService.slotFor(row.equipment)

function minLevel(row) {
  return equipmentService.tierMinLevel((row.equipment && row.equipment.tier) || 1)
}

function canEquip(row) {
  return (props.pet.level || 1) >= minLevel(row)
}

async function load() {
  loading.value = true
  try {
    const [s, a] = await Promise.all([
      equipmentService.getSlots(props.pet.id),
      equipmentService.getUnequipped()
    ])
    slots.value = s
    available.value = a
  } catch (e) {
    toastService.error('Could not load equipment.')
  } finally {
    loading.value = false
  }
}

async function doEquip(row) {
  busy.value = true
  try {
    await equipmentService.equip(row, props.pet)
    toastService.success(`${row.equipment?.name} equipped!`)
    await load()
    emit('changed')
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

async function doUnequip(slot) {
  busy.value = true
  try {
    await equipmentService.unequip(slot, props.pet.id)
    toastService.success('Equipment unequipped!')
    await load()
    emit('changed')
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.pp-slot {
  height: 100%;
  padding: 12px;
  border: 2px dashed var(--border);
  border-radius: 12px;
  text-align: center;

  &.pp-filled {
    border-style: solid;
    border-color: var(--purple-light);
    background: rgba(153, 102, 255, 0.08);
  }
}

.pp-slot-label {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
  margin-bottom: 6px;
}

.pp-slot-name {
  font-weight: 700;
  font-size: 0.85rem;
}

.pp-slot-bonus {
  font-size: 0.7rem;
  color: var(--text-light);
  margin-bottom: 6px;
}

.pp-slot-empty {
  font-size: 0.78rem;
  color: var(--text-light);
  font-style: italic;
}

.pp-unequip {
  font-size: 0.7rem;
  padding: 3px 10px;
  border-radius: 8px;
  border: 1px solid #ff6b6b;
  background: none;
  color: #ff6b6b;
  cursor: pointer;
}

.pp-section-label {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--purple-dark);
  margin-bottom: 8px;
}

.pp-none {
  font-size: 0.8rem;
  color: var(--text-light);
  font-style: italic;
}

.pp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.pp-item-name {
  font-weight: 700;
  font-size: 0.8rem;
}

.pp-tier {
  font-size: 0.65rem;
  color: var(--purple);
  border: 1px solid var(--purple-light);
  border-radius: 6px;
  padding: 0 4px;
  margin-left: 4px;
}

.pp-item-bonus {
  font-size: 0.68rem;
  color: var(--text-light);
}

.pp-item-icon {
  font-size: 1.4rem;
  line-height: 1;
  flex-shrink: 0;
}

.pp-item-slot {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--purple);
}

.pp-equip-btn {
  flex-shrink: 0;
  padding: 5px 12px;
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: 8px;
  border: 1px solid var(--purple);
  background: none;
  color: var(--purple);
  cursor: pointer;
  white-space: nowrap;

  &.pp-equip-locked { border-color: #ff6b6b; color: #ff6b6b; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}
</style>
