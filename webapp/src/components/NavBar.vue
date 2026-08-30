<template>
  <nav class="navbar">
    <div class="navbar-left">
      <!-- LEFT hamburger — opens the drawer holding both sidebars. Lives in the
           navbar exactly as legacy's did (index.html:919) so it inherits
           the global stylesheet's existing `.hamburger-menu-btn` rules; the scoped block
           below widens the window it shows in from ≤768px to ≤991px, so it
           appears wherever the sidebars are hidden rather than 223px later.
           Only for a signed-in player: the drawer is page navigation, and a
           guest has only the auth routes. -->
      <button v-if="AppState.user" class="hamburger-menu-btn" aria-label="Open navigation"
        :aria-expanded="AppState.mobileNavOpen ? 'true' : 'false'" @click="toggleDrawer('nav')">☰</button>
      <!-- Logo only — the wordmark that sat beside it is gone. `logo.png` is
           300x300, so it fills the 40x40 slot squarely; `pawket-logo.png` was a
           1280x720 banner, which `object-fit: contain` letterboxed down to a
           40x22 sliver. `title`/`aria-label` carry the accessible name that the
           removed text used to provide. -->
      <div class="navbar-logo" title="Home" aria-label="PawketPetsVT — Home" role="button"
        @click="router.push('/home')">
        <img src="/images/logo.png" alt="" />
      </div>
      <div class="beta-badge">In Beta</div>
    </div>

    <template v-if="AppState.user">
      <!-- Both are rendered here only at desktop widths; below 992px they move
           into the right-hand drawer. Each is mounted exactly once either way —
           the bell polls its unread count and a second copy would double it. -->
      <div class="navbar-center">
        <NotificationBell v-if="isDesktop" @open-gifts="showGifts = true" />
        <EventStatusWidget v-if="isDesktop" />
      </div>

      <!-- Username and PP are their own group rather than the first two items of
           `.navbar-right`, because on mobile they stay in the bar while every
           control in that group moves into the right-hand drawer. On desktop
           this box is `display: contents`, so the row reads exactly as before. -->
      <div class="navbar-readouts">
        <!-- Deliberately NOT `.navbar-username` / `.navbar-points`. Those are
             legacy pill rules (legacy style.css:14433/14442) that add a background,
             a 20px radius and 6px 14px of padding — turning two plain readouts
             into things that look clickable, and costing ~56px of a row that
             already overflows. -->
        <span class="nav-readout">⭐ {{ AppState.player?.username }}</span>
        <!-- Legacy's #nav-points carries an onclick opening the PP history -->
        <span class="nav-points-btn nav-readout"
          :class="{ 'glitch-text': ppGlitchState.active, 'spooky-wobble': ppGlitchState.active }"
          title="Click to see PP history" @click="showPPHistory = true">
          {{ displayPP(points) }} PP
        </span>
      </div>

      <div class="navbar-right">
        <!-- Ports the navbar Pass button and skin-key counter
             (index.html:934 / 955). The key counter is hidden at zero, as
             legacy's own display toggle behaved. -->
        <!-- The EMOJI sits outside the label span on purpose. legacy style.css:14518
             hides `.btn-nav-action span` at ≤900px to drop these to icon-only,
             which only works if the icon is not itself inside that span — with
             the icon in there, every one of these buttons rendered completely
             EMPTY between 769px and 900px. -->
        <button class="btn-nav-action position-relative" title="PawketPass" @click="showPass = true">
          🎫<span class="nav-label"> PawketPass</span>
          <span v-if="unclaimedPass > 0" class="nav-pass-dot">{{ unclaimedPass }}</span>
        </button>
        <button class="btn-nav-action" title="Daily Bingo" @click="showBingo = true">
          🎰<span class="nav-label"> Bingo {{ bingoService.completedCount() }}/{{ BINGO_SQUARES }}</span>
        </button>
        <button class="btn-nav-action" title="Weekly Challenges" @click="showWeekly = true">
          📋<span class="nav-label"> Weekly</span>
        </button>
        <!-- Gift inbox. LEGACY BUG: the only thing that opens it is
             #gift-inbox-bar on the Home page, whose own inline style ends with
             `display:none` marked important — which beats showApp()'s plain
             `giftBar.style.display = 'flex'`. So the bar never appears,
             gift_showInboxModal() has no reachable caller, and on the live site
             gifts can be SENT but never CLAIMED. -->
        <button class="btn-nav-action position-relative" title="Gift Inbox" @click="showGifts = true">
          📬<span class="nav-label"> Gifts</span>
          <span v-if="giftState.inboxCount > 0" class="nav-pass-dot">{{ giftState.inboxCount }}</span>
        </button>
        <div v-if="skinKeyState.keys > 0" class="nav-skin-keys" title="Skin Keys — unlock pet variants">
          🔑 <span class="skin-key-count">{{ skinKeyState.keys }}</span>
        </div>
        <button class="btn-nav-action" @click="router.push('/myprofile')">👤<span class="nav-label">
            Profile</span></button>
        <!-- The two round chrome buttons legacy renders with inline styles at
             index.html:951-952. -->
        <button class="nav-round-btn help" title="Game Information" @click="showHelp = true">❓</button>
        <button class="nav-round-btn report" title="Report a player or bug" @click="showReport = true">🚩</button>
        <button class="btn-nav-action" @click="handleLogout">🚪<span class="nav-label"> Logout</span></button>
        <div class="music-controls">
          <button class="music-btn" @click="musicService.toggle()">{{ musicState.playing ? '⏸' : '▶' }}</button>
          <button class="music-btn" @click="musicService.stop()">⏹</button>
          <input type="range" class="music-volume" min="0" max="100" step="5" :value="musicState.volume"
            @input="musicService.setVolume($event.target.valueAsNumber)" />
        </div>
      </div>

      <!-- RIGHT hamburger — the mirror of the left one. Everything in
           `.navbar-right` plus the bell and event badge is hidden below 992px,
           so this is what reaches them. Rendered only there; on desktop the
           controls are in the bar itself and a drawer would be redundant. -->
      <button class="hamburger-menu-btn nav-chrome-toggle" aria-label="Open account menu"
        :aria-expanded="AppState.mobileChromeOpen ? 'true' : 'false'" @click="toggleDrawer('chrome')">
        ☰
        <span v-if="chromeBadgeCount > 0" class="nav-pass-dot">{{ chromeBadgeCount }}</span>
      </button>

      <!-- The drawer itself. It lives inside NavBar so it can drive the same
           `showPass` / `showBingo` / … refs the desktop buttons do — no event
           plumbing, one source of truth for what is open. It is TELEPORTED to
           <body> because `[class*="navbar"] > *` (legacy style.css:11665) forces
           `display: inline-flex !important` on every direct child of the
           navbar, at (0,1,1), which would beat `.mobile-nav-menu`'s own
           `display: block !important` at (0,1,0) and flatten the drawer. -->
      <Teleport to="body">
        <div class="mobile-nav-overlay" :class="{ show: AppState.mobileChromeOpen }"
          @click="AppState.mobileChromeOpen = false"></div>

        <nav class="mobile-nav-menu mobile-chrome-menu" :class="{ open: AppState.mobileChromeOpen }"
          aria-label="Account menu">
          <button class="mobile-menu-close" aria-label="Close menu"
            @click="AppState.mobileChromeOpen = false">✕ Close</button>

          <div class="d-flex flex-column gap-2">
            <!-- Rendered HERE rather than in the navbar below 992px (and vice
                 versa above), so only one instance is ever mounted — it polls
                 its own badge count on a timer, and two copies would double it.
                 `as-row` makes it draw itself as a drawer row rather than the
                 navbar's round bell. -->
            <NotificationBell v-if="!isDesktop" as-row @open-gifts="openFromDrawer('gifts')" />

            <button class="nc-item" @click="openFromDrawer('pass')">
              🎫<span class="nc-label">PawketPass</span>
              <span v-if="unclaimedPass > 0" class="nc-count">{{ unclaimedPass }}</span>
            </button>
            <button class="nc-item" @click="openFromDrawer('bingo')">
              🎰<span class="nc-label">Daily Bingo</span>
              <span class="nc-count nc-count-plain">{{ bingoService.completedCount() }}/{{ BINGO_SQUARES }}</span>
            </button>
            <button class="nc-item" @click="openFromDrawer('weekly')">
              📋<span class="nc-label">Weekly Challenges</span>
            </button>
            <button class="nc-item" @click="openFromDrawer('gifts')">
              📬<span class="nc-label">Gift Inbox</span>
              <span v-if="giftState.inboxCount > 0" class="nc-count">{{ giftState.inboxCount }}</span>
            </button>
            <button class="nc-item" @click="openFromDrawer('pphistory')">
              💰<span class="nc-label">PP History</span>
            </button>
            <div v-if="skinKeyState.keys > 0" class="nc-item nc-static">
              🔑<span class="nc-label">Skin Keys</span>
              <span class="nc-count nc-count-plain">{{ skinKeyState.keys }}</span>
            </div>
            <button class="nc-item" @click="goFromDrawer('/myprofile')">
              👤<span class="nc-label">My Profile</span>
            </button>
            <button class="nc-item" @click="openFromDrawer('help')">
              ❓<span class="nc-label">Quick Guide</span>
            </button>
            <button class="nc-item" @click="openFromDrawer('report')">
              🚩<span class="nc-label">Report an Issue</span>
            </button>
            <button class="nc-item nc-logout" @click="logoutFromDrawer">
              🚪<span class="nc-label">Logout</span>
            </button>

            <!-- The event/weather badge is a readout, not a control, so it is
                 shown as itself rather than made into a row that does nothing.
                 Same single-instance rule as the bell above. -->
            <div v-if="!isDesktop" class="nc-divider d-flex justify-content-center mt-2 pt-3">
              <EventStatusWidget />
            </div>

            <!-- `.nc-music-controls`, NOT `.music-controls`: two mobile rules
                 hide that class outright and a third hides `.music-volume`
                 below 900px, all aimed at the navbar's copy. -->
            <div class="nc-divider mt-2 pt-3">
              <div class="nc-music-label mb-2">🎵 Music</div>
              <div class="nc-music-controls">
                <button class="music-btn" :title="musicState.playing ? 'Pause' : 'Play'"
                  @click="musicService.toggle()">{{ musicState.playing ? '⏸' : '▶' }}</button>
                <button class="music-btn" title="Stop" @click="musicService.stop()">⏹</button>
                <input type="range" class="music-volume" min="0" max="100" step="5" :value="musicState.volume"
                  @input="musicService.setVolume($event.target.valueAsNumber)" />
              </div>
            </div>
          </div>
        </nav>
      </Teleport>
    </template>
  </nav>

  <!-- OUTSIDE the <nav> on purpose. These are the navbar's modals only in the
       sense that its buttons open them; as DOM children of `.navbar` they were
       caught by two of the global stylesheet's broad navbar selectors —
       `[class*="navbar"] > *` forcing `display: inline-flex` on each modal root,
       and `.navbar button` (11671) forcing `padding: 6px 12px !important;
       height: auto !important` on EVERY button inside them, which is the whole
       Pass, Bingo, Help, Report, PP-history and Gift UI. Vue 3 allows multiple
       root nodes, so moving them out of the element costs nothing and takes
       them out of range of both. -->
  <PawketPassModal v-if="showPass" @close="showPass = false" />
  <BingoModal v-if="showBingo" @close="showBingo = false" />
  <WeeklyChallengeModal v-if="showWeekly" @close="showWeekly = false" />
  <HelpModal v-if="showHelp" @close="showHelp = false" />
  <ReportModal v-if="showReport" @close="showReport = false" />
  <PPHistoryModal v-if="showPPHistory" @close="showPPHistory = false" />
  <GiftInboxModal v-if="showGifts" @close="showGifts = false" />

  <!-- The site's background theme. It used to sit at the repo root as
       `music.mp3`, apart from every other track; it now lives in `music/`
       alongside the three battle themes MusicService loads. -->
  <audio ref="bgMusicEl" loop>
    <source src="/music/sitetheme.mp3" type="audio/mpeg" />
  </audio>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
