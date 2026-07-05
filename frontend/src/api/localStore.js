/**
 * Local storage persistence layer for offline support.
 * Falls back to localStorage when backend is unreachable.
 */

const STORAGE_KEYS = {
  USER: 'go_home_user',
  ENTRIES: 'go_home_entries',
  SYNC_QUEUE: 'go_home_sync_queue',
}

const DEFAULT_LIFE_EXPECTANCY = 80

function getLifeExpectancy() {
  return DEFAULT_LIFE_EXPECTANCY
}

// ===== User =====

export function loadLocalUser() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function saveLocalUser(user) {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
  } catch (e) {
    console.error('Failed to save user locally:', e)
  }
}

export function clearLocalUser() {
  localStorage.removeItem(STORAGE_KEYS.USER)
}

// ===== Entries =====

export function loadLocalEntries() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ENTRIES)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function saveLocalEntries(entriesMap) {
  try {
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entriesMap))
  } catch (e) {
    console.error('Failed to save entries locally:', e)
  }
}

export function getLocalEntriesForDate(date) {
  const all = loadLocalEntries()
  return all[date] || []
}

export function addLocalEntry(date, entry) {
  const all = loadLocalEntries()
  if (!all[date]) all[date] = []
  all[date].push(entry)
  saveLocalEntries(all)
  return entry
}

export function updateLocalEntry(entryId, updates) {
  const all = loadLocalEntries()
  for (const date of Object.keys(all)) {
    const idx = all[date].findIndex((e) => e.id === entryId)
    if (idx !== -1) {
      all[date][idx] = { ...all[date][idx], ...updates }
      saveLocalEntries(all)
      return all[date][idx]
    }
  }
  return null
}

export function deleteLocalEntry(entryId) {
  const all = loadLocalEntries()
  for (const date of Object.keys(all)) {
    const idx = all[date].findIndex((e) => e.id === entryId)
    if (idx !== -1) {
      all[date].splice(idx, 1)
      if (all[date].length === 0) delete all[date]
      saveLocalEntries(all)
      return true
    }
  }
  return false
}

// ===== Sync Queue (for offline -> online sync) =====

export function getSyncQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || '[]')
  } catch {
    return []
  }
}

export function addToSyncQueue(action) {
  const queue = getSyncQueue()
  queue.push({ ...action, timestamp: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue))
}

export function clearSyncQueue() {
  localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE)
}

// ===== Helpers =====

export function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export { STORAGE_KEYS, DEFAULT_LIFE_EXPECTANCY, getLifeExpectancy }
