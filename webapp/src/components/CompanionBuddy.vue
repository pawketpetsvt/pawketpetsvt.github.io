<template>
  <!-- Ports the #companion-buddy block from index.html. The pet you set as your
       companion floats in the bottom-right corner of every page, drifting up and
       down, speaking every so often, and reacting when you pat it.

       Every class here is owned by the root style.css (`#companion-buddy`,
       `.companion-sprite`, `.companion-bubble`, `.companion-message`, the
       `.pet-variant-*` particle effects, and the `companionFloat` /
       `companionPatFloat` keyframes), so this component carries almost no
       styling of its own — the same arrangement LiveBanner.vue uses. -->
  <div v-if="pet" id="companion-buddy">
    <div class="companion-sprite d-flex align-items-center justify-content-center"
      :class="variantClass" :style="spriteStyle" title="Pat your pet!" @click="pat">
      <span v-if="!imageFile" class="pp-companion-fallback">🐾</span>
    </div>

    <div class="companion-bubble"
      :class="{ show: companionState.showBubble, 'companion-spooky-bubble': companionState.spooky }">
      <div class="companion-message">
        <span v-if="companionState.spooky" class="glitch-text companion-spooky-text">{{ companionState.message }}</span>
        <template v-else>{{ companionState.message }}</template>
      </div>
    </div>

    <!-- Pat floaters. Legacy appended these straight to <body> to escape any
         clipping container; `position: fixed` already does that, so they can
         live here and be cleaned up with the component. -->
    <div v-for="f in floaters" :key="f.id" class="pp-pat-float position-fixed"
      :style="{ left: f.x + 'px', top: f.y + 'px', color: f.color }">{{ f.text }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { companionState, companionService } from '../services/CompanionService.js'
import { petCosmeticsService } from '../services/PetCosmeticsService.js'

const pet = computed(() => companionState.pet)
const imageFile = computed(() => pet.value && pet.value.pets && pet.value.pets.image_file)

// `/images/` + image_file, not legacy's `images/pets/` + image_file: the
// column already carries its own subpath. See the Phase 6 profile-image bug.
const spriteStyle = computed(() => imageFile.value
  ? { backgroundImage: `url(/images/${imageFile.value})` }
  : {})

const variantClass = computed(() =>
  petCosmeticsService.variantClass(pet.value && pet.value.current_variant))

// ── pat gimmick ─────────────────────────────────────────────────────────────
// Ports petPat() — purely visual, no game mechanics. Capped at 6 live floaters,
// as legacy does, so holding the mouse down can't flood the page.
const PAT_TEXTS = [':3', '*purr*', '<33', '^-^', 'mrrp~', 'hehe~', 'pats!', 'uwu', ':33', '*mew*', 'heehee~', 'eep!']
const PAT_COLORS = ['var(--pink)', 'var(--purple)', '#ff9f43', '#5dde7a']
const MAX_FLOATERS = 6

const floaters = ref([])
let floaterId = 0
let wobbleTimer = null

function pat(e) {
  if (floaters.value.length >= MAX_FLOATERS) return

  const rect = e.currentTarget.getBoundingClientRect()
  const id = ++floaterId
  floaters.value.push({
    id,
    text: PAT_TEXTS[Math.floor(Math.random() * PAT_TEXTS.length)],
    color: PAT_COLORS[Math.floor(Math.random() * PAT_COLORS.length)],
    x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 50,
    y: rect.top - 8
  })

  // The floater removes itself when `companionPatFloat` finishes. A timer would
  // have to duplicate the keyframe's 1.4s and drift out of sync if it changed.
  setTimeout(() => {
    floaters.value = floaters.value.filter(f => f.id !== id)
  }, 1400)

  // Wobble, then settle. `transform` is what companionFloat animates, so the
  // wobble goes on a wrapper-free scale via a class the animation doesn't own.
  const sprite = e.currentTarget
  sprite.classList.add('pp-patted')
  clearTimeout(wobbleTimer)
  wobbleTimer = setTimeout(() => sprite.classList.remove('pp-patted'), 180)
}

// The companion's watchers are registered in main.js so they survive log-out;
// only the speech rotation is tied to this component's lifetime.
onMounted(() => companionService.start())

onUnmounted(() => {
  companionService.stop()
  clearTimeout(wobbleTimer)
})
</script>

<style lang="scss" scoped>
// The pat floater. Legacy built this as an inline cssText blob on a
// body-appended div; the keyframes it animates (`companionPatFloat`) are already
// in style.css and are reused as-is.
// Positioned inline from the click coordinates, so `position: fixed` stays with
// the offsets it belongs to rather than moving to a utility.
.pp-pat-float {
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 9999;
  font-size: 1.1rem;
  font-weight: 800;
  font-family: 'Chewy', 'Fredoka One', sans-serif;
  white-space: nowrap;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
  animation: companionPatFloat 1.4s ease-out forwards;
}

// The sprite has no image when the pet's catalog row carries no file, so the
// emoji fallback needs the sprite box to centre it — `d-flex align-items-center
// justify-content-center` in the template.

.pp-companion-fallback {
  font-size: 3rem;
  line-height: 1;
}

// A brief squish on click. `companionFloat` owns `transform` on this element,
// so the pat reads as a filter/scale change that does not fight the drift.
.companion-sprite.pp-patted {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2)) brightness(1.15);
  scale: 1.18;
  transition: scale 0.1s ease;
}
</style>
