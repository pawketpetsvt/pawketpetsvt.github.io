<template>
  <div class="fp-post d-flex gap-3 mb-2 overflow-hidden rounded-3" :class="{ original: isOriginal }">
    <div class="fp-sidebar flex-shrink-0 text-center px-2 py-3">
      <div class="fp-avatar d-flex align-items-center justify-content-center mx-auto mb-2 rounded-circle">{{ initial }}</div>
      <div class="fp-username">{{ authorName }}</div>
      <div class="fp-stats mt-1">Posts: {{ author ? author.forum_post_count || 0 : 0 }}</div>
    </div>
    <div class="flex-grow-1 min-w-0 p-3">
      <div class="fp-top d-flex flex-wrap align-items-center justify-content-between gap-2 pb-2 mb-2">
        <div class="fp-date">{{ getTimeAgo(new Date(post.created_at)) }}</div>
        <div class="d-flex flex-wrap gap-1">
          <button v-if="isModerator && isOriginal" class="fp-action px-2 py-1 rounded-2" @click="$emit('toggle-pin')">
            {{ post.is_pinned ? '📌 Unpin' : '📌 Pin' }}
          </button>
          <button v-if="isModerator && isOriginal" class="fp-action px-2 py-1 rounded-2" @click="$emit('toggle-lock')">
            {{ post.is_locked ? '🔓 Unlock' : '🔒 Lock' }}
          </button>
          <button v-if="canDelete" class="fp-action danger px-2 py-1 rounded-2" @click="$emit('delete')">🗑️ Delete</button>
        </div>
      </div>
      <div class="fp-body">{{ post.content || post.title }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { AppState } from '../../AppState.js'
import { getTimeAgo } from '../../utils/timeAgo.js'

const props = defineProps({
  post: { type: Object, required: true },
  author: { type: Object, default: null },
  isOriginal: { type: Boolean, default: false },
  isModerator: { type: Boolean, default: false }
})
defineEmits(['delete', 'toggle-pin', 'toggle-lock'])

const authorName = computed(() => (props.author && props.author.username) || 'Unknown')
const initial = computed(() => authorName.value.charAt(0).toUpperCase())
const canDelete = computed(() =>
  props.isModerator || (AppState.user && AppState.user.id === props.post.author_id)
)
</script>

<style lang="scss" scoped>
// Layout via Bootstrap utilities in the template; visuals only here.
.fp-post {
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);

  &.original {
    border-color: var(--purple);
  }
}

.fp-sidebar {
  width: 110px;
  background: rgba(153, 102, 255, 0.07);
}

.fp-avatar {
  width: 46px;
  height: 46px;
  background: linear-gradient(135deg, var(--purple), var(--pink, #ff66cc));
  color: #fff;
  font-weight: 700;
  font-size: 1.2rem;
}

.fp-username {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--purple-dark);
  word-break: break-word;
}

.fp-stats {
  font-size: 0.68rem;
  color: var(--text-light);
}

.fp-top {
  border-bottom: 1px solid var(--border);
}

.fp-date {
  font-size: 0.72rem;
  color: var(--text-light);
}

.fp-action {
  border: 1px solid var(--border);
  background: transparent;
  font-size: 0.7rem;
  cursor: pointer;
  color: var(--text-light);

  &:hover {
    background: rgba(153, 102, 255, 0.1);
  }

  &.danger {
    color: #d63031;
    border-color: rgba(255, 77, 77, 0.4);
  }
}

.fp-body {
  font-size: 0.88rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
