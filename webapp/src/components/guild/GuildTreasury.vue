<template>
  <div>
    <button class="btn btn-outline btn-sm mb-3" @click="$emit('back')">← Back to Guild</button>

    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <div class="gt-label mb-px2">GUILD TREASURY</div>
        <div class="gt-amount">🪙 {{ treasury.toLocaleString() }} PP</div>
      </div>
      <button v-if="guildService.isOfficer" class="btn btn-primary btn-sm" @click="showProposal = true">
        ➕ New Proposal
      </button>
    </div>

    <div v-if="activePerks.length" class="gt-perks rounded-2 py-px10 px-tight mb-px14">
      <div class="gt-perks-title mb-px6">✨ Active Guild Perks</div>
      <div v-for="p in activePerks" :key="p.type" class="gt-perk-row">
        {{ PERK_LABELS[p.type] || p.type }} · {{ remaining(p) }} remaining
      </div>
    </div>

    <!-- Donate -->
    <div class="gt-donate rounded-3 py-tight px-px14 mb-3">
      <div class="gt-donate-title mb-2">💰 Donate PP</div>
      <div class="d-flex gap-2">
        <input
          v-model="donateAmount"
          type="number"
          :min="DONATE_MIN"
          placeholder="Amount..."
          class="gt-donate-input flex-fill rounded-1"
        />
        <button class="btn btn-primary btn-sm" :disabled="donating" @click="donate">
          {{ donating ? '...' : 'Donate' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <div class="gt-section">🗳️ Active Proposals</div>
      <div v-if="!votes.length" class="gt-empty">No active proposals.</div>
      <div v-for="v in votes" :key="v.id" class="gt-vote rounded-3 py-tight px-px14 mb-px10">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="gt-vote-icon">{{ EFFECT_ICONS[v.effect_type] || '📊' }}</span>
          <span class="gt-vote-title">{{ v.proposal }}</span>
          <span class="gt-vote-time ms-auto">⏱️ {{ endsIn(v) }}</span>
        </div>
        <div v-if="v.description" class="gt-vote-desc mb-2">{{ v.description }}</div>
        <div class="gt-vote-cost mb-2">Cost: <strong>🪙{{ v.cost }} PP</strong> from treasury</div>
        <div class="d-flex gap-4 gt-tally mb-px10">
          <span class="gt-for">👍 {{ v.votes_for || 0 }} For</span>
          <span class="gt-against">👎 {{ v.votes_against || 0 }} Against</span>
        </div>
        <div v-if="myVotes.has(v.id)" class="gt-voted text-center p-px6 rounded-1">✅ You have already voted</div>
        <div v-else class="d-flex gap-2">
          <button class="btn btn-primary btn-sm flex-fill" :disabled="voting" @click="vote(v, true)">
            👍 Vote Yes
          </button>
          <button class="btn btn-outline btn-sm flex-fill gt-no-btn" :disabled="voting" @click="vote(v, false)">
            👎 Vote No
          </button>
        </div>
      </div>

      <div class="gt-section mt-3">📜 Treasury Log</div>
      <div v-if="!logs.length" class="gt-empty">No transactions yet.</div>
      <div v-for="l in logs" :key="l.id" class="gt-log d-flex align-items-center gap-2">
        <span>{{ l.amount > 0 ? '💰' : '💸' }}</span>
        <span class="flex-fill min-w-0 gt-log-text">
          {{ (l.players && l.players.username) || 'Someone' }} • {{ l.description || l.action }}
        </span>
        <span class="gt-log-amt" :class="l.amount > 0 ? 'pos' : 'neg'">
          {{ l.amount > 0 ? '+' : '' }}{{ l.amount }} PP
        </span>
      </div>
    </template>

    <!-- New proposal -->
    <PetModal v-if="showProposal" title="✨ Create Treasury Proposal" @close="showProposal = false">
      <div class="mb-2">
        <label class="gt-form-label">Proposal Title</label>
        <input v-model="propTitle" type="text" maxlength="60" placeholder="e.g. XP Boost for the guild!" class="gt-form-input" />
      </div>
      <div class="mb-2">
        <label class="gt-form-label">Description</label>
        <textarea v-model="propDesc" maxlength="200" class="gt-form-input gt-form-textarea"></textarea>
      </div>
      <div class="d-flex gap-2 mb-2">
        <div class="flex-fill">
          <label class="gt-form-label">Effect Type</label>
          <select v-model="propEffect" class="gt-form-input">
            <option v-for="e in PROPOSAL_EFFECTS" :key="e.key" :value="e.key">{{ e.label }}</option>
          </select>
        </div>
        <div class="flex-fill">
          <label class="gt-form-label">Duration (hours)</label>
          <input v-model="propDuration" type="number" min="1" max="72" class="gt-form-input" />
        </div>
      </div>
      <div class="gt-cost-box rounded-2 py-px10 px-tight mb-px14">
        Cost: <strong>🪙{{ (PROPOSAL_COSTS[propEffect] || 1000).toLocaleString() }} PP</strong>
        from treasury · Votes close in {{ propDuration }} hours
      </div>
      <button class="btn btn-primary w-100" :disabled="proposing" @click="createProposal">
        {{ proposing ? 'Creating...' : 'Create Proposal' }}
      </button>
    </PetModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { guildService, guildState } from '../../services/GuildService.js'
import { guildPerkService } from '../../services/GuildPerkService.js'
import { toastService } from '../../services/ToastService.js'
import PetModal from '../pet/PetModal.vue'
import {
  DONATE_MIN, PROPOSAL_COSTS, PROPOSAL_EFFECTS, EFFECT_ICONS, PERK_LABELS
} from '../../data/guildData.js'

defineEmits(['back'])

const loading = ref(true)
const treasury = ref(0)
const votes = ref([])
const logs = ref([])
const myVotes = ref(new Set())
const donateAmount = ref('')
const donating = ref(false)
const voting = ref(false)
const showProposal = ref(false)
const propTitle = ref('')
const propDesc = ref('')
const propEffect = ref('xp_boost')
const propDuration = ref(24)
const proposing = ref(false)

const activePerks = computed(() => guildPerkService.activeList())

function remaining(p) {
  const mins = Math.max(0, Math.floor((p.expiresAt - Date.now()) / 60000))
  const hrs = Math.floor(mins / 60)
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`
}

function endsIn(v) {
  const mins = Math.max(0, Math.floor((new Date(v.ends_at) - Date.now()) / 60000))
  if (mins <= 0) return 'Ending soon'
  const hrs = Math.floor(mins / 60)
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`
}

async function load() {
  loading.value = true
  try {
    const data = await guildService.loadTreasury()
    if (!data) return
    treasury.value = data.treasury
    votes.value = data.votes
    logs.value = data.logs
    myVotes.value = data.myVotes
  } catch (e) {
    toastService.error(e.message)
  } finally {
    loading.value = false
  }
}

async function donate() {
  donating.value = true
  try {
    const amount = await guildService.donate(donateAmount.value)
    toastService.success(`💰 Donated ${amount} PP to the treasury!`)
    donateAmount.value = ''
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    donating.value = false
  }
}

async function vote(v, inFavor) {
  voting.value = true
  try {
    await guildService.castVote(v.id, inFavor)
    toastService.success(inFavor ? '👍 Voted Yes!' : '👎 Voted No!')
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    voting.value = false
  }
}

async function createProposal() {
  proposing.value = true
  try {
    await guildService.createProposal({
      title: propTitle.value,
      description: propDesc.value,
      effect: propEffect.value,
      durationHours: propDuration.value
    })
    toastService.success('📊 Proposal created! Guild members can now vote.')
    showProposal.value = false
    propTitle.value = ''
    propDesc.value = ''
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    proposing.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.gt-label {
  font-size: 0.72rem;
  color: var(--text-light);
  letter-spacing: 1px;
}

.gt-amount {
  font-size: 2rem;
  font-weight: 800;
  color: #e6a800;
}

.gt-perks {
  background: rgba(93, 222, 122, 0.1);
  border: 1px solid rgba(93, 222, 122, 0.3);
}

.gt-perks-title {
  font-weight: 700;
  font-size: 0.8rem;
  color: #2d8a4e;
}

.gt-perk-row { font-size: 0.78rem; color: #2d8a4e; }

.gt-donate {
  background: rgba(153, 102, 255, 0.06);
}

.gt-donate-title {
  font-weight: 700;
  font-size: 0.82rem;
}

.gt-donate-input {
  padding: 7px 10px;
  border: 2px solid var(--border);
  font-size: 0.85rem;
}

.gt-section {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
  margin-bottom: 10px;
}

.gt-empty {
  color: var(--text-light);
  font-size: 0.82rem;
  font-style: italic;
  margin-bottom: 14px;
}

.gt-vote {
  border: 2px solid var(--border);
}

.gt-vote-icon { font-size: 1.2rem; }

.gt-vote-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--purple-dark);
}

.gt-vote-time { font-size: 0.72rem; color: var(--text-light); }

.gt-vote-desc {
  font-size: 0.78rem;
  color: var(--text-light);
}

.gt-vote-cost {
  font-size: 0.78rem;
}

.gt-tally {
  font-size: 0.82rem;
}
.gt-for { color: #5dde7a; }
.gt-against { color: #ff6b6b; }
.gt-no-btn { color: #ff6b6b; border-color: #ff6b6b; }

.gt-voted {
  font-size: 0.78rem;
  color: var(--text-light);
  background: rgba(153, 102, 255, 0.06);
}

.gt-log {
  padding: 5px 0;
  border-bottom: 1px solid rgba(153, 102, 255, 0.08);
  font-size: 0.78rem;
}

.gt-log-text { color: var(--purple-dark); }

.gt-log-amt {
  font-weight: 600;
  &.pos { color: #5dde7a; }
  &.neg { color: #ff6b6b; }
}

.gt-form-label {
  font-size: 0.8rem;
  font-weight: 700;
  display: block;
  margin-bottom: 4px;
}

.gt-form-input {
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: 2px solid var(--border);
  font-size: 0.85rem;
  box-sizing: border-box;
}

.gt-form-textarea { resize: vertical; min-height: 60px; font-size: 0.82rem; }

.gt-cost-box {
  background: rgba(255, 215, 0, 0.1);
  font-size: 0.82rem;
}
</style>
