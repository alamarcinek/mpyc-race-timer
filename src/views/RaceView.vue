<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted } from 'vue'
import { useCompetitorsStore } from '@/stores/competitors.js'
import { useRacesStore } from '@/stores/races.js'
import { useUIStore } from '@/stores/ui.js'
import { saveRecording } from '@/lib/recordings.js'

defineOptions({ name: 'RaceView' })

const compStore = useCompetitorsStore()
const raceStore = useRacesStore()
const ui        = useUIStore()

// ── Local race state
const phase       = ref('idle')         // idle | countdown | racing
const seqMinutes  = ref(3)
const raceOrder   = ref([])             // draggable copy of competitors
const finishTimes = ref([])             // elapsed seconds in finish order
let   raceNumber  = 1

// ── Timers
let timerInterval = null
let countdownEnd  = null
let raceStartTime = null
let lastBeepSec   = -1
const displayMs   = ref(0)             // drives the timer display

// ── Add sailor modal
const addSailorOpen = ref(false)
const mName         = ref('')
const mSailNo       = ref('')
const mClass        = ref('ILCA 7')

// ── Drag & drop
let dragIdx    = null
let tFromIdx   = null
let tEl        = null

// ── Debounce rapid taps
const _lastTap = {}
function debounce(id, ms = 600) {
  const now = Date.now()
  if (_lastTap[id] && now - _lastTap[id] < ms) return true
  _lastTap[id] = now
  return false
}

function haptic(ms)    { try { navigator.vibrate?.(ms) } catch {} }
function hapticPat(p)  { try { navigator.vibrate?.(p) } catch {} }

// ── Audio
let audioCtx = null
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
}

function tone(freq, duration, gainPeak = 0.5) {
  try {
    initAudio()
    const now  = audioCtx.currentTime
    const osc  = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain); gain.connect(audioCtx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  } catch {}
}

// Short pip for countdown seconds 5-1
function pip() { tone(1320, 0.12, 0.6); haptic(40) }

// Warm dong for each minute mark
function dong() {
  tone(660, 0.6, 0.55)
  tone(880, 0.3, 0.2)
  haptic(120)
}

// Foghorn blast for race start — three layered sines
function horn() {
  try {
    initAudio()
    const now = audioCtx.currentTime
    ;[220, 330, 440].forEach((freq, i) => {
      const osc  = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain); gain.connect(audioCtx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const peak = [0.5, 0.35, 0.2][i]
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(peak, now + 0.06)
      gain.gain.setValueAtTime(peak, now + 1.1)
      gain.gain.linearRampToValueAtTime(0, now + 1.6)
      osc.start(now)
      osc.stop(now + 1.7)
    })
  } catch {}
  hapticPat([300, 80, 300, 80, 400])
}

// kept for startRace() first-touch beep
function beep() { tone(880, 0.25, 0.4) }
function longBeep() { horn() }

// ── Init / re-activate
function initRace() {
  raceNumber  = raceStore.races.length + 1
  raceOrder.value = [...compStore.competitors]
}

onMounted(async () => {
  // Seed immediately from whatever the store already has (fast, no wait)
  if (phase.value === 'idle') initRace()
  // Then refresh from network and re-init with fresh data
  await compStore.load()
  await raceStore.loadRaces()
  if (phase.value === 'idle') initRace()
})

onActivated(() => {
  if (phase.value === 'idle') {
    initRace() // instant from cache
    compStore.load().then(() => { if (phase.value === 'idle') initRace() })
    raceStore.loadRaces().then(() => { raceNumber = raceStore.races.length + 1 })
  }
})

// ── Voice notes
const isRecording  = ref(false)
const recDuration  = ref(0)
const recSupported = !!navigator.mediaDevices?.getUserMedia
const MAX_REC_SECS = 120
let mediaRecorder  = null
let recChunks      = []
let recTimer       = null
let recStart       = null


