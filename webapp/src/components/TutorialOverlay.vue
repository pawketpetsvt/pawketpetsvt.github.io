<template>
  <!-- Teleported for the same reason as MobileNav: everything here is fixed
       positioning at very high z-index, and the global stylesheet has plenty of ancestors
       carrying a transform that a fixed child would anchor to instead of the
       viewport. -->
  <Teleport to="body">
    <div v-if="tutorialState.active" class="tutorial-overlay">
      <!-- Legacy set the backdrop's blur and tint imperatively on every step
           change. Both values are a pure function of which step is showing, so
           they are bound instead. -->
      <div class="tutorial-backdrop" :style="backdropStyle"></div>

      <div class="tutorial-mascot" :class="'tutorial-mascot-' + (dialogue?.mascot || 'happy')">
        <div class="tutorial-mascot-image">
          <img src="/images/Melon2.png" alt="Melon" class="tm-img" />
        </div>
        <div class="tutorial-mascot-name">Melon</div>
      </div>

      <div class="tutorial-dialogue-box">
        <!-- ── Recap ──────────────────────────────────────────────────────── -->
        <div v-if="tutorialState.recap" class="tutorial-dialogue-content">
          <div class="text-center mb-3">
            <div class="tr-emoji mb-1">🎉</div>
            <div class="tr-heading">You're all set!</div>
            <div class="tr-mood mt-1">{{ moodText }}</div>
            <div v-if="tutorialState.recap.reward > 0" class="tr-pp mt-1">
              Here's <strong>{{ tutorialState.recap.reward }} PP</strong> to get you started!
            </div>
            <div v-else class="tr-pp mt-1">Thanks for reviewing!</div>
          </div>
          <ul class="tutorial-recap-list">
            <li v-for="line in RECAP_LINES" :key="line">{{ line }}</li>
          </ul>
          <div class="text-center mt-3">
            <button class="btn btn-primary btn-lg" @click="tutorialService.close()">Let's Go! 🚀</button>
          </div>
        </div>

        <!-- ── Running ────────────────────────────────────────────────────── -->
        <div v-else class="tutorial-dialogue-content">
          <div class="tutorial-dialogue-text">{{ dialogue?.text }}</div>

          <div class="tutorial-progress">
            <span v-for="(d, i) in (step?.dialogue || [])" :key="i" class="tutorial-dot"
              :class="{ active: i === tutorialState.dialogueIndex }"></span>
          </div>

          <div class="tutorial-buttons">
            <template v-if="dialogue?.showChoice">
              <div class="tutorial-choice-buttons">
                <button class="btn btn-primary btn-lg" @click="tutorialService.makeChoice(true)">👻 YES - Bring on the
                  spooky!</button>
                <button class="btn btn-outline btn-lg" @click="tutorialService.makeChoice(false)">🌈 NO - Keep it
                  cozy</button>
              </div>
            </template>
            <template v-else>
              <button class="btn tutorial-skip" @click="confirmSkip">Skip Tutorial</button>
              <button v-if="tutorialState.waitingForPet" class="btn btn-primary tutorial-next" disabled>⏳ Adopt a pet to
                continue...</button>
              <button v-else class="btn btn-primary tutorial-next" @click="tutorialService.next()">Continue</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Points at the highlighted sidebar button. Kept as a sibling of the
         overlay rather than a child so the overlay's `pointer-events: none`
         and stacking context don't apply to it, matching legacy appending it
         straight to <body>. -->
    <div v-if="arrowPos" class="tutorial-tab-arrow" :style="arrowPos">👈</div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { tutorialState, tutorialService } from '../services/TutorialService.js'
import { TUTORIAL_SKIP_PP } from '../constants.js'

const step = computed(() => tutorialService.step)
const dialogue = computed(() => tutorialService.dialogue)

const moodText = computed(() => tutorialState.spookyChosen
  ? 'Brave choice! Keep your eyes open... 👁️✨'
  : 'A wise choice! Enjoy your cozy adventure! 🌈✨')

const RECAP_LINES = [
  'Home page for daily news & updates',
  'Adopt Center to get pets (first one is free!)',
  'My Pets to feed, play & equip your companions',
  'Equipment from the Shop to boost battle stats',
  'Minigames to earn PawketPoints daily',
  'Battle Arena to fight and level up pets',
  'PawketPass 🎫 for leveling rewards',
  'Daily Bingo 🎯 for bonus prizes'
]

// Steps the player is meant to look at or click through get a lighter backdrop.
const backdropStyle = computed(() => (tutorialService.interactive || tutorialState.waitingForPet)
  ? { backdropFilter: 'none', background: 'rgba(0,0,0,0.15)' }
  : { backdropFilter: 'blur(2px)', background: 'rgba(0,0,0,0.5)' })

