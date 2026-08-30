<template>
  <div v-if="toastState.current" class="pixel-toast" :class="['pixel-toast-' + toastState.current.type, { show: toastState.visible }]">
    <span class="pixel-toast-icon">{{ toastState.current.icon }}</span>
    <span class="pixel-toast-message" v-html="formattedMessage"></span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { toastState } from '../services/ToastService.js'

const formattedMessage = computed(() => {
  if (!toastState.current) return ''
  const div = document.createElement('div')
  div.textContent = toastState.current.message
  return div.innerHTML.replace(
    /(\+?\d[\d,]*)\s*PP\b/g,
    // Root-relative, like every other asset reference in the app. It happened
    // to work as a relative path only because hash routing keeps the document
    // path at "/" no matter which page is open — it would have broken the
    // moment anything served the app from a subpath.
    '$1 <img src="/images/icons/pawketpoint.png" alt="PP" style="width:13px;height:13px;vertical-align:middle;margin:0 1px;object-fit:contain;">'
  )
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.pixel-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--white);
  border: 3px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 250px;
  max-width: 400px;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.2);
  z-index: 10000;
  font-family: 'Fredoka One', cursive;
  font-size: 0.9rem;
  transform: translateX(500px);
  transition: transform 0.3s ease-out;
}
.pixel-toast.show { transform: translateX(0); }
.pixel-toast-icon {
  font-size: 1.5rem;
  font-weight: bold;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}
.pixel-toast-message {
  flex: 1;
  line-height: 1.4;
}
body.night-mode .pixel-toast {
  background: linear-gradient(135deg,#2a2a3a,#1e1e2e) !important;
  border: 3px solid #9966ff !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
}
body.night-mode .pixel-toast-message { color: #e8d5ff !important; }
@media (max-width: 768px) {
  .pixel-toast {
    right: 10px;
    left: 10px;
    max-width: none;
  }
}
</style>
