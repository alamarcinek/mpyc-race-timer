<script setup>
import { RouterView, useRoute, useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { useUIStore } from '@/stores/ui.js'

const route  = useRoute()
const router = useRouter()
const ui     = useUIStore()

const DATA_VERSION = '1'

onMounted(() => {
  if (localStorage.getItem('mpyc_version') !== DATA_VERSION) {
    localStorage.removeItem('mpyc_competitors')
    localStorage.removeItem('mpyc_races')
    localStorage.removeItem('mpyc_results')
    localStorage.setItem('mpyc_version', DATA_VERSION)
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ui.wakeActive) ui.requestWakeLock()
  })
})

function nav(path) {
  router.push(path)
  try { navigator.vibrate?.(15) } catch {}
}
</script>

<template>
  <!-- Status bar -->
  <div class="status-bar">
    <span>{{ ui.saveStatus }}</span>
    <span>{{ ui.wakeLockLabel }}</span>
  </div>

  <!-- Toast -->
  <div class="toast" :class="[ui.toastVisible ? 'show' : '', ui.toastType]">
    {{ ui.toastMsg }}
  </div>

  <!-- Confirm overlay -->
  <div class="confirm-overlay" :class="{ open: ui.confirmOpen }">
    <div class="confirm-box">
      <h3>{{ ui.confirmTitle }}</h3>
      <p>{{ ui.confirmMsg }}</p>
      <div class="confirm-btns">
        <button class="btn btn-danger" @click="ui.doConfirm()">Yes</button>
        <button class="btn btn-ghost"  @click="ui.cancelConfirm()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Pages — KeepAlive on RaceView so the timer survives tab switches -->
  <RouterView v-slot="{ Component }">
    <KeepAlive include="RaceView">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>

  <!-- Bottom nav -->
  <nav class="nav">
    <button :class="{ active: route.path === '/' }" @click="nav('/')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
      Setup
    </button>
    <button :class="{ active: route.path === '/race' }" @click="nav('/race')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      Race
    </button>
    <button :class="{ active: route.path === '/history' }" @click="nav('/history')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
      History
    </button>
  </nav>
</template>

<style>
/* ================================================================
   MARINE INSTRUMENT PANEL DESIGN SYSTEM
   High-contrast · Direct sunlight · Wet hands · Boat motion
   ================================================================ */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');

:root {
  --bg:      #0b1929;
  --bg2:     #0f2238;
  --bg3:     #17304d;
  --card:    #0f2238;
  --border:  #1c4068;
  --text:    #f0f4f8;
  --text2:   #7da2c4;
  --accent:  #00e8b0;
  --accent2: #00cc9a;
  --warn:    #ff5c5c;
  --warn2:   #e04848;
  --blue:    #4da8ff;
  --orange:  #ffaa2e;
  --gold:    #ffd740;
  --green:   #4cff8e;
  --radius:  14px;
  --mono:    'JetBrains Mono', monospace;
  --sans:    'DM Sans', -apple-system, sans-serif;
  --tap-lg:  64px;
  --tap-md:  56px;
  --tap-sm:  48px;
  --tap-gap: 14px;
}

*, *::before, *::after {
  margin: 0; padding: 0; box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
}

html, body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  height: 100%;
  overflow-x: hidden;
  -webkit-user-select: none; user-select: none;
  overscroll-behavior-y: contain;
}

