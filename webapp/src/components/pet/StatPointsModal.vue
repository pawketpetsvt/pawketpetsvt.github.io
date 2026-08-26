<template>
  <!-- Ports statPoints_openModal() / statPoints_spend() (game.js:25800-25890).
       Legacy closed and reopened the whole dialog after every spend to refresh
       it; here the numbers are reactive, so the modal simply updates. -->
  <PetModal title="✨ Allocate Stat Points" :subtitle="subtitle" width="380px" @close="$emit('close')">
    <div class="d-flex flex-column gap-2">
      <div v-for="stat in STAT_DEFS" :key="stat.key" class="pp-stat-row">
        <div class="pp-stat-icon">{{ stat.icon }}</div>
        <div class="flex-grow-1">
          <div class="pp-stat-label">{{ stat.label }}</div>
          <div class="pp-stat-desc">{{ stat.desc }} • Current: {{ pet[stat.key] || 0 }}</div>
        </div>
        <button class="pp-stat-add" :disabled="available <= 0 || spending" @click="spend(stat)">+1</button>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import PetModal from './PetModal.vue'
import { supabase } from '../../services/SupabaseService.js'
import { toastService } from '../../services/ToastService.js'

const props = defineProps({
  pet: { type: Object, required: true }
})
defineEmits(['close'])

// `gain` is the amount written into the column, not a point count — see the
// note in EquipmentService.calculatePetStats about how these are read back.
const STAT_DEFS = [
  { key: 'bonus_hp', label: '❤️ Health', desc: '+3 max HP per point', icon: '❤️', gain: 3 },
  { key: 'bonus_attack', label: '⚔️ Attack', desc: '+2 attack per point', icon: '⚔️', gain: 2 },
  { key: 'bonus_defense', label: '🛡️ Defense', desc: '+2 defense per point', icon: '🛡️', gain: 2 },
  { key: 'bonus_speed', label: '💨 Speed', desc: '+1 speed per point', icon: '💨', gain: 1 }
]

const spending = ref(false)
const available = computed(() => props.pet.stat_points || 0)
const subtitle = computed(() =>
  `${available.value} point${available.value !== 1 ? 's' : ''} available to spend`
)

async function spend(stat) {
  if (available.value <= 0) return
  spending.value = true
  const nextPoints = available.value - 1
  const nextBonus = (props.pet[stat.key] || 0) + stat.gain
  try {
    const res = await supabase.from('user_pets')
      .update({ stat_points: nextPoints, [stat.key]: nextBonus })
      .eq('id', props.pet.id)
    if (res.error) throw new Error(res.error.message)

    // Mutating the reactive model updates the card behind the modal too.
    props.pet.stat_points = nextPoints
    props.pet[stat.key] = nextBonus
    toastService.success(`+${stat.gain} ${stat.key.replace('bonus_', '').toUpperCase()} allocated!`)
  } catch (e) {
    toastService.error('Failed to spend stat point: ' + e.message)
  } finally {
    spending.value = false
  }
}
</script>

<style lang="scss" scoped>
.pp-stat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(153, 102, 255, 0.06);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.pp-stat-icon { font-size: 1.4rem; }

.pp-stat-label {
  font-weight: 700;
  font-size: 0.88rem;
}

.pp-stat-desc {
  font-size: 0.72rem;
  color: var(--text-light);
}

.pp-stat-add {
  padding: 7px 16px;
  border-radius: 10px;
  border: 2px solid var(--purple);
  background: var(--purple);
  color: var(--white);
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;

  &:disabled {
    background: var(--border);
    border-color: var(--border);
    cursor: not-allowed;
  }
}
</style>
