<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🏁 ✦ 🏁</div>
      <h1>Pet Racing</h1>
      <p>Train your pet, climb the leagues, and take the Grand Prix! ✨</p>
    </div>

    <!-- Reuses `.shop-tabs`/`.shop-tab`, as the legacy racing tab does. That
         class is owned entirely by style.css, so no layout utilities are added
         to it — see the note in ShopPage. -->
    <div class="shop-tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="shop-tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >{{ t.label }}</button>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <TrainPanel v-if="activeTab === 'train'" />
      <QuickRacePanel v-else-if="activeTab === 'quickrace'" />
      <LeaguePanel v-else-if="activeTab === 'league'" />
      <RacingShop v-else-if="activeTab === 'shop'" />
      <GrandPrixPanel v-else-if="activeTab === 'grandprix'" />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { racingService } from '../services/RacingService.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { toastService } from '../services/ToastService.js'
import TrainPanel from '../components/racing/TrainPanel.vue'
import QuickRacePanel from '../components/racing/QuickRacePanel.vue'
import LeaguePanel from '../components/racing/LeaguePanel.vue'
import RacingShop from '../components/racing/RacingShop.vue'
import GrandPrixPanel from '../components/racing/GrandPrixPanel.vue'

const TABS = [
  { key: 'train', label: '🏋️ Train' },
  { key: 'quickrace', label: '🏎️ Quick Race' },
  { key: 'league', label: '🏆 League' },
  { key: 'shop', label: '🛒 Shop' },
  { key: 'grandprix', label: '🎪 Grand Prix' }
]

// Legacy opens on Quick Race.
const activeTab = ref('quickrace')
const loading = ref(true)

onMounted(async () => {
  try {
    // The pet list is shared state; racing needs base_speed/attack/defense,
    // which the owned-pets query already selects.
    if (!AppState.ownedPets || !AppState.ownedPets.length) {
      await ownedPetsService.getMyPets(AppState.user.id)
    }
    await racingService.loadLeague()
  } catch (e) {
    toastService.error('Could not load racing.')
  } finally {
    loading.value = false
  }
})
</script>
