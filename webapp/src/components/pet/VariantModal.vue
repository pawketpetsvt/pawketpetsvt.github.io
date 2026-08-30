<template>
  <!-- Ports showPetVariantModal(). Variants are cosmetic skins that paint the
       card with an aura, a corner glyph and an image filter (all defined as
       `.my-pet-card.pet-variant-*` rules in the global stylesheet).

       Unlock state comes from the Skin Key system (SkinKeyService), migrated in
       Phase 9.5. A locked variant that can be bought with keys shows its price
       and buys in place; the rest are listed with how they're obtained rather
       than hidden, matching how the pet-title selector shows locked entries. -->
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
          <div class="pp-variant-how mt-px2">{{ unlockHint(v) }}</div>
          <button v-if="buyable(key)" class="pp-variant-buy" :disabled="busy || !canAfford(key)"
            @click="buy(key)">🔑 {{ skinKeyService.cost(key) }}</button>
        </div>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from './PetModal.vue'
import { PET_VARIANTS } from '../../data/petCardData.js'
import { petCosmeticsService } from '../../services/PetCosmeticsService.js'
import { skinKeyService, skinKeyState, SPECIAL_VARIANTS } from '../../services/SkinKeyService.js'
import { BASIC_VARIANTS } from '../../data/petCardData.js'
import { toastService } from '../../services/ToastService.js'

const props = defineProps({
  pet: { type: Object, required: true }
})
const emit = defineEmits(['close', 'changed'])

const busy = ref(false)

const owned = computed(() => {
  const keys = new Set(skinKeyState.unlocked[props.pet.id] || [])
  // A variant already applied counts as owned even if the unlock row is missing
  // — a pet that received one through a grant rather than a purchase.
  if (props.pet.current_variant) keys.add(props.pet.current_variant)
  SPECIAL_VARIANTS.forEach(k => { if (PET_VARIANTS[k]) keys.add(k) })
  return keys
})

const unlocked = computed(() => Object.entries(PET_VARIANTS).filter(([k]) => owned.value.has(k)))
const locked = computed(() => Object.entries(PET_VARIANTS).filter(([k]) => !owned.value.has(k)))

const subtitle = computed(() =>
  `${unlocked.value.length} unlocked · ${locked.value.length} still to earn` +
  ` · 🔑 ${skinKeyState.keys} key${skinKeyState.keys === 1 ? '' : 's'}`
)

// Only the BASIC_VARIANTS set is purchasable with keys — the rest unlock by
// level roll or Twitch redemption and have no price.
const buyable = key => !!BASIC_VARIANTS[key]
const canAfford = key => skinKeyState.keys >= skinKeyService.cost(key)

async function buy(key) {
  busy.value = true
  try {
    const v = await skinKeyService.unlock(props.pet.id, key)
    toastService.success(`✨ Unlocked ${v.name} variant!`)
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

onMounted(() => { if (!skinKeyState.loaded) skinKeyService.load() })

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
}

// Buy-with-keys button on a locked tile. The gold reads as the key currency,
// which is how the navbar counter renders it too.
.pp-variant-buy {
  margin-top: 6px;
  padding: 2px 10px;
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 20px;
  border: 1px solid rgba(255, 215, 0, 0.5);
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.18), rgba(255, 165, 0, 0.18));
  color: #b8860b;
  cursor: pointer;

  &:disabled { opacity: 0.45; cursor: default; }
  &:hover:not(:disabled) { filter: brightness(1.1); }
}
</style>