// ── Tab highlight ──────────────────────────────────────────────────────────
// The target is a LeftSidebar button, outside this component, so the class is
// added to the real element and the arrow is positioned from its rect. That is
// why both rules are `:global()` in this file's style block rather than scoped
// — see the note there.
const arrowPos = ref(null)
let highlighted = null

function clearHighlight() {
  if (highlighted) {
    highlighted.classList.remove('tutorial-tab-highlight')
    highlighted = null
  }
  arrowPos.value = null
}

async function applyHighlight(tab) {
  clearHighlight()
  if (!tab) return
  // Two frames: one for the route/nav-group change to render, one for the
  // group's open transition to have laid the button out. Legacy did the same
  // with a rAF plus a 220ms retry when the measured height came back zero.
  await nextTick()
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const btn = document.getElementById('sidebar-btn-' + tab)
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  // A hidden sidebar (below Bootstrap's lg breakpoint the whole column is
  // `d-none`) measures zero. Highlight nothing rather than parking an arrow in
  // the top-left corner — the dialogue still names the tab in its own text.
  if (!rect.height) return

  btn.classList.add('tutorial-tab-highlight')
  highlighted = btn
  arrowPos.value = {
    top: (rect.top + rect.height / 2 - 16) + 'px',
    left: (rect.right + 8) + 'px'
  }
}

watch(() => [tutorialState.active, tutorialState.highlightTab], ([active, tab]) => {
  if (!active) return clearHighlight()
  applyHighlight(tab)
}, { immediate: true })

// window.confirm, as legacy used here and as Forum/Friends/Profile still do —
// ModalService has alert-style dialogs only, no confirm.
function confirmSkip() {
  // The figure is interpolated rather than written into the sentence: legacy
  // stated "50 PP" as literal text next to a separately hardcoded payout, which
  // is precisely how a promise and a payment drift apart.
  if (window.confirm('Skip the tutorial? You can replay it anytime from Settings.\n\nYou\'ll still receive ' + TUTORIAL_SKIP_PP + ' PP for starting.')) {
    tutorialService.skip()
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && tutorialState.active && !tutorialState.recap) confirmSkip()
}

watch(() => tutorialState.active, active => {
  if (active) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
}, { immediate: true })

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  clearHighlight()
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
//
// These two MUST be `:global()`, not scoped and not `:deep()`. Both decorate
// elements this component does not render: `highlightTab()` adds
// `.tutorial-tab-highlight` to a nav button inside LeftSidebar, and the arrow
// is positioned against it. `:deep()` compiles to `[data-v-x] .target`, which
// only reaches DESCENDANTS of this component's own root — so a scoped or deep
// version of these would silently never match, and the walkthrough would run
// with nothing highlighted. `:global()` emits them unscoped, which is what
// the global stylesheet was providing before.
//
// The keyframes stay local: Vue renames a locally-defined @keyframes and
// rewrites the `animation:` references that name it, including the ones inside
// a `:global()` rule, so the pair stays consistent.
:global(.tutorial-tab-highlight) {
  animation: tutorial-tab-pulse 1s ease-in-out infinite !important;
  box-shadow: 0 0 0 0 rgba(153, 102, 255, 0.7) !important;
  outline: 3px solid #9966ff !important;
  outline-offset: 2px !important;
  position: relative !important;
  z-index: 10 !important;
}

:global(.tutorial-tab-arrow) {
  position: fixed;
  z-index: 1000003;
  pointer-events: none;
  font-size: 2rem;
  animation: tutorial-arrow-bounce 0.6s ease-in-out infinite alternate;
  filter: drop-shadow(0 2px 6px rgba(153, 102, 255, 0.8));
}

@keyframes tutorial-tab-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(153, 102, 255, 0.7); }
  70%  { box-shadow: 0 0 0 10px rgba(153, 102, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(153, 102, 255, 0); }
}

@keyframes tutorial-arrow-bounce {
  from { transform: translateX(-8px); }
  to   { transform: translateX(4px); }
}

// Carried from the legacy index.html's inline <style> (index.html:52-125).
.tutorial-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  pointer-events: none;
}

.tutorial-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.tutorial-mascot {
  position: fixed;
  left: 200px;
  bottom: 200px;
  z-index: 1000001;
  text-align: center;
  pointer-events: none;
  animation: tutorial-mascot-bounce 4s ease-in-out infinite;
}

.tutorial-mascot-image {
  width: 120px;
  height: 120px;
  object-fit: contain;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.3));
  animation: tutorial-mascot-float 3s ease-in-out infinite;
}