async function startRecording() {
  if (!recSupported) { ui.toast('Microphone not available', false); return }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    mediaRecorder  = new MediaRecorder(stream, { mimeType })
    recChunks      = []
    recStart       = Date.now()
    recDuration.value = 0

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data) }
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob     = new Blob(recChunks, { type: mediaRecorder.mimeType })
      const duration = Math.round((Date.now() - recStart) / 1000)
      await saveRecording({
        id:          crypto.randomUUID(),
        timestamp:   recStart,
        duration,
        mimeType:    mediaRecorder.mimeType,
        blob,
        raceNumber:  phase.value !== 'idle' ? raceNumber : null,
      })
      ui.toast(`Note saved (${fmtTime(duration)})`)
      haptic(60)
      loadRecordings()
    }

    mediaRecorder.start(500)
    isRecording.value = true
    haptic(40)
    recTimer = setInterval(() => {
      recDuration.value++
      if (recDuration.value >= MAX_REC_SECS) stopRecording()
    }, 1000)
  } catch {
    ui.toast('Microphone access denied', false)
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  clearInterval(recTimer)
  mediaRecorder.stop()
  isRecording.value = false
  recDuration.value = 0
}

function toggleRecording() {
  if (isRecording.value) stopRecording()
  else startRecording()
}

onUnmounted(() => { clearInterval(timerInterval); stopRecording(); audioPlayer?.pause(); audioPlayer = null })

// ── Computed display
const displayLabel = computed(() => {
  if (phase.value === 'idle')      return 'READY'
  if (phase.value === 'countdown') return 'COUNTDOWN'
  return '🏁 RACE TIME'
})

const displayText = computed(() => {
  const ms = displayMs.value
  if (phase.value === 'countdown') {
    const total = Math.ceil(ms / 1000)
    const m = Math.floor(total / 60), s = total % 60
    return `${m}:${String(s).padStart(2,'0')}`
  }
  if (phase.value === 'racing') {
    const total = Math.floor(ms / 1000)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60), s = total % 60
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
  }
  return '0:00'
})

const displayClass = computed(() => ({
  countdown: phase.value === 'countdown',
  racing:    phase.value === 'racing',
}))

const raceTitle = computed(() => `Race ${raceNumber}`)
const raceDate  = computed(() => new Date().toLocaleDateString('en-NZ', { weekday:'long', year:'numeric', month:'long', day:'numeric' }))

// ── Start sequence
function startRace() {
  if (debounce('start', 1000)) return
  if (!raceOrder.value.length) { ui.toast('Add competitors in Setup first', false); return }
  initAudio()
  ui.requestWakeLock()
  phase.value   = 'countdown'
  countdownEnd  = Date.now() + seqMinutes.value * 60 * 1000
  raceStartTime = null
  lastBeepSec   = -1
  displayMs.value = seqMinutes.value * 60 * 1000
  beep(); haptic(100)
  timerInterval = setInterval(tick, 50)
}

function tick() {
  if (phase.value === 'countdown') {
    const remaining = Math.max(0, countdownEnd - Date.now())
    displayMs.value  = remaining
    const totalSecs  = Math.ceil(remaining / 1000)

    if (totalSecs > 0 && totalSecs % 60 === 0 && totalSecs !== lastBeepSec) {
      lastBeepSec = totalSecs; dong()
    }
    if (totalSecs <= 5 && totalSecs > 0 && totalSecs !== lastBeepSec) {
      lastBeepSec = totalSecs; pip()
    }
    if (remaining <= 0) {
      phase.value   = 'racing'
      raceStartTime = Date.now()
      lastBeepSec   = -1
      longBeep()
    }
  } else if (phase.value === 'racing') {
    displayMs.value = Date.now() - raceStartTime
  }
}

function cancelRace() {
  ui.showConfirm('Cancel Race', 'Stop the timer and cancel this start?', () => {
    clearInterval(timerInterval)
    phase.value     = 'idle'
    raceStartTime   = null
    displayMs.value = 0
    ui.releaseWakeLock()
    haptic(50)
  })
}

// ── Record finish
function recordFinish() {
  if (debounce('finish', 400)) return
  if (phase.value !== 'racing') return
  if (finishTimes.value.length >= raceOrder.value.length) {
    ui.toast('All sailors have finished', false); return
  }
  const elapsed = Math.floor((Date.now() - raceStartTime) / 1000)
  finishTimes.value.push(elapsed)
  beep(120, 1400); haptic(60)
  ui.toast(`#${finishTimes.value.length} — ${fmtTime(elapsed)}`)
}

function removeFinish(idx) {
  if (debounce(`rm${idx}`, 500)) return
  finishTimes.value.splice(idx, 1)
  haptic(30); ui.toast('Finish time removed', false)
}