import { isDesktop } from '../composables/useViewport.js'
import { authService } from '../services/AuthService.js'
import { musicService, musicState } from '../services/MusicService.js'
import NotificationBell from './NotificationBell.vue'
import EventStatusWidget from './EventStatusWidget.vue'
import HelpModal from './HelpModal.vue'
import ReportModal from './ReportModal.vue'
import PPHistoryModal from './PPHistoryModal.vue'
import GiftInboxModal from './gift/GiftInboxModal.vue'
import { giftService, giftState } from '../services/GiftService.js'
import PawketPassModal from './pass/PawketPassModal.vue'
import { passService, passState } from '../services/PassService.js'
import { skinKeyService, skinKeyState } from '../services/SkinKeyService.js'
import BingoModal from './bingo/BingoModal.vue'
import WeeklyChallengeModal from './bingo/WeeklyChallengeModal.vue'
import { bingoService } from '../services/BingoService.js'
import { BINGO_SQUARES } from '../data/bingoData.js'
// The ambient 666 PP money glitch — every PP counter reads through displayPP()
// so they all flip together.
import { displayPP, ppGlitchState } from '../services/PPGlitchService.js'

const router = useRouter()
const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)
const showPass = ref(false)
const showBingo = ref(false)
const showWeekly = ref(false)
const showHelp = ref(false)
const showReport = ref(false)
const showPPHistory = ref(false)
const showGifts = ref(false)
const unclaimedPass = computed(() => passService.unclaimedCount())

