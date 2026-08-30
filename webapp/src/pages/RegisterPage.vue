<template>
  <AuthLanding beta-label="Join the Beta · 100% Free">
    <div class="form-card landing-v2-card">
      <h2 style="margin-bottom:4px;">Create Your Account</h2>
      <p class="form-subtitle">Already a tester? <router-link to="/login">Login here!</router-link></p>
      <div class="alert alert-error" :class="{ show: error }">{{ error }}</div>
      <div class="alert alert-success" :class="{ show: success }">
        <template v-if="success">Account created! 🎉<br /><small>Now <router-link to="/login">login here</router-link>
            to start playing!</small></template>
      </div>
      <div class="form-group"><label>Username</label><input type="text" v-model="username"
          placeholder="CoolPetTrainer123" minlength="2" maxlength="30" @keydown.enter="handleRegister" /></div>
      <div class="form-group"><label>Email Address</label><input type="email" v-model="email"
          placeholder="your@email.com" autocomplete="email" @keydown.enter="handleRegister" /></div>
      <div class="form-group"><label>Password</label><input type="password" v-model="password"
          placeholder="At least 6 characters" autocomplete="new-password" @keydown.enter="handleRegister" /></div>
      <div class="form-group"><label>Confirm Password</label><input type="password" v-model="confirmPassword"
          placeholder="••••••••" @keydown.enter="handleRegister" /></div>

      <div class="form-group">
        <label>Date of Birth <span style="color:#ff9f43;font-size:0.8rem;">* Required</span></label>
        <input type="date" v-model="dob" :max="todayStr"
          style="width:100%;padding:10px 12px;border:2px solid var(--border);border-radius:10px;font-size:1rem;background:var(--card-bg);color:var(--text);" />
        <div style="font-size:0.75rem;color:var(--text-light);margin-top:4px;">You must be 13 or older to register. By
          providing your date of birth you confirm you meet this requirement.</div>
      </div>

      <div
        style="margin:12px 0;padding:12px;background:rgba(153,102,255,0.08);border-radius:10px;border:1px solid rgba(153,102,255,0.2);">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:0.88rem;line-height:1.5;">
          <input type="checkbox" v-model="termsAccepted"
            style="margin-top:3px;width:18px;height:18px;flex-shrink:0;accent-color:var(--purple);" />
          <!-- Legacy opened the policy in a modal cloning #section-privacy
               (showPrivacyModal). With Privacy as a real route, a link to it
               is the same affordance without duplicating the document. -->
          <span>I have read and agree to the
            <router-link to="/privacy" target="_blank" style="color:var(--purple);">Privacy Policy</router-link>.
            I confirm that I am 13 years of age or older, or that I have
            parental consent to create this account. I understand this is a beta and game data may be reset before full
            launch.</span>
        </label>
      </div>

      <button class="btn btn-primary btn-lg form-submit" :disabled="submitting" @click="handleRegister">{{ btnText
        }}</button>
    </div>

    <template #info>
      <div class="landing-v2-tagline">
        Your companion is already waiting.<br />
        <strong>What will you name them?</strong>
        <span>Choose from 8+ unique pets, each based on real members of the PawketPetsVT streaming team, and
          growing!</span>
      </div>

      <div class="landing-v2-perks">
        <div v-for="p in PERKS" :key="p.text" class="landing-v2-perk">
          {{ p.icon }} <strong>{{ p.text }}</strong>
        </div>
      </div>

      <div class="landing-v2-lore">
        <span class="landing-v2-lore-label">// BETA TESTER NOTE //</span>
        <p>Installation complete. Your tester profile has been initialized. A companion has been assigned to your
          session and is ready for adoption.</p>
        <p class="landing-v2-lore-fine">We ask that you report any anomalies during your session. Previous testers did
          not always do so.</p>
      </div>
    </template>
  </AuthLanding>
</template>

<script setup>
import { ref } from 'vue'
import { authService } from '../services/AuthService.js'
import AuthLanding from '../components/AuthLanding.vue'

// Copy ported verbatim from the legacy register landing (index.html:1381-1388).
const PERKS = [
  { icon: '🐣', text: 'First pet is always free' },
  { icon: '📺', text: 'Earn PP by watching Twitch streams' },
  { icon: '🔥', text: 'Daily login streak rewards + Skin Keys' },
  { icon: '⚔️', text: 'Battle, race, explore & join guilds' },
  { icon: '🎮', text: 'Daily minigames & bingo cards' },
  { icon: '✨', text: '100% free, no download needed' }
]

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const dob = ref('')
const termsAccepted = ref(false)
const error = ref('')
const success = ref('')
const submitting = ref(false)
const btnText = ref('🌟 Create Account')
const todayStr = new Date().toISOString().split('T')[0]

async function handleRegister() {
  error.value = ''
  success.value = ''
  const u = username.value.trim()
  const e = email.value.trim()
  if (!u || !e || !password.value || !confirmPassword.value) {
    error.value = 'Please fill in all fields!'
    return
  }
  if (u.length < 2) {
    error.value = 'Username must be at least 2 characters!'
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
  // Date of birth validation (COPPA — must be 13+)
  if (!dob.value) {
    error.value = 'Please enter your date of birth.'
    return
  }
  const dobDate = new Date(dob.value)
  const today = new Date()
  const age = today.getFullYear() - dobDate.getFullYear() -
    (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate()) ? 1 : 0)
  if (isNaN(age) || age < 13) {
    error.value = 'You must be at least 13 years old to register. If you are under 13, please ask a parent or guardian to contact us.'
    return
  }
  if (!termsAccepted.value) {
    error.value = 'Please agree to the Privacy Policy to continue.'
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
// RegisterPage has no styling of its own — the auth pages sit outside AppShell
// and are covered by the `.form-card` / `.landing-v2-*` rules in style.css.
</style>
