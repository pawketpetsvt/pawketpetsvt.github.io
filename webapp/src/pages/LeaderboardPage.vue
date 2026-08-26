<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🏆 ✦ 🏆</div>
      <h1>Leaderboard</h1>
      <p>See how you stack up against the rest of Pawket Pets! ⭐</p>
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="leaderboard-tab px-3 py-2 rounded-pill"
        :class="{ active: activeTab === t.key }"
        @click="switchTab(t.key)"
      >{{ t.label }}</button>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <div v-if="!entries.length" class="empty-state"><p>No data yet! Be the first! 🌟</p></div>
      <div v-else class="d-flex flex-column gap-2">
        <div
          v-for="(p, i) in entries"
          :key="p.userId || p.username"
          class="leaderboard-item d-flex align-items-center gap-3 px-3 py-2 rounded-3"
          @click="viewProfile(p.username)"
        >
          <div class="leaderboard-rank text-center flex-shrink-0" :class="rankClass(i)">{{ rankLabel(i) }}</div>
          <div class="leaderboard-avatar d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle">
            {{ p.username.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-grow-1 min-w-0">
            <div class="leaderboard-username">{{ p.username }}</div>
            <div class="leaderboard-stats">{{ p.stat }}</div>
          </div>
          <div class="leaderboard-value flex-shrink-0">{{ p.value }}</div>
        </div>
      </div>

      <div
        v-if="activeTab === 'streak' && myStreakWidget"
        class="my-streak-widget d-flex align-items-center justify-content-between mt-4 px-3 py-3 rounded-4"
      >
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

const TABS = [
  { key: 'points', label: '🪙 Most Points' },
  { key: 'streak', label: '🔥 Login Streak' },
  { key: 'levels', label: '⭐ Highest Levels' },
  { key: 'badges', label: '🎖️ Most Badges' }
]

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
// Layout is Bootstrap utilities in the template throughout this file; these
// rules carry only what utilities can't express — the game's colors, the
// active-tab treatment, and the fixed avatar/rank sizing.
.leaderboard-tab {
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

.leaderboard-item {
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);
  cursor: pointer;

  &:hover {
    background: rgba(153, 102, 255, 0.06);
  }
}

.leaderboard-rank {
  width: 32px;
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--text-light);

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
  background: linear-gradient(135deg, var(--purple), var(--pink, #ff66cc));
  color: #fff;
  font-weight: 700;
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
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-light);
}

.my-streak-widget {
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.12), rgba(255, 102, 153, 0.08));
  border: 1px solid rgba(153, 102, 255, 0.25);
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
