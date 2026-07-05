<script setup>
import { ref, watch, nextTick } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import StarRating from './StarRating.vue'
import styles from './EntryForm.module.css'

const store = useAppStore()

const content = ref('')
const rating = ref(3)
const category = ref('life')
const date = ref(dayjs().format('YYYY-MM-DD'))
const isSubmitting = ref(false)
const textareaRef = ref(null)

const CATEGORIES = [
  { value: 'work', label: '工作', icon: '💼' },
  { value: 'study', label: '学习', icon: '📚' },
  { value: 'life', label: '生活', icon: '🏠' },
  { value: 'health', label: '健康', icon: '💪' },
  { value: 'entertainment', label: '娱乐', icon: '🎮' },
  { value: 'other', label: '其他', icon: '📝' },
]

// Reset form when opening/closing
watch(
  () => [store.showForm, store.editingEntry],
  () => {
    if (store.editingEntry) {
      content.value = store.editingEntry.content || ''
      rating.value = store.editingEntry.rating || 3
      category.value = store.editingEntry.category || 'life'
      date.value = store.editingEntry.entryDate || dayjs().format('YYYY-MM-DD')
    } else {
      content.value = ''
      rating.value = 3
      category.value = 'life'
      date.value = dayjs().format('YYYY-MM-DD')
    }
    if (store.showForm && textareaRef.value) {
      nextTick(() => textareaRef.value?.focus())
    }
  }
)

function handleSubmit(e) {
  e.preventDefault()
  if (!content.value.trim()) return

  isSubmitting.value = true

  const data = {
    content: content.value.trim(),
    rating: rating.value,
    category: category.value,
    date: date.value,
  }

  try {
    if (store.editingEntry) {
      store.updateEntry({ ...data, id: store.editingEntry.id })
    } else {
      store.addEntry(data)
    }
    store.closeForm()
  } catch (err) {
    console.error('Failed to save entry:', err)
  } finally {
    isSubmitting.value = false
  }
}

function handleOverlayClick() {
  store.closeForm()
}

function handleModalClick(e) {
  e.stopPropagation()
}
</script>

<template>
  <div v-if="store.showForm" :class="styles.overlay" @click="handleOverlayClick">
    <div
      :class="styles.modal"
      @click="handleModalClick"
      role="dialog"
      :aria-label="store.editingEntry ? '编辑记录' : '添加记录'"
    >
      <div :class="styles.header">
        <h2 :class="styles.title">
          {{ store.editingEntry ? '编辑记录' : '添加记录' }}
        </h2>
        <p :class="styles.subtitle">
          {{ store.editingEntry ? '修改今天的生活记录' : '记录今天的美好瞬间' }}
        </p>
        <button
          :class="styles.closeBtn"
          @click="store.closeForm()"
          aria-label="关闭"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <form :class="styles.form" @submit="handleSubmit">
        <!-- Date -->
        <div :class="styles.field">
          <label :class="styles.label">日期</label>
          <input
            type="date"
            :class="styles.dateInput"
            v-model="date"
            :max="dayjs().format('YYYY-MM-DD')"
          />
        </div>

        <!-- Content -->
        <div :class="styles.field">
          <label :class="styles.label">今天做了什么？</label>
          <textarea
            ref="textareaRef"
            :class="[styles.textarea, content && styles.hasContent]"
            v-model="content"
            placeholder="记录今天的点滴..."
            rows="4"
            maxlength="500"
          />
          <span :class="styles.charCount">{{ content.length }}/500</span>
        </div>

        <!-- Rating -->
        <div :class="styles.field">
          <label :class="styles.label">满意度</label>
          <div :class="styles.ratingWrapper">
            <StarRating v-model="rating" :size="36" />
          </div>
        </div>

        <!-- Category -->
        <div :class="styles.field">
          <label :class="styles.label">分类</label>
          <div :class="styles.categoryGrid">
            <button
              v-for="cat in CATEGORIES"
              :key="cat.value"
              type="button"
              :class="[styles.categoryBtn, category === cat.value && styles.categoryActive]"
              @click="category = cat.value"
              :style="category === cat.value ? {
                borderColor: `var(--color-${cat.value})`,
                backgroundColor: `var(--color-${cat.value})`,
                color: '#fff',
              } : undefined"
            >
              <span :class="styles.categoryIcon">{{ cat.icon }}</span>
              <span>{{ cat.label }}</span>
            </button>
          </div>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :class="styles.submitBtn"
          :disabled="!content.trim() || isSubmitting"
        >
          {{ isSubmitting ? '保存中...' : store.editingEntry ? '更新记录' : '保存记录' }}
        </button>
      </form>
    </div>
  </div>
</template>