const bgMusicEl = ref(null)

onMounted(() => {
  musicService.registerElement(bgMusicEl.value)
  // The navbar mounts once per authed session, so this is where the Pass level
  // and key count get their initial read — both are shown right here.
  if (AppState.user) {
    passService.load()
    skinKeyService.load()
    giftService.refreshCount()
  }
  const startOnFirstClick = () => {
    if (musicState.enabled) musicService.play()
    document.removeEventListener('click', startOnFirstClick)
  }
  document.addEventListener('click', startOnFirstClick, { once: true })
})

async function handleLogout() {
  await authService.logout()
  router.push('/login')
}

// The two drawers slide in from opposite edges and would otherwise overlap, so
// opening either closes the other.
function toggleDrawer(which) {
  if (which === 'nav') {
    AppState.mobileChromeOpen = false
    AppState.mobileNavOpen = !AppState.mobileNavOpen
  } else {
    AppState.mobileNavOpen = false
    AppState.mobileChromeOpen = !AppState.mobileChromeOpen
  }
}

// ── Right-hand drawer ───────────────────────────────────────────────────────
// One helper per kind of action so every row closes the drawer first. Leaving
// it open behind a modal stacks two overlays and traps the body scroll lock.
const MODAL_REFS = {
  pass: showPass,
  bingo: showBingo,
  weekly: showWeekly,
  gifts: showGifts,
  help: showHelp,
  report: showReport,
  pphistory: showPPHistory
}

function openFromDrawer(key) {
  AppState.mobileChromeOpen = false
  const target = MODAL_REFS[key]
  if (target) target.value = true
}

function goFromDrawer(path) {
  AppState.mobileChromeOpen = false
  router.push(path)
}

