import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const onLine = ref(navigator.onLine)
  window.addEventListener('online',  () => { onLine.value = true })
  window.addEventListener('offline', () => { onLine.value = false })

  // Save status
  const saveStatus = ref('Ready')
  function markSaved() {
    saveStatus.value = 'Saved ' + new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // Toast
  const toastMsg     = ref('')
  const toastType    = ref('ok')
  const toastVisible = ref(false)
  let _toastTimer = null
  function toast(msg, ok = true) {
    toastMsg.value     = msg
    toastType.value    = ok ? 'ok' : 'bad'
    toastVisible.value = true
    clearTimeout(_toastTimer)
    _toastTimer = setTimeout(() => { toastVisible.value = false }, 2400)
  }

  // Confirm dialog
  const confirmOpen  = ref(false)
  const confirmTitle = ref('')
  const confirmMsg   = ref('')
  let _confirmCb = null
  function showConfirm(title, msg, cb) {
    confirmTitle.value = title
    confirmMsg.value   = msg
    _confirmCb         = cb
    confirmOpen.value  = true
  }
  function doConfirm() {
    confirmOpen.value = false
    _confirmCb?.()
    _confirmCb = null
  }
  function cancelConfirm() {
    confirmOpen.value = false
    _confirmCb = null
  }

  // Wake lock
  const wakeLockLabel = ref('☀️ Screen lock: off')
  const wakeActive    = ref(false)
  let _wakeLock = null
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        _wakeLock = await navigator.wakeLock.request('screen')
        wakeLockLabel.value = '☀️ Screen: awake'
        wakeActive.value = true
        _wakeLock.addEventListener('release', () => {
          wakeLockLabel.value = '🌙 Screen lock: on'
          wakeActive.value = false
        })
      }
    } catch {}
  }
  function releaseWakeLock() {
    _wakeLock?.release()
    _wakeLock = null
    wakeActive.value = false
    wakeLockLabel.value = '☀️ Screen lock: off'
  }

  return {
    onLine, saveStatus, markSaved,
    toastMsg, toastType, toastVisible, toast,
    confirmOpen, confirmTitle, confirmMsg, showConfirm, doConfirm, cancelConfirm,
    wakeLockLabel, wakeActive, requestWakeLock, releaseWakeLock,
  }
})
