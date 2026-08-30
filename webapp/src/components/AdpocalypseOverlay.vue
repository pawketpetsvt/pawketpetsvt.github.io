<template>
  <Teleport to="body">
    <div
      v-for="popup in adpocalypseState.popups"
      :key="popup.key"
      class="adpoc-popup adpoc-show"
      :class="{ 'adpoc-horror': popup.ad.horror }"
      :style="popup.position"
    >
      <div class="adpoc-titlebar d-flex align-items-center justify-content-between gap-2 py-1 px-px6">
        <span>{{ popup.ad.title }}</span>
        <button class="adpoc-close flex-shrink-0" title="Close" @click="close(popup.key)">✕</button>
      </div>
      <div class="p-px10 text-center">
        <div class="adpoc-headline mb-px6">{{ popup.ad.headline }}</div>
        <!-- The ad copy is authored WITH markup (<strong>, <br>) in the legacy
             data and is a fixed, in-repo string — no user input reaches it. -->
        <div class="adpoc-sub mb-px10" v-html="popup.ad.sub"></div>
        <button class="adpoc-btn d-block w-100 p-2" @click="act(popup)">{{ popup.ad.btn }}</button>
        <div class="adpoc-fine mt-2">{{ popup.ad.fine }}</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { adpocalypseService, adpocalypseState } from '../services/AdpocalypseService.js'

// Ports adpocalypse_showAd() / adpocalypse_closePopup(). Legacy built each
// popup with document.createElement and an onclick attribute referencing a
// global; this renders them from state.

function close(key) {
  adpocalypseService.close(key)
}

function act(popup) {
  adpocalypseService.resolve({ ...popup.ad, __key: popup.key })
}
</script>

<style lang="scss" scoped>
// NOT A PORT — these rules do not exist. `.adpoc-popup` and every one of its
// children are referenced by legacy's generated markup and defined NOWHERE:
// zero matches in the global stylesheet and zero in index.html, on `main` as well as here.
// Since `position` is never set either, the inline `top`/`right` legacy applies
// does nothing, so on the live site an Ad-pocalypse popup renders as unstyled
// text dumped into the page flow. Same "class referenced, rule missing" family
// as `.ach-badge` and the spooky keyframes.
//
// Written to match the deliberately tacky 2000s-popup look the copy is going
// for, with the horror variant stripped back to something colder.
.adpoc-popup {
  position: fixed;
  z-index: 10050;
  width: 260px;
  max-width: calc(100vw - 24px);
  border: 2px solid #8a8a8a;
  border-radius: 4px;
  background: #ecebe4;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.35);
  font-family: Verdana, Geneva, sans-serif;
  opacity: 0;
  transform: translateY(10px) scale(0.96);
  transition: opacity 0.35s ease, transform 0.35s ease;

  &.adpoc-show {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.adpoc-titlebar {
  background: linear-gradient(180deg, #2b6ec9, #1b4f96);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
}

.adpoc-close {
  background: #d4d0c8;
  border: 1px solid #6f6f6f;
  color: #222;
  font-size: 0.65rem;
  line-height: 1;
  padding: 2px 5px;
  cursor: pointer;
}

.adpoc-headline {
  font-size: 0.85rem;
  font-weight: 800;
  color: #c0392b;
}

.adpoc-sub {
  font-size: 0.7rem;
  color: #222;
  line-height: 1.45;
}

.adpoc-btn {
  border: 2px outset #ffd34d;
  background: linear-gradient(180deg, #ffe680, #ffb700);
  color: #3b2500;
  font-weight: 800;
  font-size: 0.75rem;
  cursor: pointer;
  animation: adpoc-throb 1.1s ease-in-out infinite;
}

@keyframes adpoc-throb {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

.adpoc-fine {
  font-size: 0.55rem;
  color: #666;
  line-height: 1.35;
}

// The horror ad drops the whole gaudy act.
.adpoc-horror {
  background: #0d0a12;
  border-color: #3a2f4a;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.7);

  .adpoc-titlebar {
    background: #14101c;
    color: #8f86a3;
    font-weight: 500;
    letter-spacing: 1px;
  }

  .adpoc-close { background: #241d33; border-color: #3a2f4a; color: #8f86a3; }
  .adpoc-headline { color: #b9aecd; font-weight: 500; }
  .adpoc-sub { color: #8f86a3; }

  .adpoc-btn {
    background: #1b1526;
    border: 1px solid #3a2f4a;
    color: #b9aecd;
    font-weight: 500;
    animation: none;
  }

  .adpoc-fine { color: #4a4159; }
}

// Reduced motion kills the throb and the slide, keeping the popup readable.
:global(body.reduced-motion) .adpoc-popup { transition: none; }
:global(body.reduced-motion) .adpoc-btn { animation: none; }
</style>
