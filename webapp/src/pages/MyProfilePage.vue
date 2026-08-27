<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">👤 ✦ 👤</div>
      <h1>My Profile</h1>
      <p>Customize how the rest of Pawket Pets sees you! ✨</p>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else-if="profile">
      <ProfileHeader :profile="profile" own />
      <ProfileStatCards :profile="profile" :badge-count="earnedCount" />

      <div class="mt-3">
        <router-link class="btn btn-outline btn-sm" :to="'/profile/' + encodeURIComponent(profile.username)">
          👁️ View My Public Profile
        </router-link>
      </div>

      <h2 class="mp-section-title">✏️ Edit Profile</h2>
      <div class="mp-form d-flex flex-column gap-1">
        <label class="mp-label mt-2" for="mp-username">Username</label>
        <input id="mp-username" v-model="usernameDraft" class="mp-input px-3 py-2 rounded-3" type="text" minlength="2" maxlength="30" />
        <div class="mp-help">Letters, numbers, and underscores only. Max 30 characters.</div>

        <label class="mp-label mt-2" for="mp-bio">Bio</label>
        <textarea id="mp-bio" v-model="bioDraft" class="mp-input px-3 py-2 rounded-3" rows="3" maxlength="200"></textarea>
        <div class="mp-help">{{ bioDraft.length }} / 200</div>

        <div v-if="saveError" class="mp-error my-2 px-3 py-2 rounded-3">{{ saveError }}</div>
        <button class="btn btn-primary align-self-start" :disabled="saving" @click="save">
          {{ saving ? '⏳ Saving...' : '💾 Save Profile' }}
        </button>
      </div>

      <h2 class="mp-section-title">👑 Your Account Title</h2>
      <p class="mp-help">This title displays on your profile and shows your account-wide achievements!</p>
      <select v-model="activeTitleId" class="mp-input d-block px-3 py-2 rounded-3" @change="changeTitle">
        <option value="">No Title</option>
        <option v-for="t in titles" :key="t.id" :value="t.id" :disabled="!t.unlocked">
          {{ t.unlocked ? t.icon + ' ' + t.display_name + ' (' + t.rarity + ')' : '🔒 ??? - ' + t.unlock_condition }}
        </option>
      </select>

      <h2 class="mp-section-title">🎮 Discord</h2>
      <div class="d-flex flex-column align-items-start gap-2">
        <div v-if="discordLinked" class="mp-discord-status">✅ Linked</div>
        <template v-else>
          <div class="mp-discord-status">Not linked yet. Generate a code below and use <strong>/link</strong> in
            Discord.</div>
          <button class="btn btn-outline btn-sm" :disabled="generatingCode" @click="generateDiscordCode">
            {{ generatingCode ? 'Generating...' : '🔗 Generate Link Code' }}
          </button>
          <div v-if="discordCode" class="mp-discord-code d-flex align-items-center gap-3 px-3 py-2 rounded-3">
            <span class="mp-discord-code-value">{{ discordCode }}</span>
            <span class="mp-discord-code-note">Expires in 10 minutes</span>
          </div>
        </template>
      </div>

      <CosmeticsPanel :equipped="profile.equipped" :unlocked="unlockedCosmetics" @update="saveCosmetics" />

      <h2 class="mp-section-title">🎖️ Badges</h2>
      <BadgeGrid :badges="allBadges" empty-text="No badges available yet!" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { supabase } from '../services/SupabaseService.js'
import { profileService } from '../services/ProfileService.js'
import { toastService } from '../services/ToastService.js'
import ProfileHeader from '../components/profile/ProfileHeader.vue'
import ProfileStatCards from '../components/profile/ProfileStatCards.vue'
import BadgeGrid from '../components/profile/BadgeGrid.vue'
import CosmeticsPanel from '../components/profile/CosmeticsPanel.vue'

