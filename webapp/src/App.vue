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

  <div class="pp-app-shell-wrap d-flex flex-column">
    <NavBar />
    <!-- Second bar under the navbar, matching legacy DOM order. Authed-only:
         the legacy stylesheet hid it for guests via `body.guest .news-ticker`,
         and mounting it here rather than in AppShell keeps it full-bleed
         instead of inside AppShell's centred container. -->
    <NewsTicker v-if="AppState.user" />
    <AppShell v-if="AppState.user" />
    <GuestLayout v-else />
    <SiteFooter />
    <!-- Fixed-position, renders nothing unless someone is live. Authed-only
         because live status needs the viewer's linked Twitch token. -->
    <LiveBanner v-if="AppState.user" />
    <!-- Also fixed-position, and renders nothing until a companion is set. It
         sits outside AppShell so it stays pinned to the viewport corner on
         every page rather than to the centre column. -->
    <CompanionBuddy v-if="AppState.user" />
    <!-- Full-screen ARG blackout. Renders nothing unless something triggers it
         (today only the THEYWENTMISSING redeem code), and lives here so any
         later ARG surface can reach it without a DOM handle. -->
    <SpookyOverlay />
    <!-- Drains the badge/title unlock queue. Renders nothing until something
         is actually unlocked. -->
    <UnlockCelebration v-if="AppState.user" />
  </div>
</template>

<script setup>
import { AppState } from './AppState.js'
import NavBar from './components/NavBar.vue'
import NewsTicker from './components/NewsTicker.vue'
import LiveBanner from './components/LiveBanner.vue'
import CompanionBuddy from './components/CompanionBuddy.vue'
import SpookyOverlay from './components/SpookyOverlay.vue'
import UnlockCelebration from './components/UnlockCelebration.vue'
import SiteFooter from './components/SiteFooter.vue'
import AppShell from './layouts/AppShell.vue'
import GuestLayout from './layouts/GuestLayout.vue'
</script>

<style lang="scss">
@import './assets/scss/globals.scss';

.pp-app-shell-wrap {
  min-height: 100vh;
}
</style>
