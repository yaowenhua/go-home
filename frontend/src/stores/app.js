import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { entriesApi } from '../api'
import { useAuthStore } from './auth'

const DEFAULT_LIFE_EXPECTANCY = 80
const STORAGE_KEY = 'go_home_user'

// --- Math helpers (exported for composable reuse) ---
export function calcTotalDays(birthDate, lifeExpectancy = DEFAULT_LIFE_EXPECTANCY) {
  const birth = dayjs(birthDate)
  const end = birth.add(lifeExpectancy, 'year')
  return end.diff(birth, 'day')
}

export function calcPassedDays(birthDate) {
  return dayjs().diff(dayjs(birthDate), 'day')
}

export function calcRemainingDays(birthDate, lifeExpectancy = DEFAULT_LIFE_EXPECTANCY) {
  return calcTotalDays(birthDate, lifeExpectancy) - calcPassedDays(birthDate)
}

// --- Storage helpers ---
function loadFromStorage(key, fallback = null) {
  try {
    const d = localStorage.getItem(key)
    return d ? JSON.parse(d) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // silently fail
  }
}

export const useAppStore = defineStore('app', () => {
  // ============ User State ============
  const user = ref(null)
  const isOnboarded = ref(false)
  const isHydrated = ref(false)
  const lifeExpectancy = ref(DEFAULT_LIFE_EXPECTANCY)
  const isLoading = ref(false)

  // ============ Entry State ============
  const entries = ref([])
  const selectedDate = ref('')
  const isLoadingEntries = ref(false)

  // ============ UI State ============
  const showForm = ref(false)
  const editingEntry = ref(null)

  // ============ Computed ============
  const birthDate = computed(() => user.value?.birthDate || user.value?.birth_date || '')

  // ============ Actions ============

  function setBirthDate(birthDate) {
    const u = { ...(user.value || {}), birthDate }
    user.value = u
    isOnboarded.value = true
    lifeExpectancy.value = DEFAULT_LIFE_EXPECTANCY
    saveToStorage(STORAGE_KEY, u)
  }

  function checkOnboarding() {
    const savedUser = loadFromStorage(STORAGE_KEY, null)
    if (savedUser?.birthDate) {
      user.value = savedUser
      isOnboarded.value = true
      isHydrated.value = true
      lifeExpectancy.value = savedUser.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY
      return true
    }

    // V2: 检查 auth store 的登录用户信息
    try {
      const authUser = JSON.parse(localStorage.getItem('go_home_user_info') || 'null')
      if (authUser?.birth_date) {
        const u = {
          username: authUser.display_name || authUser.username || 'user',
          birthDate: authUser.birth_date,
          lifeExpectancy: authUser.life_expectancy || DEFAULT_LIFE_EXPECTANCY,
        }
        saveToStorage(STORAGE_KEY, u)
        user.value = u
        isOnboarded.value = true
        isHydrated.value = true
        lifeExpectancy.value = u.lifeExpectancy
        return true
      }
    } catch {
      // ignore
    }

    // Legacy fallback
    const legacyBirthDate = loadFromStorage('return_home_birth_date', null)
    if (legacyBirthDate) {
      const u = { username: 'user', birthDate: legacyBirthDate }
      saveToStorage(STORAGE_KEY, u)
      user.value = u
      isOnboarded.value = true
      isHydrated.value = true
      return true
    }
    isHydrated.value = true
    return false
  }

  async function completeOnboarding(userData) {
    isLoading.value = true
    try {
      if (userData.username && userData.birthDate) {
        const { userApi } = await import('../api')
        await userApi.create({
          username: userData.username,
          birthDate: userData.birthDate,
        })
      }
    } catch (err) {
      console.warn('User sync failed:', err.message)
    }
    const u = {
      username: userData.username || 'user',
      birthDate: userData.birthDate,
      lifeExpectancy: userData.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY,
      onboardingDate: new Date().toISOString(),
    }
    saveToStorage(STORAGE_KEY, u)
    user.value = u
    isOnboarded.value = true
    lifeExpectancy.value = u.lifeExpectancy
    isLoading.value = false
  }

  function setSelectedDate(date) {
    selectedDate.value = date
    loadEntries(date)
  }

  async function loadEntries(date) {
    isLoadingEntries.value = true
    const targetDate = date || dayjs().format('YYYY-MM-DD')
    try {
      const res = await entriesApi.getByDate(targetDate)
      const entryList = (res.data || []).map((e) => ({
        id: e.id,
        content: e.content,
        rating: e.rating || e.satisfaction || 3,
        category: e.category || 'life',
        tags: e.tags ? JSON.parse(e.tags) : [],
        entryDate: e.entryDate || e.entry_date || e.date || targetDate,
        createdAt: e.createdAt || e.created_at,
      }))
      entries.value = entryList
      selectedDate.value = targetDate
      isLoadingEntries.value = false
      return entryList
    } catch {
      // Offline fallback: read from localStorage
      const cached = loadFromStorage(`go_home_entries_${targetDate}`, [])
      entries.value = cached
      selectedDate.value = targetDate
      isLoadingEntries.value = false
      return cached
    }
  }

  function openForm(entry = null) {
    showForm.value = true
    editingEntry.value = entry
  }

  function closeForm() {
    showForm.value = false
    editingEntry.value = null
  }

  async function addEntry(data) {
    const targetDate = selectedDate.value || dayjs().format('YYYY-MM-DD')
    const entry = {
      ...data,
      id: 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      entryDate: targetDate,
      createdAt: new Date().toISOString(),
    }

    // Optimistic update
    const updated = [entry, ...entries.value]
    entries.value = updated
    showForm.value = false
    editingEntry.value = null
    saveToStorage(`go_home_entries_${targetDate}`, updated)

    // Async sync to backend (JWT token provides user identity)
    try {
      await entriesApi.create({
        content: entry.content,
        rating: entry.rating,
        category: entry.category || 'life',
        tags: JSON.stringify(entry.tags || []),
        entry_date: targetDate,
      })
    } catch (err) {
      console.warn('Entry create sync failed:', err.message)
    }
  }

  async function updateEntry(entryData) {
    const targetDate = selectedDate.value || dayjs().format('YYYY-MM-DD')
    const entry = {
      ...entryData,
      id:
        entryData.id ||
        'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      entryDate: entryData.entryDate || targetDate,
      createdAt: entryData.createdAt || new Date().toISOString(),
    }

    const exists = entries.value.some((e) => e.id === entry.id)
    const updated = exists
      ? entries.value.map((e) => (e.id === entry.id ? { ...e, ...entry } : e))
      : [entry, ...entries.value]

    entries.value = updated
    showForm.value = false
    editingEntry.value = null
    saveToStorage(`go_home_entries_${targetDate}`, updated)

    try {
      if (exists) {
        await entriesApi.update(entry.id, {
          content: entry.content,
          rating: entry.rating,
          category: entry.category || 'life',
          tags: JSON.stringify(entry.tags || []),
          entry_date: targetDate,
        })
      } else {
        await entriesApi.create({
          content: entry.content,
          rating: entry.rating,
          category: entry.category || 'life',
          tags: JSON.stringify(entry.tags || []),
          entry_date: targetDate,
        })
      }
    } catch (err) {
      console.warn('Entry sync failed:', err.message)
    }
  }

  async function deleteEntry(entryId) {
    const targetDate = selectedDate.value || dayjs().format('YYYY-MM-DD')
    const filtered = entries.value.filter((e) => e.id !== entryId)
    entries.value = filtered
    saveToStorage(`go_home_entries_${targetDate}`, filtered)
    try {
      await entriesApi.delete(entryId)
    } catch {
      console.warn('Entry delete sync failed')
    }
  }

  function setLifeExpectancy(years) {
    lifeExpectancy.value = years
    if (user.value) {
      const u = { ...user.value, lifeExpectancy: years }
      user.value = u
      saveToStorage(STORAGE_KEY, u)
    }
  }

  function updateProfile(data) {
    const u = { ...(user.value || {}), ...data }
    user.value = u
    saveToStorage(STORAGE_KEY, u)
  }

  return {
    // State
    user,
    isOnboarded,
    isHydrated,
    lifeExpectancy,
    isLoading,
    entries,
    selectedDate,
    isLoadingEntries,
    showForm,
    editingEntry,
    // Computed
    birthDate,
    // Actions
    setBirthDate,
    checkOnboarding,
    completeOnboarding,
    setSelectedDate,
    loadEntries,
    openForm,
    closeForm,
    addEntry,
    updateEntry,
    deleteEntry,
    setLifeExpectancy,
    updateProfile,
  }
})
