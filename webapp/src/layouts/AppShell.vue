<template>
  <div class="app-container">
    <LeftSidebar />
    <div class="center-content">
      <router-view />
    </div>
    <RightSidebar />
  </div>
  <ToastHost />
  <CenteredModal />
  <MelonPopup />
</template>

<script setup>
import { onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { playerService } from '../services/PlayerService.js'
import { streakService } from '../services/StreakService.js'
import { melonService } from '../services/MelonService.js'
import { tutorialService } from '../services/TutorialService.js'
import { notificationService } from '../services/NotificationService.js'
import { settingsService } from '../services/SettingsService.js'
import { themeService } from '../services/ThemeService.js'
import LeftSidebar from '../components/LeftSidebar.vue'
import RightSidebar from '../components/RightSidebar.vue'
import ToastHost from '../components/ToastHost.vue'
import CenteredModal from '../components/CenteredModal.vue'
import MelonPopup from '../components/MelonPopup.vue'

// Ports the shell-relevant slice of showApp(), game.js:2036-2241. The other
// ~15 parallel bootstraps there (pass, bingo, scrapbook, community goals,
// polls, admin, referral, badges/titles, skin keys, cosmetics, etc.) are
// feature-tab bootstraps deferred to their own migration phases.
onMounted(async () => {
  await playerService.ensurePlayerRow(AppState.user)
  await playerService.refreshSidebarStats(AppState.user.id)
  await tutorialService.checkStatus(AppState.user.id)
  await notificationService.refreshBadge(AppState.user.id)
  await settingsService.load(AppState.user.id)
  themeService.loadSaved()

  const login = await streakService.checkDailyLogin(AppState.user.id)
  if (login.awarded) {
    await streakService.showDailyLoginReward(login.streak, login.ppReward)
  }

  melonService.checkMilestones()
})
</script>
