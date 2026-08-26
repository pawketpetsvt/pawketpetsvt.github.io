<template>
  <!-- Ports the card built inline by loadBattlePets() (game.js:11255-11400).
       `battle-pet-card` and its `-name`/`-level`/`-stats`/`battle-pet-stat*`
       children are all styled by the root style.css, so this component only
       supplies markup plus the energy bar, which legacy wrote inline. -->
  <div class="battle-pet-card" :class="{ selected }" @click="$emit('select', pet.id)">
    <div class="pp-portrait">
      <img v-if="imageFile && !imgError" :src="'/images/' + imageFile" :alt="displayName" @error="imgError = true" />
      <span v-else>🐾</span>
    </div>

    <div class="battle-pet-card-name">{{ displayName }}</div>
    <div class="battle-pet-card-level">Level {{ pet.level || 1 }}</div>

    <div class="battle-pet-card-stats">
      <div v-for="stat in stats" :key="stat.label" class="battle-pet-stat pp-help" v-tooltip="stat.tip">
        <div class="battle-pet-stat-label">{{ stat.label }}</div>
        <div class="battle-pet-stat-value">{{ stat.value }}</div>
      </div>
    </div>

    <div class="pp-energy">
      <div class="pp-energy-row">
        <span class="pp-energy-icon">⚡</span>
        <div class="pp-energy-track">
          <div class="pp-energy-fill" :style="{ width: energyPct + '%', background: energyColor }"></div>
        </div>
        <span class="pp-energy-text" :style="{ color: energyColor }">{{ energy }}/{{ maxEnergy }}</span>
      </div>
      <div v-if="energy < 5" class="pp-energy-warn">⚠️ Too low to battle</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { evolutionStage, evolutionBonuses } from '../../utils/petSkills.js'

const props = defineProps({
  pet: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})
defineEmits(['select'])

const imgError = ref(false)

// `image_file` already carries its own `pets/` prefix, so the path is
// `/images/<file>` — not `/images/pets/<file>`.
const imageFile = computed(() => props.pet.species?.image_file || props.pet.pets?.image_file || null)
const displayName = computed(() => props.pet.nickname || props.pet.species?.name || 'Pet')

// max_hp in the row is written back by calculatePetStats (so it already
// includes gear bonuses), but a pet that has never entered battle may not have
// one yet — fall back to base + evolution, exactly as quickHeal() does.
const maxHP = computed(() => {
  if (props.pet.max_hp) return props.pet.max_hp
  const evo = evolutionBonuses(evolutionStage(props.pet.level || 1))
  return (props.pet.base_hp || 60) + evo.hp
})

const currentHP = computed(() =>
  (props.pet.current_hp !== null && props.pet.current_hp !== undefined)
    ? props.pet.current_hp
    : maxHP.value
)

const stats = computed(() => [
  { label: 'HP', value: `${currentHP.value}/${maxHP.value}`, tip: '❤️ HP. Carries over between battles. At 0 your pet faints.' },
  { label: 'ATK', value: props.pet.base_attack || 5, tip: '⚔️ ATK. Damage dealt per hit. Boosted by weapons and level-ups.' },
  { label: 'DEF', value: props.pet.base_defense || 3, tip: '🛡️ DEF. Reduces incoming damage. Boosted by armor and level-ups.' },
  { label: 'SPD', value: props.pet.base_speed || 4, tip: '💨 SPD. Who attacks first. Also affects racing performance.' }
])

const energy = computed(() => props.pet.energy || 0)
const maxEnergy = computed(() => props.pet.max_energy || 100)
const energyPct = computed(() => Math.round(Math.min(energy.value / maxEnergy.value, 1) * 100))
const energyColor = computed(() =>
  energyPct.value > 50 ? '#66ff99' : energyPct.value > 20 ? '#fbbf24' : '#ff6b6b'
)
</script>

<style lang="scss" scoped>
.pp-portrait {
  width: 72px;
  height: 72px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    max-width: 72px;
    max-height: 72px;
    object-fit: contain;
  }

  span { font-size: 2rem; }
}

.pp-help { cursor: help; }

.pp-energy { margin-top: 6px; }

.pp-energy-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
}

.pp-energy-icon {
  color: var(--text-light);
  min-width: 14px;
}

.pp-energy-track {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  height: 6px;
  overflow: hidden;
}

.pp-energy-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s;
}

.pp-energy-text {
  font-weight: 700;
  min-width: 36px;
  text-align: right;
}

.pp-energy-warn {
  font-size: 0.65rem;
  color: #ff6b6b;
  text-align: center;
  margin-top: 2px;
}
</style>
