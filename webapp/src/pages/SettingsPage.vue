<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="page-hero">
      <div class="sparkle-row">⚙️ ✦ ⚙️</div>
      <h1>Settings</h1>
      <p>Customize your experience</p>
    </div>

    <div class="settings-col mx-auto my-5">
      <div class="setting-row d-flex align-items-center justify-content-between gap-3">
        <div class="setting-label"><strong>👻 Spooky Content</strong></div>
        <label class="pp-toggle">
          <input type="checkbox" v-model="settingsState.spooky_enabled" @change="save" />
          <span class="pp-toggle-track"></span>
        </label>
      </div>

      <div class="setting-row d-flex align-items-center justify-content-between gap-3">
        <div class="setting-label"><strong>🎵 Music</strong></div>
        <label class="pp-toggle">
          <input type="checkbox" :checked="musicState.enabled" @change="onMusicEnabledChange" />
          <span class="pp-toggle-track"></span>
        </label>
      </div>

      <div class="setting-row d-flex align-items-center justify-content-between gap-3">
        <div class="setting-label"><strong>🎼 Music Volume</strong></div>
        <div class="d-flex align-items-center gap-2">
          <input class="pp-range" type="range" min="0" max="100" :value="musicState.volume" @change="onMusicVolumeChange" />
          <span class="setting-value">{{ musicState.volume }}%</span>
        </div>
      </div>

      <div class="setting-row d-flex align-items-center justify-content-between gap-3">
        <div class="setting-label"><strong>🔊 Sound Effects Volume</strong></div>
        <div class="d-flex align-items-center gap-2">
          <input class="pp-range" type="range" min="0" max="100" v-model.number="settingsState.sfx_volume" @change="save" />
          <span class="setting-value">{{ settingsState.sfx_volume }}%</span>
        </div>
      </div>

      <div class="setting-row d-flex align-items-center justify-content-between gap-3">
        <div class="setting-label"><strong>🌙 Day/Night Effects</strong></div>
        <label class="pp-toggle">
          <input type="checkbox" v-model="settingsState.daynight_enabled" @change="save" />
          <span class="pp-toggle-track"></span>
        </label>
      </div>

      <div class="setting-row d-flex align-items-center justify-content-between gap-3">
        <div class="setting-label"><strong>🌦️ Weather Effects</strong></div>
        <label class="pp-toggle">
          <input type="checkbox" v-model="settingsState.weather_enabled" @change="save" />
          <span class="pp-toggle-track"></span>
        </label>
      </div>

      <!-- `border-0`: this is the last row before a section, so the section's
           own solid rule serves as its divider — a dashed line here too would
           read as a double separator with dead space between them. -->
      <div class="setting-row border-0 pb-0">
        <div class="setting-label"><strong>🎓 Tutorial</strong></div>
        <div class="setting-help mb-3">Replay Melon's guide. No extra PP awarded on replay.</div>
        <button class="btn btn-outline btn-tutorial" @click="toastService.info('Tutorial replay isn\'t available in this version yet.')">🍈 Replay Tutorial</button>
      </div>

      <section class="settings-section mt-3 pt-4">
        <h3 class="settings-heading mb-1">🎨 UI Themes</h3>
        <p class="setting-help mb-3">Choose a theme for the site. Unlock more through achievements and the PawketPass!</p>
        <!-- Was `.theme-selector-grid` (auto-fill minmax 120px, 12px gap).
             No `h-100` on the swatch: locked entries carry an extra unlock
             hint, and stretching every card to match the tallest left blank
             space and a bordered gap under the shorter ones. -->
        <div class="row row-cols-3 row-cols-md-4 row-cols-lg-6 g-tight">
          <div v-for="t in THEME_CATALOG" :key="t.id" class="col">
            <div
              class="theme-swatch"
              :class="{ active: activeTheme === t.id, locked: !themeService.isUnlocked(t.id) }"
              @click="applyTheme(t)"
            >
              <div class="theme-swatch-preview d-flex align-items-center justify-content-center" :style="{ background: 'linear-gradient(135deg,' + t.colors[0] + ',' + t.colors[1] + ')' }">{{ t.emoji }}</div>
              <div class="theme-swatch-label">{{ t.name }}</div>
              <template v-if="!themeService.isUnlocked(t.id)">
                <div class="theme-swatch-hint">{{ t.unlockHint }}</div>
                <div class="theme-swatch-lock">🔒</div>
              </template>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-section mt-3 pt-4">
        <h3 class="settings-heading mb-3">♿ Accessibility</h3>

        <div class="setting-row">
          <label class="setting-label d-block mb-2" for="cb-mode">Colorblind Mode</label>
          <select id="cb-mode" v-model="settingsState.colorblind_mode" class="pp-select w-100" @change="onAccessibilityChange">
            <option value="none">None (Default)</option>
            <option value="deuteranopia">Deuteranopia (Red-Green)</option>
            <option value="protanopia">Protanopia (Red Blind)</option>
            <option value="tritanopia">Tritanopia (Blue-Yellow)</option>
          </select>
        </div>

        <div
          v-for="a in ACCESSIBILITY_TOGGLES"
          :key="a.key"
          class="setting-row d-flex align-items-center justify-content-between gap-3"
        >
          <div>
            <div class="setting-label"><strong>{{ a.label }}</strong></div>
            <div class="setting-help">{{ a.help }}</div>
          </div>
          <label class="pp-toggle">
            <input type="checkbox" v-model="settingsState[a.key]" @change="onAccessibilityChange" />
            <span class="pp-toggle-track"></span>
          </label>
        </div>
      </section>

      <!-- Legacy placed the admin block here, between the settings sections and
           Invite Friends, revealed by isAdmin() from showApp(). -->
      <AdminTools />

      <section class="settings-section mt-3 pt-4 text-center">
        <h3 class="settings-heading mb-2">💰 Invite Friends</h3>
        <p class="setting-help mb-3">Earn {{ REFERRER_PP }} PP for each friend who adopts their first pet!</p>
        <button class="btn btn-primary btn-referral" @click="openReferralModal">📤 Get Referral Link</button>
      </section>
    </div>

    <div class="modal-overlay" :class="{ show: referral }">
      <div class="modal referral-modal p-gap" v-if="referral">
        <h2 class="settings-heading text-center mb-3">💰 Refer Friends!</h2>
        <!-- Reads the same constant as the Home referral card. These used to
             disagree (250 here, 200 there) — see the note in referralData.js. -->
        <p class="setting-help text-center mb-3">Invite friends and earn <strong>{{ REFERRER_PP }} PP</strong> for each friend who adopts their first pet!</p>
        <div class="referral-stat text-center p-3 mb-3 rounded-3">
          <div class="referral-count">{{ referral.count }}</div>
          <div class="setting-help">Friends Referred</div>
          <div class="referral-earned mt-1">🪙 {{ referral.count * REFERRER_PP }} PP Earned</div>
        </div>
        <div class="fw-bold mb-2">Your Referral Link:</div>
        <input :value="referral.link" readonly class="pp-select referral-link w-100 mb-3" @click="$event.target.select()" />
        <button class="btn btn-primary w-100 mb-2" @click="copyReferralLink">📋 Copy Link</button>
        <button class="btn btn-secondary w-100" @click="referral = null">Close</button>
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
import { REFERRER_PP } from '../data/referralData.js'
import { toastService } from '../services/ToastService.js'
import AdminTools from '../components/admin/AdminTools.vue'
import { THEME_CATALOG } from '../data/themeCatalog.js'

