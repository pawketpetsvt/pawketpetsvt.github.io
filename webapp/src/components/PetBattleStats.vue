<template>
  <!-- Ports the battle-stats strip from makeMyPetCard (game.js:3957-4011).
       Legacy rendered base values immediately and then patched in the
       equipment-adjusted ones via updatePetStatsDisplay(); here the adjusted
       values simply arrive when calculatePetStats resolves, so the numbers
       never disagree with themselves mid-render. -->
  <div class="pet-battle-stats d-flex justify-content-around flex-wrap gap-2 p-tight my-px10 rounded-3">
    <div class="battle-stat-mini pp-help text-center" v-tooltip="TIPS.hp">
      <div class="pp-stat-label">HP</div>
      <div class="pp-stat-value">{{ currentHP }}/{{ maxHP }}</div>
      <div class="pp-hp-track mt-1 overflow-hidden">
        <div class="pp-hp-fill h-100" :style="{ width: hpPct + '%', background: hpColor }"></div>
      </div>
    </div>

    <div v-for="stat in shownStats" :key="stat.key" class="battle-stat-mini pp-help text-center"
      v-tooltip="TIPS[stat.key]">
      <div class="pp-stat-label">{{ stat.label }}</div>
      <div class="pp-stat-value" :style="stat.color ? { color: stat.color } : null">{{ stat.value }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { equipmentService } from '../services/EquipmentService.js'
import { evolutionStage, evolutionBonuses } from '../utils/petSkills.js'

const props = defineProps({
  pet: { type: Object, required: true }
})

// Tooltip copy ported verbatim — it explains how each stat is raised, which is
// the only place the game teaches that.
const TIPS = {
  hp: '❤️ HEALTH POINTS\nHP carries over between battles!\nAt 0 HP your pet faints. Use a Revive Potion.\n\n💡 HP regenerates slowly over time.\nHeal faster with potions from the Shop.',
  atk: '⚔️ ATTACK\nHow much damage your pet deals in battle.\n\n💡 Increase by:\n• Leveling up\n• Equipping weapons\n• Evolution',
  def: '🛡️ DEFENSE\nReduces damage taken from enemy attacks.\n\n💡 Increase by:\n• Leveling up\n• Equipping armor\n• Evolution',
  spd: '💨 SPEED\nDetermines who attacks first in battles.\nAlso affects race performance!\n\n💡 Increase by:\n• Leveling up\n• Speed equipment\n• Certain variants',
  lck: '🍀 LUCK\nRaises your critical-hit chance in battle.\n\n💡 Comes from equipment.',
  spi: '🔮 SPIRIT\nResists status effects, amplifies healing,\nand makes Piper less likely to find you.\n\n💡 Comes from equipment.'
}

// Equipment-adjusted stats, or null until they load.
const battle = ref(null)

const maxHP = computed(() => {
  if (battle.value) return battle.value.maxHP
  if (props.pet.max_hp) return props.pet.max_hp
  return (props.pet.base_hp || 60) + evolutionBonuses(evolutionStage(props.pet.level || 1)).hp
})

const currentHP = computed(() => {
  if (battle.value) return battle.value.currentHP
  return (props.pet.current_hp !== null && props.pet.current_hp !== undefined)
    ? props.pet.current_hp
    : maxHP.value
})

const hpPct = computed(() => maxHP.value ? Math.round((currentHP.value / maxHP.value) * 100) : 0)
const hpColor = computed(() => hpPct.value > 50 ? '#5dde7a' : hpPct.value > 25 ? '#ffaa00' : '#ff6b6b')

// LCK and SPI only come from gear, so legacy hides them at zero rather than
// showing three empty boxes on a pet with no equipment.
const shownStats = computed(() => {
  const s = battle.value?.stats
  const out = [
    { key: 'atk', label: 'ATK', value: s ? s.attack : (props.pet.base_attack || 5) },
    { key: 'def', label: 'DEF', value: s ? s.defense : (props.pet.base_defense || 3) },
    { key: 'spd', label: 'SPD', value: s ? s.speed : (props.pet.base_speed || 4) }
  ]
  if (s?.luck) out.push({ key: 'lck', label: 'LCK', value: s.luck, color: '#f0a500' })
  if (s?.spirit) out.push({ key: 'spi', label: 'SPI', value: s.spirit, color: '#c47fff' })
  return out
})

async function load() {
  try {
    battle.value = await equipmentService.calculatePetStats(props.pet.id)
  } catch (e) {
    // Base stats stay on screen — a failed gear lookup shouldn't blank the row.
    console.error('[PetBattleStats] could not load adjusted stats:', e)
  }
}

onMounted(load)
watch(() => props.pet.id, load)
</script>

<style lang="scss" scoped>
// `.pet-battle-stats` and `.battle-stat-mini` were inline-styled in the legacy
// card, so the component owns the whole look.
.pet-battle-stats {
  background: rgba(176, 106, 255, 0.1);
  border: 2px solid var(--purple-light);
}

.pp-help { cursor: help; }

.pp-stat-label {
  font-size: 0.7rem;
  color: var(--text-light);
  text-transform: uppercase;
}

.pp-stat-value {
  font-weight: bold;
  color: var(--purple);
  font-size: 1.1rem;
}

// A drawn mini-bar: 60x4 with a 2px radius, none of which is on the utility
// scale (the radius scale starts at 8px).
.pp-hp-track {
  width: 60px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
}

.pp-hp-fill {
  transition: width 0.3s;
}
</style>
