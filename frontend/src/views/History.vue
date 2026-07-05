<script setup>
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import EntryCard from '../components/EntryCard.vue'
import EntryForm from '../components/EntryForm.vue'
import styles from './History.module.css'

const store = useAppStore()

const currentMonth = ref(dayjs())
const selectedDateInternal = ref(store.selectedDate || dayjs().format('YYYY-MM-DD'))

const weekDayNames = ['日', '一', '二', '三', '四', '五', '六']

const today = computed(() => dayjs().format('YYYY-MM-DD'))

const calendarDays = computed(() => {
  const startOfMonth = currentMonth.value.startOf('month')
  const endOfMonth = currentMonth.value.endOf('month')
  const startDay = startOfMonth.day() // 0 = Sunday
  const days = []

  // Previous month's trailing days
  const prevMonth = currentMonth.value.subtract(1, 'month')
  const prevDaysCount = startDay
  const prevMonthEnd = prevMonth.endOf('month').date()
  for (let i = prevDaysCount - 1; i >= 0; i--) {
    days.push({
      date: prevMonth.date(prevMonthEnd - i).format('YYYY-MM-DD'),
      day: prevMonthEnd - i,
      isCurrentMonth: false,
    })
  }

  // Current month
  for (let i = 1; i <= endOfMonth.date(); i++) {
    days.push({
      date: currentMonth.value.date(i).format('YYYY-MM-DD'),
      day: i,
      isCurrentMonth: true,
    })
  }

  // Next month's leading days (to fill 6 rows = 42 cells)
  const remainingDays = 42 - days.length
  const nextMonth = currentMonth.value.add(1, 'month')
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: nextMonth.date(i).format('YYYY-MM-DD'),
      day: i,
      isCurrentMonth: false,
    })
  }

  return days
})

onMounted(() => {
  store.loadEntries(selectedDateInternal.value)
})

function handleDateClick(date) {
  selectedDateInternal.value = date
  store.setSelectedDate(date)
}

function handlePrevMonth() {
  currentMonth.value = currentMonth.value.subtract(1, 'month')
}

function handleNextMonth() {
  const next = currentMonth.value.add(1, 'month')
  if (!next.isAfter(dayjs(), 'month')) {
    currentMonth.value = next
  }
}

const canGoNext = computed(
  () => !currentMonth.value.isSame(dayjs(), 'month')
)
</script>

<template>
  <div :class="styles.page">
    <!-- Month Navigation -->
    <div :class="styles.monthNav">
      <button
        :class="styles.navBtn"
        @click="handlePrevMonth"
        aria-label="上个月"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <h2 :class="styles.monthTitle">
        {{ currentMonth.format('YYYY年M月') }}
      </h2>

      <button
        :class="styles.navBtn"
        @click="handleNextMonth"
        :disabled="!canGoNext"
        aria-label="下个月"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>

    <!-- Calendar Grid -->
    <div :class="styles.calendar">
      <div :class="styles.weekDays">
        <span v-for="name in weekDayNames" :key="name" :class="styles.weekDay">
          {{ name }}
        </span>
      </div>

      <div :class="styles.dayGrid">
        <button
          v-for="{ date, day, isCurrentMonth } in calendarDays"
          :key="date"
          :class="[
            styles.dayCell,
            !isCurrentMonth && styles.otherMonth,
            date === selectedDateInternal && styles.selected,
            date === today && styles.today,
          ]"
          @click="handleDateClick(date)"
        >
          <span :class="styles.dayNumber">{{ day }}</span>
        </button>
      </div>
    </div>

    <!-- Selected Date Entries -->
    <div :class="styles.entriesSection">
      <div :class="styles.sectionHeader">
        <h3 :class="styles.sectionTitle">
          {{ dayjs(selectedDateInternal).format('M月D日') }} 的记录
        </h3>
        <span :class="styles.entryCount">
          {{ store.entries.length }} 条
        </span>
      </div>

      <div v-if="store.isLoadingEntries" :class="styles.loading">
        <div :class="styles.spinner" />
      </div>
      <div v-else-if="store.entries.length > 0" :class="styles.entryList">
        <EntryCard
          v-for="entry in store.entries"
          :key="entry.id"
          :entry="entry"
          readonly
        />
      </div>
      <div v-else :class="styles.empty">
        <span :class="styles.emptyIcon">📭</span>
        <p :class="styles.emptyText">这一天还没有记录</p>
      </div>
    </div>

    <!-- Bottom spacer -->
    <div :class="styles.bottomSpacer" />

    <!-- Entry form modal -->
    <EntryForm />
  </div>
</template>
