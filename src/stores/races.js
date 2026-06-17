import { defineStore } from 'pinia'
import { ref } from 'vue'

const RACES_KEY   = 'mpyc_races'
const RESULTS_KEY = 'mpyc_results'

export const useRacesStore = defineStore('races', () => {
  const races   = ref([])
  const results = ref([])

  function loadRaces() {
    races.value = JSON.parse(localStorage.getItem(RACES_KEY) || '[]')
  }

  function loadResultsForRace(raceId) {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]')
    results.value = all.filter(r => r.race_id === raceId)
  }

  function createRace(payload) {
    const record = {
      id:          payload.id || crypto.randomUUID(),
      race_number: payload.race_number,
      race_date:   payload.race_date,
      start_time:  payload.start_time,
      seq_minutes: payload.seq_minutes,
    }
    const all = JSON.parse(localStorage.getItem(RACES_KEY) || '[]')
    all.unshift(record)
    localStorage.setItem(RACES_KEY, JSON.stringify(all))
    races.value.unshift(record)
    return record
  }

  function saveResult(payload) {
    const record = {
      id:              payload.id || crypto.randomUUID(),
      race_id:         payload.race_id,
      competitor_id:   payload.competitor_id,
      position:        payload.position,
      elapsed_seconds: payload.elapsed_seconds,
      dnf:             payload.dnf ?? false,
      notation:        payload.notation ?? null,
    }
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]')
    const i = all.findIndex(r => r.id === record.id)
    if (i >= 0) all[i] = record; else all.push(record)
    localStorage.setItem(RESULTS_KEY, JSON.stringify(all))

    const j = results.value.findIndex(r => r.id === record.id)
    if (j >= 0) results.value[j] = record; else results.value.push(record)
    return record
  }

  function deleteRace(id) {
    const allResults = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]')
    localStorage.setItem(RESULTS_KEY, JSON.stringify(allResults.filter(r => r.race_id !== id)))
    const allRaces = JSON.parse(localStorage.getItem(RACES_KEY) || '[]')
    localStorage.setItem(RACES_KEY, JSON.stringify(allRaces.filter(r => r.id !== id)))
    races.value = races.value.filter(r => r.id !== id)
  }

  function confirmRace(id) {
    const all = JSON.parse(localStorage.getItem(RACES_KEY) || '[]')
    const idx = all.findIndex(r => r.id === id)
    if (idx >= 0) { all[idx].confirmed = true; localStorage.setItem(RACES_KEY, JSON.stringify(all)) }
    const j = races.value.findIndex(r => r.id === id)
    if (j >= 0) races.value[j] = { ...races.value[j], confirmed: true }
  }

  return { races, results, loadRaces, loadResultsForRace, createRace, saveResult, deleteRace, confirmRace }
})