async function logoutFromDrawer() {
  AppState.mobileChromeOpen = false
  await handleLogout()
}

// Everything the collapsed hamburger is hiding that wants attention. Without
// this the drawer swallows the Pass, gift and notification badges entirely and
// a player has no reason to open it.
const chromeBadgeCount = computed(() =>
  (AppState.unreadNotificationCount || 0) + unclaimedPass.value + (giftState.inboxCount || 0))

// The drawer is fixed and full-height; the page behind it still scrolls on
// touch without this, which reads as the drawer sliding around.
watch(() => AppState.mobileChromeOpen, open => {
  document.body.style.overflow = open ? 'hidden' : ''
})

function onChromeKeydown(e) {
  if (e.key === 'Escape' && AppState.mobileChromeOpen) AppState.mobileChromeOpen = false
}

onMounted(() => document.addEventListener('keydown', onChromeKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onChromeKeydown)
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.music-btn {
  background: rgba(255,255,255,0.25) !important;
  border: 2px solid rgba(255,255,255,0.5) !important;
  color: var(--white) !important;
  font-size: 1rem !important;
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s !important;
  flex-shrink: 0 !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
}
.music-btn:hover {
  background: rgba(255,255,255,0.4) !important;
  transform: scale(1.1) !important;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2) !important;
}
.music-volume { width: 80px !important; accent-color: var(--yellow) !important; cursor: pointer !important; }
.navbar-center {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
  padding: 0 10px !important;
}
.navbar-logo {
  font-family: 'Chewy', cursive !important;
  font-size: 1.4rem !important;
  color: var(--white) !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  text-decoration: none !important;
  flex-shrink: 0 !important;
  cursor: pointer !important;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3) !important;
  transition: transform 0.2s !important;
}
.navbar-logo:hover { transform: scale(1.05) !important; }
.navbar-logo img {
  width: 64px !important;
  height: 64px !important;
  object-fit: contain !important;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)) !important;
}
.navbar-logo span { color: var(--yellow) !important; }
.btn-nav-action {
  background: var(--yellow) !important;
  color: var(--purple-dark) !important;
  font-family: 'Chewy', cursive !important;
  font-size: 1.05rem !important;
  padding: 10px 24px !important;
  border-radius: 30px !important;
  border: 3px solid rgba(255,255,255,0.6) !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  font-weight: 700 !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important;
}
.btn-nav-action:hover {
  background: var(--white) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 5px 12px rgba(0,0,0,0.25) !important;
}
body.night-mode .btn-nav-action {
  background: linear-gradient(135deg, #ffd700, #ffaa00) !important;
  color: #1a0a2e !important;
  border: 3px solid rgba(255, 215, 0, 0.6) !important;
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3) !important;
}
body.night-mode .btn-nav-action:hover {
  background: linear-gradient(135deg, #ffed4e, #ffd700) !important;
  color: #0f0619 !important;
  box-shadow: 0 6px 16px rgba(255, 215, 0, 0.5) !important;
}
.hamburger-menu-btn {
  display: none !important; /* Hidden on desktop — shown only inside @media (max-width: 768px) */
  position: static;         /* Sits in navbar-left flow on mobile; Phase 1 overrides as needed */
  z-index: 1001;
  background: rgba(255,255,255,0.15);
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  width: 40px;
  height: 40px;
  font-size: 22px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
  margin-right: 8px;
  transition: transform 0.2s ease;
}
.hamburger-menu-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.5);
}
.hamburger-menu-btn:active { transform: scale(0.95); }
.navbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.navbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-shrink: 0;
}
.navbar-logo {
  font-size: 16px !important;
  flex-shrink: 0 !important;
  /* padding removed — the bar's own 20px side padding does this job now. */
}
.navbar-center {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  flex-shrink: 1 !important;
  min-width: 0 !important;
}
.navbar-left, .navbar-right {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
}
.btn-nav-action {
  padding: 4px 8px !important;
  font-size: 11px !important;
  white-space: nowrap !important;
  min-width: auto !important;
}
.navbar-logo {
  font-size: 18px !important;
  font-weight: bold !important;
  flex-shrink: 0 !important;
  /* padding removed — this was the winner of two competing `.navbar-logo`
  padding rules (the other declared 6px) and is why the logo sat inset from
  the bar's edge. The 20px on `.navbar` replaces it. */
}
.navbar-center {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  flex-shrink: 1 !important;
}
.btn-nav-action {
  padding: 6px 12px !important;
  font-size: 13px !important;
  white-space: nowrap !important;
  min-height: 36px !important;
  font-weight: 600 !important;
}
.beta-badge {
  display: inline !important;
  margin-right: 5px !important;
}
.navbar-logo {
  gap: 15px !important;
  display: flex !important;
  align-items: center !important;
}
.navbar-center {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex-shrink: 1 !important;
  min-width: 0 !important;
  overflow-x: auto !important;
}
.navbar-center button {
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}
.skin-key-count {
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.navbar-logo {
  margin-right: 0 !important;
  flex-shrink: 0 !important;
}
.navbar-center {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  flex-shrink: 1 !important;
  justify-content: center !important;
}
.navbar-center > *, .navbar-left > * { margin: 0 4px !important; }
.navbar-left {
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
  flex-shrink: 0 !important;
}
.navbar-center {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  flex-shrink: 0 !important;
}
.navbar-right {
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
  flex-shrink: 0 !important;
  margin-left: auto !important;
}
.navbar-logo {
  font-size: 1.2rem !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  cursor: pointer !important;
  flex-shrink: 0 !important;
}
.beta-badge {
  background: rgba(0, 0, 0, 0.35) !important;
  color: #ffcc00 !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  padding: 4px 12px !important;
  border-radius: 20px !important;
  letter-spacing: 1px !important;
  border: 1px solid rgba(255, 204, 0, 0.4) !important;
  white-space: nowrap !important;
  cursor: help !important;
}
.beta-badge:hover {
  background: rgba(0, 0, 0, 0.6) !important;
  transform: scale(1.02);
  border-color: rgba(255, 204, 0, 0.8) !important;
}
.btn-nav-action {
  padding: 6px 14px !important;
  font-size: 13px !important;
  border-radius: 20px !important;
  white-space: nowrap !important;
  cursor: pointer !important;
}
.navbar-left {
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
}
.navbar-center {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}
.navbar-right {
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
  margin-left: auto !important;
}
.navbar-left > *, .navbar-center > *, .navbar-right > * {
  flex-shrink: 0 !important;
  white-space: nowrap !important;
}
.navbar-logo {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-family: 'Chewy', cursive !important;
  font-size: 1.2rem !important;
  color: white !important;
  cursor: pointer !important;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3) !important;
}
.beta-badge {
  background: rgba(0,0,0,0.3) !important;
  color: #ffcc00 !important;
  padding: 6px 12px !important;
  border-radius: 20px !important;
  font-size: 11px !important;
  font-weight: bold !important;
}
.btn-nav-action {
  background: rgba(255,255,255,0.2) !important;
  border: none !important;
  color: white !important;
  padding: 8px 16px !important;
  border-radius: 20px !important;
  cursor: pointer !important;
  font-size: 13px !important;
  font-weight: bold !important;
  transition: all 0.2s !important;
}
.btn-nav-action:hover {
  background: rgba(255,255,255,0.35) !important;
  transform: translateY(-2px) !important;
}
.music-controls {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
.music-btn {
  background: rgba(255,255,255,0.2) !important;
  border: none !important;
  color: white !important;
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  cursor: pointer !important;
  font-size: 14px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s !important;
}
.music-btn:hover {
  background: rgba(255,255,255,0.35) !important;
  transform: scale(1.05) !important;
}
.music-volume {
  width: 80px !important;
  height: 4px !important;
  accent-color: #ffdd00 !important;
  cursor: pointer !important;
}
.navbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mobile-chrome-menu {
  left: auto !important;
  right: -320px !important;
  transition: right 0.28s ease !important;
  border-right: none !important;
  border-left: 4px solid var(--border) !important;
  box-shadow: -6px 0 28px rgba(153, 102, 255, 0.35) !important;
}
.mobile-chrome-menu.open {
  left: auto !important;
  right: 0 !important;
}
.nc-count-plain {
  background: rgba(153, 102, 255, 0.25);
  color: var(--purple-dark);
}
.nc-static { cursor: default; }
.nc-static:hover {
  background: rgba(153, 102, 255, 0.22);
  border-color: rgba(153, 102, 255, 0.4);
}
.nc-logout {
  color: #c2410c;
  background: rgba(255, 153, 51, 0.18);
  border-color: rgba(255, 153, 51, 0.45);
}
.nc-logout:hover {
  background: rgba(255, 153, 51, 0.3);
  border-color: var(--orange);
}
.nc-divider { border-top: 2px solid rgba(153, 102, 255, 0.25); }
.nc-music-label {
  font-family: 'Fredoka', cursive;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--purple-dark);
}
.nc-music-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
}
.nc-music-controls .music-btn {
  width: 40px !important;
  height: 40px !important;
  border-radius: 50% !important;
  background: rgba(153, 102, 255, 0.22) !important;
  border: 2px solid rgba(153, 102, 255, 0.4) !important;
  color: var(--purple-dark) !important;
  font-size: 1rem !important;
  flex: 0 0 auto !important;
}
.nc-music-controls .music-btn:hover { background: rgba(153, 102, 255, 0.35) !important; }
.nc-music-controls .music-volume {
  display: block !important;
  width: auto !important;
  flex: 1 1 auto !important;
  height: 6px !important;
  accent-color: var(--purple) !important;
}
@media (max-width: 992px) {
  .navbar-center {
    grid-column: 1 / -1 !important;
    order: 3 !important;
    padding: 8px 0 !important;
  }
}
@media (max-width: 900px) {
  .hamburger-menu-btn { display: block !important; }
  .navbar-center { display: none !important; }
  .beta-badge { display: none !important; }
  .music-volume { display: none !important; }
  .btn-nav-action span { display: none !important; }
  .btn-nav-action { padding: 8px 12px !important; }
}
@media (max-width: 480px) {
  .hamburger-menu-btn {
    width: 38px !important;
    height: 38px !important;
    font-size: 1.6rem !important;
  }
}
@media (min-width: 901px) {
  .hamburger-menu-btn { display: none !important; }
}
@media (max-width: 600px) {
  .navbar-center { display: none !important;  /* Hide entire beta section */ }
  .music-controls { display: none !important; }
}
@media (min-width: 769px) {
  .navbar-left {
    display: flex !important;
    align-items: center !important;
    gap: 15px !important;
    flex-shrink: 0 !important;
  }
  .navbar-center {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    flex-shrink: 1 !important;
    flex-grow: 0 !important;
    justify-content: center !important;
  }
  .navbar-right {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    flex-shrink: 0 !important;
    margin-left: auto !important; /* Push to right edge */
  }
  .navbar-left {
    display: flex !important;
    align-items: center !important;
    gap: 16px !important;
    order: 1 !important;
  }
  .navbar-center {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    order: 2 !important;
    margin-left: auto !important;
  }
  .navbar-right {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    order: 3 !important;
    margin-left: 0 !important;
  }
  .hamburger-menu-btn, #hamburger-menu-btn, [id*="hamburger"] { display: none !important; }
}
@media (max-width: 768px) {
  .hamburger-menu-btn {
    display: flex !important;
    position: static !important;   /* no longer fixed — lives in navbar */
    width: 40px !important;
    height: 40px !important;
    font-size: 22px !important;
    background: rgba(255,255,255,0.15) !important;
    border: 1px solid rgba(255,255,255,0.3) !important;
    border-radius: 8px !important;
    color: white !important;
    box-shadow: none !important;
    margin-right: 8px !important;
    flex-shrink: 0 !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .navbar-logo span { display: none !important;  /* hide "PawketPets" text, keep logo img */ }
  .beta-badge { display: none !important; }
  .music-controls { display: none !important; }
  .hamburger-menu-btn { display:flex !important; }
  .navbar-right { gap: 4px !important; }
  .music-controls { display: none !important; }
}

// The navbar's own chrome. the global stylesheet still owns `.navbar`, `.navbar-right` and
// `.skin-key-count`; what follows is the set that has no rule anywhere, plus the
// overrides needed to beat the global stylesheet's several competing `!important` rules for
// this bar.
//
// `.nav-pass-dot` and `.nav-skin-keys` were introduced by the Phase 9.5
// Pass/Skin Key work with no styling written for them at all, so the
// unclaimed-reward badge and the key counter rendered as bare inline text. Same
// "class referenced, rule missing" family as `.ach-badge` and the spooky
// keyframes, but this one was mine.
//
// ── WHY THIS FILE USES NO BOOTSTRAP UTILITIES ───────────────────────────────
// Everywhere else in the app, layout moved to Bootstrap utilities. It cannot
// here, and the reason is specificity arithmetic rather than preference.
//
// legacy style.css:11665 applies `margin`, `display` and `align-items` to EVERY navbar
// child through `[class*="navbar"] > *`, and 11677 applies `padding`/`height` to
// every navbar button — all `!important`. Those selectors score (0,1,1).
// A Bootstrap utility such as `.p-0` or `.m-0` scores (0,1,0), also `!important`.
// Two `!important` declarations are settled by specificity, so the global rule
// wins and the utility silently does nothing.
//
// A SCOPED rule gains `[data-v-…]` and scores (0,2,0), which does win. That is
// why these declarations are written out here with `!important` instead of
// being replaced by utility classes — swapping them for utilities would bring
// back the oval Guide/Report buttons and the row overflow.
//
// `display: contents` in the wrap block below has no utility either; Bootstrap
// ships no `d-contents`.

// ── Shared navbar text treatment ────────────────────────────────────────────
// Every control in the navbar now reads the way the event/weather badge does.
//
// WHY THAT BADGE READS BETTER, and it is not the colour: `.event-status-text`
// carries `text-shadow: 0 1px 2px rgba(0,0,0,0.2)`, and nothing else in the
// navbar did. The bar is a purple→pink→cyan gradient, so white text sits on a
// background ranging from mid-purple to bright cyan — against the cyan end
// there is barely any contrast and the letters wash out. The shadow is what
// holds their edges. The badge also uses weight 600 rather than bold, which
// stops the glyphs thickening into each other at this size.
//
// `!important` is required: the global stylesheet sets these properties with `!important`
// from several competing rules, so a plain declaration loses even though the
// scoped attribute raises specificity.
//
// This is NOT a colour change. The winning `.btn-nav-action` rule
// (legacy style.css:14452) already renders white-on-translucent — the yellow/Chewy
// rule at legacy style.css:346 is dead, overridden five rules further down. Only the
// typography moves.
.nav-readout,
.nav-points-btn,
.btn-nav-action,
.nav-skin-keys,
.nav-round-btn {
  font-family: inherit !important;
  font-size: 0.85rem !important;
  font-weight: 600 !important;
  white-space: nowrap !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2) !important;
}

