<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRacesStore } from '@/stores/races.js'
import { useCompetitorsStore } from '@/stores/competitors.js'
import { useUIStore } from '@/stores/ui.js'
import { getAllRecordings, deleteRecording, updateRecording } from '@/lib/recordings.js'
const raceStore = useRacesStore()
const compStore = useCompetitorsStore()
const ui        = useUIStore()

const detailOpen    = ref(false)
const detailRace    = ref(null)
const detailResults = ref([])
const detailLoading = ref(false)
const editMode      = ref(false)
const editResults   = ref([])

// ── Voice notes
const recordings     = ref([])
const playingId      = ref(null)
const transcribingId = ref(null)
let   audioPlayer    = null

async function loadRecordings() {
  recordings.value = await getAllRecordings()
}

function playRecording(rec) {
  if (audioPlayer) {
    audioPlayer.pause()
    URL.revokeObjectURL(audioPlayer.src)
    audioPlayer = null
    if (playingId.value === rec.id) { playingId.value = null; return }
  }
  const url = URL.createObjectURL(rec.blob)
  audioPlayer = new Audio(url)
  playingId.value = rec.id
  audioPlayer.play()
  audioPlayer.onended = () => { URL.revokeObjectURL(url); playingId.value = null; audioPlayer = null }
}

function removeRecording(id) {
  ui.showConfirm('Delete Note', 'Delete this voice note?', async () => {
    if (playingId.value === id) { audioPlayer?.pause(); audioPlayer = null; playingId.value = null }
    await deleteRecording(id)
    recordings.value = recordings.value.filter(r => r.id !== id)
    ui.toast('Note deleted', false)
  })
}

