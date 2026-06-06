import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { getAll, getByIndex, upsert, enqueueSyncOp } from '@/lib/db.js'

export const useRacesStore = defineStore('races', () => {
  const races = ref([])
  const results = ref([]) // results for the currently active race

  async function loadRaces() {
    races.value = await getAll('races')
    if (navigator.onLine) {
      const { data } = await supabase.from('races').select('*').order('race_date', { ascending: false })
      if (data) {
        for (const row of data) await upsert('races', row)
        races.value = data
      }
    }
  }

  async function loadResultsForRace(raceId) {
    results.value = await getByIndex('race_results', 'race_id', raceId)
    if (navigator.onLine) {
      const { data } = await supabase.from('race_results').select('*').eq('race_id', raceId)
      if (data) {
        for (const row of data) await upsert('race_results', row)
        results.value = data
      }
    }
  }

  async function createRace(payload) {
    const record = {
      id: crypto.randomUUID(),
      race_number: payload.race_number,
      race_date: payload.race_date,
      start_time: payload.start_time,
      seq_minutes: payload.seq_minutes,
    }
    await upsert('races', record)
    if (navigator.onLine) {
      await supabase.from('races').upsert(record)
    } else {
      await enqueueSyncOp({ action: 'upsert', table: 'races', record })
    }
    races.value.unshift(record)
    return record
  }

  async function saveResult(payload) {
    const record = {
      id: payload.id || crypto.randomUUID(),
      race_id: payload.race_id,
      competitor_id: payload.competitor_id,
      position: payload.position,
      elapsed_seconds: payload.elapsed_seconds,
      dnf: payload.dnf ?? false,
    }
    await upsert('race_results', record)
    if (navigator.onLine) {
      await supabase.from('race_results').upsert(record)
    } else {
      await enqueueSyncOp({ action: 'upsert', table: 'race_results', record })
    }
    const i = results.value.findIndex((r) => r.id === record.id)
    if (i >= 0) results.value[i] = record
    else results.value.push(record)
    return record
  }

  async function deleteRace(id) {
    // soft remove from local and remote
    if (navigator.onLine) {
      await supabase.from('race_results').delete().eq('race_id', id)
      await supabase.from('races').delete().eq('id', id)
    }
    races.value = races.value.filter((r) => r.id !== id)
  }

  return { races, results, loadRaces, loadResultsForRace, createRace, saveResult, deleteRace }
})
