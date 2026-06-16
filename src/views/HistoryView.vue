<script setup>
import { ref, computed, onMounted } from 'vue'
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
  transcribingId.value = rec.id
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(rec.blob)
    })
    const resp = await fetch('/api/transcribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ audio: base64, mimeType: rec.mimeType }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || `Server error ${resp.status}`)
    await updateRecording(rec.id, { transcript: data.transcript })
    const idx = recordings.value.findIndex(r => r.id === rec.id)
    if (idx >= 0) recordings.value[idx] = { ...recordings.value[idx], transcript: data.transcript }
    ui.toast('Transcription saved')
  } catch (err) {
    ui.toast(err.message || 'Transcription failed', false)
  } finally {
    transcribingId.value = null
  }
}

function fmtRecTime(ts) {
  return new Date(ts).toLocaleString('en-NZ', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

onMounted(async () => {
  await compStore.load()
  await raceStore.loadRaces()
  await loadRecordings()
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
  editMode.value      = false
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

// ── Edit results
const raceRecordings   = computed(() => detailRace.value
  ? recordings.value.filter(r => r.raceNumber === detailRace.value.race_number) : [])
const generalRecordings = computed(() => recordings.value.filter(r => !r.raceNumber))

function parseTime(str) {
  const parts = String(str).trim().split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + (parts[1] || 0)
  return parseInt(str) || 0
}

function startEdit() {
  editResults.value = detailResults.value.map(r => ({
    ...r,
    timeStr: r.dnf ? '' : fmtTime(r.elapsed_seconds),
  }))
  editMode.value = true
}

async function saveEdit() {
  const updated = editResults.value.map((r, i) => ({
    ...r,
    position:        i + 1,
    elapsed_seconds: r.dnf ? 0 : parseTime(r.timeStr),
    dnf:             r.dnf,
  }))
  for (const r of updated) raceStore.saveResult(r)
  detailResults.value = updated.map(({ timeStr, ...r }) => r)
  editMode.value = false
  haptic(50)
  ui.toast('Results updated')
}

function moveUp(i) {
  if (i === 0) return
  const arr = [...editResults.value]
  ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
  editResults.value = arr
  haptic(15)
}

function moveDown(i) {
  if (i >= editResults.value.length - 1) return
  const arr = [...editResults.value]
  ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
  editResults.value = arr
  haptic(15)
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

function exportAll() {
  if (!raceStore.races.length) { ui.toast('No races yet', false); return }
  const allResults = JSON.parse(localStorage.getItem('mpyc_results') || '[]')
  let csv = 'raceno,class,sailno,HelmName,start,elapsed\n'
  for (const race of raceStore.races) {
    const results = allResults.filter(r => r.race_id === race.id)
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

    <!-- Voice Notes (not linked to a race) -->
    <div v-if="generalRecordings.length" class="card" style="margin-top:16px">
      <div class="card-title">🎙 Voice Notes ({{ generalRecordings.length }})</div>
      <div v-for="rec in generalRecordings" :key="rec.id" class="rec-row">
        <div class="rec-info">
          <div class="rec-time">{{ fmtRecTime(rec.timestamp) }}</div>
          <div class="rec-meta">
            {{ fmtTime(rec.duration) }}
            <span v-if="rec.raceNumber"> · Race {{ rec.raceNumber }}</span>
          </div>
          <div v-if="rec.transcript" class="rec-transcript">{{ rec.transcript }}</div>
        </div>
        <div class="rec-actions">
          <button class="btn btn-ghost btn-sm" @click="playRecording(rec)">
            {{ playingId === rec.id ? '■ Stop' : '▶ Play' }}
          </button>
          <button class="btn btn-ghost btn-sm"
                  :disabled="!!transcribingId"
                  @click="transcribeRecording(rec)">
            {{ transcribingId === rec.id ? '…' : '✦' }}
          </button>
          <button class="btn btn-ghost btn-sm" style="color:var(--warn)" @click="removeRecording(rec.id)">✕</button>
        </div>
      </div>
    </div>

  </div>

  <!-- Race detail bottom sheet -->
  <div class="modal-bg" :class="{ open: detailOpen }" @click.self="detailOpen = false">
    <div class="modal">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <h2 v-if="detailRace">Race {{ detailRace.race_number }}</h2>
        <button v-if="!editMode && detailResults.length" class="btn btn-ghost btn-sm" @click="startEdit">✎ Edit</button>
      </div>

      <div v-if="detailRace" style="color:var(--text2);font-size:13px;margin-bottom:12px">
        {{ fmtDate(detailRace.race_date) }} · Start: {{ detailRace.start_time?.slice(0,5) ?? 'N/A' }}
      </div>

      <div v-if="detailLoading" style="color:var(--text2);padding:20px 0;text-align:center">
        Loading…
      </div>

      <!-- Normal view -->
      <div v-else-if="!editMode">
        <div v-if="detailResults.length" style="overflow-x:auto">
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

        <!-- Voice notes for this race -->
        <div v-if="raceRecordings.length" style="margin-top:16px">
          <div class="card-title">🎙 Voice Notes</div>
          <div v-for="rec in raceRecordings" :key="rec.id" class="rec-row">
            <div class="rec-info">
              <div class="rec-time">{{ fmtRecTime(rec.timestamp) }}</div>
              <div class="rec-meta">{{ fmtTime(rec.duration) }}</div>
              <div v-if="rec.transcript" class="rec-transcript">{{ rec.transcript }}</div>
            </div>
            <div class="rec-actions">
              <button class="btn btn-ghost btn-sm" @click="playRecording(rec)">
                {{ playingId === rec.id ? '■ Stop' : '▶ Play' }}
              </button>
              <button class="btn btn-ghost btn-sm" :disabled="!!transcribingId" @click="transcribeRecording(rec)">
                {{ transcribingId === rec.id ? '…' : '✦' }}
              </button>
              <button class="btn btn-ghost btn-sm" style="color:var(--warn)" @click="removeRecording(rec.id)">✕</button>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:var(--tap-gap);margin-top:16px">
          <button class="btn btn-primary btn-block" @click="exportDetail">⬇ Export CSV</button>
          <button class="btn btn-danger btn-block"  @click="deleteRace">🗑 Delete</button>
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:10px" @click="detailOpen = false">
          Close
        </button>
      </div>

      <!-- Edit mode -->
      <div v-else>
        <div v-for="(r, i) in editResults" :key="r.id" class="edit-row">
          <span class="pos-num">{{ i + 1 }}</span>
          <div class="edit-move">
            <button class="move-btn" :disabled="i === 0" @click="moveUp(i)">↑</button>
            <button class="move-btn" :disabled="i === editResults.length - 1" @click="moveDown(i)">↓</button>
          </div>
          <span class="edit-name">{{ compName(r.competitor_id) }}</span>
          <input v-if="!r.dnf" v-model="r.timeStr" class="fi edit-time" placeholder="M:SS" />
          <span v-else class="finish-time none" style="flex:1">DNF</span>
          <label class="dnf-toggle">
            <input type="checkbox" v-model="r.dnf" />
            DNF
          </label>
        </div>
        <!-- Voice notes accessible in edit mode -->
        <div v-if="raceRecordings.length" style="margin-top:16px">
          <div class="card-title">🎙 Voice Notes</div>
          <div v-for="rec in raceRecordings" :key="rec.id" class="rec-row">
            <div class="rec-info">
              <div class="rec-time">{{ fmtRecTime(rec.timestamp) }}</div>
              <div class="rec-meta">{{ fmtTime(rec.duration) }}</div>
              <div v-if="rec.transcript" class="rec-transcript">{{ rec.transcript }}</div>
            </div>
            <div class="rec-actions">
              <button class="btn btn-ghost btn-sm" @click="playRecording(rec)">
                {{ playingId === rec.id ? '■ Stop' : '▶ Play' }}
              </button>
              <button class="btn btn-ghost btn-sm" :disabled="!!transcribingId" @click="transcribeRecording(rec)">
                {{ transcribingId === rec.id ? '…' : '✦' }}
              </button>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:var(--tap-gap);margin-top:16px">
          <button class="btn btn-primary btn-block" @click="saveEdit">✓ Save</button>
          <button class="btn btn-ghost btn-block"   @click="editMode = false">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid rgba(28,64,104,.4);
}
.edit-row:last-child { border-bottom: none; }
.edit-move { display: flex; flex-direction: column; gap: 2px; }
.move-btn {
  background: var(--bg3); border: 1px solid var(--border); color: var(--text2);
  border-radius: 6px; width: 28px; height: 28px; font-size: 14px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  touch-action: manipulation;
}
.move-btn:disabled { opacity: .2; pointer-events: none; }
.edit-name { flex: 1; font: 600 14px/1 var(--sans); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edit-time { width: 76px; padding: 8px 10px; min-height: 40px; font-size: 15px; text-align: center; }
.dnf-toggle { display: flex; align-items: center; gap: 6px; font: 600 12px/1 var(--sans); color: var(--text2); flex-shrink: 0; cursor: pointer; }
.dnf-toggle input { width: 18px; height: 18px; accent-color: var(--warn); cursor: pointer; }

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
