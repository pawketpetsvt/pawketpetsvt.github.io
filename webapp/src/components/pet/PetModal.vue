<template>
  <!-- Shared shell for the pet-card modals (skills, equipment, stat points,
       variants). Legacy built each of these with makeModal() + an innerHTML
       blob; one shell means the backdrop, Escape handling and scroll behaviour
       are written once instead of four times. -->
  <Teleport to="body">
    <div class="pp-modal-backdrop" @click.self="$emit('close')">
      <div class="pp-modal" :style="{ maxWidth: width }">
        <div class="pp-modal-head">
          <h3 class="pp-modal-title">{{ title }}</h3>
          <button class="pp-modal-x" aria-label="Close" @click="$emit('close')">✕</button>
        </div>
        <div v-if="subtitle" class="pp-modal-sub">{{ subtitle }}</div>

        <div class="pp-modal-body">
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
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.pp-modal {
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--white);
  border: 3px solid var(--purple-light);
  border-radius: var(--radius);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
  padding: 18px 20px;
}

.pp-modal-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.pp-modal-title {
  flex: 1;
  margin: 0;
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
  margin: 4px 0 12px;
}

// The body scrolls, not the whole dialog, so the title and Done button stay put.
.pp-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
