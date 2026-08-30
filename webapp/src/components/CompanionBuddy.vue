<template>
  <!-- Ports the #companion-buddy block from index.html. The pet you set as your
       companion floats in the bottom-right corner of every page, drifting up and
       down, speaking every so often, and reacting when you pat it.

       Every class here is owned by the global stylesheet (`#companion-buddy`,
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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.companion-sprite {
  position: relative;
  transition: filter 0.4s ease, opacity 0.4s ease;
}
#companion-buddy {
  position: fixed !important;
  bottom: 20px !important;
  right: 20px !important;
  z-index: 1500;
  pointer-events: none;
}
#companion-buddy .companion-sprite {
  pointer-events: all !important;
  cursor: pointer !important;
}
.companion-sprite {
  width: 80px;
  height: 80px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  animation: companionFloat 3s ease-in-out infinite;
}
.companion-bubble {
  position: absolute;
  bottom: 90px;
  right: 0;
  min-width: 200px;
  max-width: 280px;
  background: white;
  border: 3px solid var(--purple);
  border-radius: 16px;
  padding: 12px 16px;
  box-shadow: 0 4px 12px rgba(153, 102, 255, 0.3);
  opacity: 0;
  transform: translateY(10px) scale(0.95);
  transition: all 0.3s ease;
  pointer-events: auto;
}
.companion-bubble.show {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.companion-bubble::after {
  content: '';
  position: absolute;
  bottom: -12px;
  right: 30px;
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 12px solid var(--purple);
}
.companion-message {
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.4;
}
#companion-buddy {
  position: fixed !important; /* override any later position:relative that breaks fixed */
  bottom: 20px !important;
  right: 20px !important;
  left: auto !important;
  z-index: 1500;
  pointer-events: none;
}
.companion-sprite { position: relative; /* needed so variant particles anchor to the sprite, not the page */ }
@media (max-width: 768px) {
  #companion-buddy { display: none !important; }
  #companion-buddy {
    bottom: 50px !important; /* above the stats bar */
    right: 6px !important;
  }
  .companion-sprite { width: 60px !important; height: 60px !important; }
  .companion-bubble { max-width: 160px !important; font-size: 0.72rem !important; }
}

@keyframes companionFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

// The pat floater. Legacy built this as an inline cssText blob on a
// body-appended div; the keyframes it animates (`companionPatFloat`) are already
// in the global stylesheet and are reused as-is.
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
