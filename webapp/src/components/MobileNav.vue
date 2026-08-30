<template>
  <!-- Teleported to <body> deliberately. The drawer is position:fixed, and a
       fixed element anchors to the nearest ancestor with a transform, filter or
       contain — of which the global stylesheet has many. -->
  <Teleport to="body">
    <div class="mobile-nav-overlay" :class="{ show: AppState.mobileNavOpen }" @click="close"></div>

    <nav class="mobile-nav-menu" :class="{ open: AppState.mobileNavOpen }" aria-label="Site menu">
      <button class="mobile-menu-close" aria-label="Close menu" @click="close">✕ Close</button>

      <!-- The two sidebars themselves, not a second copy of their contents.
           Legacy hand-copied its nav list into `#mobile-nav-menu` and the two
           had already drifted apart by the time it was read — the mobile copy
           carried entries the desktop one lacked and vice versa.

           Rendered here ONLY below the desktop breakpoint, and in AppShell only
           above it, so exactly one instance of each exists at any width. That
           matters beyond tidiness: LeftSidebar runs the activity-feed rotation
           and RightSidebar polls stream status, so a second mounted copy would
           double both timers and their queries. It also keeps the
           `sidebar-btn-<tab>` ids the tutorial looks up unambiguous. -->
      <div class="mn-sidebars d-flex flex-column gap-3">
        <LeftSidebar />
        <RightSidebar />
      </div>
    </nav>
  </Teleport>
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { AppState } from '../AppState.js'
import LeftSidebar from './LeftSidebar.vue'
import RightSidebar from './RightSidebar.vue'

const route = useRoute()

function close() {
  AppState.mobileNavOpen = false
}

// Closing on a route change covers navigation the drawer didn't initiate — a
// toast link, the back button, a redirect — which would otherwise leave it
// sitting open over a page the player has already moved on from. The sidebar's
// own buttons route, so this is also what closes the drawer when one is tapped.
watch(() => route.fullPath, close)

// The page behind a fixed, full-height drawer still scrolls on touch, which
// reads as the drawer sliding around.
watch(() => AppState.mobileNavOpen, open => {
  document.body.style.overflow = open ? 'hidden' : ''
})

function onKeydown(e) {
  if (e.key === 'Escape' && AppState.mobileNavOpen) close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  // Teleported nodes go with the component, but the body style is set on an
  // element this component does not own, so it has to be handed back.
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
// `.mobile-nav-menu`, `.mobile-nav-overlay` and `.mobile-menu-close` are owned
// by the global stylesheet, including the slide-in transition and the `.open` / `.show`
// toggles.

// ── Un-hiding the sidebars inside the drawer ────────────────────────────────
// the global stylesheet's `@media (max-width: 900px)` block hides exactly what this drawer
// exists to show, because legacy had a SEPARATE hand-copied menu and needed the
// real sidebars out of the way. Here the drawer IS the sidebars, so those three
// rules have to be reversed within it — and only within it.
//
// The specificity is deliberate, not defensive padding. The hardest rule to
// beat is
//     .left-sidebar > .sidebar-section:first-of-type + .sidebar-section
// at (0,4,0) with `!important`. Two important declarations are decided by
// specificity, so anything at (0,4,0) or below silently loses. Writing the
// drawer class AND the wrapper AND the scoped attribute in front of the deep
// selector gives (0,5,0), which wins outright rather than relying on source
// order between the global stylesheet and this component's emitted CSS — an order Vite
// does not guarantee.
.mobile-nav-menu .mn-sidebars :deep(.left-sidebar),
.mobile-nav-menu .mn-sidebars :deep(.right-sidebar) {
  display: flex !important;
  // Legacy turns the left sidebar into a horizontal wrapping strip on mobile
  // ("compact header with stats only"), which inside a 280px drawer squeezes
  // the branding, Menu and Your Stats into columns beside each other.
  flex-direction: column !important;
  width: 100% !important;
  align-self: stretch !important;
}

// The two panels' running order, stated explicitly.
//
// This is not belt-and-braces — without it they come out BACKWARDS. That same
// mobile block sets `.left-sidebar { order: 1 }` (for legacy's stacked page
// layout, where it ordered the sidebar against `.center-content`), while
// `.right-sidebar` has no order at all and so defaults to 0. Inside the
// drawer the two are siblings, 0 sorts before 1, and Our Streamers and Latest
// News were rendering above the whole left sidebar — including Your Stats.
.mobile-nav-menu .mn-sidebars :deep(.left-sidebar) {
  order: 1 !important;
}

.mobile-nav-menu .mn-sidebars :deep(.right-sidebar) {
  order: 2 !important;
}

// `display` un-hides the Menu and Your Stats panels, which the mobile block
// blanks. `flex`/`min-width` undo the other half of the horizontal-strip
// layout: `.left-sidebar .sidebar-section { flex: 1; min-width: 120px }` is
// sized for sections sitting side by side, and as column children it stretches
// each to an equal share of the drawer's height rather than to its content.
.mobile-nav-menu .mn-sidebars :deep(.left-sidebar .desktop-nav),
.mobile-nav-menu .mn-sidebars :deep(.left-sidebar .sidebar-section) {
  display: block !important;
  flex: 0 0 auto !important;
  min-width: 0 !important;
}

// Restores the base rule's own layout (legacy style.css:2405) — the mobile block
// blanks this to `none`, and `block` would drop the 8px gap between buttons.
.mobile-nav-menu .mn-sidebars :deep(.left-sidebar .sidebar-nav-links) {
  display: flex !important;
  flex-direction: column !important;
}
</style>