// The three accessibility toggles were three near-identical markup blocks;
// driving them from data keeps them in lockstep.
const ACCESSIBILITY_TOGGLES = [
  { key: 'reduced_motion', label: 'Reduced Motion', help: 'Disables animations and transitions' },
  { key: 'high_contrast', label: 'High Contrast', help: 'Increases text and border contrast' },
  { key: 'large_text', label: 'Larger Text', help: 'Increases base font size across the game' }
]

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

<style lang="scss" scoped>
// Layout comes from Bootstrap utilities in the template. What lives here is
// the theming Bootstrap can't provide: the site's own toggle switch and range
// slider, which replace the raw browser controls this page was rendering.
// (The legacy `.toggle-switch`/`.toggle-slider` styling never made it into the
// root style.css — only its night-mode overrides did — so these controls had
// been unstyled since the shell was ported.)
.settings-col {
  max-width: 560px;
}

.setting-row {
  padding: 14px 0;
  border-bottom: 1px dashed rgba(153, 102, 255, 0.25);

  &:last-child {
    border-bottom: none;
  }
}

.setting-label {
  font-size: 0.95rem;
}

.setting-help {
  font-size: 0.85rem;
  color: var(--text-light);
}

.setting-value {
  min-width: 44px;
  font-weight: 700;
  color: var(--purple-dark);
}

