<template>
  <!-- Shared shell for the pet-card modals (skills, equipment, stat points,
       variants). Legacy built each of these with makeModal() + an innerHTML
       blob; one shell means the backdrop, Escape handling and scroll behaviour
       are written once instead of four times. -->
  <Teleport to="body">
    <div class="pp-modal-backdrop position-fixed d-flex align-items-center justify-content-center p-gap" @click.self="$emit('close')">
      <div class="pp-modal w-100 d-flex flex-column" :style="{ maxWidth: width }">
        <div class="d-flex align-items-start gap-px10">
          <h3 class="pp-modal-title flex-grow-1 m-0">{{ title }}</h3>
          <button class="pp-modal-x" aria-label="Close" @click="$emit('close')">✕</button>
        </div>
        <div v-if="subtitle" class="pp-modal-sub mt-1 mx-0 mb-tight">{{ subtitle }}</div>

        <div class="pp-modal-body flex-grow-1">
          <slot />
        </div>

        <button class="btn btn-outline w-100 mt-3" @click="$emit('close')">Done</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  width: { type: String, default: '460px' }
})
const emit = defineEmits(['close'])

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}

// Teleported to body, so the page behind must not scroll underneath it.
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
.pp-modal-backdrop {
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.55);
}

.pp-modal {
  max-height: 88vh;
  background: var(--white);
  border: 3px solid var(--purple-light);
  border-radius: var(--radius);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
  padding: 18px 20px;
}

.pp-modal-title {
  color: var(--purple);
  font-family: 'Fredoka One', cursive;
  font-size: 1.15rem;
}

.pp-modal-x {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--text-light);
  padding: 2px 6px;
  border-radius: 6px;

  &:hover { background: var(--purple-light); color: var(--purple-dark); }
}

.pp-modal-sub {
  font-size: 0.75rem;
  color: var(--text-light);
}

// The body scrolls, not the whole dialog, so the title and Done button stay put.
//
// The bleed-and-pad margin/padding pair is load-bearing, not decoration. Setting
// `overflow-y: auto` makes the browser compute `overflow-x: visible` as `auto`
// too, so ANY horizontal overflow here becomes a stray side-scrollbar — and a
// Bootstrap `.row` always overflows a zero-padding parent, because its gutter is
// implemented as negative horizontal margins. Bootstrap's own `.modal-body`
// avoids this by carrying 1rem of padding; this one had none.
//
// Bleeding 8px out and padding 8px back gives rows up to `g-3` room to sit in
// while leaving the content aligned exactly with the title and Done button.
.pp-modal-body {
  min-height: 0;
  overflow-y: auto;
  margin-inline: -8px;
  padding-inline: 8px;
}
</style>
