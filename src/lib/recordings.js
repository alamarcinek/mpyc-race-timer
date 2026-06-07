const DB_NAME    = 'mpyc_audio'
const DB_VERSION = 1
const STORE      = 'recordings'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' })
        s.createIndex('timestamp', 'timestamp')
      }
    }
    req.onsuccess  = e => resolve(e.target.result)
    req.onerror    = () => reject(req.error)
  })
}

export async function saveRecording(rec) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(rec)
    tx.oncomplete = resolve
    tx.onerror    = () => reject(tx.error)
  })
}

export async function getAllRecordings() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).index('timestamp').getAll()
    req.onsuccess = () => resolve([...req.result].reverse())
    req.onerror   = () => reject(req.error)
  })
}

export async function deleteRecording(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = resolve
    tx.onerror    = () => reject(tx.error)
  })
}