const loading = ref(true)
const profile = ref(null)
const usernameDraft = ref('')
const bioDraft = ref('')
const saving = ref(false)
const saveError = ref('')
const titles = ref([])
const activeTitleId = ref('')
const allBadges = ref([])
const discordLinked = ref(false)
const discordCode = ref('')
const generatingCode = ref(false)

// Cosmetic unlock state lives in a system that isn't migrated yet (game.js's
// phase1_state.unlockedBackgrounds/Frames/Badges) — until it is, only the
// alwaysUnlocked catalog entries are equippable, which profileService.isOwned
// handles on its own. Graceful degradation, same pattern as Phase 4's
// weather-gated fish.
const unlockedCosmetics = ref({ backgrounds: [], frames: [], badges: [] })

const earnedCount = computed(() => allBadges.value.filter(b => b.earned).length)

async function load() {
  loading.value = true
  const userId = AppState.user.id
  try {
    profile.value = await profileService.loadMyProfile(userId)
    usernameDraft.value = profile.value.username
    bioDraft.value = profile.value.bio
    discordLinked.value = !!(AppState.player && AppState.player.discord_id)

    const [titleData, badgeData] = await Promise.all([
      profileService.loadTitleOptions(userId),
      profileService.loadAllBadgesWithProgress(userId)
    ])
    titles.value = titleData.titles
    activeTitleId.value = titleData.activeId
    allBadges.value = badgeData
  } catch (err) {
    toastService.error(err.message)
  }
  loading.value = false
}

async function save() {
  saving.value = true
  saveError.value = ''
  try {
    await profileService.saveProfile(AppState.user.id, usernameDraft.value, bioDraft.value, profile.value.username)
    profile.value.username = usernameDraft.value.trim()
    profile.value.bio = bioDraft.value.trim()
    toastService.success('✅ Profile saved successfully!')
  } catch (err) {
    saveError.value = err.message
  }
  saving.value = false
}

async function changeTitle() {
  try {
    await profileService.setActiveTitle(AppState.user.id, activeTitleId.value)
    await load()
    toastService.success(activeTitleId.value ? '✅ Title equipped!' : 'Title removed')
  } catch (err) {
    toastService.error('Failed to equip title')
  }
}

async function saveCosmetics(next) {
  const previous = profile.value.equipped
  profile.value.equipped = next
  try {
    await profileService.saveEquipped(AppState.user.id, next)
  } catch (err) {
    profile.value.equipped = previous
    toastService.error('Could not save cosmetics')
  }
}

async function generateDiscordCode() {
  generatingCode.value = true
  try {
    const res = await supabase.rpc('generate_discord_link_code')
    if (res.error || !res.data || res.data.error) {
      toastService.error(res.data && res.data.error ? res.data.error : 'Could not generate a code')
    } else {
      discordCode.value = res.data.code
    }
  } catch (err) {
    toastService.error('Could not generate a code')
  }
  generatingCode.value = false
}

onMounted(load)
</script>

<style lang="scss" scoped>

// Layout via Bootstrap utilities in the template; visuals only here.
.mp-section-title {
  font-size: 1.15rem;
  color: var(--purple-dark);
  margin: 24px 0 8px;
}

.mp-form {
  max-width: 480px;
}

.mp-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--purple-dark);
}

.mp-input {
  width: 100%;
  max-width: 480px;
  border: 1px solid var(--border);
  font-size: 0.85rem;
  font-family: inherit;
}

.mp-help {
  font-size: 0.72rem;
  color: var(--text-light);
}

.mp-error {
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid rgba(255, 77, 77, 0.3);
  color: #d63031;
  font-size: 0.82rem;
}

.mp-discord-status {
  font-size: 0.85rem;
  color: var(--text-light);
}

.mp-discord-code {
  border: 1px dashed var(--purple);
  background: rgba(153, 102, 255, 0.06);
}

.mp-discord-code-value {
  font-family: monospace;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--purple-dark);
}

.mp-discord-code-note {
  font-size: 0.7rem;
  color: var(--text-light);
}
</style>
