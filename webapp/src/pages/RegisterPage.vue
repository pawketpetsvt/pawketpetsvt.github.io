<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">✦ ✧ ✦</div>
      <h1>Join PawketPetsVT!</h1>
      <p>Create your account and start your pet collection adventure ✨</p>
    </div>
    <div class="form-card">
      <h2>🌟 Register</h2>
      <p class="form-subtitle">Already have an account? <router-link to="/login">Login here!</router-link></p>
      <div class="alert alert-error" :class="{ show: error }">{{ error }}</div>
      <div class="alert alert-success" :class="{ show: success }">
        <template v-if="success">Account created! 🎉<br /><small>Now <router-link to="/login">login here</router-link> to start playing!</small></template>
      </div>
      <div class="form-group"><label>Username</label><input type="text" v-model="username" placeholder="CoolPetTrainer123" maxlength="30" @keydown.enter="handleRegister" /></div>
      <div class="form-group"><label>Email Address</label><input type="email" v-model="email" placeholder="your@email.com" autocomplete="email" @keydown.enter="handleRegister" /></div>
      <div class="form-group"><label>Password</label><input type="password" v-model="password" placeholder="At least 6 characters" autocomplete="new-password" @keydown.enter="handleRegister" /></div>
      <div class="form-group"><label>Confirm Password</label><input type="password" v-model="confirmPassword" placeholder="••••••••" @keydown.enter="handleRegister" /></div>
      <button class="btn btn-primary btn-lg form-submit" :disabled="submitting" @click="handleRegister">{{ btnText }}</button>
      <div class="form-footer">Already have an account? <router-link to="/login">Login!</router-link></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { authService } from '../services/AuthService.js'

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)
const btnText = ref('🌟 Create Account')

async function handleRegister() {
  error.value = ''
  success.value = ''
  const u = username.value.trim()
  const e = email.value.trim()
  if (!u || !e || !password.value || !confirmPassword.value) {
    error.value = 'Please fill in all fields!'
    return
  }
  if (u.length < 3) {
    error.value = 'Username must be at least 3 characters!'
    return
  }
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters!'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match!'
    return
  }
  submitting.value = true
  btnText.value = '🌟 Creating account...'
  try {
    await authService.register(e, password.value, u)
    success.value = true
    btnText.value = '✅ Account Created!'
  } catch (err) {
    error.value = err.message || 'Registration failed.'
    btnText.value = '🌟 Create Account'
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
// RegisterPage has no styling of its own yet — it's fully covered by the
// shared page-wrap/form-card classes in assets/scss/globals.scss.
</style>
