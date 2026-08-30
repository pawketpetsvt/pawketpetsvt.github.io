<template>
  <div class="gd-member">
    <div class="text-center mb-4">
      <div class="gd-hero-emblem">{{ g.emblem_emoji || '🏛️' }}</div>
      <div class="gd-hero-name">
        {{ g.name }} <span class="gd-hero-tag">[{{ g.tag || '???' }}]</span>
      </div>
      <div class="gd-hero-meta">
        Level {{ g.guild_level || 1 }} · {{ guildState.members.length }}/{{ GUILD_MAX_MEMBERS }} members ·
        Treasury: 🪙{{ (g.guild_treasury || 0).toLocaleString() }} PP · 🏅 {{ g.guild_tokens || 0 }} Tokens
      </div>
      <div v-if="g.description && !editingBio" class="gd-hero-desc mt-px6">"{{ g.description }}"</div>

      <!-- Ports the guild bio editor (guild_saveBio / #guild-bio-edit,
           main:23626). GuildService.saveBio() was ported in Phase 9 but nothing
           ever called it, so the leader had no way to write a bio. -->
      <div v-if="editingBio" class="gd-bio-edit">
        <textarea v-model="bioDraft" maxlength="200" class="gd-bio-input w-100 rounded-1 py-px6 px-2"
          placeholder="Tell people what your guild is about…"></textarea>
        <div class="d-flex gap-2 mt-1">
          <button class="btn btn-primary btn-sm" :disabled="savingBio" @click="saveBio">Save</button>
          <button class="btn btn-outline btn-sm" @click="editingBio = false">Cancel</button>
        </div>
      </div>
      <button v-else-if="guildService.isLeader" class="gd-bio-btn" @click="startBio">
        {{ g.description ? '✏️ Edit guild bio' : '✏️ Add a guild bio' }}
      </button>
    </div>

    <!-- Active treasury perks, shown to every member -->
    <div v-if="activePerks.length" class="gd-perks rounded-2 py-px10 px-tight mb-px14">
      <div class="gd-perks-title mb-px6">✨ Active Guild Perks</div>
      <div v-for="p in activePerks" :key="p.type" class="gd-perk-row">
        {{ PERK_LABELS[p.type] || p.type }} · {{ remaining(p) }} remaining
      </div>
    </div>

    <div class="mb-3">
      <div class="d-flex justify-content-between gd-xp-label">
        <span>Guild XP</span><span>{{ g.guild_xp || 0 }}/{{ xpNeeded }}</span>
      </div>
      <div class="gd-xp-track rounded-5 overflow-hidden"><div class="gd-xp-fill h-100 rounded-5" :style="{ width: xpPct + '%' }"></div></div>
    </div>

    <!-- Guild pet (liaison) -->
    <div class="gd-liaison rounded-3 p-px14 my-3 mx-0">
      <div class="gd-liaison-title mb-px10">🏛️ Your Guild Pet</div>
      <div v-if="myLiaison && myLiaison.user_pets" class="gd-liaison-current mb-2">
        Current: {{ myLiaison.user_pets.nickname || 'Pet' }} Lv.{{ myLiaison.user_pets.level || 1 }}
      </div>
      <div v-else class="gd-liaison-none mb-2">No guild pet set!</div>

      <template v-if="eligiblePets.length">
        <select v-model="liaisonChoice" class="gd-select w-100 p-2 rounded-1 mb-2">
          <option value="">-- Choose a pet --</option>
          <option v-for="p in eligiblePets" :key="p.id" :value="p.id">
            {{ p.nickname || 'Pet' }} Lv.{{ p.level || 1 }}
          </option>
        </select>
        <button class="btn btn-primary btn-sm w-100" :disabled="!liaisonChoice" @click="setLiaison">
          Set Guild Pet
        </button>
      </template>
      <div v-else class="gd-liaison-hint">
        Need a level {{ GUILD_MIN_PET_LEVEL }}+ pet to set as guild liaison.
      </div>
    </div>

    <!-- Roster -->
    <div class="gd-section-title mb-px10">👥 Members ({{ guildState.members.length }})</div>
    <div>
      <div v-for="m in guildState.members" :key="m.user_id" class="gd-member-row d-flex align-items-center gap-2">
        <span>{{ ROLE_ICONS[m.role] || '👤' }}</span>
        <span class="flex-fill min-w-0" :class="{ 'gd-is-you': isMe(m) }">
          {{ (m.players && m.players.username) || 'Unknown' }}{{ isMe(m) ? ' (You)' : '' }}
        </span>
        <span class="gd-member-pet">Guild Pet: {{ petLabel(m) }}</span>
        <template v-if="!isMe(m) && guildService.isOfficer">
          <button
            v-if="guildService.isLeader"
            class="btn btn-sm btn-outline gd-mini-btn"
            @click="changeRole(m)"
          >{{ m.role === 'officer' ? '⬇️ Demote' : '⬆️ Promote' }}</button>
          <button
            v-if="guildService.isLeader || m.role === 'member'"
            class="btn btn-sm btn-outline gd-mini-btn gd-kick"
            @click="kick(m)"
          >Kick</button>
        </template>
      </div>
    </div>

    <!-- Join requests (officers only) -->
    <div v-if="guildState.joinRequests.length" class="gd-requests mt-3 pt-px14">
      <div class="gd-requests-title mb-2">📬 Join Requests ({{ guildState.joinRequests.length }})</div>
      <div
        v-for="r in guildState.joinRequests"
        :key="r.id"
        class="d-flex align-items-center gap-2 gd-request-row py-2 px-0"
      >
        <span class="flex-fill min-w-0">{{ (r.players && r.players.username) || 'Unknown' }}</span>
        <button class="btn btn-primary btn-sm" @click="acceptReq(r)">Accept</button>
        <button class="btn btn-outline btn-sm" @click="declineReq(r)">Decline</button>
      </div>
    </div>

    <div class="d-flex gap-2 flex-wrap mt-4">
      <button class="btn btn-outline flex-fill" @click="$emit('open', 'chat')">💬 Chat</button>
      <button class="btn btn-outline flex-fill" @click="$emit('open', 'dungeons')">⚔️ Dungeons</button>
      <button class="btn btn-outline flex-fill" @click="$emit('open', 'housing')">🏠 Guild Hall</button>
      <template v-if="guildService.isOfficer">
        <button class="btn btn-outline flex-fill" @click="$emit('open', 'treasury')">🏦 Treasury</button>
        <button class="btn btn-outline flex-fill" @click="showInvite = true">✉️ Invite</button>
      </template>
      <button class="btn btn-outline flex-fill gd-leave" @click="confirmLeave = true">
        🚪 {{ guildService.isLeader ? 'Disband' : 'Leave' }} Guild
      </button>
    </div>

    <!-- Invite -->
    <PetModal v-if="showInvite" title="✉️ Invite a Player" @close="showInvite = false">
      <label class="gd-label d-block mb-1">Username</label>
      <input v-model="inviteName" type="text" placeholder="Enter exact username" class="gd-input mb-3 w-100 py-2 px-tight rounded-1" />
      <button class="btn btn-primary w-100" :disabled="inviting" @click="sendInvite">
        {{ inviting ? 'Sending...' : 'Send Invite' }}
      </button>
    </PetModal>

    <!-- Leave / disband. A leader cannot simply leave — legacy swaps the
         confirmation for a disband warning, which is kept. -->
    <PetModal
      v-if="confirmLeave"
      :title="guildService.isLeader ? '⚠️ You are the Guild Leader' : '🚪 Leave Guild?'"
      @close="confirmLeave = false"
    >
      <p class="gd-confirm-text mb-gap">
        <template v-if="guildService.isLeader">
          Leaders cannot leave without disbanding the guild. This will permanently remove the
          guild and all membership records.
        </template>
        <template v-else>
          You will lose access to guild perks, dungeons, and the treasury.
        </template>
      </p>
      <div class="d-flex gap-2">
        <button class="btn btn-outline flex-fill" @click="confirmLeave = false">Cancel</button>
        <button class="btn btn-primary flex-fill gd-danger-btn" :disabled="leaving" @click="doLeave">
          {{ guildService.isLeader ? '🗑️ Disband Guild' : 'Leave' }}
        </button>
      </div>
    </PetModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../../AppState.js'
