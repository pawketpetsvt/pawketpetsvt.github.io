<template>
  <!-- Ports showPetVariantModal(). Variants are cosmetic skins that paint the
       card with an aura, a corner glyph and an image filter (all defined as
       `.my-pet-card.pet-variant-*` rules in style.css).

       Unlock state lives in the Skin Key system, which is not migrated yet, so
       only variants the pet has actually been granted — plus "None" — can be
       selected. The rest are listed with how they're obtained rather than
       hidden, matching how the pet-title selector shows locked entries. -->
  <PetModal :title="`🎨 Variants — ${pet.nickname}`" :subtitle="subtitle" width="520px" @close="$emit('close')">
    <div class="row row-cols-2 row-cols-sm-3 g-2">
      <div class="col">
        <button class="pp-variant" :class="{ 'pp-active': !pet.current_variant }" :disabled="busy"
          @click="choose(null)">
          <div class="pp-variant-icon">🚫</div>
          <div class="pp-variant-name">None</div>
        </button>
      </div>

      <div v-for="[key, v] in unlocked" :key="key" class="col">
        <button class="pp-variant" :class="{ 'pp-active': pet.current_variant === key }" :disabled="busy"
          :style="{ borderColor: v.color }" @click="choose(key)">
          <div class="pp-variant-icon">{{ v.icon }}</div>
          <div class="pp-variant-name" :style="{ color: v.color }">{{ v.name }}</div>
        </button>
      </div>

      <div v-for="[key, v] in locked" :key="'lock-' + key" class="col">
        <div class="pp-variant pp-locked">
          <div class="pp-variant-icon">🔒</div>
          <div class="pp-variant-name">{{ v.name }}</div>
          <div class="pp-variant-how">{{ unlockHint(v) }}</div>
        </div>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import PetModal from './PetModal.vue'
import { PET_VARIANTS } from '../../data/petCardData.js'
import { petCosmeticsService } from '../../services/PetCosmeticsService.js'
import { toastService } from '../../services/ToastService.js'

const props = defineProps({
  pet: { type: Object, required: true },
  // Variant keys this pet has unlocked. The Skin Key system that grants them is
  // not migrated, so today this is whatever the pet already has applied.
  unlockedKeys: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'changed'])

const busy = ref(false)

const owned = computed(() => {
  const keys = new Set(props.unlockedKeys)
  if (props.pet.current_variant) keys.add(props.pet.current_variant)
  return keys
})

const unlocked = computed(() => Object.entries(PET_VARIANTS).filter(([k]) => owned.value.has(k)))
const locked = computed(() => Object.entries(PET_VARIANTS).filter(([k]) => !owned.value.has(k)))

const subtitle = computed(() =>
  `${unlocked.value.length} unlocked · ${locked.value.length} still to earn`
)

function unlockHint(v) {
  if (v.unlockType === 'level') return `Level ${v.level} roll`
  if (v.unlockType === 'twitch_reward') return 'Twitch channel points'
  return 'Skin Key'
}

async function choose(key) {
  busy.value = true
  try {
    await petCosmeticsService.setVariant(props.pet.id, key)
    props.pet.current_variant = key
    toastService.success(key ? `${PET_VARIANTS[key].name} variant applied!` : 'Variant cleared.')
    emit('changed')
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
.pp-variant {
  width: 100%;
  height: 100%;
  padding: 12px 8px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--white);
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s;

  &:hover:not(:disabled):not(.pp-locked) { transform: translateY(-2px); }

  &.pp-active {
    background: var(--purple-light);
    box-shadow: 0 0 0 3px rgba(153, 102, 255, 0.25);
  }

  &.pp-locked {
    cursor: default;
    opacity: 0.6;
    border-style: dashed;
  }

  &:disabled { cursor: not-allowed; }
}

.pp-variant-icon { font-size: 1.6rem; }

.pp-variant-name {
  font-weight: 700;
  font-size: 0.78rem;
  color: var(--purple-dark);
}

.pp-variant-how {
  font-size: 0.62rem;
  color: var(--text-light);
  margin-top: 2px;
}
</style>
