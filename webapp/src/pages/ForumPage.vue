<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="page-hero">
      <div class="sparkle-row">💬 ✦ 💬</div>
      <h1>Forum</h1>
      <p>Chat with the community, share tips, and make friends! 🌐</p>
    </div>

    <div v-if="isModerator" class="mb-3">
      <button class="btn btn-outline btn-sm" @click="openAdmin">🛡️ Moderator Panel</button>
    </div>

    <div v-if="loading" class="spinner"></div>

    <!-- Categories -->
    <template v-else-if="view === 'categories'">
      <div v-if="!categories.length" class="empty-state">
        <div class="empty-icon">📂</div>
        <p>No forum categories yet.</p>
      </div>
      <div
        v-for="c in categories"
        :key="c.id"
        class="fm-category-card d-flex align-items-center gap-3 p-3 mb-2 rounded-4"
        @click="openCategory(c)"
      >
        <div class="fm-category-icon flex-shrink-0">{{ c.icon }}</div>
        <div class="flex-grow-1 min-w-0">
          <div class="fm-category-name">{{ c.name }}</div>
          <div class="fm-category-desc mt-px2">{{ c.description }}</div>
        </div>
        <div class="text-center flex-shrink-0">
          <div class="fm-stat-number">{{ c.threadCount }}</div>
          <div class="fm-stat-label">Threads</div>
        </div>
      </div>
    </template>

    <!-- Thread list -->
    <template v-else-if="view === 'category'">
      <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
        <button class="btn btn-outline btn-sm" @click="backToCategories">← All Categories</button>
        <h2 class="fm-crumb-title flex-grow-1 min-w-0 m-0">{{ activeCategory.name }}</h2>
        <button class="btn btn-primary btn-sm" @click="openNewThread">✏️ New Thread</button>
      </div>

      <div v-if="banned" class="empty-state">
        <div class="empty-icon">🚫</div>
        <p>You have been banned from posting</p>
      </div>
      <template v-else>
        <div v-if="!threads.length" class="empty-state">
          <div class="empty-icon">📝</div>
          <p>No threads yet. Be the first to post!</p>
        </div>
        <div
          v-for="t in threads"
          :key="t.id"
          class="fm-thread-row d-flex align-items-center gap-3 px-3 py-2 mb-2 rounded-3"
          :class="{ pinned: t.is_pinned, locked: t.is_locked }"
          @click="openThread(t.id)"
        >
          <div class="fm-thread-icon flex-shrink-0">{{ t.is_pinned ? '📌' : t.is_locked ? '🔒' : '💬' }}</div>
          <div class="flex-grow-1 min-w-0">
            <div class="fm-thread-title">{{ t.title }}</div>
            <div class="fm-thread-meta mt-px2">
              Started by <strong>{{ t.players ? t.players.username : 'Unknown' }}</strong> • {{ getTimeAgo(new Date(t.created_at)) }}
            </div>
          </div>
          <div class="d-flex gap-4 flex-shrink-0">
            <div class="text-center">
              <div class="fm-thread-stat-number">{{ t.reply_count || 0 }}</div>
              <div class="fm-thread-stat-label">Replies</div>
            </div>
            <div class="text-center">
              <div class="fm-thread-stat-number">{{ t.view_count || 0 }}</div>
              <div class="fm-thread-stat-label">Views</div>
            </div>
          </div>
        </div>
        <button v-if="hasMore" class="btn btn-outline w-100 mt-2 py-2" @click="loadMoreThreads">⬇️ Load More Threads</button>
      </template>
    </template>

    <!-- Single thread -->
    <template v-else-if="view === 'thread'">
      <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
        <button class="btn btn-outline btn-sm" @click="backToCategory">← {{ activeCategory.name }}</button>
        <h2 class="fm-crumb-title flex-grow-1 min-w-0 m-0">{{ thread.title }}</h2>
      </div>

      <ForumPost
        :post="thread"
        :author="thread.players"
        :is-original="true"
        :is-moderator="isModerator"
        @delete="deletePost(thread.id, 'thread')"
        @toggle-pin="togglePin"
        @toggle-lock="toggleLock"
      />
      <ForumPost
        v-for="r in replies"
        :key="r.id"
        :post="r"
        :author="r.players"
        :is-original="false"
        :is-moderator="isModerator"
        @delete="deletePost(r.id, 'reply')"
      />

      <div v-if="thread.is_locked && !isModerator" class="fm-locked-note text-center mt-4 p-3 rounded-3">
        🔒 This thread is locked.
      </div>
      <div v-else class="mt-4">
        <textarea v-model="replyDraft" class="fm-input mb-2 p-2 rounded-3" rows="4" placeholder="Write a reply..."></textarea>
        <div class="d-flex flex-wrap gap-1 mb-2">
          <button v-for="e in EMOJI" :key="e" class="fm-emoji px-2 py-1 rounded-2" @click="replyDraft += e">{{ e }}</button>
        </div>
        <button class="btn btn-primary btn-sm" :disabled="posting || !replyDraft.trim()" @click="submitReply">Post Reply</button>
      </div>
    </template>

    <!-- New thread modal -->
    <div v-if="showNewThread" class="fm-modal-backdrop position-fixed d-flex align-items-center justify-content-center p-gap" @click.self="showNewThread = false">
      <div class="fm-modal w-100 p-gap rounded-4">
        <h3 class="fm-modal-title m-0 mb-3">✏️ New Thread</h3>
        <input v-model="newThreadTitle" class="fm-input mb-2 p-2 rounded-3" type="text" placeholder="Thread title" maxlength="200" />
        <textarea v-model="newThreadContent" class="fm-input mb-2 p-2 rounded-3" rows="6" placeholder="What's on your mind?"></textarea>
        <div class="d-flex flex-wrap gap-1 mb-2">
          <button v-for="e in EMOJI" :key="e" class="fm-emoji px-2 py-1 rounded-2" @click="newThreadContent += e">{{ e }}</button>
        </div>
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button class="btn btn-outline btn-sm" @click="showNewThread = false">Cancel</button>
          <button class="btn btn-primary btn-sm" :disabled="posting" @click="submitThread">Create Thread</button>
        </div>
      </div>
    </div>

    <!-- Moderator panel -->
    <div v-if="showAdmin" class="fm-modal-backdrop position-fixed d-flex align-items-center justify-content-center p-gap" @click.self="showAdmin = false">
      <div class="fm-modal w-100 p-gap rounded-4">
        <h3 class="fm-modal-title m-0 mb-3">🛡️ Moderator Panel</h3>
        <div class="d-flex gap-2 mb-3">
          <button class="fm-admin-tab px-3 py-1 rounded-pill" :class="{ active: adminTab === 'bans' }" @click="switchAdminTab('bans')">Banned Users</button>
          <button class="fm-admin-tab px-3 py-1 rounded-pill" :class="{ active: adminTab === 'recent' }" @click="switchAdminTab('recent')">Recent Posts</button>
        </div>

        <template v-if="adminTab === 'bans'">
          <div class="d-flex flex-column gap-1 mb-3">
            <input v-model="banUsername" class="fm-input p-2 rounded-3" type="text" placeholder="Username to ban" />
            <input v-model="banReason" class="fm-input p-2 rounded-3" type="text" placeholder="Reason (optional)" />
            <button class="btn btn-danger btn-sm" @click="doBan">Ban User</button>
          </div>
          <div v-if="!bans.length" class="fm-admin-empty py-3">No banned users</div>
          <div
            v-for="b in bans"
            :key="b.id"
            class="fm-admin-row d-flex align-items-center justify-content-between gap-2 px-3 py-2 mb-1 rounded-3"
          >
            <div>
              <strong>{{ b.players ? b.players.username : 'Unknown' }}</strong>
              <div v-if="b.reason" class="fm-admin-sub">{{ b.reason }}</div>
            </div>
            <button class="btn btn-outline btn-sm" @click="doUnban(b.user_id)">Unban</button>
          </div>
        </template>

        <template v-else>
          <div v-if="!recentThreads.length" class="fm-admin-empty py-3">No recent posts</div>
          <div
            v-for="t in recentThreads"
            :key="t.id"
            class="fm-admin-row d-flex flex-column align-items-start gap-2 px-3 py-2 mb-1 rounded-3"
          >
            <div>
              <strong>{{ t.title }}</strong>
              <div class="fm-admin-sub">by {{ t.players ? t.players.username : 'Unknown' }} • {{ getTimeAgo(new Date(t.created_at)) }}</div>
            </div>
            <button class="btn btn-danger btn-sm" @click="deletePost(t.id, 'thread', true)">Delete Thread</button>
          </div>
        </template>

        <div class="d-flex justify-content-end gap-2 mt-3">
          <button class="btn btn-outline btn-sm" @click="showAdmin = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { forumService } from '../services/ForumService.js'
