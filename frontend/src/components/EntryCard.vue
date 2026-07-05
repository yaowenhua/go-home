<script setup>
import StarRating from './StarRating.vue'
import styles from './EntryCard.module.css'

const props = defineProps({
  entry: { type: Object, required: true },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['edit', 'delete'])

const CATEGORY_LABELS = {
  work: '工作',
  study: '学习',
  life: '生活',
  health: '健康',
  entertainment: '娱乐',
  other: '其他',
}

const CATEGORY_COLORS = {
  work: 'var(--color-work)',
  study: 'var(--color-study)',
  life: 'var(--color-life)',
  health: 'var(--color-health)',
  entertainment: 'var(--color-entertainment)',
  other: 'var(--color-other)',
}

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || '其他'
}

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.other
}

function formatTime(createdAt) {
  if (!createdAt) return ''
  try {
    return new Date(createdAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function handleEdit() {
  emit('edit', props.entry)
}

function handleDelete() {
  emit('delete', props.entry.id)
}
</script>

<template>
  <div :class="styles.card">
    <div :class="styles.header">
      <span
        :class="styles.category"
        :style="{ backgroundColor: categoryColor(entry.category) }"
      >
        {{ categoryLabel(entry.category) }}
      </span>
      <StarRating :model-value="entry.rating" readonly :size="18" />
    </div>

    <p :class="styles.content">{{ entry.content }}</p>

    <div :class="styles.footer">
      <span :class="styles.time">
        {{ formatTime(entry.createdAt) }}
      </span>
      <div v-if="!readonly" :class="styles.actions">
        <button
          :class="styles.actionBtn"
          @click="handleEdit"
          aria-label="编辑"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          :class="[styles.actionBtn, styles.deleteBtn]"
          @click="handleDelete"
          aria-label="删除"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
