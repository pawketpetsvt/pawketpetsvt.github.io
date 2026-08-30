<template>
  <div v-if="modalState.open" class="centered-modal-overlay position-fixed w-100 h-100 d-flex align-items-center justify-content-center p-gap" role="dialog" aria-modal="true" @click.self="modalService.close()">
    <div class="centered-modal-container position-relative">
      <button class="centered-modal-close" aria-label="Close modal" @click="modalService.close()">×</button>
      <div class="centered-modal-header text-center">
        <div class="centered-modal-icon mb-3 d-inline-block">{{ modalState.icon }}</div>
        <h2 class="centered-modal-title m-0">{{ modalState.title }}</h2>
      </div>
      <div class="centered-modal-body p-4 text-center">
        <p class="centered-modal-message m-0">{{ modalState.message }}</p>
      </div>
      <div class="centered-modal-footer text-center">
        <button class="centered-modal-button" @click="modalService.close()">{{ modalState.buttonText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { modalState, modalService } from '../services/ModalService.js'

watch(() => modalState.open, (open) => {
  document.body.classList.toggle('modal-open', open)
})

function handleEscape(e) {
  if (e.key === 'Escape' && modalState.open) modalService.close()
}

onMounted(() => document.addEventListener('keydown', handleEscape))
onUnmounted(() => document.removeEventListener('keydown', handleEscape))
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.centered-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: modalOverlayFadeIn 0.3s ease-out;
}
.centered-modal-container {
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  max-width: 450px;
  width: 90%;
  padding: 0;
  position: relative;
  animation: modalPopIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  border: 2px solid rgba(102, 126, 234, 0.3);
}
.centered-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #cbd5e1;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 1;
}
.centered-modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transform: rotate(90deg);
}
.centered-modal-header {
  padding: 32px 24px 24px 24px;
  text-align: center;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}
.centered-modal-icon {
  font-size: 64px;
  margin-bottom: 16px;
  display: inline-block;
  animation: modalIconBounce 1s ease-in-out infinite;
}
.centered-modal-title {
  font-size: 24px;
  font-weight: bold;
  color: #667eea;
  margin: 0;
  line-height: 1.3;
}
.centered-modal-body {
  padding: 24px;
  text-align: center;
}
.centered-modal-message {
  font-size: 16px;
  color: #e2e8f0;
  line-height: 1.6;
  margin: 0;
  white-space: pre-line;
}
.centered-modal-footer {
  padding: 20px 24px 24px 24px;
  text-align: center;
}
.centered-modal-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  min-width: 140px;
  position: relative;
  overflow: hidden;
}
.centered-modal-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
}
.centered-modal-button:active { transform: translateY(0); }
.centered-modal-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}
.centered-modal-button:active::before {
  width: 300px;
  height: 300px;
}
.centered-modal-overlay:focus { outline: none; }
.centered-modal-button:focus, .centered-modal-close:focus {
  outline: 3px solid rgba(102, 126, 234, 0.5);
  outline-offset: 2px;
}
body.night-mode .centered-modal-container {
  background: #2a2a3a !important;
  border: 2px solid #9966ff !important;
  color: #e8d5ff !important;
}
body.night-mode .centered-modal-container {
  background: #2a2a3a !important;
  color: #e8d5ff !important;
  border-color: #9966ff !important;
}
@media (max-width: 480px) {
  .centered-modal-container {
    width: 95%;
    max-width: 95%;
  }
  .centered-modal-icon { font-size: 48px; }
  .centered-modal-title { font-size: 20px; }
  .centered-modal-message { font-size: 14px; }
  .centered-modal-button {
    width: 100%;
    padding: 12px 24px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .centered-modal-overlay, .centered-modal-container, .centered-modal-icon, .centered-modal-button {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@keyframes modalOverlayFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalPopIn {
  0% {
    opacity: 0;
    transform: scale(0.7) translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes modalIconBounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-10px) scale(1.1);
  }
}

.centered-modal-overlay {
  top: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  z-index: 100000;
  animation: modalOverlayFadeIn 0.3s ease-out;
}

@keyframes modalOverlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.centered-modal-container {
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  max-width: 450px;
  width: 90%;
  animation: modalPopIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  border: 2px solid rgba(102, 126, 234, 0.3);
}

@keyframes modalPopIn {
  0% { opacity: 0; transform: scale(0.7) translateY(-20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

.centered-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #cbd5e1;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    transform: rotate(90deg);
  }
}

.centered-modal-header {
  padding: 32px 24px 24px 24px;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.centered-modal-icon {
  font-size: 64px;
  animation: modalIconBounce 1s ease-in-out infinite;
}

@keyframes modalIconBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-10px) scale(1.1); }
}

.centered-modal-title {
  font-size: 24px;
  font-weight: bold;
  color: #667eea;
  line-height: 1.3;
}

.centered-modal-message {
  font-size: 16px;
  color: #e2e8f0;
  line-height: 1.6;
}

.centered-modal-footer {
  padding: 20px 24px 24px 24px;
}

.centered-modal-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  min-width: 140px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
  }

  &:active {
    transform: translateY(0);
  }
}

:global(body.modal-open) {
  overflow: hidden;
}

@media (max-width: 480px) {
  .centered-modal-container { width: 95%; max-width: 95%; }
  .centered-modal-icon { font-size: 48px; }
  .centered-modal-title { font-size: 20px; }
  .centered-modal-message { font-size: 14px; }
  .centered-modal-button { width: 100%; padding: 12px 24px; }
}
</style>
