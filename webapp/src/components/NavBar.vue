<template>
  <nav class="navbar">
    <div class="navbar-left">
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
      <div class="navbar-center">
        <NotificationBell @open-gifts="showGifts = true" />
        <EventStatusWidget />
      </div>

      <div class="navbar-right">
        <!-- Deliberately NOT `.navbar-username` / `.navbar-points`. Those are
             legacy pill rules (style.css:14433/14442) that add a background,
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
        <!-- Ports the navbar Pass button and skin-key counter
             (index.html:934 / 955). The key counter is hidden at zero, as
             legacy's own display toggle behaved. -->
        <!-- The EMOJI sits outside the label span on purpose. style.css:14518
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
    </template>
    <PawketPassModal v-if="showPass" @close="showPass = false" />
    <BingoModal v-if="showBingo" @close="showBingo = false" />
    <WeeklyChallengeModal v-if="showWeekly" @close="showWeekly = false" />
    <HelpModal v-if="showHelp" @close="showHelp = false" />
    <ReportModal v-if="showReport" @close="showReport = false" />
    <PPHistoryModal v-if="showPPHistory" @close="showPPHistory = false" />
    <GiftInboxModal v-if="showGifts" @close="showGifts = false" />
    <audio ref="bgMusicEl" loop>
      <source src="/music.mp3" type="audio/mpeg" />
    </audio>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
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
</script>

<style lang="scss" scoped>
// The navbar's own chrome. style.css still owns `.navbar`, `.navbar-right` and
// `.skin-key-count`; what follows is the set that has no rule anywhere, plus the
// overrides needed to beat style.css's several competing `!important` rules for
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
// style.css:11665 applies `margin`, `display` and `align-items` to EVERY navbar
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
// `!important` is required: style.css sets these properties with `!important`
// from several competing rules, so a plain declaration loses even though the
// scoped attribute raises specificity.
//
// This is NOT a colour change. The winning `.btn-nav-action` rule
// (style.css:14452) already renders white-on-translucent — the yellow/Chewy
// rule at style.css:346 is dead, overridden five rules further down. Only the
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

// `.navbar button` (style.css:11671) sets `margin: 0 4px !important` on every
// button in here. `.navbar-right` already spaces them with a flex `gap`, so
// that margin is 8px of duplicate spacing per button — ~64px across the row,
// which is most of why it runs off the right edge.
// The same duplicate-spacing problem from a second rule: `.navbar-center > *`
// and `.navbar-left > *` (style.css:12516) add `margin: 0 4px` to the logo, the
// beta badge, the bell and the event badge. Harmless while those groups had
// their own gap; now that every control shares one row gap, it makes the first
// four items sit 8px further apart than the rest.
.btn-nav-action,
.nav-round-btn,
.music-btn,
.navbar-left>*,
.navbar-center>* {
  margin: 0 !important;
}

// ── Wrapping on narrower desktops ───────────────────────────────────────────
// style.css pins the whole bar to a single line — `flex-wrap: nowrap` on
// `.navbar` (14296) and on `.navbar-right` (10770), with
// `.navbar-right > * { flex-shrink: 0 }` (14346). Nothing can shrink and
// nothing can wrap, so past a certain width the row simply runs off the right
// edge and its last controls become unreachable.
//
// Scoped to `min-width: 769px` DELIBERATELY: 768px is where style.css's own
// desktop navbar block (`@media (min-width: 769px)`, 14236) stops applying and
// the separate mobile layout takes over. That layout has its own problems and
// is explicitly out of scope here — this must not reach into it.
//
// No max-width and no chosen breakpoint: flexbox only wraps when the content
// genuinely does not fit, so a 1920 display keeps the single row it has now and
// narrower ones break onto a second (or third) line exactly when they need to.
// Guessing a pixel value would either wrap too early on a 1440 laptop or too
// late on a small window.
@media (min-width: 769px) {

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
  // generation, so style.css rules like `.navbar-right > *` (14346, which keeps
  // these from squashing) and `.navbar-center button` (12264) continue to
  // apply. `margin-left: auto` on `.navbar-right` (10377) stops mattering,
  // since a box-less element has no margins to resolve.
  .navbar-left,
  .navbar-center,
  .navbar-right {
    display: contents !important;
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
@media (min-width: 769px) and (max-width: 1469.98px) {
  .navbar {
    padding-bottom: 8px !important;
  }
}

// At ≤900px style.css drops the buttons to icon-only by hiding
// `.btn-nav-action span`. That selector also catches the count badges, which
// are spans too — so the unclaimed-Pass and pending-gift counts would vanish
// exactly when the label they qualify is gone and the icon alone says least.
// They are the one thing that must survive the trim.
.nav-pass-dot {
  display: inline-block !important;
}

// Legacy makes #nav-points clickable with an inline `cursor:pointer`. The gold
// is legacy's too (`.navbar-points`, style.css:14443) — kept without that rule's
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
// (style.css:11671) forces `padding: 6px 12px !important` and
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