// The username and PP counter are READOUTS, not controls — they get the text
// treatment and nothing else. No pill, no border, no padding.
.nav-readout {
  background: none !important;
  border: none !important;
  padding: 0 !important;
}

// The badge's own pill outline, so each button keeps an edge against the
// brighter parts of the gradient. `.nav-skin-keys` is deliberately left out —
// its gold border is its identity, and a white one would flatten it into the
// row.
.btn-nav-action {
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  padding: 6px 12px !important;
}

// `.navbar button` (legacy style.css:11671) sets `margin: 0 4px !important` on every
// button in here. `.navbar-right` already spaces them with a flex `gap`, so
// that margin is 8px of duplicate spacing per button — ~64px across the row,
// which is most of why it runs off the right edge.
// The same duplicate-spacing problem from a second rule: `.navbar-center > *`
// and `.navbar-left > *` (legacy style.css:12516) add `margin: 0 4px` to the logo, the
// beta badge, the bell and the event badge. Harmless while those groups had
// their own gap; now that every control shares one row gap, it makes the first
// four items sit 8px further apart than the rest.
.btn-nav-action,
.nav-round-btn,
.music-btn,
.navbar-left>*,
.navbar-center>*,
.navbar-readouts>* {
  margin: 0 !important;
}

// ── Wrapping on narrower desktops ───────────────────────────────────────────
// the global stylesheet pins the whole bar to a single line — `flex-wrap: nowrap` on
// `.navbar` (14296) and on `.navbar-right` (10770), with
// `.navbar-right > * { flex-shrink: 0 }` (14346). Nothing can shrink and
// nothing can wrap, so past a certain width the row simply runs off the right
// edge and its last controls become unreachable.
//
// Scoped to `min-width: 992px`, which is Bootstrap's `lg` and therefore the
// width where AppShell stops hiding the two sidebars. Below it the bar switches
// to the five-item mobile layout further down this file.
//
// It was 769px until the mobile navbar was built. That number came from
// the global stylesheet's own desktop block, but it left 769-991px in a bad state: the
// sidebars were already gone (they hide at lg) while the desktop navbar was
// still in force and the global stylesheet hides the hamburger above 768px — so that whole
// range had no route to any page but Home and Profile.
//
// No max-width and no chosen breakpoint at the top end: flexbox only wraps when
// the content genuinely does not fit, so a 1920 display keeps the single row it
// has now and narrower ones break onto a second (or third) line exactly when
// they need to. Guessing a pixel value would either wrap too early on a 1440
// laptop or too late on a small window.
@media (min-width: 992px) {

  // `.navbar-left`, `.navbar-center` and `.navbar-right` are each a single
  // flex ITEM of the navbar, so a group can only wrap as one indivisible block
  // — which is why the entire control cluster dropped to row two the moment its
  // last button stopped fitting, and why the first row was left mostly empty.
  //
  // `display: contents` removes those three boxes without touching the DOM, so
  // every control becomes a direct flex item of `.navbar` and the row wraps one
  // control at a time.
  //
  // Descendant selectors still match: `display: contents` only suppresses box
  // generation, so the global stylesheet rules like `.navbar-right > *` (14346, which keeps
  // these from squashing) and `.navbar-center button` (12264) continue to
  // apply. `margin-left: auto` on `.navbar-right` (10377) stops mattering,
  // since a box-less element has no margins to resolve.
  .navbar-left,
  .navbar-center,
  .navbar-readouts,
  .navbar-right {
    display: contents !important;
  }

  // The two drawer toggles exist only below this width. the global stylesheet already hides
  // `.hamburger-menu-btn` from 769px up, but the second one carries an extra
  // class and this states the intent in one place rather than relying on that.
  .hamburger-menu-btn {
    display: none !important;
  }

  .navbar {
    flex-wrap: wrap !important;
    // Packed from the left for 769-1429px — the range where the bar wraps.
    // Once items are on two rows, `space-between` would strew gaps between
    // individual buttons and shove the last one on each row to the right edge;
    // left-packing keeps a wrapped row reading as a continuation of the one
    // above it. Above 1430px everything fits on one line and this flips back to
    // `space-between` (see the block below).
    justify-content: flex-start !important;
    row-gap: 8px !important;
    // The navbar's own 16px gap was spacing three groups. Applied between every
    // control it is far too wide, so this drops to the 6px the right-hand group
    // used internally, rounded up slightly now that the buttons carry borders.
    column-gap: 8px !important;
  }
}

