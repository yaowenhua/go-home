<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import styles from './Settings.module.css'

const router = useRouter()
const store = useAppStore()

const name = ref(store.user?.name || '')
const birthDate = ref(store.user?.birthDate || '')
const localLifeExpectancy = ref(store.lifeExpectancy || 80)
const saved = ref(false)
const error = ref('')

let savedTimer = null
watch(saved, (val) => {
  if (val) {
    savedTimer = setTimeout(() => (saved.value = false), 3000)
  }
})
onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer)
})

const age = computed(() => {
  if (!birthDate.value) return 0
  return dayjs().diff(dayjs(birthDate.value), 'year')
})

const remainingDays = computed(() => {
  if (!birthDate.value) return 0
  const end = dayjs(birthDate.value).add(localLifeExpectancy.value, 'year')
  const diff = end.diff(dayjs().startOf('day'), 'day')
  return Math.max(0, diff)
})

function handleSave() {
  error.value = ''

  if (birthDate.value) {
    const birth = dayjs(birthDate.value)
    if (!birth.isValid()) {
      error.value = '日期格式无效'
      return
    }
    if (birth.isAfter(dayjs())) {
      error.value = '出生日期不能是未来'
      return
    }
  }

  try {
    if (birthDate.value !== store.user?.birthDate) {
      store.updateProfile({ birthDate: birthDate.value })
    }
    if (name.value !== store.user?.name) {
      store.updateProfile({ name: name.value })
    }
    store.setLifeExpectancy(localLifeExpectancy.value)
    saved.value = true
  } catch (err) {
    error.value = '保存失败，请重试'
  }
}

function handleReset() {
  if (
    window.confirm(
      '确定重置所有数据吗？\n\n这将会清除所有个人信息和记录，且不可恢复！'
    )
  ) {
    localStorage.clear()
    window.location.href = '/onboarding'
  }
}


</script>

<template>
  <div :class="styles.page">
    <div :class="styles.header">
      <h1 :class="styles.title">设置</h1>
      <p :class="styles.subtitle">管理你的个人信息</p>
    </div>

    <div :class="styles.section">
      <h2 :class="styles.sectionTitle">个人信息</h2>

      <div :class="styles.field">
        <label :class="styles.label">姓名</label>
        <input
          type="text"
          :class="styles.input"
          v-model="name"
          placeholder="你的名字（选填）"
          maxlength="20"
        />
      </div>

      <div :class="styles.field">
        <label :class="styles.label">出生日期</label>
        <input
          type="date"
          :class="styles.input"
          v-model="birthDate"
          :max="dayjs().format('YYYY-MM-DD')"
        />
        <p v-if="age > 0" :class="styles.fieldHint">
          当前 <strong>{{ age }}</strong> 岁
        </p>
      </div>

      <div :class="styles.field">
        <label :class="styles.label">预期寿命</label>
        <div :class="styles.inputGroup">
          <input
            type="number"
            :class="styles.input"
            v-model.number="localLifeExpectancy"
            @input="localLifeExpectancy = Math.max(1, Math.min(150, Number($event.target.value) || 80))"
            min="1"
            max="150"
          />
          <span :class="styles.inputSuffix">年</span>
        </div>
        <p v-if="remainingDays > 0" :class="styles.fieldHint">
          大约还有 <strong>{{ remainingDays.toLocaleString() }}</strong> 天
        </p>
      </div>
    </div>

    <div :class="styles.section">
      <h2 :class="styles.sectionTitle">关于返乡</h2>

      <div :class="styles.infoRow">
        <span :class="styles.infoLabel">版本</span>
        <span :class="styles.infoValue">2.0.0</span>
      </div>

      <div :class="styles.infoRow">
        <span :class="styles.infoLabel">数据存储</span>
        <span :class="styles.infoValue">本地存储</span>
      </div>

      <div :class="styles.infoRow">
        <span :class="styles.infoLabel">创建时间</span>
        <span :class="styles.infoValue">
          {{ store.user?.onboardingDate ? dayjs(store.user.onboardingDate).format('YYYY/M/D') : '—' }}
        </span>
      </div>
    </div>

    <p v-if="error" :class="styles.error">{{ error }}</p>

    <button :class="styles.saveBtn" @click="handleSave">
      {{ saved ? '✓ 已保存' : '保存设置' }}
    </button>

    <button :class="styles.resetBtn" @click="handleReset">
      重置所有数据
    </button>

    <p :class="styles.footer">珍惜每一天，记录生活的美好。</p>

    <div :class="styles.bottomSpacer" />
  </div>
</template>
