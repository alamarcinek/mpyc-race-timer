import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { getAll, upsert, remove, enqueueSyncOp } from '@/lib/db.js'

export const useCompetitorsStore = defineStore('competitors', () => {
  const competitors = ref([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    // always read from local first
    competitors.value = await getAll('competitors')
    // then try remote
    if (navigator.onLine) {
      const { data } = await supabase.from('competitors').select('*').order('name')
      if (data) {
        for (const row of data) await upsert('competitors', row)
        competitors.value = data
      }
    }
    loading.value = false
  }

  async function addCompetitor(payload) {
    const record = { id: crypto.randomUUID(), name: payload.name, sail_no: payload.sail_no, class: payload.class }
    await upsert('competitors', record)
    if (navigator.onLine) {
      await supabase.from('competitors').upsert(record)
    } else {
      await enqueueSyncOp({ action: 'upsert', table: 'competitors', record })
    }
    competitors.value.push(record)
    return record
  }

  async function updateCompetitor(record) {
    await upsert('competitors', record)
    if (navigator.onLine) {
      await supabase.from('competitors').upsert(record)
    } else {
      await enqueueSyncOp({ action: 'upsert', table: 'competitors', record })
    }
    const i = competitors.value.findIndex((c) => c.id === record.id)
    if (i >= 0) competitors.value[i] = record
  }

  async function deleteCompetitor(id) {
    await remove('competitors', id)
    if (navigator.onLine) {
      await supabase.from('competitors').delete().eq('id', id)
    } else {
      await enqueueSyncOp({ action: 'delete', table: 'competitors', id })
    }
    competitors.value = competitors.value.filter((c) => c.id !== id)
  }

  return { competitors, loading, load, addCompetitor, updateCompetitor, deleteCompetitor }
})