// 1470px is the width at which the bar stops needing a second row, so from here
// up every control fits on one line and the spare width is spread between them
// rather than left as a gap after the last one.
//
// It was 1430px before `.navbar` gained `padding: 0 20px`. That padding takes
// 40px out of the row's usable width, so wrapping begins 40px earlier and the
// threshold moved with it — if the side padding changes again, this number has
// to move by twice the delta.
//
// This MUST come after the `min-width: 769px` block above: both rules are
// `.navbar[data-v-…]` with `!important`, so they are identical in specificity
// and only source order separates them. Moving this earlier in the file would
// silently hand the range back to `flex-start`.
//
// Not a Bootstrap breakpoint — the nearest, xxl, is 1400px, which is too early
// and still wraps. This is measured to the bar's own content.
@media (min-width: 1470px) {
  .navbar {
    justify-content: space-between !important;
  }
}

// The wrapping range ONLY. The bar has no vertical padding — its height comes
// from the 64px logo, whose own transparent margin cushions row one. A second
// row gets no such cushion and would sit flush against the bottom edge, so it
// needs its own clearance. Bounded above rather than reset at 1470px so the
// rule states its condition directly: this exists because the bar wraps.
//
// 8px matches the `row-gap` between the rows, keeping the spacing even.
@media (min-width: 992px) and (max-width: 1469.98px) {
  .navbar {
    padding-bottom: 8px !important;
  }
}