import { supabase } from '../../services/SupabaseService.js'
import { guildService, guildState } from '../../services/GuildService.js'
import { guildPerkService } from '../../services/GuildPerkService.js'
import { toastService } from '../../services/ToastService.js'
import PetModal from '../pet/PetModal.vue'
import {
  GUILD_MAX_MEMBERS, GUILD_MIN_PET_LEVEL, ROLE_ICONS, PERK_LABELS, guildXpNeeded
} from '../../data/guildData.js'

const emit = defineEmits(['open', 'left'])

const showInvite = ref(false)
const inviteName = ref('')
const inviting = ref(false)
const confirmLeave = ref(false)
const leaving = ref(false)
const liaisonChoice = ref('')
const myPets = ref([])

const g = computed(() => guildState.myGuild || {})
const xpNeeded = computed(() => guildXpNeeded(g.value.guild_level))
const xpPct = computed(() =>
  Math.min(100, Math.round(((g.value.guild_xp || 0) / xpNeeded.value) * 100))
)
const myLiaison = computed(() => guildState.liaisons[AppState.user?.id])
const activePerks = computed(() => guildPerkService.activeList())
const eligiblePets = computed(() =>
  myPets.value.filter(p => (p.level || 1) >= GUILD_MIN_PET_LEVEL)
)

