// What CRBN Rig's page remembers for the person using it, in their own browser only: the settings (localStorage), the
// last capture and IR they loaded (IndexedDB, so a reload brings their rig back), and the art players bring for their
// own kits' knobs and switches (IndexedDB, by its content's hash; D-RIG-010 (f)), and the library's folder and index
// (build plan R4, library.js). Every access is guarded: in a private window, or with site data blocked, the page works
// and simply forgets.
const SETTINGS = 'crbn-rig/settings'
const DB = 'crbn-rig'
const STORE = 'files'
const ART = 'art'
const LIB = 'lib'

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS) ?? '{}') ?? {} } catch { return {} }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS, JSON.stringify(settings)) } catch { /* not remembered */ }
}

// Version 2 (R1b) adds the art store beside the files; version 3 (R4) the library's.
function open() {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 3)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of [STORE, ART, LIB]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
    }
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
  })
}

async function tx(mode, fn, store = STORE) {
  const db = await open()
  try {
    return await new Promise((ok, fail) => {
      const t = db.transaction(store, mode)
      const req = fn(t.objectStore(store))
      t.oncomplete = () => ok(req?.result)
      t.onerror = () => fail(t.error)
      t.onabort = () => fail(t.error)
    })
  } finally { db.close() }
}

/** Remembers a file ('capture' or 'ir') as { name, bytes, from }: `from` is { key, p } when it came from the library. */
export async function rememberFile(slot, name, bytes, from = null) {
  try { await tx('readwrite', (s) => s.put({ name, bytes: bytes.slice(0), from }, slot)) } catch { /* not remembered */ }
}

export async function forgetFile(slot) {
  try { await tx('readwrite', (s) => s.delete(slot)) } catch { /* nothing to forget */ }
}

/** The remembered { name, bytes, from } for a slot, or null. */
export async function recallFile(slot) {
  try { return (await tx('readonly', (s) => s.get(slot))) ?? null } catch { return null }
}

/** Keeps a picture a player brought for their kit: { type, bytes }, under its id (the start of its SHA-256). */
export async function rememberArt(id, type, bytes) {
  try { await tx('readwrite', (s) => s.put({ type, bytes: bytes.slice(0) }, id), ART); return true } catch { return false }
}

/** A kept picture's { type, bytes }, or null. */
export async function recallArt(id) {
  try { return (await tx('readonly', (s) => s.get(id), ART)) ?? null } catch { return null }
}

/** The ids of every picture kept. */
export async function artIds() {
  try { return (await tx('readonly', (s) => s.getAllKeys(), ART)) ?? [] } catch { return [] }
}

export async function forgetArt(id) {
  try { await tx('readwrite', (s) => s.delete(id), ART) } catch { /* nothing to forget */ }
}

/** The library's folder ('folder': a handle or a desktop path) and each folder's index ('index:<key>'). */
export async function libGet(key) {
  try { return (await tx('readonly', (s) => s.get(key), LIB)) ?? null } catch { return null }
}

export async function libPut(key, value) {
  try { await tx('readwrite', (s) => s.put(value, key), LIB); return true } catch { return false }
}

export async function libDelete(key) {
  try { await tx('readwrite', (s) => s.delete(key), LIB) } catch { /* nothing to forget */ }
}