// ── Finish & save
async function doFinishRace() {
  clearInterval(timerInterval)
  ui.releaseWakeLock()

  // Snapshot state before resetting so async saves use correct data
  const savedRaceNumber  = raceNumber
  const savedStartTime   = raceStartTime ? new Date(raceStartTime).toTimeString().slice(0,8) : '00:00:00'
  const savedFinishTimes = [...finishTimes.value]
  const savedRaceOrder   = [...raceOrder.value]

  // Reset UI immediately — don't make the user stare at RACE TIME while Supabase writes
  phase.value       = 'idle'
  displayMs.value   = 0
  finishTimes.value = []
  raceNumber++
  raceOrder.value   = [...compStore.competitors]
  hapticPat([100, 80, 100, 80, 200])
  ui.toast(`Race ${savedRaceNumber} saved!`)

  // Persist in background
  const race = await raceStore.createRace({
    race_number:  savedRaceNumber,
    race_date:    new Date().toISOString().slice(0,10),
    start_time:   savedStartTime,
    seq_minutes:  seqMinutes.value,
  })

  const results = savedRaceOrder.map((c, i) => ({
    race_id:         race.id,
    competitor_id:   c.id,
    position:        i + 1,
    elapsed_seconds: i < savedFinishTimes.length ? savedFinishTimes[i] : 0,
    dnf:             i >= savedFinishTimes.length,
  }))

  for (const r of results) await raceStore.saveResult(r)
  ui.markSaved()
}

function confirmFinish() {
  ui.showConfirm('Finish Race', 'Save results and start new race?', doFinishRace)
}

// ── Drag & drop (desktop)
function dStart(e, idx) { dragIdx = idx; e.dataTransfer.effectAllowed = 'move' }
function dOver(e)        { e.preventDefault() }
function dDrop(e, to) {
  e.preventDefault()
  if (dragIdx === null || dragIdx === to) return
  moveRow(dragIdx, to); dragIdx = null
}

// ── Touch drag (mobile)
function tStart(e, idx) {
  if (!e.target.closest('.drag-grip')) return
  tFromIdx = idx; tEl = e.currentTarget
  tEl.classList.add('dragging')
}
function tMove(e) { if (tEl) e.preventDefault() }
function tEnd(e, _idx) {
  if (!tEl) return
  tEl.classList.remove('dragging')
  const endY = e.changedTouches[0].clientY
  const rows  = document.querySelectorAll('.race-tbody .comp-row')
  let to = tFromIdx
  rows.forEach((row, i) => {
    const r = row.getBoundingClientRect()
    if (endY >= r.top && endY <= r.bottom) to = i
  })
  if (tFromIdx !== to) moveRow(tFromIdx, to)
  tEl = null; tFromIdx = null
}

function moveRow(from, to) {
  const arr = [...raceOrder.value]
  const [item] = arr.splice(from, 1)
  arr.splice(to, 0, item)
  raceOrder.value = arr
  haptic(20)
}

// ── Add sailor modal
async function submitAddSailor() {
  const name = mName.value.trim()
  if (!name) { ui.toast('Enter name', false); return }
  const comp = await compStore.addCompetitor({ name, sail_no: mSailNo.value.trim(), class: mClass.value })
  raceOrder.value.push(comp)
  ui.markSaved()
  addSailorOpen.value = false
  mName.value = ''; mSailNo.value = ''; mClass.value = 'ILCA 7'
  haptic(30); ui.toast(`${name} added`)
}

