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
  haptic(50)
  router.push('/race')
}

// ── Photo scan — proxied through /api/parse-signup (keeps API key server-side)
async function handlePhoto(file) {
  if (!file) return
  parseStatus.value = { type: 'loading', text: '⏳ Analysing signup sheet…' }
  try {
    const base64 = await toBase64(file)
    const resp = await fetch('/api/parse-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mediaType: file.type || 'image/jpeg' }),
    }).catch(() => { throw new Error('Cannot reach /api/parse-signup — is ANTHROPIC_API_KEY set in Vercel?') })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || `Server error ${resp.status}`)
    const parsed = JSON.parse(data.text.replace(/```json|```/g, '').trim())
    if (Array.isArray(parsed) && parsed.length) {
      for (const p of parsed) {
        await store.addCompetitor({ name: p.name || 'Unknown', sail_no: String(p.sailNo || p.sail_no || ''), class: p.class || 'ILCA 7' })
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

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
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
              <td>{{ c.name }}</td>
              <td class="sail-num">{{ c.sail_no }}</td>
              <td><span class="class-badge">{{ c.class }}</span></td>
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
    <button class="btn btn-primary btn-xl btn-block"
            :disabled="!store.competitors.length"
            @click="goToRace">
      Proceed to Race →
    </button>
  </div>
</template>
