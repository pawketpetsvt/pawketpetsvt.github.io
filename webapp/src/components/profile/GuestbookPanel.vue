<template>
  <div class="gb-panel">
    <h2 class="gb-title">📖 Guestbook</h2>

    <div v-if="canPost" class="gb-form">
      <textarea
        v-model="draft"
        class="gb-input"
        rows="3"
        :maxlength="GUESTBOOK_MAX_LENGTH"
        placeholder="Leave a nice message..."
      ></textarea>
      <div class="gb-form-row">
        <span class="gb-count">{{ draft.length }} / {{ GUESTBOOK_MAX_LENGTH }}</span>
        <button class="btn btn-primary btn-sm" :disabled="posting || !draft.trim()" @click="post">Post Message</button>
      </div>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <div v-if="!entries.length" class="gb-empty">
        <div class="gb-empty-icon">📖</div>
        <p>No messages yet!</p>
        <p class="gb-empty-sub">Be the first to leave a message!</p>
      </div>

      <div v-for="e in entries" :key="e.id" class="gb-entry">
        <div class="gb-entry-top">
          <div class="gb-author">
            <div class="gb-author-avatar">{{ e.authorName.charAt(0).toUpperCase() }}</div>
            <div>
              <div class="gb-author-name" @click="$emit('view-profile', e.authorName)">{{ e.authorName }}</div>
              <div class="gb-timestamp">{{ getTimeAgo(new Date(e.createdAt)) }}</div>
            </div>
          </div>
          <button v-if="e.canDelete" class="btn btn-outline btn-sm btn-danger" @click="remove(e)">Delete</button>
        </div>
        <div class="gb-message">{{ e.message }}</div>
      </div>

      <button v-if="hasMore" class="btn btn-outline gb-load-more" :disabled="loadingMore" @click="loadMore">
        {{ loadingMore ? 'Loading...' : '⬇️ Load More' }}
      </button>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { guestbookService, GUESTBOOK_PAGE_SIZE, GUESTBOOK_MAX_LENGTH } from '../../services/GuestbookService.js'
import { toastService } from '../../services/ToastService.js'
import { getTimeAgo } from '../../utils/timeAgo.js'

const props = defineProps({
  profileUserId: { type: String, required: true },
  canPost: { type: Boolean, default: false }
})
defineEmits(['view-profile'])

const entries = ref([])
const draft = ref('')
const loading = ref(true)
const loadingMore = ref(false)
const posting = ref(false)
const hasMore = ref(false)
let offset = 0

async function load() {
  loading.value = true
  offset = 0
  try {
    const page = await guestbookService.loadEntries(props.profileUserId, 0)
    entries.value = page
    hasMore.value = page.length >= GUESTBOOK_PAGE_SIZE
  } catch (err) {
    toastService.error('Error loading messages.')
  }
  loading.value = false
}

async function loadMore() {
  loadingMore.value = true
  offset += GUESTBOOK_PAGE_SIZE
  try {
    const page = await guestbookService.loadEntries(props.profileUserId, offset)
    entries.value = entries.value.concat(page)
    hasMore.value = page.length >= GUESTBOOK_PAGE_SIZE
  } catch (err) {
    toastService.error('Error loading more messages.')
  }
  loadingMore.value = false
}

async function post() {
  posting.value = true
  try {
    await guestbookService.post(props.profileUserId, draft.value)
    draft.value = ''
    toastService.success('Message posted! 💖')
    await load()
  } catch (err) {
    toastService.error(err.message)
  }
  posting.value = false
}

async function remove(entry) {
  if (!window.confirm('Delete this message?')) return
  try {
    await guestbookService.remove(entry.id)
    entries.value = entries.value.filter(e => e.id !== entry.id)
    toastService.success('Message deleted')
  } catch (err) {
    toastService.error(err.message)
  }
}

watch(() => props.profileUserId, load)
onMounted(load)
</script>

<style lang="scss" scoped>
.gb-panel {
  margin-top: 24px;
}

.gb-title {
  font-size: 1.15rem;
  color: var(--purple-dark);
  margin-bottom: 12px;
}

.gb-form {
  margin-bottom: 16px;
}

.gb-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 0.85rem;
  font-family: inherit;
  resize: vertical;
}

.gb-form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.gb-count {
  font-size: 0.72rem;
  color: var(--text-light);
}

.gb-entry {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 8px;
  background: var(--card-bg, #fff);
}

.gb-entry-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.gb-author {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.gb-author-avatar {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--purple), var(--pink, #ff66cc));
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gb-author-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.gb-timestamp {
  font-size: 0.7rem;
  color: var(--text-light);
}

.gb-message {
  margin-top: 8px;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.gb-empty {
  text-align: center;
  padding: 30px;
  color: var(--text-light);
}

.gb-empty-icon {
  font-size: 2.6rem;
  margin-bottom: 8px;
}

.gb-empty-sub {
  font-size: 0.85rem;
  margin-top: 6px;
}

.gb-load-more {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
}
</style>
