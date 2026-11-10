// What CRBN Rig's page remembers for the person using it, in their own browser only: the settings (localStorage) and
// the last capture and IR they loaded (IndexedDB, so a reload brings their rig back). Every access is guarded: in a
// private window, or with site data blocked, the page works and simply forgets.
const SETTINGS = 'crbn-rig/settings'
const DB = 'crbn-rig'
const STORE = 'files'

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS) ?? '{}') ?? {} } catch { return {} }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS, JSON.stringify(settings)) } catch { /* not remembered */ }
}

function open() {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
  })
}

async function tx(mode, fn) {
  const db = await open()
  try {
    return await new Promise((ok, fail) => {
      const t = db.transaction(STORE, mode)
      const req = fn(t.objectStore(STORE))
      t.oncomplete = () => ok(req?.result)
      t.onerror = () => fail(t.error)
      t.onabort = () => fail(t.error)
    })
  } finally { db.close() }
}

/** Remembers a file ('capture' or 'ir') as { name, bytes }. */
export async function rememberFile(slot, name, bytes) {
  try { await tx('readwrite', (s) => s.put({ name, bytes: bytes.slice(0) }, slot)) } catch { /* not remembered */ }
}

export async function forgetFile(slot) {
  try { await tx('readwrite', (s) => s.delete(slot)) } catch { /* nothing to forget */ }
}

/** The remembered { name, bytes } for a slot, or null. */
export async function recallFile(slot) {
  try { return (await tx('readonly', (s) => s.get(slot))) ?? null } catch { return null }
}