async function transcribeRecording(rec) {
  if (transcribingId.value) return
  if (!rec.transcript) {
    ui.toast('New recordings include a transcript automatically', false)
    return
  }
  transcribingId.value = rec.id
  try {
    const resp = await fetch('/api/transcribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rawText: rec.transcript }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || `Server error ${resp.status}`)
    await updateRecording(rec.id, { transcript: data.transcript })
    const idx = recordings.value.findIndex(r => r.id === rec.id)
    if (idx >= 0) recordings.value[idx] = { ...recordings.value[idx], transcript: data.transcript }
    ui.toast('Transcript refined')
  } catch (err) {
    ui.toast(err.message || 'Could not refine transcript', false)
  } finally {
    transcribingId.value = null
  }
}

function fmtRecTime(ts) {
  return new Date(ts).toLocaleString('en-NZ', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

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
  // unconfirmed races open directly in edit mode
  if (!race.confirmed) startEdit()
  else editMode.value = false
}

function deleteRace() {
  ui.showConfirm('Delete Race', 'Permanently delete this race?', async () => {
    await raceStore.deleteRace(detailRace.value.id)
    detailOpen.value = false
    ui.toast('Race deleted', false)
  })
}

// ── Edit results
function recsForRace(race) {
  if (!race) return []
  const raceDate = race.race_date
  return recordings.value.filter(r =>
    r.raceId === race.id ||
    // fallback for recordings saved before raceId was introduced
    (!r.raceId && r.raceNumber === race.race_number &&
     new Date(r.timestamp).toISOString().slice(0, 10) === raceDate)
  )
}
const raceRecordings = computed(() => recsForRace(detailRace.value))

function startEdit() {
  // Sort by position so time slots are in correct order
  const sorted = [...detailResults.value].sort((a, b) => a.position - b.position)
  editResults.value = sorted.map(r => ({ ...r }))
  editMode.value = true
}

async function saveEdit() {
  // Only positions and competitor assignments are updated — times stay with their slots
  const updated = editResults.value.map((r, i) => ({ ...r, position: i + 1 }))
  for (const r of updated) raceStore.saveResult(r)
  detailResults.value = [...updated]
  return updated
}

async function confirmEdit() {
  await saveEdit()
  raceStore.confirmRace(detailRace.value.id)
  detailRace.value = { ...detailRace.value, confirmed: true }
  editMode.value = false
  haptic(50)
  ui.toast('Results confirmed ✓')
}

// ── Drag & drop (edit mode)
let dragIdx  = null
let tFromIdx = null
let tEl      = null

function dStart(e, idx) { dragIdx = idx; e.dataTransfer.effectAllowed = 'move' }
function dOver(e)        { e.preventDefault() }
function dDrop(e, to) {
  e.preventDefault()
  if (dragIdx === null || dragIdx === to) return
  moveEditRow(dragIdx, to); dragIdx = null
}
function tStart(e, idx) {
  if (!e.target.closest('.drag-grip')) return
  tFromIdx = idx; tEl = e.currentTarget
  tEl.classList.add('dragging')
}
function tMove(e) { if (tEl) e.preventDefault() }
function tEnd(e) {
  if (!tEl) return
  tEl.classList.remove('dragging')
  const endY = e.changedTouches[0].clientY
  const rows = document.querySelectorAll('.edit-tbody .comp-row')
  let to = tFromIdx
  rows.forEach((row, i) => {
    const r = row.getBoundingClientRect()
    if (endY >= r.top && endY <= r.bottom) to = i
  })
  if (tFromIdx !== to) moveEditRow(tFromIdx, to)
  tEl = null; tFromIdx = null
}
function moveEditRow(from, to) {
  // Only move competitor assignments — times stay pinned to position slots
  const ids = editResults.value.map(r => r.competitor_id)
  const [id] = ids.splice(from, 1)
  ids.splice(to, 0, id)
  editResults.value = editResults.value.map((r, i) => ({ ...r, competitor_id: ids[i] }))
  haptic(20)
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

const groupedRaces = computed(() => {
  const groups = {}
  for (const race of raceStore.races) {
    if (!groups[race.race_date]) groups[race.race_date] = []
    groups[race.race_date].push(race)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, races]) => ({
      date,
      races: [...races]
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        .map((race, i) => ({ ...race, displayNumber: i + 1 })),
    }))
})

function exportDay(date, races) {
  const allResults = JSON.parse(localStorage.getItem('mpyc_results') || '[]')
  let csv = 'raceno,class,sailno,HelmName,start,elapsed\n'
  races.forEach((race, i) => {
    const raceNo  = race.displayNumber ?? (i + 1)
    const results = allResults.filter(r => r.race_id === race.id)
    const start   = race.start_time || '00:00:00'
    results.forEach(r => {
      const elapsed = r.dnf ? 'DNF' : fmtHMS(r.elapsed_seconds)
      csv += `${raceNo},${csvStr(compClass(r.competitor_id))},${csvStr(compSail(r.competitor_id))},${csvStr(compName(r.competitor_id))},${start},${elapsed}\n`
    })
  })
  dlCSV(csv, `MPYC_${date}.csv`)
}

onMounted(async () => {
  await compStore.load()
  await raceStore.loadRaces()
  await loadRecordings()
})
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

    <div v-for="group in groupedRaces" :key="group.date" class="day-group">
      <div class="day-header">{{ fmtDate(group.date) }}</div>

      <div v-for="race in group.races" :key="race.id"
           class="hist-card" @click="openDetail(race)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="date">{{ race.start_time?.slice(0,5) }}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span v-if="recsForRace(race).length" class="badge-rec">
              🎙 {{ recsForRace(race).length }}
            </span>
            <span :class="race.confirmed ? 'badge-ready' : 'badge-draft'">
              {{ race.confirmed ? '✓ Ready' : 'Draft' }}
            </span>
          </div>
        </div>
        <div class="name">Race {{ race.displayNumber }}</div>
        <div class="meta">{{ race.seq_minutes }}min start sequence</div>
      </div>

      <button class="btn btn-ghost btn-xl btn-block" style="margin-bottom:8px"
              @click="exportDay(group.date, group.races)">
        ⬇ Export {{ fmtDate(group.date) }} — Sailwave CSV
      </button>
    </div>


  </div>

  <!-- Race detail bottom sheet -->
  <div class="modal-bg" :class="{ open: detailOpen }" @click.self="detailOpen = false">
    <div class="modal">

      <!-- Title row -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <h2 v-if="detailRace">Race {{ detailRace.displayNumber ?? detailRace.race_number }}</h2>
        <span v-if="detailRace" :class="detailRace.confirmed ? 'badge-ready' : 'badge-draft'">
          {{ detailRace.confirmed ? '✓ Ready' : 'Draft' }}
        </span>
      </div>
      <div v-if="detailRace" style="color:var(--text2);font-size:13px;margin-bottom:12px">
        {{ fmtDate(detailRace.race_date) }} · Start: {{ detailRace.start_time?.slice(0,5) ?? 'N/A' }}
      </div>

      <div v-if="detailLoading" style="color:var(--text2);padding:20px 0;text-align:center">Loading…</div>

      <!-- Confirmed: read-only -->
      <div v-else-if="detailRace?.confirmed">
        <div v-if="detailResults.length" style="overflow-x:auto">
          <table class="comp-table">
            <thead><tr><th>#</th><th>Time</th><th>Sailor</th><th>Sail #</th><th>Class</th></tr></thead>
            <tbody>
              <tr v-for="r in detailResults" :key="r.id" class="comp-row">
                <td class="pos-num">{{ r.position }}</td>
                <td class="finish-time" :class="r.dnf ? 'none' : 'has'">{{ r.dnf ? 'DNF' : fmtTime(r.elapsed_seconds) }}</td>
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
        <button class="btn btn-ghost btn-block" style="margin-top:10px" @click="detailOpen = false">Close</button>
        <!-- Recordings at bottom -->
        <div v-if="raceRecordings.length" style="margin-top:20px">
          <div class="card-title">🎙 Voice Notes</div>
          <div v-for="rec in raceRecordings" :key="rec.id" class="rec-row">
            <div class="rec-info">
              <div class="rec-time">{{ fmtRecTime(rec.timestamp) }}</div>
              <div class="rec-meta">{{ fmtTime(rec.duration) }}</div>
              <div v-if="rec.transcript" class="rec-transcript">{{ rec.transcript }}</div>
            </div>
            <div class="rec-actions">
              <button class="btn btn-ghost btn-sm" @click="playRecording(rec)">{{ playingId === rec.id ? '■ Stop' : '▶ Play' }}</button>
              <button v-if="rec.transcript" class="btn btn-ghost btn-sm" :disabled="!!transcribingId" @click="transcribeRecording(rec)">{{ transcribingId === rec.id ? '…' : '✦' }}</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--warn)" @click="removeRecording(rec.id)">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Draft: always editable -->
      <div v-else>
        <div class="card-title" style="margin-bottom:8px">Drag rows to set finish order</div>
        <div style="overflow-x:auto">
          <table class="comp-table">
            <thead>
              <tr>
                <th style="width:30px"></th>
                <th style="width:36px">#</th>
                <th>Time</th>
                <th>Sailor</th>
                <th>Sail #</th>
                <th>Class</th>
              </tr>
            </thead>
            <tbody class="edit-tbody">
              <tr v-for="(r, i) in editResults" :key="r.id"
                  class="comp-row"
                  draggable="true"
                  @dragstart="dStart($event, i)"
                  @dragover="dOver"
                  @drop="dDrop($event, i)"
                  @touchstart.passive="tStart($event, i)"
                  @touchmove="tMove"
                  @touchend.passive="tEnd($event, i)">
                <td class="drag-grip">⠿</td>
                <td class="pos-num">{{ i + 1 }}</td>
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

        <button class="btn btn-primary btn-xl btn-block" style="margin-top:16px" @click="confirmEdit">
          ✓ Confirm Results
        </button>
        <button class="btn btn-ghost btn-block" style="margin-top:10px" @click="detailOpen = false">
          Close
        </button>
        <button class="btn btn-danger btn-block" style="margin-top:10px" @click="deleteRace">
          🗑 Delete Race
        </button>

        <!-- Recordings at bottom -->
        <div v-if="raceRecordings.length" style="margin-top:20px">
          <div class="card-title">🎙 Voice Notes</div>
          <div v-for="rec in raceRecordings" :key="rec.id" class="rec-row">
            <div class="rec-info">
              <div class="rec-time">{{ fmtRecTime(rec.timestamp) }}</div>
              <div class="rec-meta">{{ fmtTime(rec.duration) }}</div>
              <div v-if="rec.transcript" class="rec-transcript">{{ rec.transcript }}</div>
            </div>
            <div class="rec-actions">
              <button class="btn btn-ghost btn-sm" @click="playRecording(rec)">{{ playingId === rec.id ? '■ Stop' : '▶ Play' }}</button>
              <button v-if="rec.transcript" class="btn btn-ghost btn-sm" :disabled="!!transcribingId" @click="transcribeRecording(rec)">{{ transcribingId === rec.id ? '…' : '✦' }}</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.day-group { margin-bottom: 24px; }
