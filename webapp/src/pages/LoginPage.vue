<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">✦ ✧ ✦</div>
      <h1>Welcome Back!</h1>
      <p>Login to check on your pets and keep the adventure going ✨</p>
    </div>
    <div class="form-card">
      <h2>🐾 Login</h2>
      <p class="form-subtitle">Don't have an account? <router-link to="/register">Register here!</router-link></p>
      <div class="alert alert-error" :class="{ show: error }">{{ error }}</div>
      <div class="alert alert-success" :class="{ show: success }">{{ success }}</div>
      <div class="form-group"><label>Email Address</label>
        <input type="email" v-model="email" placeholder="your@email.com" autocomplete="email" @keydown.enter="handleLogin" />
      </div>
      <div class="form-group"><label>Password</label>
        <input type="password" v-model="password" placeholder="••••••••" autocomplete="current-password" @keydown.enter="handleLogin" />
      </div>
      <button class="btn btn-primary btn-lg form-submit" :disabled="submitting" @click="handleLogin">
        {{ submitting ? '✨ Logging in...' : '✨ Login' }}
      </button>
      <div style="text-align:center;margin:10px 0 0;">
        <router-link to="/forgot" style="font-size:0.85rem;color:var(--text-light);">Forgot your password?</router-link>
      </div>
      <div class="form-footer">New here? <router-link to="/register">Create an account!</router-link></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/AuthService.js'

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
// LoginPage has no styling of its own yet — it's fully covered by the
// shared page-wrap/form-card classes in assets/scss/globals.scss.
</style>
