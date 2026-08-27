<template>
  <div class="gd-create">
    <button class="btn btn-outline btn-sm mb-3" @click="$emit('back')">← Back</button>
    <h3 class="gd-create-title">✨ Create a Guild</h3>

    <div v-if="!hasEligiblePet" class="gd-warn">
      ⚠️ You need a level {{ GUILD_MIN_PET_LEVEL }}+ pet to create a guild. Keep training!
    </div>
    <div v-else-if="!canAfford" class="gd-warn">
      ⚠️ You need {{ GUILD_CREATE_COST }} PP to create a guild. You have {{ points }} PP.
    </div>

    <div class="mb-3">
      <label class="gd-label">Guild Name (3–20 chars)</label>
      <input v-model="name" type="text" maxlength="20" placeholder="Ember's Army" class="gd-input" />
    </div>

    <div class="mb-3">
      <label class="gd-label">Tag (3–5 uppercase letters)</label>
      <input
        :value="tag"
        type="text"
        maxlength="5"
        placeholder="EMBER"
        class="gd-input"
        @input="tag = $event.target.value.toUpperCase()"
      />
    </div>

    <div class="mb-3">
      <label class="gd-label">Emblem (any emoji)</label>
      <input v-model="emblem" type="text" maxlength="4" placeholder="🏛️" class="gd-input gd-emblem-input" />
    </div>

    <div class="mb-3">
      <label class="gd-label">Bio (optional)</label>
      <textarea v-model="bio" maxlength="200" placeholder="Describe your guild..." class="gd-input gd-textarea"></textarea>
    </div>

    <div class="gd-cost-note">
      ⚠️ Cost: {{ GUILD_CREATE_COST }} PP · Requires level {{ GUILD_MIN_PET_LEVEL }}+ pet
    </div>

    <button class="btn btn-primary w-100" :disabled="busy" @click="submit">
      {{ busy ? 'Creating...' : `✨ Create Guild (${GUILD_CREATE_COST} PP)` }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../../AppState.js'
import { supabase } from '../../services/SupabaseService.js'
import { guildService } from '../../services/GuildService.js'
import { toastService } from '../../services/ToastService.js'
import { GUILD_CREATE_COST, GUILD_MIN_PET_LEVEL } from '../../data/guildData.js'

const emit = defineEmits(['back', 'created'])

const name = ref('')
const tag = ref('')
const emblem = ref('🏛️')
const bio = ref('')
const busy = ref(false)
const hasEligiblePet = ref(true)

const points = computed(() => (AppState.player && AppState.player.pawketpoints) || 0)
const canAfford = computed(() => points.value >= GUILD_CREATE_COST)

// Legacy read this off its in-memory `petState`, which only holds pets the My
// Pets tab has loaded this session — so opening Guild first showed the warning
// even to a player who qualified. Queried directly instead.
onMounted(async () => {
  if (!AppState.user) return
  const { data } = await supabase
    .from('user_pets').select('level').eq('user_id', AppState.user.id)
  hasEligiblePet.value = (data || []).some(p => (p.level || 1) >= GUILD_MIN_PET_LEVEL)
})

async function submit() {
  if (busy.value) return
  busy.value = true
  try {
    await guildService.create({ name: name.value, tag: tag.value, emblem: emblem.value, bio: bio.value })
    toastService.success(`🏛️ Guild "${name.value.trim()}" created!`)
    emit('created')
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
.gd-create { max-width: 480px; }

.gd-create-title {
  color: var(--purple);
  margin-bottom: 16px;
}

.gd-warn {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid #ff6b6b;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 14px;
  font-size: 0.85rem;
  color: #cc3333;
}

.gd-label {
  font-size: 0.82rem;
  font-weight: 700;
  display: block;
  margin-bottom: 4px;
}

.gd-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid var(--border);
  font-size: 0.9rem;
  box-sizing: border-box;
}

.gd-emblem-input {
  width: 80px;
  font-size: 1.2rem;
  text-align: center;
}

.gd-textarea {
  font-size: 0.85rem;
  resize: vertical;
  min-height: 70px;
}

.gd-cost-note {
  font-size: 0.78rem;
  color: var(--text-light);
  margin-bottom: 14px;
}
</style>
