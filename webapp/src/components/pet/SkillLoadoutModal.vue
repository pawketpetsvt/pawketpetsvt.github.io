<template>
  <!-- Ports petSkills_openManager() (game.js). Lets the player choose which of
       the unlocked active skills a pet carries into battle, up to its slot
       count. Passives are listed but never occupy a slot. -->
  <PetModal :title="`⚔️ Skills — ${pet.nickname}`" :subtitle="subtitle" @close="$emit('close')">
    <div class="pp-section-label">Active Loadout ({{ loadout.length }}/{{ slots }})</div>
    <div class="pp-loadout">
      <template v-if="loadout.length">
        <div v-for="skill in loadout" :key="skill.id" class="pp-chip">
          <span>{{ skill.icon }}</span>
          <span class="pp-chip-name">{{ skill.name }}</span>
          <button class="pp-chip-x" :aria-label="`Remove ${skill.name}`" @click="remove(skill.id)">✕</button>
        </div>
      </template>
      <span v-else class="pp-empty">No skills selected — add from the list below.</span>
    </div>

    <div class="pp-section-label">All Skills</div>
    <div class="d-flex flex-column gap-1">
      <div v-for="skill in unlocked" :key="skill.id" class="pp-skill" :class="{ 'pp-in': inLoadout(skill.id) }">
        <span class="pp-skill-icon">{{ skill.icon }}</span>
        <div class="flex-grow-1 min-w-0">
          <div class="pp-skill-name">
            {{ skill.name }}
            <span class="pp-skill-meta">Lv.{{ skill.unlockLevel }} CD:{{ skill.cooldown }}</span>
          </div>
          <div class="pp-skill-desc">{{ skill.desc }}</div>
        </div>
        <button v-if="inLoadout(skill.id)" class="pp-btn pp-btn-remove" @click="remove(skill.id)">Remove</button>
        <button v-else-if="loadout.length < slots" class="pp-btn pp-btn-add" @click="add(skill.id)">+ Add</button>
        <span v-else class="pp-full">Full</span>
      </div>

      <div v-if="passives.length" class="pp-passives">
        <span class="pp-passive-tag">✨ PASSIVE</span>
        <span v-for="(p, i) in passives" :key="p.id" class="pp-passive">
          {{ p.icon }} <strong>{{ p.name }}</strong> — {{ p.desc }}<span v-if="i < passives.length - 1">, </span>
        </span>
      </div>

      <div v-if="lockedCount" class="pp-locked">
        + {{ lockedCount }} more skill{{ lockedCount === 1 ? '' : 's' }} unlock at higher levels
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import PetModal from './PetModal.vue'
import { PET_SKILLS } from '../../data/battleData.js'
import { skillKeyFor, skillSlotCount, unlockedSkills, passiveSkills, skillLoadout, saveSkillLoadout }
  from '../../utils/petSkills.js'

const props = defineProps({
  pet: { type: Object, required: true }
})
defineEmits(['close'])

const level = computed(() => props.pet.level || 1)
const petName = computed(() => props.pet.species?.name || '')
const allSkills = computed(() => PET_SKILLS[skillKeyFor(petName.value)] || [])
const slots = computed(() => skillSlotCount(level.value))
const unlocked = computed(() => unlockedSkills(petName.value, level.value))
const passives = computed(() => passiveSkills(petName.value, level.value))
const lockedCount = computed(() =>
  allSkills.value.filter(s => !s.passive && s.unlockLevel > level.value).length
)

const subtitle = computed(() =>
  `Lv.${level.value} · ${slots.value} active slots · ${unlocked.value.length} skills unlocked`
)

// Local copy so the list reacts immediately; each change is persisted straight
// away, matching legacy's write-on-every-edit behaviour.
const loadoutIds = ref(skillLoadout(props.pet.id, petName.value, level.value).map(s => s.id))
const loadout = computed(() =>
  loadoutIds.value.map(id => allSkills.value.find(s => s.id === id)).filter(Boolean)
)

function inLoadout(id) {
  return loadoutIds.value.includes(id)
}

function persist() {
  saveSkillLoadout(props.pet.id, loadoutIds.value)
}

function add(id) {
  if (loadoutIds.value.length >= slots.value || inLoadout(id)) return
  loadoutIds.value.push(id)
  persist()
}

function remove(id) {
  loadoutIds.value = loadoutIds.value.filter(x => x !== id)
  persist()
}
</script>

<style lang="scss" scoped>
.pp-section-label {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--purple-dark);
  margin-bottom: 8px;
}

.pp-loadout {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  min-height: 40px;
}

.pp-chip {
  background: rgba(153, 102, 255, 0.15);
  border: 2px solid var(--purple-light);
  border-radius: 10px;
  padding: 5px 10px;
  font-size: 0.74rem;
  display: flex;
  align-items: center;
  gap: 5px;
}

.pp-chip-name { font-weight: 700; }

.pp-chip-x {
  background: none;
  border: none;
  color: #ff6b6b;
  cursor: pointer;
  padding: 0 2px;
  font-size: 0.85rem;
}

.pp-empty {
  font-size: 0.75rem;
  color: var(--text-light);
  font-style: italic;
}

.pp-skill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);

  &.pp-in {
    background: rgba(153, 102, 255, 0.12);
    border-color: var(--purple-light);
  }
}

.pp-skill-icon { font-size: 1.2rem; }

.pp-skill-name {
  font-weight: 700;
  font-size: 0.76rem;
}

.pp-skill-meta {
  color: var(--text-light);
  font-weight: 400;
}

.pp-skill-desc {
  font-size: 0.65rem;
  color: var(--text-light);
}

.pp-btn {
  font-size: 0.68rem;
  padding: 3px 8px;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  white-space: nowrap;
}

.pp-btn-add {
  border: 1px solid var(--purple);
  color: var(--purple);
}

.pp-btn-remove {
  border: 1px solid #ff6b6b;
  color: #ff6b6b;
}

.pp-full {
  font-size: 0.65rem;
  color: var(--text-light);
  white-space: nowrap;
}

.pp-passives {
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(93, 222, 122, 0.08);
  border-radius: 10px;
  border: 1px solid rgba(93, 222, 122, 0.25);
  font-size: 0.7rem;
}

.pp-passive-tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: #5dde7a;
  margin-right: 4px;
}

.pp-locked {
  margin-top: 6px;
  font-size: 0.68rem;
  color: var(--text-light);
  padding: 4px 10px;
}
</style>