import { toastService } from '../services/ToastService.js'
import { getTimeAgo } from '../utils/timeAgo.js'
import ForumPost from '../components/forum/ForumPost.vue'

const EMOJI = ['😀', '😂', '😍', '🥺', '😎', '🎉', '🔥', '💜', '🐾', '⭐', '🎮', '🍉']

const loading = ref(true)
const view = ref('categories')
const isModerator = ref(false)
const banned = ref(false)

const categories = ref([])
const activeCategory = ref({})
const threads = ref([])
const hasMore = ref(false)
let threadPage = 0

const thread = ref({})
const replies = ref([])
const replyDraft = ref('')
const posting = ref(false)

const showNewThread = ref(false)
const newThreadTitle = ref('')
const newThreadContent = ref('')

const showAdmin = ref(false)
const adminTab = ref('bans')
const bans = ref([])
const recentThreads = ref([])
const banUsername = ref('')
const banReason = ref('')

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await forumService.loadCategories()
  } catch (err) {
    toastService.error('Error loading categories')
  }
  loading.value = false
}

async function openCategory(category) {
  activeCategory.value = category
  view.value = 'category'
  threadPage = 0
  loading.value = true
  banned.value = await forumService.isBanned(AppState.user.id)
  if (!banned.value) {
    const res = await forumService.loadThreads(category.id, 0)
    threads.value = res.threads
    hasMore.value = res.hasMore
  }
  loading.value = false
}

