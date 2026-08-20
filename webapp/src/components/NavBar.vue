<template>
  <nav class="pp-navbar">
    <router-link to="/my-pets" class="nav-brand">🐾 PawketPetsVT</router-link>
    <div class="nav-links">
      <template v-if="AppState.user">
        <router-link to="/my-pets">My Pets</router-link>
        <router-link to="/adopt">Adopt</router-link>
        <span id="nav-points">🪙 {{ points }} PP</span>
        <span class="nav-username">{{ AppState.player?.username }}</span>
        <button class="btn btn-outline" @click="handleLogout">Logout</button>
      </template>
      <template v-else>
        <router-link to="/login">Login</router-link>
        <router-link to="/register">Register</router-link>
      </template>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { AppState } from '../AppState.js'
import { authService } from '../services/AuthService.js'

const router = useRouter()
const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)

async function handleLogout() {
  await authService.logout()
  router.push('/login')
}
</script>

<style lang="scss" scoped>
.pp-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: var(--white);
  box-shadow: 0 2px 12px var(--shadow);
  flex-wrap: wrap;
  gap: 12px;
}

.nav-brand {
  font-family: 'Fredoka One', cursive;
  color: var(--purple-dark);
  text-decoration: none;
  font-size: 1.2rem;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  a {
    color: var(--text);
    text-decoration: none;
    font-weight: 700;

    &.router-link-active {
      color: var(--purple);
    }
  }
}

.nav-username {
  font-weight: 700;
  color: var(--purple-dark);
}
</style>
