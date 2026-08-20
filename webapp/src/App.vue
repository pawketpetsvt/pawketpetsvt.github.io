<template>
  <NavBar />
  <router-view />
  <footer class="footer">
    <div class="footer-sparkles">✦ ✧ ★ ✦ ✧ ★ ✦</div>
    <p>© 2026 PawketPetsVT &nbsp;|&nbsp; Made with 💖</p>
  </footer>
  <div v-if="toastState.visible" class="toast">{{ toastState.message }}</div>
</template>

<script setup>
import NavBar from './components/NavBar.vue'
import { toastState } from './utils/Toast.js'
</script>

<style lang="scss">
@import './assets/scss/globals.scss';
</style>

<style lang="scss" scoped>
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--purple-dark, #4a2e7a);
  color: white;
  padding: 12px 24px;
  border-radius: 24px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  z-index: 300;
  font-weight: 700;
}
</style>
