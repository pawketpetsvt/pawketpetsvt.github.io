<template>
  <div>
    <button class="btn btn-outline btn-sm mb-3" @click="$emit('back')">← Back to Guild</button>
    <h3 class="gc-title">💬 Guild Chat</h3>

    <div class="mb-3">
      <textarea
        v-model="draft"
        :maxlength="CHAT_MAX_LEN"
        placeholder="Say something to your guild..."
        class="gc-input"
      ></textarea>
      <div class="d-flex justify-content-between align-items-center mt-1">
        <span class="gc-count">{{ draft.length }} / {{ CHAT_MAX_LEN }}</span>
        <button class="btn btn-primary btn-sm" :disabled="sending || !draft.trim()" @click="send">
          {{ sending ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="gc-section">Recent Messages</div>
      <button class="btn btn-outline btn-sm" :disabled="loading" @click="load">🔄 Refresh</button>
    </div>

    <div v-if="loading" class="spinner"></div>
    <div v-else-if="error" class="gc-empty">{{ error }}</div>
    <div v-else-if="!messages.length" class="gc-empty">
      No messages yet. Say hello to your guild! 👋
    </div>
    <div v-else>
      <div v-for="m in messages" :key="m.id" class="gc-msg d-flex gap-2">
        <div class="gc-avatar" :class="{ me: m.isMe }">{{ m.author.charAt(0).toUpperCase() }}</div>
        <div class="flex-fill min-w-0">
          <div class="d-flex align-items-center gap-1 mb-1">
            <span class="gc-author" :class="{ me: m.isMe }">{{ m.author }}{{ m.isMe ? ' (You)' : '' }}</span>
            <span class="gc-time">{{ getTimeAgo(new Date(m.createdAt)) }}</span>
          </div>
          <div class="gc-body">{{ m.message }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { guildService } from '../../services/GuildService.js'
import { toastService } from '../../services/ToastService.js'
import { getTimeAgo } from '../../utils/timeAgo.js'
import { CHAT_MAX_LEN } from '../../data/guildData.js'

defineEmits(['back'])

const draft = ref('')
const messages = ref([])
const loading = ref(true)
const sending = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    messages.value = await guildService.loadChat()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function send() {
  sending.value = true
  try {
    await guildService.postChat(draft.value)
    draft.value = ''
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    sending.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.gc-title { color: var(--purple); margin-bottom: 14px; }

.gc-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid var(--border);
  font-size: 0.88rem;
  resize: vertical;
  min-height: 60px;
  box-sizing: border-box;
}

.gc-count { font-size: 0.72rem; color: var(--text-light); }

.gc-section {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
}

.gc-empty {
  color: var(--text-light);
  text-align: center;
  padding: 20px;
  font-style: italic;
}

.gc-msg {
  padding: 8px 0;
  border-bottom: 1px solid rgba(153, 102, 255, 0.08);
}

.gc-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--purple-light);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.82rem;
  flex-shrink: 0;
  &.me { background: var(--purple); }
}

.gc-author {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
  &.me { color: var(--purple); }
}

.gc-time { font-size: 0.68rem; color: var(--text-light); }

.gc-body {
  font-size: 0.85rem;
  color: var(--purple-dark);
  word-break: break-word;
}
</style>
