<template>
  <div>
    <!-- Pending invitations, shown above the list so they can't be missed -->
    <div v-if="guildState.invitations.length" class="gd-invites">
      <div class="gd-invites-title">✉️ Guild Invitations ({{ guildState.invitations.length }})</div>
      <div
        v-for="inv in guildState.invitations"
        :key="inv.id"
        class="d-flex align-items-center gap-2 py-1"
      >
        <span class="gd-emblem-sm">{{ (inv.guilds && inv.guilds.emblem_emoji) || '🏛️' }}</span>
        <span class="flex-fill min-w-0 gd-invite-text">
          {{ (inv.guilds && inv.guilds.name) || 'Unknown' }}
          <span class="gd-muted">invited by {{ inv.inviterUsername }}</span>
        </span>
        <button class="btn btn-primary btn-sm" @click="accept(inv)">Accept</button>
        <button class="btn btn-outline btn-sm" @click="decline(inv)">Decline</button>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h3 class="gd-heading m-0">🏛️ Browse Guilds</h3>
      <button class="btn btn-primary" @click="$emit('create')">✨ Create Guild</button>
    </div>

    <div v-if="guildState.loading" class="spinner"></div>

    <div v-else-if="!guildState.guilds.length" class="empty-state">
      <div class="gd-empty-icon">🏛️</div>
      <h3>No Guilds Yet!</h3>
      <p class="gd-muted">Be the first to create a guild!</p>
      <button class="btn btn-primary mt-3" @click="$emit('create')">✨ Create the First Guild</button>
    </div>

    <template v-else>
      <div class="d-flex flex-column gap-2">
        <div v-for="g in guildState.guilds" :key="g.id" class="gd-row d-flex align-items-center gap-3">
          <div class="gd-emblem">{{ g.emblem_emoji || '🏛️' }}</div>
          <div class="flex-fill min-w-0">
            <div class="gd-name">
              {{ g.name }} <span class="gd-tag">[{{ g.tag || '???' }}]</span>
            </div>
            <div class="gd-meta">
              Level {{ g.guild_level || 1 }} · {{ g.member_count || 0 }}/{{ GUILD_MAX_MEMBERS }} members ·
              {{ g.is_open !== false ? '🟢 Open' : '🔴 Closed' }}
            </div>
            <div v-if="g.description" class="gd-desc">{{ g.description.slice(0, 100) }}</div>
          </div>
          <div>
            <span v-if="(g.member_count || 0) >= GUILD_MAX_MEMBERS" class="gd-full">Full</span>
            <button
              v-else-if="g.is_open !== false"
              class="btn btn-primary btn-sm gd-action"
              :disabled="busy"
              @click="join(g)"
            >Join</button>
            <button
              v-else
              class="btn btn-outline btn-sm gd-action"
              :disabled="busy"
              @click="request(g)"
            >Request</button>
          </div>
        </div>
      </div>

      <div v-if="guildService.totalPages > 1" class="d-flex justify-content-center align-items-center gap-2 mt-4">
        <button class="btn btn-outline btn-sm" :disabled="guildState.currentPage <= 1" @click="page(-1)">← Prev</button>
        <span class="gd-page">Page {{ guildState.currentPage }} of {{ guildService.totalPages }}</span>
        <button class="btn btn-outline btn-sm" :disabled="guildState.currentPage >= guildService.totalPages" @click="page(1)">Next →</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { guildService, guildState } from '../../services/GuildService.js'
import { GUILD_MAX_MEMBERS } from '../../data/guildData.js'
import { toastService } from '../../services/ToastService.js'

const emit = defineEmits(['create', 'joined'])
const busy = ref(false)

async function run(fn, success) {
  if (busy.value) return
  busy.value = true
  try {
    await fn()
    if (success) toastService.success(success)
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

const join = g => run(async () => {
  await guildService.join(g.id)
  emit('joined')
}, '✅ Joined the guild!')

const request = g => run(() => guildService.requestJoin(g.id), '📨 Join request sent!')

const accept = inv => run(async () => {
  await guildService.acceptInvite(inv.id, inv.guild_id)
  emit('joined')
}, '🏛️ Joined the guild!')

const decline = inv => run(() => guildService.declineInvite(inv.id), 'Invite declined.')

async function page(dir) {
  guildState.currentPage = Math.max(1, guildState.currentPage + dir)
  await guildService.loadBrowser()
}
</script>

<style lang="scss" scoped>
// Legacy built this whole view from inline styles inside a template string —
// there is no `.guild-*` rule anywhere in style.css to inherit from, so the
// component owns all of it.
.gd-invites {
  background: rgba(153, 102, 255, 0.08);
  border: 2px solid var(--purple);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 18px;
}

.gd-invites-title {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--purple-dark);
  margin-bottom: 10px;
}

.gd-invite-text { font-size: 0.85rem; }
.gd-emblem-sm { font-size: 1.5rem; }
.gd-muted { color: var(--text-light); }
.gd-heading { color: var(--purple-dark); }
.gd-empty-icon { font-size: 3rem; margin-bottom: 12px; }

.gd-row {
  border: 2px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
}

.gd-emblem {
  font-size: 2.3rem;
  min-width: 46px;
  text-align: center;
}

.gd-name {
  font-weight: 700;
  font-size: 1.02rem;
  color: var(--purple-dark);
}

.gd-tag {
  font-size: 0.78rem;
  color: var(--text-light);
  font-weight: 400;
}

.gd-meta {
  font-size: 0.82rem;
  color: var(--text-light);
}

.gd-desc {
  font-size: 0.78rem;
  color: var(--text-light);
  font-style: italic;
  margin-top: 4px;
}

.gd-full {
  color: #ff6b6b;
  font-weight: 700;
  font-size: 0.85rem;
}

.gd-action { min-width: 76px; }

.gd-page {
  padding: 0 10px;
  color: var(--text-light);
  font-size: 0.85rem;
}
</style>
