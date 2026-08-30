<template>
  <!-- Phase 6.5: the legacy `.app-container` CSS grid (240px/260px 1fr …,
       defined six competing times across style.css) is replaced by Bootstrap's
       container/row/col system. `container-xxl` reproduces the legacy geometry
       exactly — fluid below 1400px, capped and centered above — because both
       the container max-width and Bootstrap's xxl breakpoint are 1400px.

       Horizontal padding comes from the container itself ($container-padding-x
       emits 20px per side); `py-gap` supplies the vertical half that legacy's
       `padding: 20px` also had and a container does not. -->
  <div class="container-xxl py-gap">
    <div class="row g-3 align-items-start">
      <aside class="col-auto d-none d-lg-block pp-sidebar-col">
        <LeftSidebar />
      </aside>

      <!-- `center-content` is retained deliberately: its remaining style.css
           rules are non-grid (min-height, position) and still wanted. It gets
           folded into a scoped block when the shell components themselves are
           converted later in this phase. -->
      <main class="col center-content">
        <router-view />
      </main>

      <aside class="col-auto d-none d-lg-block pp-sidebar-col">
        <RightSidebar />
      </aside>
    </div>
  </div>

  <ToastHost />
  <CenteredModal />
  <MelonPopup />
  <QuestCompleteModal />
  <AdpocalypseOverlay />
</template>

<script setup>
import { onMounted } from 'vue'
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
import ToastHost from '../components/ToastHost.vue'
import CenteredModal from '../components/CenteredModal.vue'
import MelonPopup from '../components/MelonPopup.vue'
import QuestCompleteModal from '../components/pet/QuestCompleteModal.vue'
import AdpocalypseOverlay from '../components/AdpocalypseOverlay.vue'

// Ports the shell-relevant slice of showApp(), game.js:2036-2241. The other
// ~15 parallel bootstraps there (pass, bingo, scrapbook, community goals,
// polls, admin, referral, badges/titles, skin keys, cosmetics, etc.) are
// feature-tab bootstraps deferred to their own migration phases.
onMounted(async () => {
  await playerService.ensurePlayerRow(AppState.user)
  await playerService.refreshSidebarStats(AppState.user.id)
  await tutorialService.checkStatus(AppState.user.id)
  await notificationService.refreshBadge(AppState.user.id)
  await friendService.refreshRequestCount(AppState.user.id)
  await settingsService.load(AppState.user.id)
  themeService.loadSaved()

  const login = await streakService.checkDailyLogin(AppState.user.id)
  if (login.awarded) {
    await streakService.showDailyLoginReward(login.streak, login.ppReward)
  }

  melonService.checkMilestones()
})
</script>

<style lang="scss" scoped>
// The only piece Bootstrap's grid can't express directly: the sidebars are a
// fixed 260px rather than a fraction of the row. `col-auto` sizes to content,
// so the width is set here and the center column takes the remainder via `col`.
.pp-sidebar-col {
  width: 260px;
}
</style>
