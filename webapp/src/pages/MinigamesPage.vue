<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🎮 ✦ 🎮</div>
      <h1>Minigames</h1>
      <p>Play daily games to earn PawketPoints! 🪙</p>
    </div>
    <PointsBanner :points="points" />

    <div class="games-grid">
      <DiceGame />
      <GuessGame />
      <MemoryGame />
      <SlotMachine />
      <WheelGame />
      <WhackGame />
      <ShellGame />
      <TypingGame />
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

const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)

onMounted(() => {
  if (!AppState.player) playerService.getPlayer(AppState.user.id)
})
</script>
