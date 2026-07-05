<script setup>
import { ref, onMounted, computed } from 'vue'
import { adminApi } from '../../api/admin'
import dayjs from 'dayjs'
import styles from './AdminStats.module.css'

// ============ State ============
const overview = ref(null)
const dauTrend = ref([])
const loading = ref(true)
const error = ref('')
const trendDays = ref(30)

// ============ Computed ============
const formattedTrend = computed(() => {
  return dauTrend.value.map((item) => ({
    ...item,
    displayDate: dayjs(item.date).format('M/D'),
    dayOfWeek: dayjs(item.date).format('dd'),
  }))
})

const maxDau = computed(() => {
  if (dauTrend.value.length === 0) return 1
  return Math.max(...dauTrend.value.map((d) => d.dau), 1)
})

// ============ Fetch ============
async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const [overviewRes, trendRes] = await Promise.all([
      adminApi.getStatsOverview(),
      adminApi.getDAUTrend(trendDays.value),
    ])
    overview.value = overviewRes.data || overviewRes
    dauTrend.value = trendRes.data || []
  } catch (err) {
    error.value = err.message || '获取统计数据失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

// ============ Helpers ============
function trendHeight(dau) {
  return Math.max((dau / maxDau.value) * 100, 4)
}
</script>

<template>
  <div :class="styles.page">
    <!-- Header -->
    <div :class="styles.header">
      <div>
        <h1 :class="styles.title">数据统计</h1>
        <p :class="styles.subtitle">平台运营数据总览</p>
      </div>
    </div>

    <!-- Error -->
    <p v-if="error" :class="styles.error">{{ error }}</p>

    <!-- Loading -->
    <p v-if="loading" :class="styles.loading">加载中...</p>

    <template v-if="!loading && !error">
      <!-- Overview Cards -->
      <div :class="styles.cards">
        <div :class="styles.card">
          <span :class="styles.cardIcon">👥</span>
          <div :class="styles.cardInfo">
            <p :class="styles.cardValue">{{ overview?.totalUsers ?? '—' }}</p>
            <p :class="styles.cardLabel">总用户数</p>
          </div>
        </div>

        <div :class="styles.card">
          <span :class="styles.cardIcon">📝</span>
          <div :class="styles.cardInfo">
            <p :class="styles.cardValue">{{ overview?.totalEntries ?? '—' }}</p>
            <p :class="styles.cardLabel">总日记数</p>
          </div>
        </div>

        <div :class="[styles.card, styles.cardHighlight]">
          <span :class="styles.cardIcon">☀️</span>
          <div :class="styles.cardInfo">
            <p :class="styles.cardValue">{{ overview?.dau ?? '—' }}</p>
            <p :class="styles.cardLabel">日活跃用户 (DAU)</p>
          </div>
        </div>

        <div :class="styles.card">
          <span :class="styles.cardIcon">📅</span>
          <div :class="styles.cardInfo">
            <p :class="styles.cardValue">{{ overview?.wau ?? '—' }}</p>
            <p :class="styles.cardLabel">周活跃用户 (WAU)</p>
          </div>
        </div>

        <div :class="styles.card">
          <span :class="styles.cardIcon">📊</span>
          <div :class="styles.cardInfo">
            <p :class="styles.cardValue">{{ overview?.mau ?? '—' }}</p>
            <p :class="styles.cardLabel">月活跃用户 (MAU)</p>
          </div>
        </div>

        <div :class="styles.card">
          <span :class="styles.cardIcon">🆕</span>
          <div :class="styles.cardInfo">
            <p :class="styles.cardValue">{{ overview?.usersToday ?? '—' }}</p>
            <p :class="styles.cardLabel">今日新增用户</p>
          </div>
        </div>
      </div>

      <!-- DAU Trend -->
      <div :class="styles.section">
        <div :class="styles.sectionHeader">
          <h2 :class="styles.sectionTitle">DAU 趋势（近{{ trendDays }}天）</h2>
        </div>

        <div :class="styles.trendCard">
          <div v-if="dauTrend.length === 0" :class="styles.emptyTrend">
            暂无趋势数据
          </div>

          <div v-else :class="styles.trendChart">
            <!-- Y-axis labels -->
            <div :class="styles.yAxis">
              <span>{{ maxDau }}</span>
              <span>{{ Math.round(maxDau / 2) }}</span>
              <span>0</span>
            </div>

            <!-- Bars -->
            <div :class="styles.bars">
              <div
                v-for="(item, i) in formattedTrend"
                :key="item.date"
                :class="styles.barCol"
                :title="`${item.date}: ${item.dau} DAU`"
              >
                <div
                  :class="[styles.bar, i === formattedTrend.length - 1 && styles.barToday]"
                  :style="{ height: trendHeight(item.dau) + '%' }"
                >
                  <span v-if="item.dau > 0" :class="styles.barValue">{{ item.dau }}</span>
                </div>
                <span :class="styles.barDate">{{ item.displayDate }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Today's Stats -->
      <div :class="styles.section">
        <h2 :class="styles.sectionTitle">今日概览</h2>
        <div :class="styles.todayGrid">
          <div :class="styles.todayItem">
            <span :class="styles.todayLabel">今日新增用户</span>
            <span :class="styles.todayValue">{{ overview?.usersToday ?? '—' }}</span>
          </div>
          <div :class="styles.todayItem">
            <span :class="styles.todayLabel">今日新增日记</span>
            <span :class="styles.todayValue">{{ overview?.entriesToday ?? '—' }}</span>
          </div>
          <div :class="styles.todayItem">
            <span :class="styles.todayLabel">今日活跃用户</span>
            <span :class="styles.todayValue">{{ overview?.dau ?? '—' }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
