<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import styles from './Onboarding.module.css'

const router = useRouter()
const store = useAppStore()

const birthDate = ref('')
const error = ref('')
const slideIndex = ref(0)

const slides = [
  { emoji: '⏳', title: '每一刻都珍贵', subtitle: '记录生活的点滴，珍惜当下的时光' },
  { emoji: '📖', title: '书写人生故事', subtitle: '每天留下足迹，让生活有迹可循' },
  { emoji: '✨', title: '返乡之旅', subtitle: '记录你的旅途，直到归家的那一天' },
]

let slideTimer = null
onMounted(() => {
  slideTimer = setInterval(() => {
    slideIndex.value = (slideIndex.value + 1) % slides.length
  }, 4000)
})
onUnmounted(() => {
  if (slideTimer) clearInterval(slideTimer)
})

const previewAge = computed(() => {
  if (!birthDate.value) return null
  return dayjs().diff(dayjs(birthDate.value), 'year')
})

function handleSubmit() {
  if (!birthDate.value) {
    error.value = '请选择出生日期'
    return
  }

  const birth = dayjs(birthDate.value)
  if (!birth.isValid()) {
    error.value = '日期格式无效'
    return
  }
  if (birth.isAfter(dayjs())) {
    error.value = '出生日期不能是未来'
    return
  }
  if (birth.isBefore(dayjs().subtract(120, 'year'))) {
    error.value = '请输入有效的出生日期'
    return
  }

  error.value = ''
  store.setBirthDate(birthDate.value)
  router.push({ name: 'Home', replace: true })
}

function setSlideIndex(i) {
  slideIndex.value = i
}
</script>

<template>
  <div :class="styles.page">
    <div :class="styles.content">
      <!-- Logo area -->
      <div :class="styles.logo">
        <span :class="styles.logoIcon">🏡</span>
        <h1 :class="styles.appName">返乡</h1>
        <p :class="styles.tagline">Return Home</p>
      </div>

      <!-- Slideshow -->
      <div :class="styles.slideshow">
        <div :class="styles.slideIcon">{{ slides[slideIndex].emoji }}</div>
        <h2 :class="styles.slideTitle">{{ slides[slideIndex].title }}</h2>
        <p :class="styles.slideSubtitle">{{ slides[slideIndex].subtitle }}</p>
        <div :class="styles.dots">
          <span
            v-for="(_, i) in slides"
            :key="i"
            :class="[styles.dot, i === slideIndex && styles.dotActive]"
            @click="setSlideIndex(i)"
          />
        </div>
      </div>

      <!-- Birth date input -->
      <div :class="styles.form">
        <label :class="styles.label">请输入您的出生日期</label>
        <input
          type="date"
          :class="styles.dateInput"
          v-model="birthDate"
          @input="error = ''"
          :max="dayjs().format('YYYY-MM-DD')"
          autofocus
        />

        <p v-if="previewAge !== null" :class="styles.preview">
          您今年 <strong>{{ previewAge }}</strong> 岁
        </p>

        <p v-if="error" :class="styles.error">{{ error }}</p>

        <button
          :class="styles.submitBtn"
          @click="handleSubmit"
          :disabled="!birthDate"
        >
          <span>开始旅程</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