function setSeq(n) {
  seqMinutes.value = n
  haptic(15)
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2,'0')}`
}
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>{{ raceTitle }}</h1>
        <div class="sub">{{ raceDate }}</div>
      </div>
      <button class="btn btn-ghost btn-sm" @click="addSailorOpen = true">+ Sailor</button>
    </div>

    <!-- Timer -->
    <div class="timer-wrap">
      <div class="timer-label">{{ displayLabel }}</div>
      <div class="timer-display" :class="displayClass">{{ displayText }}</div>
    </div>

    <!-- Sequence selector (idle only) -->
    <div v-if="phase === 'idle'">
      <div style="font:700 12px/1 var(--sans);color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;text-align:center;margin-bottom:10px">
        Start Sequence
      </div>
      <div class="seq-row">
        <button v-for="n in [1,2,3,4,5]" :key="n"
                class="seq-btn" :class="{ active: seqMinutes === n }"
                @click="setSeq(n)">{{ n }}</button>
      </div>
    </div>

    <!-- Race controls -->
    <div class="race-controls">
      <button v-if="phase === 'idle'"
              class="btn btn-primary btn-xl btn-block"
              @click="startRace">▶ START SEQUENCE</button>

      <button v-if="phase === 'countdown'"
              class="btn btn-danger btn-xl btn-block"
              @click="cancelRace">✕ CANCEL RACE</button>

      <button v-if="phase === 'racing'"
              class="btn-mega"
              @click="recordFinish">🏁 RECORD FINISH</button>
    </div>

    <!-- Finish chips -->
    <div v-if="finishTimes.length" class="card">
      <div class="card-title">Finish Times ({{ finishTimes.length }})</div>
      <div class="finish-strip">
        <span v-for="(t, i) in finishTimes" :key="i" class="finish-chip">
          <span style="color:var(--text2);font-size:11px;margin-right:2px">#{{ i + 1 }}</span>
          {{ fmtTime(t) }}
          <button class="rm" @click="removeFinish(i)">×</button>
        </span>
      </div>
    </div>

    <!-- Results table -->
    <div v-if="raceOrder.length" class="card">
      <div class="card-title">Results — drag rows to reorder</div>
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
          <tbody class="race-tbody">
            <tr v-for="(c, i) in raceOrder" :key="c.id"
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
              <td class="finish-time" :class="i < finishTimes.length ? 'has' : 'none'">
                {{ i < finishTimes.length ? fmtTime(finishTimes[i]) : '—' }}
              </td>
              <td>{{ c.name }}</td>
              <td class="sail-num">{{ c.sail_no }}</td>
              <td><span class="class-badge">{{ c.class }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Finish & save -->
    <div v-if="phase === 'racing' || finishTimes.length > 0" class="finish-save-row">
      <button class="btn btn-primary btn-xl" style="flex:1" @click="confirmFinish">
        ✓ FINISH &amp; SAVE RACE
      </button>
      <button v-if="phase === 'racing'" class="btn btn-ghost btn-sm" @click="cancelRace">
        ✕ Cancel
      </button>
    </div>

  </div>

  <!-- Floating voice note button -->
  <button v-if="recSupported" class="btn-rec" :class="{ active: isRecording }" @click="toggleRecording">
    <span class="rec-dot" />
    <span class="rec-label">{{ isRecording ? fmtTime(recDuration) : 'NOTE' }}</span>
  </button>

  <!-- Add Sailor modal -->
  <div class="modal-bg" :class="{ open: addSailorOpen }" @click.self="addSailorOpen = false">
    <div class="modal">
      <h2>Add Late Entry</h2>
      <div class="fg">
        <label class="fl">Sailor Name</label>
        <input class="fi" v-model="mName" placeholder="Name" autocomplete="off" @keyup.enter="submitAddSailor" />
      </div>
      <div style="display:flex;gap:10px">
        <div class="fg" style="flex:1">
          <label class="fl">Sail Number</label>
          <input class="fi" v-model="mSailNo" placeholder="Sail #" inputmode="numeric" autocomplete="off" />
        </div>
        <div class="fg" style="flex:1">
          <label class="fl">Class</label>
          <select class="fs" v-model="mClass">
            <option v-for="c in ['ILCA 7','ILCA 6','ILCA 4','Other']" :key="c">{{ c }}</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:var(--tap-gap)">
        <button class="btn btn-primary btn-block" @click="submitAddSailor">Add</button>
        <button class="btn btn-ghost btn-block"   @click="addSailorOpen = false">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.race-controls { display: flex; flex-direction: column; gap: var(--tap-gap); padding: 8px 0; }
.finish-save-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }

.btn-rec {
  position: fixed; right: 16px; bottom: 90px; z-index: 50;
  width: 68px; height: 68px; border-radius: 50%;
  background: var(--bg2); border: 3px solid var(--border);
  color: var(--text2); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
  touch-action: manipulation; transition: all .15s;
  box-shadow: 0 4px 16px rgba(0,0,0,.4);
}
.btn-rec.active {
  background: rgba(255,92,92,.15); border-color: var(--warn); color: var(--warn);
}
.rec-dot {
  width: 12px; height: 12px; border-radius: 50%; background: var(--text2);
  transition: background .15s;
}
.btn-rec.active .rec-dot { background: var(--warn); animation: pulse 1s infinite; }
.rec-label { font: 700 10px/1 var(--sans); text-transform: uppercase; letter-spacing: .5px; }

</style>
