<script setup>
import { ref, onMounted } from 'vue'
import { useRacesStore } from '@/stores/races.js'
import { useCompetitorsStore } from '@/stores/competitors.js'
import { useUIStore } from '@/stores/ui.js'
import { getByIndex } from '@/lib/db.js'

const raceStore = useRacesStore()
const compStore = useCompetitorsStore()
const ui        = useUIStore()

const detailOpen    = ref(false)
const detailRace    = ref(null)
const detailResults = ref([])
const detailLoading = ref(false)

onMounted(async () => {
  await compStore.load()
  await raceStore.loadRaces()
})

function haptic(ms = 30) { try { navigator.vibrate?.(ms) } catch {} }

function compName(id)  { return compStore.competitors.find(c => c.id === id)?.name   ?? '—' }
function compSail(id)  { return compStore.competitors.find(c => c.id === id)?.sail_no ?? '' }
function compClass(id) { return compStore.competitors.find(c => c.id === id)?.class   ?? '' }

function fmtTime(secs) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2,'0')}`
}

function fmtHMS(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function fmtDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-NZ', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
}

function finisherCount(results) {
  return results.filter(r => !r.dnf).length
}

async function openDetail(race) {
  haptic(15)
  detailRace.value    = race
  detailResults.value = []
  detailLoading.value = true
  detailOpen.value    = true
  await raceStore.loadResultsForRace(race.id)
  detailResults.value = [...raceStore.results].sort((a,b) => a.position - b.position)
  detailLoading.value = false
}

function deleteRace() {
  ui.showConfirm('Delete Race', 'Permanently delete this race?', async () => {
    await raceStore.deleteRace(detailRace.value.id)
    detailOpen.value = false
    ui.toast('Race deleted', false)
  })
}

// ── CSV export
function csvStr(s) {
  s = String(s ?? '')
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g,'""') + '"' : s
}

function dlCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
  haptic(50); ui.toast(`Downloaded ${filename}`)
}

function raceCSV(race, results) {
  const start = race.start_time || '00:00:00'
  let csv = 'raceno,class,sailno,HelmName,start,elapsed\n'
  results.forEach(r => {
    const elapsed = r.dnf ? 'DNF' : fmtHMS(r.elapsed_seconds)
    csv += `${race.race_number},${csvStr(compClass(r.competitor_id))},${csvStr(compSail(r.competitor_id))},${csvStr(compName(r.competitor_id))},${start},${elapsed}\n`
  })
  return csv
}

async function exportDetail() {
  if (!detailRace.value) return
  dlCSV(raceCSV(detailRace.value, detailResults.value), `MPYC_Race${detailRace.value.race_number}_${detailRace.value.race_date}.csv`)
}

async function exportAll() {
  if (!raceStore.races.length) { ui.toast('No races yet', false); return }
  let csv = 'raceno,class,sailno,HelmName,start,elapsed\n'
  for (const race of raceStore.races) {
    const results = await getByIndex('race_results', 'race_id', race.id)
    const start   = race.start_time || '00:00:00'
    results.forEach(r => {
      const elapsed = r.dnf ? 'DNF' : fmtHMS(r.elapsed_seconds)
      csv += `${race.race_number},${csvStr(compClass(r.competitor_id))},${csvStr(compSail(r.competitor_id))},${csvStr(compName(r.competitor_id))},${start},${elapsed}\n`
    })
  }
  dlCSV(csv, `MPYC_AllRaces_${new Date().toISOString().slice(0,10)}.csv`)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Race History</h1>
        <div class="sub">Saved results</div>
      </div>
    </div>

    <div v-if="!raceStore.races.length"
         style="text-align:center;color:var(--text2);padding:48px 0;font:600 15px/1.6 var(--sans)">
      No races saved yet.<br>Finish a race to see it here.
    </div>

    <div v-for="race in raceStore.races" :key="race.id"
         class="hist-card" @click="openDetail(race)">
      <div class="date">{{ race.race_date }} {{ race.start_time?.slice(0,5) }}</div>
      <div class="name">Race {{ race.race_number }}</div>
      <div class="meta">{{ race.seq_minutes }}min start sequence</div>
    </div>

    <button v-if="raceStore.races.length"
            class="btn btn-primary btn-xl btn-block"
            style="margin-top:8px"
            @click="exportAll">
      ⬇ Export All — Sailwave CSV
    </button>
  </div>

  <!-- Race detail bottom sheet -->
  <div class="modal-bg" :class="{ open: detailOpen }" @click.self="detailOpen = false">
    <div class="modal">
      <h2 v-if="detailRace">Race {{ detailRace.race_number }}</h2>

      <div v-if="detailRace" style="color:var(--text2);font-size:13px;margin-bottom:12px">
        {{ fmtDate(detailRace.race_date) }} · Start: {{ detailRace.start_time?.slice(0,5) ?? 'N/A' }}
      </div>

      <div v-if="detailLoading" style="color:var(--text2);padding:20px 0;text-align:center">
        Loading…
      </div>
      <div v-else-if="detailResults.length" style="overflow-x:auto">
        <table class="comp-table">
          <thead>
            <tr><th>#</th><th>Time</th><th>Sailor</th><th>Sail #</th><th>Class</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in detailResults" :key="r.id" class="comp-row">
              <td class="pos-num">{{ r.position }}</td>
              <td class="finish-time" :class="r.dnf ? 'none' : 'has'">
                {{ r.dnf ? 'DNF' : fmtTime(r.elapsed_seconds) }}
              </td>
              <td>{{ compName(r.competitor_id) }}</td>
              <td class="sail-num">{{ compSail(r.competitor_id) }}</td>
              <td><span class="class-badge">{{ compClass(r.competitor_id) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display:flex;gap:var(--tap-gap);margin-top:16px">
        <button class="btn btn-primary btn-block" @click="exportDetail">⬇ Export CSV</button>
        <button class="btn btn-danger btn-block"  @click="deleteRace">🗑 Delete</button>
      </div>
      <button class="btn btn-ghost btn-block" style="margin-top:10px" @click="detailOpen = false">
        Close
      </button>
    </div>
  </div>
</template>
