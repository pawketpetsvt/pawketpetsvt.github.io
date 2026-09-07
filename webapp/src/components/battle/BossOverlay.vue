<template>
  <!-- Teleported to <body> because both pieces are `position: fixed` and cover
       the whole viewport. A fixed element anchors to the nearest ancestor
       carrying a transform, filter or contain — and during a boss fight the
       drift animations put a transform on a great many of them, which is
       exactly the situation that would otherwise trap this inside the arena. -->
  <Teleport to="body">
    <div v-if="bossPresentation.active" class="screen-glitch" aria-hidden="true"></div>

    <div
      v-for="w in bossPresentation.warnings"
      :key="w.id"
      class="boss-warning-text"
      :class="w.dir === 'right' ? 'boss-warning-scroll-right' : 'boss-warning-scroll-left'"
      :style="warningStyle(w)"
      aria-hidden="true"
    >YOU SHOULDN'T BE HERE</div>

    <!-- Death screen. `blackout` flips one frame after `dying`, which is what
         gives the 5s opacity transition a starting value to move from. -->
    <div
      v-if="bossPresentation.dying"
      class="boss-death-fade"
      :class="{ 'is-black': bossPresentation.blackout }"
      aria-hidden="true"
    ></div>

    <div
      v-for="w in bossPresentation.deathWarnings"
      :key="w.id"
      class="boss-death-warning"
      :style="{ left: w.x + 'px', top: w.y + 'px' }"
      aria-hidden="true"
    >WE WARNED YOU</div>
  </Teleport>
</template>

<script setup>
import { bossPresentation } from '../../services/BossPresentationService.js'

// The scroll keyframes animate `left` / `right` from -100%, so the starting
// offset has to be on the side the text travels from — setting both would pin
// the element and it would never move.
function warningStyle(w) {
  return w.dir === 'right'
    ? { top: w.y + 'px', right: '-100%' }
    : { top: w.y + 'px', left: '-100%' }
}
</script>

<style lang="scss">
// NOT scoped. These elements are teleported to <body>, and the classes are
// recovered verbatim from the pre-migration stylesheet, where they were
// global. They were removed by the dead-CSS pass during the style.css
// elimination — correctly, at the time, because nothing in the Vue app applied
// them once the boss entrance sequence turned out never to have been ported.
// Restored here alongside the code that applies them.
//
// Every @keyframes they reference (glitch-scan, glitch-shift, glitch-distort,
// warning-shake-intense, warning-scroll-left/right, warning-fade-scroll) DID
// survive in _animations.scss, so only the rules themselves were missing.

/* Screen glitch/artifact overlay — stays up for the whole boss fight. */
.screen-glitch {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9998;
  background: repeating-linear-gradient(
    0deg,
    rgba(255, 0, 0, 0.15) 0px,
    rgba(0, 255, 0, 0.15) 1px,
    rgba(0, 0, 255, 0.15) 2px,
    transparent 3px
  );
  animation: glitch-scan 0.4s infinite, glitch-shift 0.8s infinite, glitch-distort 0.8s infinite;
}

.boss-warning-text {
  position: fixed;
  font-size: 3.2rem;
  font-weight: 900;
  color: #FF0000;
  text-shadow:
    0 0 10px #FF0000,
    0 0 20px #FF0000,
    0 0 30px #FF0000,
    3px 3px 0 #000000,
    -2px -2px 0 rgba(0, 255, 255, 0.5);
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
  opacity: 0;
  font-family: 'Arial Black', sans-serif;
  letter-spacing: 3px;
  text-transform: uppercase;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    rgba(0, 0, 0, 0.3) 1px,
    transparent 2px
  );
  -webkit-background-clip: text;
  background-clip: text;
}

.boss-warning-scroll-left {
  animation: warning-shake-intense 0.15s infinite, warning-scroll-left 6s linear forwards, warning-fade-scroll 6s ease-in-out forwards;
}

.boss-warning-scroll-right {
  animation: warning-shake-intense 0.15s infinite, warning-scroll-right 6s linear forwards, warning-fade-scroll 6s ease-in-out forwards;
}

/* ── Death screen ──────────────────────────────────────────────────────────
   `.boss-death-fade` and `.boss-death-warning` have NO rules in the legacy
   stylesheet — both were built entirely from inline styles in JS. Written as
   real classes here, per the standing rule about inline styles; only the
   random per-element placement stays a binding. The two keyframes they use
   (death-warning-shake, death-warning-fade) already survive in
   _animations.scss. */
.boss-death-fade {
  position: fixed;
  inset: 0;
  background: #000;
  opacity: 0;
  z-index: 99999;
  // Deliberately NOT `pointer-events: none`, unlike every other overlay here.
  // The sequence runs ~8.5s over a still-mounted arena whose result screen has
  // a Continue button, and that button calls battleService.reset() — which
  // would tear the death screen down and leave the player signed in, halfway
  // through being thrown out. At 99999 this sits above the navbar (100) and
  // both drawers (10002), so it swallows the click and the nav with it.
  // Legacy got this for free by hiding the battle buttons outright.
  pointer-events: auto;
  transition: opacity 5s ease-in;
}

.boss-death-fade.is-black {
  opacity: 1;
}

.boss-death-warning {
  position: fixed;
  font-size: 4rem;
  font-weight: 900;
  color: #FF0000;
  text-shadow: 0 0 20px #FF0000, 0 0 40px #FF0000, 5px 5px 0 #000;
  /* Above the blackout, which is 99999 — these have to stay readable once the
     screen has gone black, which is the whole point of the last wave. */
  z-index: 100000;
  font-family: 'Arial Black', sans-serif;
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
  animation: death-warning-shake 0.15s infinite, death-warning-fade 5s ease-in-out forwards;
}

// Not in the legacy stylesheet, and added deliberately. A full-screen RGB
// scanline strobe plus violently shaking text is the clearest possible case
// for this setting — `body.reduced-motion *` already forces every animation to
// 0.01ms, which would leave the overlay as a STATIC red-green-blue wash over
// the whole page and the warnings frozen off-screen at -100%. Hiding both is
// the honest reading of "reduced motion" here; the fight still runs, and the
// arena's own boss chrome still marks it as a boss battle.
body.reduced-motion {
  .screen-glitch,
  .boss-warning-text {
    display: none !important;
  }

  // The death warnings are NOT hidden — they are the substance of the beat,
  // not decoration, and a silent fade to black followed by a logout would be
  // unexplained rather than merely calmer. Only the shaking goes.
  //
  // Killing the animation has to come with `opacity: 1`: these start at 0 and
  // are brought in BY `death-warning-fade`, and `body.reduced-motion *` forces
  // every animation to 0.01ms — so left alone they would land on the
  // animation's final frame, which is opacity 0, and never be seen at all.
  .boss-death-warning {
    animation: none !important;
    opacity: 1 !important;
  }
}
</style>
