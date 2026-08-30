<template>
  <!-- `left-sidebar` is kept as a styling hook (night-mode and the remaining
       decorative rules still target it); only its layout declarations moved
       to Bootstrap utilities. -->
  <div class="left-sidebar d-flex flex-column gap-3 align-self-start">
    <div class="sidebar-section">
      <div class="sidebar-title">🐾 PawketPetsVT</div>
      <div class="activity-feed-box">
        <div :key="activityIndex" class="activity-feed-message">{{ activityMessage }}</div>
      </div>
    </div>

    <div class="sidebar-section desktop-nav">
      <div class="sidebar-title">📋 Menu</div>
      <div class="sidebar-nav-links">
        <!-- `sidebar-btn-<tab>` ids are legacy's own convention and are what the
             tutorial's highlight/arrow looks up. They live on this sidebar only
             — MobileNav renders the same list, and duplicating the ids would
             make them ambiguous. -->
        <button :id="'sidebar-btn-' + NAV_HOME.tab" class="sidebar-nav-btn standalone" :class="{ active: AppState.tabKey === NAV_HOME.tab }" @click="go(NAV_HOME.tab)">{{ NAV_HOME.icon }} {{ NAV_HOME.label }}</button>

        <div v-for="group in NAV_GROUPS" :key="group.key" class="nav-group" :class="{ open: openGroup === group.key }">
          <button class="nav-group-header" @click="toggleGroup(group.key)">
            {{ group.icon }} {{ group.label }} <span class="nav-group-arrow">›</span>
          </button>
          <div class="nav-group-children">
            <button
              v-for="item in group.items"
              :key="item.tab"
              :id="'sidebar-btn-' + item.tab"
              class="sidebar-nav-btn child"
              :class="{ active: AppState.tabKey === item.tab }"
              @click="go(item.tab)"
            >{{ item.icon }} {{ item.label }}
              <span v-if="item.tab === 'friends' && AppState.friendRequestCount > 0" class="nav-badge d-inline-block rounded-2 ms-1">{{ AppState.friendRequestCount }}</span>
            </button>
          </div>
        </div>

        <button
          v-for="item in NAV_STANDALONE"
          :key="item.tab"
          :id="'sidebar-btn-' + item.tab"
          class="sidebar-nav-btn standalone"
          :class="{ active: AppState.tabKey === item.tab }"
          @click="go(item.tab)"
        >{{ item.icon }} {{ item.label }}</button>
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
          <span class="stat-value" :class="{ 'glitch-text': ppGlitchState.active, 'spooky-wobble': ppGlitchState.active }">{{ displayPP(points) }} PP</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Items</span>
          <span class="stat-value">{{ AppState.sidebarStats.itemCount }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Day Streak</span>
          <span class="stat-value">{{ AppState.sidebarStats.streak }}</span>
        </div>
        <div class="streak-milestone text-center mt-px2">{{ milestoneText }}</div>
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
import { displayPP, ppGlitchState } from '../services/PPGlitchService.js'
// Shared with MobileNav — see the header comment in navMenu.js for why this
// list is not allowed to exist twice.
import { NAV_GROUPS, NAV_HOME, NAV_STANDALONE } from '../data/navMenu.js'

const router = useRouter()
// Shared so the tutorial can expand the group holding a tab it wants to
// highlight. See AppState.navOpenGroup.
const openGroup = computed({
  get: () => AppState.navOpenGroup,
  set: v => { AppState.navOpenGroup = v }
})
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

function toggleGroup(key) {
  openGroup.value = openGroup.value === key ? null : key
}

function go(tab) {
  router.push('/' + tab)
  openGroup.value = null
}
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.stat-row {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.stat-label {
  font-family: 'Chewy', cursive !important;
  font-size: 0.9rem !important;
  color: var(--text) !important;
  min-width: 85px !important;
  font-weight: 600 !important;
}
.stat-value {
  font-size: 0.85rem !important;
  font-weight: 700 !important;
  color: var(--text) !important;
  min-width: 60px !important;
  text-align: right !important;
  font-family: 'Fredoka', cursive !important;
}
.sidebar-nav-btn {
  background: rgba(153,102,255,0.22) !important;
  border: 2px solid rgba(153,102,255,0.4) !important;
  border-radius: 20px !important;
  padding: 12px 16px !important;
  font-family: 'Fredoka', cursive !important;
  font-size: 0.95rem !important;
  color: var(--purple-dark) !important;
  text-align: left !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  font-weight: 600 !important;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.05) !important;
}
.sidebar-nav-btn:hover {
  background: rgba(153,102,255,0.2) !important;
  transform: translateX(4px) !important;
  border-color: var(--purple-light) !important;
}
.sidebar-nav-btn.active {
  background: linear-gradient(135deg, var(--purple), var(--pink)) !important;
  color: var(--white) !important;
  border-color: rgba(255,255,255,0.3) !important;
  box-shadow:
  0 0 0 2px var(--pink),
  0 4px 12px rgba(153,102,255,0.4),
  inset 0 2px 4px rgba(255,255,255,0.3) !important;
}
.sidebar-stats {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
}
.stat-row {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  font-size: 0.9rem !important;
  padding: 8px 0 !important;
  border-bottom: 2px dotted rgba(153,102,255,0.3) !important;
}
.stat-row:last-child { border-bottom: none !important; }
.stat-label {
  color: var(--text-light) !important;
  font-weight: 600 !important;
}
.stat-value {
  font-family: 'Chewy', cursive !important;
  color: var(--purple-dark) !important;
  font-size: 1.05rem !important;
  text-shadow: 1px 1px 0 rgba(255,182,230,0.4) !important;
}
.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 4px;
}
.stat-label {
  font-size: 0.9rem;
  color: var(--text-light);
  font-weight: 500;
}
.activity-feed-box {
  background: linear-gradient(135deg, rgba(176, 106, 255, 0.05), rgba(255, 106, 157, 0.05));
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.activity-feed-message {
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.4;
  animation: activity-fade-in 0.5s ease-in-out;
}
body.night-mode .stat-value { color: #ffd700 !important; }
.stat-label {
  font-family: 'Chewy', cursive;
  font-size: 1.1rem;
  color: var(--purple-dark);
  font-weight: 600;
}
.stat-value {
  font-family: 'Chewy', cursive;
  font-size: 1.3rem;
  color: var(--purple);
  font-weight: 700;
  text-shadow: 1px 1px 2px rgba(153, 102, 255, 0.2);
}
body.night-mode .stat-label { color: #e8d5ff; }
body.night-mode .stat-value { color: #b589ff; }
.stat-label {
  color: #94a3b8;
  font-weight: 500;
}
.stat-value { font-weight: bold; }
body.theme-autumn .sidebar-nav-btn.active { background: linear-gradient(135deg, #c0672a, #e8a030) !important; }
body.theme-winter .sidebar-nav-btn.active { background: linear-gradient(135deg, #005f99, #00b4db) !important; }
body.theme-halloween .sidebar-nav-btn.active { background: linear-gradient(135deg, #c0392b, #ff6b35) !important; }
body.theme-golden .sidebar-nav-btn.active {
  background: linear-gradient(135deg, #b8860b, #ffd700) !important;
  color: #3d2b00 !important;
}
.sidebar-nav-btn { position: relative; /* needed for absolute dot positioning */ }
.sidebar-nav-btn { position: relative; }
.nav-group {
  position: relative;
  width: 100%;
}
.nav-group-header {
  width: 100%;
  background: rgba(153,102,255,0.22) !important;
  border: 2px solid rgba(153,102,255,0.4) !important;
  border-radius: 20px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--purple-dark);
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.15s;
  font-family: inherit;
}
.nav-group-header:hover { background: rgba(153,102,255,0.10); }
.nav-group.open .nav-group-header {
  background: linear-gradient(135deg, rgba(153,102,255,0.6), rgba(255,102,204,0.45)) !important;
  border-color: rgba(153,102,255,0.6) !important;
  color: #fff !important;
}
.nav-group-arrow {
  font-size: 0.9rem;
  transition: transform 0.2s;
  display: inline-block;
  color: var(--text-light);
}
.nav-group.open .nav-group-arrow {
  transform: rotate(90deg);
  color: var(--purple);
}
.nav-group-children {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.38s cubic-bezier(0.4,0,0.2,1);
  padding-left: 0;
}
.nav-group.open .nav-group-children { max-height: 500px; }
.sidebar-nav-btn.child {
  font-size: 0.88rem !important;
  padding: 9px 16px 9px 28px !important;
  font-weight: 600 !important;
  width: 100% !important;
  border-radius: 14px !important;
  margin-bottom: 3px !important;
  background: rgba(153,102,255,0.13) !important;
  border: 1.5px solid rgba(153,102,255,0.28) !important;
  color: var(--purple-dark) !important;
}
.sidebar-nav-btn.child:hover {
  background: rgba(153,102,255,0.10);
  color: var(--purple-dark);
}
.sidebar-nav-btn.child.active {
  background: linear-gradient(135deg, var(--purple-dark), var(--pink));
  color: #fff;
  font-weight: 700;
}
.sidebar-nav-btn.standalone { font-weight: 600; }
body.night-mode .sidebar-nav-btn { background:rgba(80,50,140,0.5) !important; border:1px solid rgba(153,102,255,0.5) !important; color:#ddc8ff !important; }
body.night-mode .sidebar-nav-btn.child { background:rgba(60,35,110,0.6) !important; border:1px solid rgba(130,90,220,0.45) !important; color:#ccb0ff !important; }
.sidebar-nav-btn:focus, .sidebar-nav-btn:focus-visible, .sidebar-nav-btn.child:focus, .sidebar-nav-btn.child:focus-visible, .nav-group-header:focus, .nav-group-header:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
body.night-mode .stat-row { background: rgba(255,255,255,0.04) !important; }
@media (max-width: 768px) {
  .stat-label { font-size: 1rem; }
  .stat-value { font-size: 1.1rem; }
}
@media (max-width: 900px) {
  .activity-feed-box {
    display: block !important;
    font-size: 0.8rem !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .sidebar-stats {
    display: flex !important;
    justify-content: space-around !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
  }
  .stat-row {
    flex-direction: row !important;
    align-items: center !important;
    gap: 6px !important;
  }
}

@keyframes activity-fade-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nav-badge {
  background: var(--red, #ff4d4d);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
}

.streak-milestone {
  font-size: 0.68rem;
  color: #ffaa00;
  line-height: 1.3;
}
</style>