// Legacy set these three on the <img> inline.
.tm-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tutorial-mascot-name {
  font-family: 'Chewy', cursive;
  font-size: 1.2rem;
  color: #fff;
  margin-top: 12px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.tutorial-mascot-excited .tutorial-mascot-image {
  animation: tutorial-mascot-excited 0.5s ease-in-out infinite;
}

.tutorial-mascot-explaining .tutorial-mascot-image {
  animation: tutorial-mascot-explaining 1.5s ease-in-out infinite;
}

.tutorial-mascot-concerned .tutorial-mascot-image {
  filter: drop-shadow(0 8px 24px rgba(255, 165, 0, 0.3));
}

.tutorial-mascot-worried .tutorial-mascot-image {
  filter: drop-shadow(0 8px 24px rgba(255, 100, 100, 0.3));
}

.tutorial-mascot-scared .tutorial-mascot-image {
  filter: drop-shadow(0 8px 24px rgba(255, 0, 0, 0.5));
  animation: tutorial-mascot-shake 0.3s ease-in-out infinite;
}

.tutorial-mascot-serious .tutorial-mascot-image {
  filter: grayscale(0.3) drop-shadow(0 8px 24px rgba(100, 0, 150, 0.4));
}

.tutorial-dialogue-box {
  position: fixed;
  bottom: 16px;
  left: 16px;
  width: 270px;
  max-width: 270px;
  z-index: 1000002;
  background: linear-gradient(135deg, #fff, #fff5ff);
  border: 3px solid var(--purple);
  border-radius: 18px;
  padding: 18px 20px;
  box-shadow: 0 8px 32px rgba(153, 102, 255, 0.4);
  animation: tutorial-dialogue-enter 0.3s ease-out;
  pointer-events: all;
}

.tutorial-dialogue-content {
  position: relative;
}

.tutorial-dialogue-text {
  font-family: 'Chewy', cursive;
  font-size: 1.1rem;
  color: var(--purple-dark);
  line-height: 1.5;
  margin-bottom: 14px;
  min-height: 60px;
}

.tutorial-progress {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}

.tutorial-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--purple-light);
  opacity: 0.3;
  transition: all 0.3s;

  &.active {
    opacity: 1;
    background: var(--purple);
    transform: scale(1.3);
  }
}

.tutorial-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  align-items: center;
}

.tutorial-skip {
  background: transparent !important;
  color: var(--purple) !important;
  border: none !important;
  font-size: 0.95rem !important;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    text-decoration: underline;
  }
}

.tutorial-next {
  min-width: 140px;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.tutorial-choice-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  .btn {
    width: 100%;
    padding: 16px 24px;
    font-size: 1.1rem;
  }
}

// The recap replaced the dialogue box's innerHTML in legacy and was styled
// entirely with inline attributes; those become classes here.
.tr-emoji {
  font-size: 2.5rem;
}

.tr-heading {
  font-family: 'Chewy', cursive;
  font-size: 1.8rem;
  color: var(--purple-dark);
}

.tr-mood {
  font-size: 1rem;
  color: var(--text-light);
}

.tr-pp {
  font-size: 1rem;
  color: var(--purple);
  font-weight: bold;
}

.tutorial-recap-list {
  text-align: left;
  margin: 16px 0;
  list-style: none;
  padding: 0;

  li {
    padding: 8px 0;
    border-bottom: 1px solid var(--purple-light);
    font-size: 1rem;
    color: var(--text);

    &:before {
      content: "✅ ";
      margin-right: 6px;
    }
  }
}

@keyframes tutorial-dialogue-enter {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes tutorial-mascot-bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

@keyframes tutorial-mascot-float {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50%      { transform: translateY(-15px) rotate(3deg); }
}

@keyframes tutorial-mascot-excited {
  0%, 100% { transform: scale(1) rotate(0); }
  25%      { transform: scale(1.1) rotate(-5deg); }
  75%      { transform: scale(1.1) rotate(5deg); }
}

@keyframes tutorial-mascot-explaining {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-6px) scale(1.03); }
}

@keyframes tutorial-mascot-shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-5px); }
  75%      { transform: translateX(5px); }
}

@media (max-width: 768px) {
  .tutorial-mascot {
    right: 20px;
    bottom: 220px;
    transform: scale(0.7);
  }

  .tutorial-dialogue-box {
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 90%;
    padding: 20px;
  }

  .tutorial-buttons {
    flex-direction: column;
    gap: 8px;
  }

  .tutorial-skip,
  .tutorial-next {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .tutorial-mascot {
    right: 10px;
    bottom: 200px;
    transform: scale(0.5);
  }

  .tutorial-dialogue-text {
    font-size: 1rem;
  }
}
</style>
