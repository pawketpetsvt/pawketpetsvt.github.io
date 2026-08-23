<template>
  <div class="left-sidebar">
    <div class="sidebar-section">
      <div class="sidebar-title">🐾 PawketPetsVT</div>
      <div class="activity-feed-box">
        <div :key="activityIndex" class="activity-feed-message">{{ activityMessage }}</div>
      </div>
    </div>

    <div class="sidebar-section desktop-nav">
      <div class="sidebar-title">📋 Menu</div>
      <div class="sidebar-nav-links">
        <button class="sidebar-nav-btn standalone" :class="{ active: AppState.tabKey === 'home' }" @click="go('home')">🏠 Home</button>

        <div v-for="group in navGroups" :key="group.key" class="nav-group" :class="{ open: openGroup === group.key }">
          <button class="nav-group-header" @click="toggleGroup(group.key)">
            {{ group.icon }} {{ group.label }} <span class="nav-group-arrow">›</span>
          </button>
          <div class="nav-group-children">
            <button
              v-for="item in group.items"
              :key="item.tab"
              class="sidebar-nav-btn child"
              :class="{ active: AppState.tabKey === item.tab }"
              @click="go(item.tab)"
            >{{ item.icon }} {{ item.label }}
              <span v-if="item.tab === 'friends' && AppState.friendRequestCount > 0" class="nav-badge">{{ AppState.friendRequestCount }}</span>
            </button>
          </div>
        </div>

        <button class="sidebar-nav-btn standalone" :class="{ active: AppState.tabKey === 'battle' }" @click="go('battle')">⚔️ Battle Arena</button>
        <button class="sidebar-nav-btn standalone" :class="{ active: AppState.tabKey === 'shop' }" @click="go('shop')">🛍️ Shop</button>
      </div>
    </div>

    <div class="sidebar-section desktop-nav">
      <div class="sidebar-title">Your Stats</div>
      <div class="sidebar-stats">
        <div class="stat-row">
          <span class="stat-label">Pets Owned</span>
          <span class="stat-value">{{ AppState.sidebarStats.petCount }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Points</span>
          <span class="stat-value">{{ points.toLocaleString() }} PP</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Items</span>
          <span class="stat-value">{{ AppState.sidebarStats.itemCount }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Day Streak</span>
          <span class="stat-value">{{ AppState.sidebarStats.streak }}</span>
        </div>
        <div class="streak-milestone">{{ milestoneText }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
import { streakService } from '../services/StreakService.js'
import { friendService } from '../services/FriendService.js'

const router = useRouter()
const openGroup = ref(null)
const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)
const milestoneText = computed(() => streakService.nextMilestoneText(AppState.sidebarStats.streak))

// Ports the activity feed rotation, game.js:21876-21975/22059-22067 —
// rotate through friends' recent public activity every 5s, reload from the
// DB every 2min. Empty until the user has accepted friends with activity.
const activities = ref([])
const activityIndex = ref(0)
const activityMessage = computed(() => (activities.value.length ? activities.value[activityIndex.value] : "Add friends to see their activity!"))
let rotateTimer = null
let refreshTimer = null

async function loadActivities() {
  activities.value = await friendService.loadFriendActivity(AppState.user.id)
  activityIndex.value = 0
}

onMounted(async () => {
  await loadActivities()
  rotateTimer = setInterval(() => {
    if (activities.value.length) activityIndex.value = (activityIndex.value + 1) % activities.value.length
  }, 5000)
  refreshTimer = setInterval(loadActivities, 120000)
})

onUnmounted(() => {
  clearInterval(rotateTimer)
  clearInterval(refreshTimer)
})

const navGroups = [
  {
    key: 'pets', icon: '🐾', label: 'Pets',
    items: [
      { tab: 'adopt', icon: '🐣', label: 'Adopt' },
      { tab: 'mypets', icon: '💖', label: 'My Pets' },
      { tab: 'journal', icon: '📓', label: 'Pet Journal' }
    ]
  },
  {
    key: 'games', icon: '🎮', label: 'Games',
    items: [
      { tab: 'minigames', icon: '🕹️', label: 'Minigames' },
      { tab: 'fishing', icon: '🎣', label: 'Fishing' },
      { tab: 'racing', icon: '🏁', label: 'Racing' },
      { tab: 'cooking', icon: '🍳', label: 'Cooking' }
    ]
  },
  {
    key: 'community', icon: '🌐', label: 'Community',
    items: [
      { tab: 'guild', icon: '🏛️', label: 'Guild' },
      { tab: 'friends', icon: '👥', label: 'Friends' },
      { tab: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
      { tab: 'forum', icon: '💬', label: 'Forum' },
      { tab: 'stats', icon: '📊', label: 'Statistics' }
    ]
  },
  {
    key: 'more', icon: '✨', label: 'More',
    items: [
      { tab: 'twitch', icon: '🎬', label: 'Twitch' },
      { tab: 'redeem', icon: '🎟️', label: 'Redeem' },
      { tab: 'news', icon: '📰', label: 'News' },
      { tab: 'team', icon: '👥', label: 'Team' },
      { tab: 'settings', icon: '⚙️', label: 'Settings' },
      { tab: 'privacy', icon: '🔒', label: 'Privacy Policy' }
    ]
  }
]

function toggleGroup(key) {
  openGroup.value = openGroup.value === key ? null : key
}

function go(tab) {
  router.push('/' + tab)
  openGroup.value = null
}
</script>

<style lang="scss" scoped>
.nav-badge {
  display: inline-block;
  background: var(--red, #ff4d4d);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  border-radius: 10px;
  padding: 1px 6px;
  margin-left: 4px;
}

.streak-milestone {
  font-size: 0.68rem;
  color: #ffaa00;
  text-align: center;
  margin-top: 2px;
  line-height: 1.3;
}
</style>
