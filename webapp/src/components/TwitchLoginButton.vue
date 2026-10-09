<template>
  <!-- One button for both auth pages: Supabase signs an existing Twitch user in
       and creates the account on a first visit, so "log in" and "sign up" are
       the same action. A Twitch-made account has no password; Twitch is how
       its owner gets back in. -->
  <div class="mt-3">
    <div class="tw-login-or d-flex align-items-center gap-px10 mb-3"><span>or</span></div>
    <button class="tw-login-btn w-100 d-flex align-items-center justify-content-center gap-2" :disabled="busy"
      @click="go">
      <TwitchLogo /> {{ busy ? 'Opening Twitch…' : 'Log In With Twitch' }}
    </button>
    <!-- The register form's own consent checkbox can't gate this button (the
         account is created on Twitch's return), so consent is given here.
         Twitch's own minimum age is 13, which covers the form's age check. -->
    <p class="tw-login-note text-center mt-2 mb-0">
      New here? This creates your account and links your Twitch for chat rewards.
      By continuing you agree to the <router-link to="/privacy" target="_blank">Privacy Policy</router-link>
      and confirm you are 13 or older.
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { authService } from '../services/AuthService.js'
import { toastService } from '../services/ToastService.js'
import TwitchLogo from './TwitchLogo.vue'

const busy = ref(false)

async function go() {
  busy.value = true
  try {
    await authService.signInWithTwitch()
  } catch (e) {
    toastService.error(e.message)
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
.tw-login-or {
  color: var(--text-light);
  font-size: 0.8rem;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
}

// Twitch's purple, matching the Twitch page's own buttons.
.tw-login-btn {
  font-family: 'Chewy', cursive;
  font-size: 1.1rem;
  padding: 12px 20px;
  border-radius: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, #9146ff, #772ce8);
  color: var(--white);
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(145, 70, 255, 0.35);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 26px rgba(145, 70, 255, 0.45);
  }

  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
}

.tw-login-note {
  font-size: 0.75rem;
  color: var(--text-light);
  line-height: 1.5;
}
</style>
