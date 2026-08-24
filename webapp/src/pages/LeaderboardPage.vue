<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🏆 ✦ 🏆</div>
      <h1>Leaderboard</h1>
      <p>See how you stack up against the rest of Pawket Pets! ⭐</p>
    </div>

    <div class="leaderboard-tabs">
      <button class="leaderboard-tab" :class="{ active: activeTab === 'points' }" @click="switchTab('points')">🪙 Most Points</button>
      <button class="leaderboard-tab" :class="{ active: activeTab === 'streak' }" @click="switchTab('streak')">🔥 Login Streak</button>
      <button class="leaderboard-tab" :class="{ active: activeTab === 'levels' }" @click="switchTab('levels')">⭐ Highest Levels</button>
      <button class="leaderboard-tab" :class="{ active: activeTab === 'badges' }" @click="switchTab('badges')">🎖️ Most Badges</button>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <div v-if="!entries.length" class="empty-state"><p>No data yet! Be the first! 🌟</p></div>
      <div v-else class="lb-list">
        <div v-for="(p, i) in entries" :key="p.userId || p.username" class="leaderboard-item" @click="viewProfile(p.username)">
          <div class="leaderboard-rank" :class="rankClass(i)">{{ rankLabel(i) }}</div>
          <div class="leaderboard-avatar">{{ p.username.charAt(0).toUpperCase() }}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-username">{{ p.username }}</div>
            <div class="leaderboard-stats">{{ p.stat }}</div>
          </div>
          <div class="leaderboard-value">{{ p.value }}</div>
        </div>
      </div>

      <div v-if="activeTab === 'streak' && myStreakWidget" class="my-streak-widget">
        <div>
          <div class="my-streak-title">Your Streak</div>
          <div class="my-streak-rank">{{ myStreakWidget.rankText }}</div>
        </div>
        <div class="my-streak-value">{{ myStreakWidget.icon }} {{ myStreakWidget.streak }} {{ myStreakWidget.streak === 1 ? 'day' : 'days' }}</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { useRouter } from 'vue-router'
import { leaderboardService } from '../services/LeaderboardService.js'

const router = useRouter()

function viewProfile(username) {
  router.push('/profile/' + encodeURIComponent(username))
}

const activeTab = ref('points')
const loading = ref(true)
const entries = ref([])
const myStreak = ref(0)
const myRank = ref(null)
// Ports leaderboardCache, game.js:11426-11430 — caches each tab's actual
// data (not just a "was this loaded" flag), since all 4 categories share
// one `entries` ref/list element here rather than legacy's 4 separate,
// persistent DOM containers. Unlike game.js (which never caches streak,
// since it was written when streak could still change mid-session), this
// port caches all 4 uniformly — login streak and last-login are already
// fixed for the day by the time this page loads, so there's nothing to
// gain from re-fetching on every revisit.
const cache = { points: null, streak: null, levels: null, badges: null }

function rankClass(i) {
  return i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''
}
function rankLabel(i) {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1 + '.'
}

const myStreakWidget = computed(() => {
  if (activeTab.value !== 'streak' || !AppState.user) return null
  const icon = myStreak.value >= 30 ? '💎' : myStreak.value >= 7 ? '🔥' : '📅'
  return {
    icon,
    streak: myStreak.value,
    rankText: myRank.value ? '#' + myRank.value + ' on the leaderboard' : 'Not yet in top 10'
  }
})

async function loadTab(tab) {
  loading.value = true
  if (tab === 'points') {
    entries.value = await leaderboardService.loadPoints()
    cache.points = entries.value
  } else if (tab === 'streak') {
    const res = await leaderboardService.loadStreak(AppState.user ? AppState.user.id : null)
    entries.value = res.entries
    myStreak.value = res.myStreak
    myRank.value = res.myRank
    cache.streak = res
  } else if (tab === 'levels') {
    entries.value = await leaderboardService.loadLevels()
    cache.levels = entries.value
  } else if (tab === 'badges') {
    entries.value = await leaderboardService.loadBadges()
    cache.badges = entries.value
  }
  loading.value = false
}

async function switchTab(tab) {
  activeTab.value = tab
  if (cache[tab]) {
    if (tab === 'streak') {
      entries.value = cache.streak.entries
      myStreak.value = cache.streak.myStreak
      myRank.value = cache.streak.myRank
    } else {
      entries.value = cache[tab]
    }
    return
  }
  await loadTab(tab)
}

onMounted(async () => {
  await loadTab('points')
})
</script>

<style lang="scss" scoped>
.leaderboard-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.leaderboard-tab {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: transparent;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-light);
  cursor: pointer;

  &.active {
    background: var(--purple);
    border-color: var(--purple);
    color: #fff;
  }
}

// The global stylesheet's `.leaderboard-list` defaults to `display: none`
// and only shows via a `.active` class the legacy JS toggles — a pattern
// this Vue port doesn't use (v-if/v-else instead), so the list rendered
// invisible despite loading real data. Sidestepping with an app-owned class
// name, same fix pattern as NotificationBell's `.notif-panel`.
.lb-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card-bg, #fff);
  margin-bottom: 8px;
  cursor: pointer;

  &:hover {
    background: rgba(153, 102, 255, 0.06);
  }
}

.leaderboard-rank {
  width: 32px;
  text-align: center;
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--text-light);
  flex-shrink: 0;

  &.top1 {
    font-size: 1.3rem;
  }
  &.top2,
  &.top3 {
    font-size: 1.15rem;
  }
}

.leaderboard-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--purple), var(--pink, #ff66cc));
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.leaderboard-info {
  flex: 1;
  min-width: 0;
}

.leaderboard-username {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--purple-dark);
}

.leaderboard-stats {
  font-size: 0.74rem;
  color: var(--text-light);
}

.leaderboard-value {
  font-weight: 700;
  color: var(--purple);
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-light);
}

.my-streak-widget {
  margin-top: 20px;
  padding: 14px 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.12), rgba(255, 102, 153, 0.08));
  border: 1px solid rgba(153, 102, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.my-streak-title {
  font-weight: 700;
  color: var(--purple-dark);
  font-size: 0.95rem;
}

.my-streak-rank {
  color: var(--text-light);
  font-size: 0.82rem;
}

.my-streak-value {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--purple);
}
</style>
