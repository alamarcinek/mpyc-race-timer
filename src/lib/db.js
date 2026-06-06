// IndexedDB wrapper for offline storage
const DB_NAME = 'mpyc-race-timer'
const DB_VERSION = 1

let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('competitors')) {
        const cs = db.createObjectStore('competitors', { keyPath: 'id' })
        cs.createIndex('sail_no', 'sail_no', { unique: false })
      }
      if (!db.objectStoreNames.contains('races')) {
        db.createObjectStore('races', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('race_results')) {
        const rs = db.createObjectStore('race_results', { keyPath: 'id' })
        rs.createIndex('race_id', 'race_id', { unique: false })
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror = () => reject(req.error)
  })
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => {
    const transaction = db.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  })
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getAll(store) {
  const os = await tx(store)
  return promisify(os.getAll())
}

export async function getById(store, id) {
  const os = await tx(store)
  return promisify(os.get(id))
}

export async function upsert(store, record) {
  const os = await tx(store, 'readwrite')
  return promisify(os.put(record))
}

export async function remove(store, id) {
  const os = await tx(store, 'readwrite')
  return promisify(os.delete(id))
}

export async function getByIndex(store, indexName, value) {
  const os = await tx(store)
  const index = os.index(indexName)
  return promisify(index.getAll(value))
}

export async function enqueueSyncOp(op) {
  const os = await tx('sync_queue', 'readwrite')
  return promisify(os.add(op))
}

export async function getAllSyncOps() {
  const os = await tx('sync_queue')
  return promisify(os.getAll())
}

export async function removeSyncOp(id) {
  const os = await tx('sync_queue', 'readwrite')
  return promisify(os.delete(id))
}