.day-header {
  font: 700 13px/1 var(--sans); text-transform: uppercase; letter-spacing: 1.5px;
  color: var(--text2); padding: 8px 0 10px; border-bottom: 2px solid var(--border);
  margin-bottom: 10px;
}

.badge-ready { font: 700 11px/1 var(--sans); text-transform: uppercase; letter-spacing: .5px; padding: 4px 10px; border-radius: 8px; background: rgba(0,232,176,.15); color: var(--accent); }
.badge-draft { font: 700 11px/1 var(--sans); text-transform: uppercase; letter-spacing: .5px; padding: 4px 10px; border-radius: 8px; background: rgba(255,170,46,.12); color: var(--orange); }
.badge-rec   { font: 600 11px/1 var(--sans); padding: 4px 8px; border-radius: 8px; background: rgba(77,168,255,.12); color: var(--blue); }


.rec-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; border-bottom: 1px solid rgba(28,64,104,.4); gap: 12px;
}
.rec-row:last-child { border-bottom: none; }
.rec-info { flex: 1; min-width: 0; }
.rec-time { font: 600 14px/1.3 var(--sans); }
.rec-meta { font: 500 12px/1 var(--sans); color: var(--text2); margin-top: 3px; }
.rec-actions { display: flex; gap: 8px; flex-shrink: 0; }
.rec-transcript { font: 400 12px/1.5 var(--sans); color: var(--text2); margin-top: 6px; font-style: italic; }
</style>
