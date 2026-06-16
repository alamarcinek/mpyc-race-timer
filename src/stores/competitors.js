import { defineStore } from 'pinia'
import { ref } from 'vue'

const KEY      = 'mpyc_competitors'
const DATE_KEY = 'mpyc_competitors_date'

function todayStr() { return new Date().toISOString().slice(0, 10) }

export const useCompetitorsStore = defineStore('competitors', () => {
  const competitors = ref([])

  function load() {
    const storedDate = localStorage.getItem(DATE_KEY)
    if (storedDate !== todayStr()) {
      competitors.value = []
      localStorage.removeItem(KEY)
      localStorage.setItem(DATE_KEY, todayStr())
    } else {
      competitors.value = JSON.parse(localStorage.getItem(KEY) || '[]')
    }
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(competitors.value))
    localStorage.setItem(DATE_KEY, todayStr())
  }

  function clear() {
    competitors.value = []
    localStorage.removeItem(KEY)
    localStorage.setItem(DATE_KEY, todayStr())
  }

  function addCompetitor(payload) {
    const record = {
      id: crypto.randomUUID(),
      name: payload.name,
      sail_no: payload.sail_no,
      class: payload.class,
    }
    competitors.value.push(record)
    persist()
    return record
  }

  function updateCompetitor(id, patch) {
    const idx = competitors.value.findIndex(c => c.id === id)
    if (idx < 0) return
    competitors.value[idx] = { ...competitors.value[idx], ...patch }
    persist()
  }

  function deleteCompetitor(id) {
    competitors.value = competitors.value.filter(c => c.id !== id)
    persist()
  }

  return { competitors, load, clear, addCompetitor, updateCompetitor, deleteCompetitor }
})