async function loadMoreThreads() {
  threadPage++
  const res = await forumService.loadThreads(activeCategory.value.id, threadPage)
  threads.value = threads.value.concat(res.threads)
  hasMore.value = res.hasMore
}

async function openThread(threadId) {
  loading.value = true
  view.value = 'thread'
  try {
    const res = await forumService.loadThread(threadId)
    thread.value = res.thread
    replies.value = res.replies
  } catch (err) {
    toastService.error(err.message)
    view.value = 'category'
  }
  loading.value = false
}

function backToCategories() {
  view.value = 'categories'
}

function backToCategory() {
  view.value = 'category'
  openCategory(activeCategory.value)
}

function openNewThread() {
  newThreadTitle.value = ''
  newThreadContent.value = ''
  showNewThread.value = true
}

async function submitThread() {
  posting.value = true
  try {
    await forumService.createThread(activeCategory.value.id, newThreadTitle.value, newThreadContent.value)
    showNewThread.value = false
    toastService.success('Thread created!')
    await openCategory(activeCategory.value)
  } catch (err) {
    toastService.error(err.message)
  }
  posting.value = false
}

async function submitReply() {
  posting.value = true
  try {
    await forumService.createReply(thread.value.id, replyDraft.value)
    replyDraft.value = ''
    toastService.success('Reply posted!')
    await openThread(thread.value.id)
  } catch (err) {
    toastService.error(err.message)
  }
  posting.value = false
}

async function deletePost(postId, postType, fromAdminPanel = false) {
  if (!window.confirm('Are you sure you want to delete this ' + postType + '?')) return
  try {
    await forumService.deletePost(postId, postType, isModerator.value)
    toastService.success(postType === 'thread' ? 'Thread deleted' : 'Reply deleted')
    if (fromAdminPanel) {
      recentThreads.value = recentThreads.value.filter(t => t.id !== postId)
    } else if (postType === 'thread') {
      backToCategory()
    } else {
      await openThread(thread.value.id)
    }
  } catch (err) {
    toastService.error(err.message)
  }
}

async function togglePin() {
  try {
    await forumService.setPinned(thread.value.id, !thread.value.is_pinned)
    toastService.success(thread.value.is_pinned ? 'Thread unpinned' : 'Thread pinned')
    await openThread(thread.value.id)
  } catch (err) {
    toastService.error(err.message)
  }
}

