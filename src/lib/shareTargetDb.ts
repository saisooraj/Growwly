export const SHARE_DB_NAME = 'growwly-share'
export const SHARE_STORE = 'pending'
export const SHARE_KEY = 'shared-image'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(SHARE_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingSharedImage(): Promise<{ blob: Blob; mime: string } | null> {
  try {
    const db = await openDb()
    return await new Promise(resolve => {
      const tx = db.transaction(SHARE_STORE, 'readonly')
      const req = tx.objectStore(SHARE_STORE).get(SHARE_KEY)
      req.onsuccess = () => resolve((req.result as { blob: Blob; mime: string } | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function clearPendingSharedImage(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>(resolve => {
      const tx = db.transaction(SHARE_STORE, 'readwrite')
      tx.objectStore(SHARE_STORE).delete(SHARE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // noop — nothing pending is the normal case
  }
}
