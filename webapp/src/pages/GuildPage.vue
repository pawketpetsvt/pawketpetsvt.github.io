<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="section-header">
      <h2 class="section-title">🏛️ Guild</h2>
    </div>

    <div v-if="booting" class="spinner"></div>

    <GuildCreateForm
      v-else-if="view === 'create'"
      @back="showBrowser"
      @created="showMine"
    />

    <GuildMemberView
      v-else-if="view === 'mine'"
      @open="openSub"
      @left="showBrowser"
    />

    <GuildChat v-else-if="view === 'chat'" @back="showMine" />

    <GuildTreasury v-else-if="view === 'treasury'" @back="showMine" />

    <GuildDungeons v-else-if="view === 'dungeons'" @back="showMine" />

    <GuildHall v-else-if="view === 'housing'" @back="showMine" />

    <GuildBrowser
      v-else
      @create="view = 'create'"
      @joined="showMine"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { guildService } from '../services/GuildService.js'
import { guildPerkService } from '../services/GuildPerkService.js'
import GuildBrowser from '../components/guild/GuildBrowser.vue'
import GuildCreateForm from '../components/guild/GuildCreateForm.vue'
import GuildMemberView from '../components/guild/GuildMemberView.vue'
import GuildChat from '../components/guild/GuildChat.vue'
import GuildTreasury from '../components/guild/GuildTreasury.vue'
import GuildDungeons from '../components/guild/GuildDungeons.vue'
import GuildHall from '../components/guild/GuildHall.vue'

const booting = ref(true)
const view = ref('browse')

async function showBrowser() {
  view.value = 'browse'
  await guildService.loadBrowser()
}

async function showMine() {
  await guildService.checkStatus()
  view.value = 'mine'
  await guildService.loadMemberView()
}

// All four sub-views are built: chat, treasury, dungeons, housing.
function openSub(which) {
  view.value = which
}

onMounted(async () => {
  guildPerkService.startPruning()
  const inGuild = await guildService.checkStatus()
  if (inGuild) {
    view.value = 'mine'
    await guildService.loadMemberView()
  } else {
    view.value = 'browse'
    await guildService.loadBrowser()
  }
  booting.value = false
})
</script>
