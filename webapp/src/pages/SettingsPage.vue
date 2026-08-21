<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">⚙️ ✦ ⚙️</div>
      <h1>Settings</h1>
      <p>Customize your experience</p>
    </div>

    <div style="max-width: 500px; margin: 40px auto;">
      <div class="settings-modal-item">
        <div class="settings-modal-label"><strong>👻 Spooky Content</strong></div>
        <label class="toggle-switch">
          <input type="checkbox" v-model="settingsState.spooky_enabled" @change="save" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="settings-modal-item" style="margin-top: 15px;">
        <div class="settings-modal-label"><strong>🎵 Music</strong></div>
        <label class="toggle-switch">
          <input type="checkbox" :checked="musicState.enabled" @change="onMusicEnabledChange" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="settings-modal-item" style="margin-top: 15px;">
        <div class="settings-modal-label"><strong>🎼 Music Volume</strong></div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="range" min="0" max="100" style="width: 150px;" :value="musicState.volume" @change="onMusicVolumeChange" />
          <span style="min-width: 40px; font-weight: bold;">{{ musicState.volume }}%</span>
        </div>
      </div>

      <div class="settings-modal-item" style="margin-top: 15px;">
        <div class="settings-modal-label"><strong>🔊 Sound Effects Volume</strong></div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="range" min="0" max="100" style="width: 150px;" v-model.number="settingsState.sfx_volume" @change="save" />
          <span style="min-width: 40px; font-weight: bold;">{{ settingsState.sfx_volume }}%</span>
        </div>
      </div>

      <div class="settings-modal-item" style="margin-top: 15px;">
        <div class="settings-modal-label"><strong>🌙 Day/Night Effects</strong></div>
        <label class="toggle-switch">
          <input type="checkbox" v-model="settingsState.daynight_enabled" @change="save" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="settings-modal-item" style="margin-top: 15px;">
        <div class="settings-modal-label"><strong>🌦️ Weather Effects</strong></div>
        <label class="toggle-switch">
          <input type="checkbox" v-model="settingsState.weather_enabled" @change="save" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="settings-modal-item" style="margin-top:15px;flex-direction:column;align-items:flex-start;gap:10px;">
        <div>
          <strong>🎓 Tutorial</strong>
          <div style="font-size:0.85rem;color:var(--text-light);margin-top:4px;">Replay Melon's guide. No extra PP awarded on replay.</div>
        </div>
        <button class="btn btn-outline" style="border-color:var(--purple);color:var(--purple);" @click="toastService.info('Tutorial replay isn\'t available in this version yet.')">🍈 Replay Tutorial</button>
      </div>

      <div style="margin-top:30px;padding-top:24px;border-top:2px solid var(--border);">
        <h3 style="color:var(--purple);margin-bottom:6px;">🎨 UI Themes</h3>
        <p style="color:var(--text-light);font-size:0.88rem;margin-bottom:12px;">Choose a theme for the site. Unlock more through achievements and the PawketPass!</p>
        <div class="theme-selector-grid">
          <div
            v-for="t in THEME_CATALOG" :key="t.id"
            class="theme-swatch" :class="{ active: activeTheme === t.id, locked: !themeService.isUnlocked(t.id) }"
            @click="applyTheme(t)"
          >
            <div class="theme-swatch-preview" :style="{ background: 'linear-gradient(135deg,' + t.colors[0] + ',' + t.colors[1] + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }">{{ t.emoji }}</div>
            <div class="theme-swatch-label">{{ t.name }}</div>
            <template v-if="!themeService.isUnlocked(t.id)">
              <div class="theme-swatch-hint">{{ t.unlockHint }}</div>
              <div class="theme-swatch-lock">🔒</div>
            </template>
          </div>
        </div>

        <div class="settings-group" style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border);">
          <h3 style="margin-bottom:14px;color:var(--purple-dark);">♿ Accessibility</h3>
          <div class="setting-row" style="margin-bottom:14px;">
            <label style="font-weight:600;margin-bottom:6px;display:block;">Colorblind Mode</label>
            <select v-model="settingsState.colorblind_mode" @change="onAccessibilityChange" style="width:100%;padding:8px 12px;border:2px solid var(--border);border-radius:10px;font-size:1rem;background:var(--card-bg);color:var(--text);">
              <option value="none">None (Default)</option>
              <option value="deuteranopia">Deuteranopia (Red-Green)</option>
              <option value="protanopia">Protanopia (Red Blind)</option>
              <option value="tritanopia">Tritanopia (Blue-Yellow)</option>
            </select>
          </div>
          <div class="setting-row" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
            <div><div style="font-weight:600;">Reduced Motion</div><div style="font-size:0.8rem;color:var(--text-light);">Disables animations and transitions</div></div>
            <label class="toggle-switch"><input type="checkbox" v-model="settingsState.reduced_motion" @change="onAccessibilityChange" /><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
            <div><div style="font-weight:600;">High Contrast</div><div style="font-size:0.8rem;color:var(--text-light);">Increases text and border contrast</div></div>
            <label class="toggle-switch"><input type="checkbox" v-model="settingsState.high_contrast" @change="onAccessibilityChange" /><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
            <div><div style="font-weight:600;">Larger Text</div><div style="font-size:0.8rem;color:var(--text-light);">Increases base font size across the game</div></div>
            <label class="toggle-switch"><input type="checkbox" v-model="settingsState.large_text" @change="onAccessibilityChange" /><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <div style="margin-top:40px;padding-top:30px;border-top:2px solid var(--border);">
        <h3 style="text-align:center;color:var(--purple);margin-bottom:15px;">💰 Invite Friends</h3>
        <p style="text-align:center;color:var(--text-light);margin-bottom:20px;">Earn 250 PP for each friend who adopts their first pet!</p>
        <button class="btn btn-primary" style="display:block;margin:0 auto;background:linear-gradient(135deg,#9966ff 0%,#ff66cc 100%);" @click="openReferralModal">📤 Get Referral Link</button>
      </div>
    </div>

    <div class="modal-overlay" :class="{ show: referral }">
      <div class="modal" v-if="referral" style="padding:20px;max-width:500px;">
        <h2 style="text-align:center;color:var(--purple);margin-bottom:15px;">💰 Refer Friends!</h2>
        <p style="text-align:center;margin-bottom:20px;color:var(--text-light);">Invite friends and earn <strong>250 PP</strong> for each friend who adopts their first pet!</p>
        <div style="text-align:center;background:rgba(153,102,255,0.1);padding:15px;border-radius:12px;margin-bottom:20px;">
          <div style="font-size:2rem;color:var(--purple);font-weight:bold;">{{ referral.count }}</div>
          <div style="color:var(--text-light);">Friends Referred</div>
          <div style="color:var(--purple);margin-top:5px;">🪙 {{ referral.count * 250 }} PP Earned</div>
        </div>
        <div style="font-weight:bold;margin-bottom:8px;">Your Referral Link:</div>
        <input :value="referral.link" readonly style="width:100%;padding:10px;border:2px solid var(--purple);border-radius:8px;font-family:monospace;margin-bottom:15px;" @click="$event.target.select()" />
        <button class="btn btn-primary" style="width:100%;margin-bottom:10px;" @click="copyReferralLink">📋 Copy Link</button>
        <button class="btn btn-secondary" style="width:100%;" @click="referral = null">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { settingsService, settingsState } from '../services/SettingsService.js'