async function toggleLock() {
  try {
    await forumService.setLocked(thread.value.id, !thread.value.is_locked)
    toastService.success(thread.value.is_locked ? 'Thread unlocked' : 'Thread locked')
    await openThread(thread.value.id)
  } catch (err) {
    toastService.error(err.message)
  }
}

function openAdmin() {
  showAdmin.value = true
  switchAdminTab('bans')
}

async function switchAdminTab(tab) {
  adminTab.value = tab
  if (tab === 'bans') bans.value = await forumService.loadBans()
  else recentThreads.value = await forumService.loadRecentThreads()
}

async function doBan() {
  try {
    await forumService.banUser(banUsername.value, banReason.value)
    banUsername.value = ''
    banReason.value = ''
    toastService.success('User banned')
    bans.value = await forumService.loadBans()
  } catch (err) {
    toastService.error(err.message)
  }
}

async function doUnban(userId) {
  try {
    await forumService.unbanUser(userId)
    toastService.success('User unbanned')
    bans.value = await forumService.loadBans()
  } catch (err) {
    toastService.error(err.message)
  }
}

onMounted(async () => {
  isModerator.value = await forumService.loadModeratorStatus(AppState.user.id)
  await loadCategories()
})
</script>

<style lang="scss" scoped>
// Layout (flex/grid, spacing, radii, centering) is expressed with Bootstrap
// utilities in the template. What remains here is only what utilities can't
// express: the game's colors, the pinned/locked accents, and the modal chrome.

.fm-category-card {
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);
  cursor: pointer;

  &:hover {
    border-color: var(--purple);
    background: rgba(153, 102, 255, 0.05);
  }
}

.fm-category-icon {
  font-size: 2rem;
}

.fm-category-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--purple-dark);
}

.fm-category-desc {
  font-size: 0.8rem;
  color: var(--text-light);
}

.fm-stat-number {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--purple);
}

.fm-stat-label {
  font-size: 0.68rem;
  color: var(--text-light);
}

.fm-crumb-title {
  font-size: 1.1rem;
  color: var(--purple-dark);
}

.fm-thread-row {
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);
  cursor: pointer;

  &:hover {
    border-color: var(--purple);
  }

  &.pinned {
    border-left: 4px solid #ffd43b;
  }

  &.locked {
    opacity: 0.75;
  }
}

.fm-thread-icon {
  font-size: 1.3rem;
}

.fm-thread-title {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--purple-dark);
}

.fm-thread-meta {
  font-size: 0.74rem;
  color: var(--text-light);
}

.fm-thread-stat-number {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--purple);
}

.fm-thread-stat-label {
  font-size: 0.65rem;
  color: var(--text-light);
}

.fm-locked-note {
  border: 1px dashed var(--border);
  color: var(--text-light);
  font-size: 0.85rem;
}

// Shared by every text input and textarea in this view.
.fm-input {
  width: 100%;
  border: 1px solid var(--border);
  font-size: 0.85rem;
  font-family: inherit;
  resize: vertical;
}

.fm-emoji {
  border: 1px solid var(--border);
  background: transparent;
  font-size: 1rem;
  cursor: pointer;

  &:hover {
    background: rgba(153, 102, 255, 0.1);
  }
}

.fm-modal-backdrop {
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
}

.fm-modal {
  background: var(--white, #fff);
  max-width: 540px;
  max-height: 86vh;
  overflow-y: auto;
  // Explicit: the modal is genuinely 16px, while `rounded-4` maps to the
  // design's more common 14px card radius.
  border-radius: 16px;
}

.fm-modal-title {
  font-size: 1.1rem;
  color: var(--purple-dark);
}

.fm-admin-tab {
  border: 1px solid var(--border);
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-light);
  cursor: pointer;

  &.active {
    background: var(--purple);
    border-color: var(--purple);
    color: #fff;
  }
}

.fm-admin-row {
  border: 1px solid var(--border);
}

.fm-admin-sub {
  font-size: 0.75rem;
  color: var(--text-light);
  margin-top: 2px;
}

.fm-admin-empty {
  color: var(--text-light);
  font-size: 0.85rem;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-light);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}
</style>
