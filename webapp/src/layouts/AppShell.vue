<template>
  <!-- Phase 6.5: the legacy `.app-container` CSS grid (240px/260px 1fr …,
       defined six competing times across the global stylesheet) is replaced by Bootstrap's
       container/row/col system. `container-xxl` reproduces the legacy geometry
       exactly — fluid below 1400px, capped and centered above — because both
       the container max-width and Bootstrap's xxl breakpoint are 1400px.

       Horizontal padding comes from the container itself ($container-padding-x
       emits 20px per side); `py-gap` supplies the vertical half that legacy's
       `padding: 20px` also had and a container does not. -->
  <div class="container-xxl py-gap">
    <div class="row g-3 align-items-start">
      <!-- `v-if` rather than only Bootstrap's `d-none d-lg-block`: below lg the
           sidebars render inside MobileNav's drawer instead, and both must
           never be mounted at once — LeftSidebar rotates the activity feed on a
           timer and RightSidebar polls stream status, so a hidden second copy
           would quietly double both. The display utility stays as well, so the
           column itself contributes no width above lg either way. -->
      <aside v-if="isDesktop" class="col-auto d-none d-lg-block pp-sidebar-col">
        <LeftSidebar />
      </aside>

      <!-- `center-content` is retained deliberately: its remaining the global stylesheet
           rules are non-grid (min-height, position) and still wanted. It gets
           folded into a scoped block when the shell components themselves are
           converted later in this phase. -->
      <main class="col center-content">
        <router-view />
      </main>

      <aside v-if="isDesktop" class="col-auto d-none d-lg-block pp-sidebar-col">
        <RightSidebar />
      </aside>
    </div>
  </div>

  <!-- Both sidebars are `d-none` below Bootstrap's lg breakpoint, and the
       navbar carries no page links beyond Home and Profile — so without this
       drawer, 21 of the app's 23 pages are unreachable on a phone. It teleports
       itself to <body>; mounting it here just ties its lifetime to the
       signed-in shell. -->
  <MobileNav />
  <TutorialOverlay />

  <ToastHost />
  <CenteredModal />
  <MelonPopup />
  <QuestCompleteModal />
  <AdpocalypseOverlay />
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
import { playerService } from '../services/PlayerService.js'
import { streakService } from '../services/StreakService.js'
import { melonService } from '../services/MelonService.js'
import { tutorialService } from '../services/TutorialService.js'
import { notificationService } from '../services/NotificationService.js'
import { friendService } from '../services/FriendService.js'
import { settingsService } from '../services/SettingsService.js'
import { themeService } from '../services/ThemeService.js'
import LeftSidebar from '../components/LeftSidebar.vue'
import RightSidebar from '../components/RightSidebar.vue'
import MobileNav from '../components/MobileNav.vue'
import TutorialOverlay from '../components/TutorialOverlay.vue'
import ToastHost from '../components/ToastHost.vue'
import CenteredModal from '../components/CenteredModal.vue'
import MelonPopup from '../components/MelonPopup.vue'
import QuestCompleteModal from '../components/pet/QuestCompleteModal.vue'
import AdpocalypseOverlay from '../components/AdpocalypseOverlay.vue'
import { isDesktop } from '../composables/useViewport.js'

const router = useRouter()

// Ports the shell-relevant slice of showApp(), game.js:2036-2241. The other
// ~15 parallel bootstraps there (pass, bingo, scrapbook, community goals,
// polls, admin, referral, badges/titles, skin keys, cosmetics, etc.) are
// feature-tab bootstraps deferred to their own migration phases.
onMounted(async () => {
  await playerService.ensurePlayerRow(AppState.user)
  await playerService.refreshSidebarStats(AppState.user.id)
  const tutorialDone = await tutorialService.checkStatus(AppState.user.id)
  await notificationService.refreshBadge(AppState.user.id)
  await friendService.refreshRequestCount(AppState.user.id)
  await settingsService.load(AppState.user.id)
  themeService.loadSaved()

  const login = await streakService.checkDailyLogin(AppState.user.id)
  if (login.awarded) {
    await streakService.showDailyLoginReward(login.streak, login.ppReward)
  }

  melonService.checkMilestones()

  // Ports checkTutorialStatus()'s tail (game.js on main:9661-9669): a player who
  // has never finished the walkthrough gets it, after a beat so the shell has
  // painted behind it. Legacy used 1.5s.
  if (!tutorialDone) {
    setTimeout(() => tutorialService.start(router), 1500)
  }
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
// `.center-content` is a Bootstrap `.col`. Bootstrap already gives it its width
// (flex: 1 0 0%) and its share of the row gutter, so the only rules it needs
// here are the non-layout ones.
//
// It used to carry a stack of mobile overrides forcing `width: 100vw` — ported
// verbatim in Phase 11 from the pre-Bootstrap layout, where `.center-content`
// was a child of the `.app-container` CSS grid and breaking out to the viewport
// width was how it escaped that grid. Under container/row/col that is actively
// wrong: 100vw ignores the container's 20px side padding AND the row's negative
// gutter margins, so the column renders WIDER than its parent and overflows —
// which is why every page's content sat pinned to the left with dead space
// beside it on a phone. The accompanying `padding: 0` also stripped the gutter
// the cards need to clear the screen edge.
//
// Also removed: `body.logged-out` and `body.guest` variants. Neither class is
// ever applied anywhere in the app, and AppShell only renders when a user is
// signed in, so a guest never reaches these rules in the first place.
.center-content {
  min-height: 600px;
  position: relative;
}

// The only piece Bootstrap's grid can't express directly: the sidebars are a
// fixed 260px rather than a fraction of the row. `col-auto` sizes to content,
// so the width is set here and the center column takes the remainder via `col`.
.pp-sidebar-col {
  width: 260px;
}
</style>