import { musicService, musicState } from '../services/MusicService.js'
import { themeService } from '../services/ThemeService.js'
import { referralService } from '../services/ReferralService.js'
import { toastService } from '../services/ToastService.js'
import { THEME_CATALOG } from '../data/themeCatalog.js'

const activeTheme = ref('classic')
const referral = ref(null)

function save() {
  settingsService.save(AppState.user.id)
}

function onMusicEnabledChange(e) {
  musicService.setEnabled(e.target.checked)
  save()
}

function onMusicVolumeChange(e) {
  musicService.setVolume(e.target.valueAsNumber)
  save()
}

function onAccessibilityChange() {
  settingsService.applyAccessibility()
  save()
}

function applyTheme(t) {
  if (!themeService.isUnlocked(t.id)) {
    toastService.warning('🔒 Theme not unlocked yet!')
    return
  }
  themeService.apply(t.id, toastService)
  activeTheme.value = t.id
}

async function openReferralModal() {
  try {
    referral.value = await referralService.getOrCreateReferral(AppState.user.id)
  } catch (err) {
    toastService.error('Failed to load referral info!')
  }
}

function copyReferralLink() {
  navigator.clipboard.writeText(referral.value.link).then(() => {
    toastService.success('Referral link copied!')
  })
}

onMounted(async () => {
  await settingsService.load(AppState.user.id)
  activeTheme.value = themeService.loadSaved()
})
</script>