// ── Mobile navbar: ☰ · logo · name · PP · ☰ ─────────────────────────────────
// Below `lg` both sidebars are gone and the control cluster does not fit, so the
// bar carries only the five things worth a permanent slot and hands the rest to
// the two drawers.
//
// `display: contents` on the groups again, for the same reason as the desktop
// block: without it `.navbar-left` and `.navbar-readouts` are two indivisible
// flex items, and `space-between` would push those two blocks apart rather than
// distributing the five controls evenly across the bar.
@media (max-width: 991.98px) {

  .navbar-left,
  .navbar-readouts {
    display: contents !important;
  }

  .navbar {
    flex-wrap: nowrap !important;
    justify-content: space-between !important;
    align-items: center !important;
    column-gap: 6px !important;
  }

  // the global stylesheet hides the hamburger from 769px up (15844) — that rule is
  // `!important` at (0,1,0), so a scoped rule at (0,2,0) is what takes the
  // range back. `display: flex` rather than `block`: the glyph is centred by
  // `align-items`/`justify-content` in the base rule.
  .hamburger-menu-btn {
    display: flex !important;
    position: relative !important;
    margin: 0 !important;
    flex-shrink: 0 !important;
  }

  // Everything that moved into the right-hand drawer.
  .navbar-center,
  .navbar-right,
  .beta-badge {
    display: none !important;
  }

  // The two readouts are the only flexible items in the row, so they are what
  // must give when a username is long — the logo and both toggles are fixed.
  .nav-readout {
    font-size: 0.78rem !important;
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  // The logo sets the bar's height at every width; at this one it does not also
  // need to set its width.
  .navbar-logo {
    flex-shrink: 0 !important;
  }
}

// At ≤900px the global stylesheet drops the buttons to icon-only by hiding
// `.btn-nav-action span`. That selector also catches the count badges, which
// are spans too — so the unclaimed-Pass and pending-gift counts would vanish
// exactly when the label they qualify is gone and the icon alone says least.
// They are the one thing that must survive the trim.
.nav-pass-dot {
  display: inline-block !important;
}

// Legacy makes #nav-points clickable with an inline `cursor:pointer`. The gold
// is legacy's too (`.navbar-points`, legacy style.css:14443) — kept without that rule's
// pill, so the balance still stands out from the username beside it.
.nav-points-btn {
  color: #ffdd00 !important;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

// Ports the two round buttons at index.html:951-952, which legacy styles
// entirely inline.
// LEGACY CSS TRAP: `.navbar button` / `[class*="navbar"] button`
// (legacy style.css:11671) forces `padding: 6px 12px !important` and
// `height: auto !important` on every button in the navbar. That inflated these
// from a 30px circle into a ~54px oval. Same broad-selector family as the
// `[class*="header"]` rule that silently broke seven layouts in Phase 6.5.
//
// Every box property here needs `!important` to beat it — a scoped class alone
// does not, because both declarations are important and specificity decides:
// `.nav-round-btn[data-v-x]` (0,2,0) beats `.navbar button` (0,1,1).
.nav-round-btn {
  background: rgba(255, 255, 255, 0.15);
  // Was `var(--border)` — a pale grey that all but disappeared against the
  // bright end of the navbar gradient. Matched to the event badge's outline.
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50% !important;
  width: 30px !important;
  height: 30px !important;
  min-height: 0 !important;
  padding: 0 !important;
  flex-shrink: 0 !important;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, border-color 0.15s;

  // Emoji render in their own colours, so these tint the border on hover rather
  // than the glyph — which is what tells the two apart at a glance.
  &.help {
    color: var(--purple);
  }

  &.report {
    color: #ff6b6b;
  }

  &:hover {
    transform: translateY(-1px);
    border-color: currentColor;
  }
}

// The count of rewards waiting to be claimed, sat on the Pass button. Its
// button carries `position-relative` in the template so this anchors to it.
.nav-pass-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #fbbf24;
  color: #3b2500;
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.7);
}

// ── Right-hand drawer ───────────────────────────────────────────────────────
// Its panel, rows, badges and music controls are themed globally in the global stylesheet
// (see "MOBILE DRAWERS — SITE THEME"), because the left drawer and
// NotificationBell need the same definitions and a scoped copy in each would
// emit them three times. Only what is genuinely this component's stays here.

// The badge on the collapsed toggle. `.nav-pass-dot` positions itself
// absolutely against a relative parent, which the mobile block supplies.
.nav-chrome-toggle {
  position: relative;
}

.nav-skin-keys {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid rgba(255, 215, 0, 0.4);
  color: #ffd700;
  white-space: nowrap;

  // The global .skin-key-count is 18px, sized for the variant modal's balance
  // panel rather than a navbar pill.
  :deep(.skin-key-count),
  .skin-key-count {
    font-size: 0.85rem;
    font-weight: 700;
  }
}
</style>
