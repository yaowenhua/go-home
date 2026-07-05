import { ref, computed, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'
import { useAppStore, calcRemainingDays, calcPassedDays, calcTotalDays } from '../stores/app'

export function useCountdown() {
  const store = useAppStore()
  const now = ref(dayjs())

  let timer = null
  onMounted(() => {
    timer = setInterval(() => {
      now.value = dayjs()
    }, 60000) // refresh every minute
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  const birthDate = computed(() => store.user?.birthDate)

  const remainingDays = computed(() =>
    birthDate.value ? calcRemainingDays(birthDate.value, store.lifeExpectancy) : 0
  )
  const passedDays = computed(() =>
    birthDate.value ? calcPassedDays(birthDate.value) : 0
  )
  const totalDays = computed(() =>
    birthDate.value ? calcTotalDays(birthDate.value, store.lifeExpectancy) : 0
  )
  const progress = computed(() => {
    if (!birthDate.value) return 0
    const total = totalDays.value
    return total === 0 ? 0 : Math.min(100, (passedDays.value / total) * 100)
  })

  const isBirthday = computed(() => {
    if (!birthDate.value) return false
    return dayjs(birthDate.value).format('MM-DD') === now.value.format('MM-DD')
  })

  const today = computed(() => now.value.format('YYYY-MM-DD'))

  return { remainingDays, passedDays, totalDays, progress, isBirthday, today, now }
}
