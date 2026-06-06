import { supabase } from './supabase.js'
import { getAllSyncOps, removeSyncOp, upsert } from './db.js'

export async function flushSyncQueue() {
  if (!navigator.onLine) return
  const ops = await getAllSyncOps()
  for (const op of ops) {
    try {
      if (op.action === 'upsert') {
        const { error } = await supabase.from(op.table).upsert(op.record)
        if (error) throw error
      } else if (op.action === 'delete') {
        const { error } = await supabase.from(op.table).delete().eq('id', op.id)
        if (error) throw error
      }
      await removeSyncOp(op.id)
    } catch {
      // leave in queue for next attempt
    }
  }
}

// Fetch all rows from Supabase and cache locally
export async function pullTable(table) {
  if (!navigator.onLine) return
  const { data, error } = await supabase.from(table).select('*')
  if (error || !data) return
  for (const row of data) await upsert(table, row)
}

export function setupOnlineSync() {
  window.addEventListener('online', flushSyncQueue)
  // initial flush if already online
  flushSyncQueue()
}
