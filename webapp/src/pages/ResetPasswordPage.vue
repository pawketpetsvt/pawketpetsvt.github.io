<template>
  <div class="auth-container">
    <div class="auth-header">
      <img src="/images/logo.png" alt="PawketPets" class="auth-logo" />
      <h1>Set New Password</h1>
      <p>Choose a secure password for your account 🔐</p>
    </div>
    <div class="form-card">
      <h2>🔑 New Password</h2>
      <div class="alert alert-error" :class="{ show: error }">{{ error }}</div>
      <div class="alert alert-success" :class="{ show: success }">{{ success }}</div>
      <div class="form-group">
        <label>New Password</label>
        <input type="password" v-model="newPassword" placeholder="Enter new password" />
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input type="password" v-model="confirmPassword" placeholder="Confirm new password" />
      </div>
      <button class="btn btn-primary btn-lg form-submit" :disabled="submitting" @click="handleSubmit">🔐 Update Password</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/AuthService.js'

const router = useRouter()
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)

async function handleSubmit() {
  error.value = ''
  success.value = ''
  if (!newPassword.value || !confirmPassword.value) {
    error.value = 'Please fill in both password fields!'
    return
  }
  if (newPassword.value.length < 6) {
    error.value = 'Password must be at least 6 characters!'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match!'
    return
  }
  submitting.value = true
  try {
    await authService.updatePasswordAfterRecovery(newPassword.value)
    success.value = 'Password updated successfully! Redirecting...'
    setTimeout(() => router.push('/home'), 2000)
  } catch (err) {
    error.value = err.message || 'Failed to update password. Please try again.'
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
// No page-specific styling yet — fully covered by legacy .auth-container/.form-card classes.
</style>
