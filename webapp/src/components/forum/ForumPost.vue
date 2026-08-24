<template>
  <div class="fp-post" :class="{ original: isOriginal }">
    <div class="fp-sidebar">
      <div class="fp-avatar">{{ initial }}</div>
      <div class="fp-username">{{ authorName }}</div>
      <div class="fp-stats">Posts: {{ author ? author.forum_post_count || 0 : 0 }}</div>
    </div>
    <div class="fp-main">
      <div class="fp-top">
        <div class="fp-date">{{ getTimeAgo(new Date(post.created_at)) }}</div>
        <div class="fp-actions">
          <button v-if="isModerator && isOriginal" class="fp-action" @click="$emit('toggle-pin')">
            {{ post.is_pinned ? '📌 Unpin' : '📌 Pin' }}
          </button>
          <button v-if="isModerator && isOriginal" class="fp-action" @click="$emit('toggle-lock')">
            {{ post.is_locked ? '🔓 Unlock' : '🔒 Lock' }}
          </button>
          <button v-if="canDelete" class="fp-action danger" @click="$emit('delete')">🗑️ Delete</button>
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
.fp-post {
  display: flex;
  gap: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card-bg, #fff);
  margin-bottom: 10px;
  overflow: hidden;

  &.original {
    border-color: var(--purple);
  }
}

.fp-sidebar {
  flex-shrink: 0;
  width: 110px;
  padding: 14px 10px;
  text-align: center;
  background: rgba(153, 102, 255, 0.07);
}

.fp-avatar {
  width: 46px;
  height: 46px;
  margin: 0 auto 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--purple), var(--pink, #ff66cc));
  color: #fff;
  font-weight: 700;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
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
  margin-top: 4px;
}

.fp-main {
  flex: 1;
  min-width: 0;
  padding: 14px;
}

.fp-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  margin-bottom: 10px;
}

.fp-date {
  font-size: 0.72rem;
  color: var(--text-light);
}

.fp-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.fp-action {
  border: 1px solid var(--border);
  background: transparent;
  border-radius: 8px;
  padding: 3px 8px;
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