function isMe(m) { return m.user_id === AppState.user?.id }

function petLabel(m) {
  const l = guildState.liaisons[m.user_id]
  if (!l || !l.user_pets) return '⚠️ Not set'
  const up = l.user_pets
  return (up.nickname || (up.pets && up.pets.name) || 'Pet') + ' Lv.' + (up.level || 1)
}

function remaining(p) {
  const mins = Math.max(0, Math.floor((p.expiresAt - Date.now()) / 60000))
  const hrs = Math.floor(mins / 60)
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`
}

async function loadPets() {
  if (!AppState.user) return
  const { data } = await supabase
    .from('user_pets').select('id, nickname, level').eq('user_id', AppState.user.id)
  myPets.value = data || []
  liaisonChoice.value = guildState.liaisonPetId || ''
}

async function guard(fn, success) {
  try {
    const r = await fn()
    if (success) toastService.success(typeof success === 'function' ? success(r) : success)
    return r
  } catch (e) {
    toastService.error(e.message)
  }
}

const setLiaison = () => guard(async () => {
  const pet = myPets.value.find(p => p.id === liaisonChoice.value)
  await guildService.setLiaison(pet)
  return pet
}, pet => `🏛️ Guild pet set to ${pet.nickname || 'Pet'}!`)

const changeRole = m => guard(
  () => guildService.setMemberRole(g.value.guild_id, m.user_id, m.role === 'officer' ? 'member' : 'officer'),
  'Role updated.'
)

const kick = m => guard(() => guildService.kickMember(g.value.guild_id, m.user_id), 'Member removed.')
const acceptReq = r => guard(() => guildService.acceptRequest(r.id, g.value.guild_id, r.user_id), 'Member accepted!')
const declineReq = r => guard(() => guildService.declineRequest(r.id), 'Request declined.')

// ── Guild bio ───────────────────────────────────────────────────────────────
const editingBio = ref(false)
const bioDraft = ref('')
const savingBio = ref(false)

function startBio() {
  bioDraft.value = g.value.description || ''
  editingBio.value = true
}

const saveBio = () => {
  savingBio.value = true
  return guard(() => guildService.saveBio(bioDraft.value), 'Guild bio saved!')
    .finally(() => { savingBio.value = false; editingBio.value = false })
}

async function sendInvite() {
  inviting.value = true
  const name = await guard(() => guildService.sendInvite(inviteName.value))
  if (name) { showInvite.value = false; inviteName.value = ''; toastService.success(`✉️ Invite sent to ${name}!`) }
  inviting.value = false
}

async function doLeave() {
  leaving.value = true
  const leader = guildService.isLeader
  await guard(async () => {
    if (leader) {
      const name = await guildService.disband()
      toastService.success(`🏛️ "${name}" has been disbanded.`)
    } else {
      await guildService.leave()
      toastService.info('You left the guild.')
    }
  })
  leaving.value = false
  confirmLeave.value = false
  emit('left')
}

onMounted(loadPets)
</script>

<style lang="scss" scoped>
.gd-bio-btn {
  background: none;
  border: none;
  color: var(--purple);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 4px 0 0;

  &:hover { text-decoration: underline; }
}

.gd-bio-input {
  border: 2px solid var(--border);
  font-size: 0.82rem;
  font-family: inherit;
  resize: vertical;
  min-height: 56px;
  box-sizing: border-box;
}

// As with the browser, legacy built all of this inline — no `.guild-*` rules
// exist in the global stylesheet, so everything is owned here.
// `margin-inline: auto` is what centres this in the page column. Without it a
// max-width block sits hard against the left edge and leaves all the slack on
// the right — which is how this rendered from the day it was written.
.gd-member {
  max-width: 700px;
  margin-inline: auto;
}

.gd-hero-emblem { font-size: 3rem; }

.gd-hero-name {
  font-weight: 800;
  font-size: 1.3rem;
  color: var(--purple-dark);
}

.gd-hero-tag {
  font-size: 0.85rem;
  color: var(--text-light);
  font-weight: 400;
}

.gd-hero-meta {
  font-size: 0.85rem;
  color: var(--text-light);
}

.gd-hero-desc {
  font-size: 0.82rem;
  color: var(--text-light);
  font-style: italic;
}

.gd-perks {
  background: rgba(93, 222, 122, 0.1);
  border: 1px solid rgba(93, 222, 122, 0.3);
}

.gd-perks-title {
  font-weight: 700;
  font-size: 0.8rem;
  color: #2d8a4e;
}

.gd-perk-row { font-size: 0.78rem; color: #2d8a4e; }

.gd-xp-label { font-size: 0.75rem; color: var(--text-light); }

.gd-xp-track {
  background: rgba(153, 102, 255, 0.12);
  height: 8px;
}

.gd-xp-fill {
  background: linear-gradient(90deg, #9966ff, #ff66cc);
}

.gd-liaison {
  background: rgba(153, 102, 255, 0.06);
}

.gd-liaison-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--purple-dark);
}

.gd-liaison-current {
  font-size: 0.9rem;
  color: var(--purple-dark);
}
.gd-liaison-none {
  font-size: 0.9rem;
  color: #ff6b6b;
}
.gd-liaison-hint { font-size: 0.8rem; color: var(--text-light); }

.gd-select {
  border: 2px solid var(--border);
}

.gd-section-title {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--purple-dark);
}

.gd-member-row {
  padding: 7px 0;
  border-bottom: 1px solid rgba(153, 102, 255, 0.08);
  font-size: 0.82rem;
  color: var(--purple-dark);
}

.gd-is-you { font-weight: 700; color: var(--purple); }

.gd-member-pet { color: var(--text-light); font-size: 0.75rem; }

.gd-mini-btn { font-size: 0.68rem; padding: 2px 6px; }
.gd-kick { color: #ff6b6b; border-color: #ff6b6b; }

.gd-requests {
  border-top: 1px solid var(--border);
}

.gd-requests-title {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
}

.gd-request-row {
  border-bottom: 1px solid rgba(153, 102, 255, 0.08);
  font-size: 0.85rem;
}

.gd-leave { color: #ff6b6b; border-color: #ff6b6b; }

.gd-danger-btn { background: #ff6b6b; border-color: #ff6b6b; }

.gd-confirm-text {
  color: var(--text-light);
  font-size: 0.88rem;
}

.gd-label {
  font-size: 0.82rem;
  font-weight: 700;
}

.gd-input {
  border: 2px solid var(--border);
  font-size: 0.9rem;
  box-sizing: border-box;
}
</style>
