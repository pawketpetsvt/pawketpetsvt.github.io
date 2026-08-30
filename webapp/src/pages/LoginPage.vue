<template>
  <AuthLanding beta-label="Beta v0.9.2 · 100% Free">
    <div class="form-card landing-v2-card">
      <h2 style="margin-bottom:4px;">Welcome back, Tester</h2>
      <p class="form-subtitle">No account? <router-link to="/register">Join the beta — it's free!</router-link></p>
      <div class="alert alert-error" :class="{ show: error }">{{ error }}</div>
      <div class="alert alert-success" :class="{ show: success }">{{ success }}</div>
      <div class="form-group"><label>Email</label>
        <input type="email" v-model="email" placeholder="your@email.com" autocomplete="email" @keydown.enter="handleLogin" />
      </div>
      <div class="form-group"><label>Password</label>
        <input type="password" v-model="password" placeholder="Password" autocomplete="current-password" @keydown.enter="handleLogin" />
      </div>
      <button class="btn btn-primary btn-lg form-submit" :disabled="submitting" @click="handleLogin">
        {{ submitting ? '✨ Logging in...' : 'Login' }}
      </button>
      <div style="text-align:center;margin:10px 0 0;">
        <router-link to="/forgot" style="font-size:0.85rem;color:var(--text-light);">Forgot your password?</router-link>
      </div>
    </div>

    <template #info>
      <div class="landing-v2-tagline">
        A virtual pet game built around the<br />
        <strong>PawketPetsVT Twitch streaming team.</strong><br />
        <span>Adopt. Care. Battle. Explore. Something is watching.</span>
      </div>

      <div class="landing-v2-features">
        <div v-for="f in FEATURES" :key="f.title" class="landing-v2-feature">
          <span class="landing-v2-feature-icon">{{ f.icon }}</span>
          <div>
            <strong>{{ f.title }}</strong>
            <span>{{ f.body }}</span>
          </div>
        </div>
      </div>

      <div class="landing-v2-lore">
        <span class="landing-v2-lore-label">// BETA TESTER NOTE //</span>
        <p>Welcome to the PawketPets beta program. You are one of a limited number of testers selected to participate
          in this session. Previous test groups have provided valuable data. We appreciate your continued involvement.
        </p>
        <p class="landing-v2-lore-fine">Session is being logged. Your companion is waiting.</p>
      </div>

      <div class="landing-v2-badges">
        <span v-for="b in BADGES" :key="b">{{ b }}</span>
      </div>
    </template>
  </AuthLanding>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/AuthService.js'
import AuthLanding from '../components/AuthLanding.vue'

// Copy ported verbatim from the legacy login landing (index.html:1268-1310).
const FEATURES = [
  { icon: '🐾', title: '8+ Adoptable Pets', body: 'Each streamer has their own unique companion with personality, stats, and lore. Your first is always free.' },
  { icon: '⚔️', title: 'Battle, Race & Explore', body: 'Turn-based battles, weekly Grand Prix racing, timed expeditions, and guild dungeons with friends.' },
  { icon: '📺', title: 'Earn by Watching', body: 'Link your Twitch account and earn PawketPoints just by watching and chatting during streams.' },
  { icon: '🎯', title: 'Daily Goals & Bingo', body: 'Log in every day for streak rewards, complete bingo cards, and level up your PawketPass.' }
]

const BADGES = ['🏁 Weekly Grand Prix', '🏛️ Guild System', '🎮 Daily Minigames', '✨ 100% Free']

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)

async function handleLogin() {
  error.value = ''
  success.value = ''
  if (!email.value || !password.value) {
    error.value = 'Please fill in all fields!'
    return
  }
  submitting.value = true
  try {
    await authService.login(email.value.trim(), password.value)
    success.value = 'Logged in! Redirecting... 🎉'
    setTimeout(() => router.push('/home'), 1000)
  } catch (err) {
    error.value = err.message || 'Login failed.'
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
// LoginPage has no styling of its own — the auth pages sit outside AppShell
// and are covered by the `.form-card` / `.landing-v2-*` rules in style.css.
</style>
