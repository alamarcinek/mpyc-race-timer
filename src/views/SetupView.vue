<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCompetitorsStore } from '@/stores/competitors.js'
import { useUIStore } from '@/stores/ui.js'

const store  = useCompetitorsStore()
const ui     = useUIStore()
const router = useRouter()

const CLASSES = ['ILCA 7', 'ILCA 6', 'ILCA 4', 'Other']

// Form
const addName   = ref('')
const addSailNo = ref('')
const addClass  = ref('ILCA 7')

// Scan
const photoInput  = ref(null)
const parseStatus = ref(null) // null | {type:'loading'|'success'|'error', text:''}


onMounted(() => store.load())

function haptic(ms = 30) { try { navigator.vibrate?.(ms) } catch {} }

async function addCompetitor() {
  const name = addName.value.trim()
  if (!name) { ui.toast('Enter sailor name', false); return }
  await store.addCompetitor({ name, sail_no: addSailNo.value.trim(), class: addClass.value })
  addName.value = ''
  addSailNo.value = ''
  ui.markSaved()
  haptic(30)
  ui.toast(`${name} added`)
}

function removeComp(id) {
  store.deleteCompetitor(id)
  ui.markSaved()
  haptic(20)
}

function clearAll() {
  ui.showConfirm('Clear All', 'Remove all competitors?', async () => {
    for (const c of [...store.competitors]) await store.deleteCompetitor(c.id)
    ui.markSaved()
    ui.toast('All competitors cleared', false)
  })
}

function goToRace() {
  if (!store.competitors.length) { ui.toast('Add at least one sailor first', false); return }
  haptic(50)
  router.push('/race')
}

// ── Resize + compress image to stay under Vercel's 4.5 MB platform body limit
function compressImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale  = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas compression failed')), 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = url
  })
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result.split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// ── Photo scan — proxied through /api/parse-signup (keeps API key server-side)
async function handlePhoto(file) {
  if (!file) return
  parseStatus.value = { type: 'loading', text: '⏳ Analysing signup sheet…' }
  try {
    const compressed = await compressImage(file)
    const base64 = await toBase64(compressed)
    const resp = await fetch('/api/parse-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mediaType: 'image/jpeg' }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.error || `Server error ${resp.status}`)
    }
    const data = await resp.json()
    const parsed = JSON.parse(data.text.replace(/```json|```/g, '').trim())
    if (Array.isArray(parsed) && parsed.length) {
      for (const p of parsed) {
        store.addCompetitor({ name: p.name || 'Unknown', sail_no: String(p.sailNo || p.sail_no || ''), class: p.class || 'ILCA 7' })
      }
      ui.markSaved()
      parseStatus.value = { type: 'success', text: `✓ Found ${parsed.length} competitor${parsed.length > 1 ? 's' : ''}` }
      ui.toast(`${parsed.length} sailors added`)
    } else {
      parseStatus.value = { type: 'error', text: '✗ No competitors found — add manually.' }
    }
  } catch (err) {
    parseStatus.value = { type: 'error', text: `✗ ${err.message || 'Scan failed'} — add competitors manually.` }
    console.error(err)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>MPYC Race Timer</h1>
        <div class="sub">Mount Pleasant Yacht Club</div>
      </div>
    </div>

    <!-- Scan card -->
    <div class="card">
      <div class="card-title">📸 Scan Signup Sheet</div>
      <div class="upload-zone" @click="photoInput.click()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <p>Tap to photograph signup sheet</p>
        <p style="font-size:12px">AI parses names, sail numbers &amp; class</p>
      </div>
      <input ref="photoInput" type="file" accept="image/*" style="display:none"
             @change="handlePhoto($event.target.files[0]); $event.target.value = ''" />
      <div v-if="parseStatus" class="parse-status" :class="parseStatus.type">
        {{ parseStatus.text }}
      </div>
    </div>

    <!-- Add competitor -->
    <div class="card">
      <div class="card-title">➕ Add Competitor</div>
      <div class="fg">
        <label class="fl">Sailor Name</label>
        <input class="fi" v-model="addName" placeholder="e.g. John Smith"
               autocomplete="off" @keyup.enter="addCompetitor" />
      </div>
      <div style="display:flex;gap:10px">
        <div class="fg" style="flex:1">
          <label class="fl">Sail Number</label>
          <input class="fi" v-model="addSailNo" placeholder="e.g. 209876"
                 inputmode="numeric" autocomplete="off" @keyup.enter="addCompetitor" />
        </div>
        <div class="fg" style="flex:1">
          <label class="fl">Class</label>
          <select class="fs" v-model="addClass">
            <option v-for="c in CLASSES" :key="c">{{ c }}</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-block" @click="addCompetitor">Add Sailor</button>
    </div>

    <!-- Competitor list -->
    <div v-if="store.competitors.length" class="card">
      <div class="card-title">Competitors ({{ store.competitors.length }})</div>
      <div style="overflow-x:auto">
        <table class="comp-table">
          <thead><tr><th>Name</th><th>Sail #</th><th>Class</th><th></th></tr></thead>
          <tbody>
            <tr v-for="c in store.competitors" :key="c.id" class="comp-row">
              <td>
                <input class="inline-fi" :value="c.name" placeholder="Name"
                       @change="store.updateCompetitor(c.id, { name: $event.target.value.trim() })" />
              </td>
              <td>
                <input class="inline-fi sail-input" :value="c.sail_no" placeholder="—"
                       inputmode="numeric"
                       @change="store.updateCompetitor(c.id, { sail_no: $event.target.value.trim() })" />
              </td>
              <td>
                <select class="inline-fs" :value="c.class"
                        @change="store.updateCompetitor(c.id, { class: $event.target.value })">
                  <option v-for="cls in CLASSES" :key="cls">{{ cls }}</option>
                </select>
              </td>
              <td>
                <button class="btn btn-ghost btn-sm" style="color:var(--warn)"
                        @click="removeComp(c.id)">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-ghost btn-block" @click="clearAll">Clear All</button>
      </div>
    </div>

    <!-- Go to race -->
    <button class="btn btn-primary btn-xl btn-block" @click="goToRace">
      Proceed to Race →
    </button>
  </div>
</template>

<style scoped>
.inline-fi {
  background: none; border: none; border-bottom: 1px solid transparent;
  color: var(--text); font: 600 15px/1.3 var(--sans);
  width: 100%; min-width: 80px; padding: 4px 2px; outline: none;
  -webkit-user-select: text; user-select: text;
  transition: border-color .15s;
}
.inline-fi:focus { border-bottom-color: var(--accent); }
.sail-input { font-family: var(--mono); color: var(--blue); min-width: 60px; }

.inline-fs {
  background: none; border: none; border-bottom: 1px solid transparent;
  color: var(--blue); font: 700 12px/1 var(--sans);
  text-transform: uppercase; letter-spacing: .5px;
  padding: 4px 2px; outline: none; cursor: pointer;
  -webkit-appearance: none; appearance: none;
  transition: border-color .15s;
}
.inline-fs:focus { border-bottom-color: var(--accent); }
</style>