/* === STATUS BAR === */
.status-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 90;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; background: var(--bg2);
  border-bottom: 1px solid var(--border);
  font: 600 11px/1 var(--mono); color: var(--text2);
  height: 32px;
}
.status-bar .indicator {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; margin-right: 5px; vertical-align: middle;
}
.indicator.ok   { background: var(--green); }
.indicator.warn { background: var(--orange); animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

/* === BOTTOM NAV === */
.nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  display: flex; background: var(--bg2);
  border-top: 2px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.nav button {
  flex: 1; background: none; border: none; color: var(--text2);
  font: 700 12px/1 var(--sans); padding: 12px 4px 10px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer; transition: color .15s; min-height: var(--tap-md);
  touch-action: manipulation;
}
.nav button.active { color: var(--accent); }
.nav button svg { width: 24px; height: 24px; }

/* === TOAST === */
.toast {
  position: fixed; top: 40px; left: 50%; transform: translateX(-50%);
  padding: 12px 24px; border-radius: 12px;
  font: 700 15px/1 var(--sans); z-index: 300;
  opacity: 0; transition: opacity .25s; pointer-events: none;
  text-align: center; max-width: 90%; white-space: nowrap;
}
.toast.show { opacity: 1; }
.toast.ok   { background: var(--accent); color: var(--bg); }
.toast.bad  { background: var(--warn);   color: #fff; }

/* === CONFIRM OVERLAY === */
.confirm-overlay {
  display: none; position: fixed; inset: 0; z-index: 250;
  background: rgba(0,0,0,.7); backdrop-filter: blur(4px);
  align-items: center; justify-content: center; padding: 20px;
}
.confirm-overlay.open { display: flex; }
.confirm-box {
  background: var(--bg2); border: 2px solid var(--border);
  border-radius: 20px; padding: 28px 24px; text-align: center;
  max-width: 360px; width: 100%;
}
.confirm-box h3 { font: 800 18px/1.3 var(--sans); margin-bottom: 8px; }
.confirm-box p  { font: 500 14px/1.5 var(--sans); color: var(--text2); margin-bottom: 20px; }
.confirm-btns   { display: flex; gap: var(--tap-gap); }
.confirm-btns .btn { flex: 1; }

/* === BUTTONS === */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font: 700 15px/1 var(--sans); border: none; border-radius: var(--radius);
  padding: 16px 24px; cursor: pointer; transition: all .12s;
  white-space: nowrap; min-height: var(--tap-md);
  touch-action: manipulation;
}
.btn:active    { transform: scale(.96); }
.btn:disabled  { opacity: .35; pointer-events: none; }
.btn-primary   { background: var(--accent);  color: var(--bg); }
.btn-primary:active { background: var(--accent2); }
.btn-danger    { background: var(--warn);    color: #fff; }
.btn-danger:active  { background: var(--warn2); }
.btn-ghost     { background: var(--bg3); color: var(--text); border: 2px solid var(--border); }
.btn-ghost:active   { background: var(--border); }
.btn-block     { width: 100%; }
.btn-xl        { min-height: var(--tap-lg); padding: 18px 28px; font-size: 17px; border-radius: 16px; }
.btn-sm        { min-height: 40px; padding: 8px 14px; font-size: 13px; border-radius: 10px; }

/* RECORD FINISH — biggest possible target */
.btn-mega {
  width: 100%; min-height: 88px; border-radius: 20px;
  font: 800 22px/1 var(--sans); letter-spacing: .5px;
  background: linear-gradient(135deg, var(--accent), #00b8d4);
  color: var(--bg); border: none;
  box-shadow: 0 4px 30px rgba(0,232,176,.25);
  touch-action: manipulation; cursor: pointer;
  transition: all .1s;
  display: flex; align-items: center; justify-content: center;
}
.btn-mega:active  { transform: scale(.97); box-shadow: 0 2px 12px rgba(0,232,176,.15); }
.btn-mega:disabled { opacity: .3; }

/* === CARD === */
.card {
  background: var(--card); border: 2px solid var(--border);
  border-radius: var(--radius); padding: 16px; margin-bottom: 14px;
}
.card-title {
  font: 700 13px/1.2 var(--sans); color: var(--text2);
  text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;
}

/* === FORM ELEMENTS === */
.fg { margin-bottom: 12px; }
.fl {
  font: 700 12px/1 var(--sans); color: var(--text2);
  text-transform: uppercase; letter-spacing: .8px;
  margin-bottom: 6px; display: block;
}
.fi, .fs {
  width: 100%; padding: 14px 16px; min-height: var(--tap-sm);
  background: var(--bg3); border: 2px solid var(--border);
  border-radius: 12px; color: var(--text);
  font: 600 16px/1 var(--sans); outline: none;
  transition: border-color .2s;
  -webkit-user-select: text; user-select: text;
}
.fi:focus, .fs:focus { border-color: var(--accent); }
.fs {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%237da2c4'%3E%3Cpath d='M7 10L1 4h12z'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 16px center;
}

/* === SEQUENCE BUTTONS === */
.seq-row { display: flex; gap: var(--tap-gap); justify-content: center; margin: 14px 0; }
.seq-btn {
  width: var(--tap-md); height: var(--tap-md); border-radius: 50%;
  background: var(--bg3); border: 3px solid var(--border);
  color: var(--text); font: 800 20px/1 var(--mono);
  cursor: pointer; transition: all .15s;
  display: flex; align-items: center; justify-content: center;
  touch-action: manipulation;
}
.seq-btn.active { border-color: var(--accent); background: rgba(0,232,176,.15); color: var(--accent); }

/* === TIMER === */
.timer-wrap { text-align: center; padding: 16px 0; }
.timer-display {
  font: 800 80px/1 var(--mono); letter-spacing: -3px;
  color: var(--text); transition: color .2s;
  text-shadow: 0 0 20px rgba(255,255,255,.08);
}
.timer-display.countdown { color: var(--orange); text-shadow: 0 0 30px rgba(255,170,46,.3); }
.timer-display.racing    { color: var(--accent); text-shadow: 0 0 30px rgba(0,232,176,.3); }
.timer-label {
  font: 700 14px/1 var(--sans); text-transform: uppercase;
  letter-spacing: 3px; color: var(--text2); margin-top: 8px;
}

/* === COMPETITOR TABLE === */
.comp-table { width: 100%; border-collapse: separate; border-spacing: 0; }
.comp-table th {
  font: 700 11px/1 var(--sans); color: var(--text2);
  text-transform: uppercase; letter-spacing: 1.5px;
  padding: 10px 6px; text-align: left;
  border-bottom: 2px solid var(--border);
}
.comp-row { border-bottom: 1px solid rgba(28,64,104,.5); transition: background .12s; }
.comp-row.dragging  { opacity: .4; background: var(--bg3); }
.comp-row.drag-over { border-top: 3px solid var(--accent); }
.comp-row td { padding: 12px 6px; font: 600 15px/1.3 var(--sans); vertical-align: middle; }

.sail-num    { font: 700 15px/1 var(--mono); color: var(--blue); }
.class-badge {
  display: inline-block; padding: 4px 10px; border-radius: 8px;
  font: 700 11px/1 var(--sans); text-transform: uppercase; letter-spacing: .5px;
  background: rgba(77,168,255,.12); color: var(--blue);
}
.finish-time      { font: 700 15px/1 var(--mono); }
.finish-time.has  { color: var(--accent); }
.finish-time.none { color: var(--text2); }
.pos-num { font: 800 16px/1 var(--mono); color: var(--text2); min-width: 28px; }
.drag-grip { width: 36px; text-align: center; color: var(--text2); cursor: grab; font-size: 18px; touch-action: none; }

/* === FINISH CHIPS === */
.finish-strip { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.finish-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(0,232,176,.1); border: 2px solid rgba(0,232,176,.3);
  border-radius: 10px; padding: 8px 14px;
  font: 700 14px/1 var(--mono); color: var(--accent);
  min-height: var(--tap-sm);
}
.finish-chip .rm {
  background: none; border: none; color: var(--warn);
  font: 800 18px/1 var(--sans); cursor: pointer;
  padding: 4px 4px 4px 8px;
  min-width: 32px; min-height: 32px;
  display: flex; align-items: center; justify-content: center;
  touch-action: manipulation;
}

/* === UPLOAD ZONE === */
.upload-zone {
  border: 3px dashed var(--border); border-radius: var(--radius);
  padding: 28px 16px; text-align: center; cursor: pointer;
  transition: border-color .2s; min-height: var(--tap-lg);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  touch-action: manipulation;
}
.upload-zone:active { border-color: var(--accent); background: rgba(0,232,176,.04); }
.upload-zone svg { width: 36px; height: 36px; color: var(--text2); }
.upload-zone p { font: 600 14px/1.4 var(--sans); color: var(--text2); }

/* === PARSE STATUS === */
.parse-status { padding: 14px; border-radius: 12px; margin: 12px 0; font: 600 14px/1.4 var(--sans); }
.parse-status.loading { background: rgba(77,168,255,.1);  color: var(--blue); }
.parse-status.success { background: rgba(0,232,176,.1);   color: var(--accent); }
.parse-status.error   { background: rgba(255,92,92,.1);   color: var(--warn); }

/* === HISTORY CARD === */
.hist-card {
  background: var(--card); border: 2px solid var(--border);
  border-radius: var(--radius); padding: 16px; margin-bottom: 12px;
  cursor: pointer; min-height: var(--tap-md); transition: border-color .15s;
  touch-action: manipulation;
}
.hist-card:active { border-color: var(--accent); }
.hist-card .date { font: 700 12px/1 var(--mono); color: var(--blue); }
.hist-card .name { font: 700 17px/1.2 var(--sans); margin: 6px 0 4px; }
.hist-card .meta { font: 500 13px/1.3 var(--sans); color: var(--text2); }

/* === BOTTOM-SHEET MODAL === */
.modal-bg {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,.65); backdrop-filter: blur(5px);
  display: flex; align-items: flex-end; justify-content: center;
  opacity: 0; pointer-events: none;
  transition: opacity .25s;
}
.modal-bg.open { opacity: 1; pointer-events: all; }
.modal {
  background: var(--bg2); border: 2px solid var(--border);
  border-radius: 22px 22px 0 0; padding: 24px 20px 40px;
  width: 100%; max-width: 560px; max-height: 85vh; overflow-y: auto;
  transform: translateY(100%); transition: transform .3s;
}
.modal-bg.open .modal { transform: translateY(0); }
.modal h2 { font: 800 20px/1.2 var(--sans); margin-bottom: 16px; }

/* === PAGE SHELL === */
.page { padding: 48px 16px 100px; min-height: 100dvh; }

.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 8px 0 16px;
}
.page-header h1   { font: 800 22px/1.2 var(--sans); letter-spacing: -.4px; }
.page-header .sub { font: 500 12px/1 var(--sans); color: var(--text2); margin-top: 3px; }

/* === RESPONSIVE === */
@media (min-width: 768px) {
  .timer-display { font-size: 100px; }
  .btn-mega      { min-height: 100px; font-size: 26px; }
  .page          { padding: 48px 24px 100px; max-width: 700px; margin: 0 auto; }
}
@media (max-width: 380px) {
  .timer-display { font-size: 60px; }
  .btn-mega      { min-height: 76px; font-size: 19px; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .timer-display { font-size: 56px; }
  .timer-wrap    { padding: 8px 0; }
}
</style>
