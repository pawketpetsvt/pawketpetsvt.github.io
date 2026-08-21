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
    '$1 <img src="images/icons/pawketpoint.png" alt="PP" style="width:13px;height:13px;vertical-align:middle;margin:0 1px;object-fit:contain;">'
  )
})
</script>
