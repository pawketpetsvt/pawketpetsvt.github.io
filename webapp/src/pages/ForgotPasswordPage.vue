<template>
  <div class="page-wrap">
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
// No page-specific styling yet — fully covered by globals/legacy classes.
</style>
