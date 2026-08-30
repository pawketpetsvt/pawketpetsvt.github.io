<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page fp-col">
    <div class="page-hero">
      <div class="sparkle-row">✦ ✧ ✦</div>
      <h1>Reset Password</h1>
      <p>Enter your email and we'll send you a reset link ✨</p>
    </div>
    <div class="form-card">
      <h2>🔑 Forgot Password</h2>
      <p class="form-subtitle">Remember it? <router-link to="/login">Back to login!</router-link></p>
      <div class="alert alert-error" :class="{ show: error }">{{ error }}</div>
      <div class="alert alert-success" :class="{ show: success }">{{ success }}</div>
      <div class="form-group"><label>Email Address</label><input type="email" v-model="email" placeholder="your@email.com" /></div>
      <button class="btn btn-primary btn-lg form-submit" :disabled="submitting" @click="handleSubmit">✉️ Send Reset Email</button>
      <div class="form-footer"><router-link to="/login">← Back to Login</router-link></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/AuthService.js'

const router = useRouter()
const email = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)

async function handleSubmit() {
  error.value = ''
  success.value = ''
  if (!email.value) {
    error.value = 'Please enter your email address!'
    return
  }
  submitting.value = true
  try {
    await authService.resetPassword(email.value.trim())
    success.value = 'Password reset email sent! Check your inbox.'
    email.value = ''
    setTimeout(() => router.push('/login'), 3000)
  } catch (err) {
    error.value = err.message || 'Failed to send reset email. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.form-footer {
  text-align: center !important;
  margin-top: 20px !important;
  color: var(--text-light) !important;
  font-size: 0.95rem !important;
  font-weight: 500 !important;
}

// This is the ONE `.page-wrap` page that is not `requiresAuth`, so it renders
// in GuestLayout rather than inside AppShell's centre column. Everywhere else
// the old `max-width: 1100px` was dead (the column tops out near 800px), but
// here it genuinely capped the page on a wide screen — so it is kept.
// Bootstrap has no container step at 1100px.
.fp-col {
  max-width: 1100px;
}
</style>
