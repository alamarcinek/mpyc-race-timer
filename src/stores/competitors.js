import { defineStore } from 'pinia'
import { ref } from 'vue'

const KEY = 'mpyc_competitors'

export const useCompetitorsStore = defineStore('competitors', () => {
  const competitors = ref([])

  function load() {
    competitors.value = JSON.parse(localStorage.getItem(KEY) || '[]')
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(competitors.value))
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

  function deleteCompetitor(id) {
    competitors.value = competitors.value.filter(c => c.id !== id)
    persist()
  }

  return { competitors, load, addCompetitor, deleteCompetitor }
})
