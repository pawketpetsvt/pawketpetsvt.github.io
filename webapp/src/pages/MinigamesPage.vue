<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🎮 ✦ 🎮</div>
      <h1>Minigames</h1>
      <p>Play daily games to earn PawketPoints! 🪙</p>
    </div>
    <PointsBanner :points="points" />

    <!-- Was the global `.games-grid` auto-fit track (minmax 300px, 28px gap).
         Each game renders its own `.game-card`, so the col is just the cell. -->
    <!-- `h-100` falls through to each game's root `.game-card`, so every card
         in a row stretches to match the tallest one (Bootstrap rows already
         stretch their columns; this makes the card fill its column). -->
    <div class="row row-cols-1 row-cols-md-2 g-wide">
      <div class="col"><DiceGame class="h-100" /></div>
      <div class="col"><GuessGame class="h-100" /></div>
      <div class="col"><MemoryGame class="h-100" /></div>
      <div class="col"><SlotMachine class="h-100" /></div>
      <div class="col"><WheelGame class="h-100" /></div>
      <div class="col"><WhackGame class="h-100" /></div>
      <div class="col"><ShellGame class="h-100" /></div>
      <div class="col"><TypingGame class="h-100" /></div>
    </div>

    <!-- Legacy attaches an expedition panel and a Pet Racing minigame to this
         tab via a `tabsLoaded['minigames']` monkey-patch, which is why the
         renderer-level audit missed both. The expedition panel is the same
         component the Battle tab uses — one system, one `expeditions` table,
         and now one UI, rather than legacy's two divergent copies. -->
    <div class="mt-4">
      <ExpeditionPanel />
    </div>

    <div class="mt-4">
      <PetRaceGame />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { playerService } from '../services/PlayerService.js'
import PointsBanner from '../components/PointsBanner.vue'
import DiceGame from '../components/minigames/DiceGame.vue'
import GuessGame from '../components/minigames/GuessGame.vue'
import MemoryGame from '../components/minigames/MemoryGame.vue'
import SlotMachine from '../components/minigames/SlotMachine.vue'
import WheelGame from '../components/minigames/WheelGame.vue'
import WhackGame from '../components/minigames/WhackGame.vue'
import ShellGame from '../components/minigames/ShellGame.vue'
import TypingGame from '../components/minigames/TypingGame.vue'
import PetRaceGame from '../components/minigames/PetRaceGame.vue'
import ExpeditionPanel from '../components/battle/ExpeditionPanel.vue'

const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)

onMounted(() => {
  if (!AppState.player) playerService.getPlayer(AppState.user.id)
})
</script>

<style lang="scss" scoped>
// The game cards are laid out by `.game-card` (flex column) in the root
// style.css, so every element below the description inherits its height —
// meaning a 2-line blurb and a 3-line blurb pushed the reward badge and the
// game area to different heights across a row. Reserving the tallest case
// (3 lines at 0.95rem/1.6) lines the badges and play areas up with each other.
//
// `:deep()` because the descriptions live inside the individual game
// components, and scoped styles otherwise stop at this page's own elements.
// Scoped to this page on purpose: `.game-desc` is shared with FishingPage,
// whose single card has a short blurb and would just gain dead space.
:deep(.game-desc) {
  min-height: 4.6rem;
}

// Titles are single-line today, but a longer name wrapping to two lines would
// reintroduce the same misalignment, so reserve one line's worth here too.
:deep(.game-title) {
  min-height: 2.2rem;
}
</style>
