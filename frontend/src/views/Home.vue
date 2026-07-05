<script setup>
import { onMounted } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import { useCountdown } from '../composables/useCountdown'
import ProgressBar from '../components/ProgressBar.vue'
import EntryCard from '../components/EntryCard.vue'
import EntryForm from '../components/EntryForm.vue'
import styles from './Home.module.css'

const store = useAppStore()
const { remainingDays, passedDays, totalDays, progress, isBirthday, today } =
  useCountdown()

onMounted(() => {
  store.loadEntries(today.value)
})

function getGreeting() {
  const hour = dayjs().hour()
  if (hour < 6) return '夜深了，早点休息 🌙'
  if (hour < 9) return '早安，新的一天开始了 🌅'
  if (hour < 12) return '上午好，加油 ☀️'
  if (hour < 14) return '中午好，记得吃饭 🍚'
  if (hour < 18) return '下午好 🌤️'
  if (hour < 21) return '傍晚好 🌆'
  return '晚上好，今天也辛苦了 🌙'
}

function handleEdit(entry) {
  store.openForm(entry)
}

function handleDelete(entryId) {
  if (window.confirm('确定删除这条记录吗？')) {
    store.deleteEntry(entryId)
  }
}

function handleAddEntry() {
  store.openForm()
}

const isToday = store.selectedDate === today.value
</script>

<template>
  <div :class="styles.page">
    <!-- Header -->
    <div :class="styles.header">
      <div v-if="isBirthday" :class="styles.birthdayBanner">🎂 生日快乐！</div>
      <p :class="styles.greeting">{{ getGreeting() }}</p>
    </div>

    <!-- Remaining days - hero section -->
    <section :class="styles.hero">
      <p :class="styles.remainingLabel">余生还剩</p>
      <div :class="styles.remainingNumber">
        {{ remainingDays.toLocaleString() }}
      </div>
      <p :class="styles.remainingUnit">天</p>
    </section>

    <!-- Progress bar -->
    <section :class="styles.progressSection">
      <ProgressBar
        :progress="progress"
        :passed-days="passedDays"
        :total-days="totalDays"
      />
    </section>

    <!-- Today's entries -->
    <section :class="styles.entriesSection">
      <div :class="styles.sectionHeader">
        <h2 :class="styles.sectionTitle">
          {{ isToday ? '今日记录' : dayjs(store.selectedDate).format('M月D日') + ' 记录' }}
        </h2>
        <span :class="styles.entryCount">
          {{ store.entries.length }} 条记录
        </span>
      </div>

      <div v-if="store.isLoadingEntries" :class="styles.empty">
        <div :class="styles.loading">
          <div :class="styles.spinner" />
          <p>加载中...</p>
        </div>
      </div>
      <div v-else-if="store.entries.length > 0" :class="styles.entryList">
        <EntryCard
          v-for="entry in store.entries"
          :key="entry.id"
          :entry="entry"
          @edit="handleEdit"
          @delete="handleDelete"
        />
      </div>
      <div v-else :class="styles.empty">
        <span :class="styles.emptyIcon">📝</span>
        <p :class="styles.emptyText">
          {{ isToday ? '今天还没有记录\n点击下方按钮开始记录' : '这一天还没有记录' }}
        </p>
      </div>
    </section>

    <!-- Spacer for bottom nav -->
    <div :class="styles.bottomSpacer" />

    <!-- FAB - Add entry -->
    <button
      :class="styles.fab"
      @click="handleAddEntry"
      aria-label="添加记录"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>

    <!-- Entry form modal -->
    <EntryForm />
  </div>
</template>