.settings-section {
  border-top: 2px solid var(--border);
}

.settings-heading {
  color: var(--purple);
}

// Sits directly under its help text, so the default button margin would read
// as a gap in the wrong place; the row's own padding supplies the spacing below.
.btn-tutorial {
  border-color: var(--purple);
  color: var(--purple);
}

// ── Themed toggle switch ───────────────────────────────────────────────────
.pp-toggle {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  width: 52px;
  height: 28px;
  cursor: pointer;

  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
}

.pp-toggle-track {
  position: absolute;
  inset: 0;
  background: rgba(153, 102, 255, 0.25);
  border: 2px solid var(--border);
  border-radius: 999px;
  transition: background 0.2s, border-color 0.2s;

  &::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: var(--white);
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
    transition: transform 0.2s;
  }
}

.pp-toggle input:checked + .pp-toggle-track {
  background: linear-gradient(135deg, var(--purple), var(--pink));
  border-color: var(--purple);

  &::before {
    transform: translateX(24px);
  }
}

.pp-toggle input:focus-visible + .pp-toggle-track {
  outline: 2px solid var(--purple-dark);
  outline-offset: 2px;
}

// ── Themed range slider ────────────────────────────────────────────────────
// Track and thumb must be declared per-engine; these cannot be combined into
// one selector list, because an unknown pseudo-element invalidates the whole
// rule in every browser that does not recognise it.
.pp-range {
  width: 150px;
  height: 8px;
  padding: 0;
  border-radius: 999px;
  background: rgba(153, 102, 255, 0.25);
  border: 1px solid var(--border);
  appearance: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--purple), var(--pink));
    border: 2px solid var(--white);
    box-shadow: 0 2px 5px var(--shadow);
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--purple), var(--pink));
    border: 2px solid var(--white);
    box-shadow: 0 2px 5px var(--shadow);
    cursor: pointer;
  }
}

.pp-select {
  padding: 8px 12px;
  border: 2px solid var(--border);
  border-radius: 10px;
  font-size: 1rem;
  font-family: inherit;
  background: var(--card-bg);
  color: var(--text);
}

// The swatch emoji sized here rather than inline (Bootstrap's `fs-*` scale has
// no 1.6rem step).
.theme-swatch-preview {
  font-size: 1.6rem;
}

.btn-referral {
  background: linear-gradient(135deg, #9966ff 0%, #ff66cc 100%);
}

.referral-modal {
  max-width: 500px;
}

.referral-stat {
  background: rgba(153, 102, 255, 0.1);
}

.referral-count {
  font-size: 2rem;
  color: var(--purple);
  font-weight: 700;
}

.referral-earned {
  color: var(--purple);
}

.referral-link {
  font-family: monospace;
  border-color: var(--purple);
}
</style>
