<template>
  <svg width="0" height="0" style="position:absolute;pointer-events:none;" aria-hidden="true">
    <defs>
      <filter id="cb-deuteranopia">
        <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="cb-protanopia">
        <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="cb-tritanopia">
        <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/>
      </filter>
    </defs>
  </svg>

  <div class="pp-app-shell-wrap">
    <NavBar />
    <AppShell v-if="AppState.user" />
    <GuestLayout v-else />
    <SiteFooter />
  </div>
</template>

<script setup>
import { AppState } from './AppState.js'
import NavBar from './components/NavBar.vue'
import SiteFooter from './components/SiteFooter.vue'
import AppShell from './layouts/AppShell.vue'
import GuestLayout from './layouts/GuestLayout.vue'
</script>

<style lang="scss">
@import './assets/scss/globals.scss';

.pp-app-shell-wrap {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
</style>
