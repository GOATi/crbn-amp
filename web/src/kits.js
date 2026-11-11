// Players' own kits (D-RIG-009 (c), D-RIG-010 (f); build plan R1b): built in the Rig builder from the energy kits'
// parts, named, kept in this browser beside the twenty, and shared as a RIG1 code. A kit can wear its player's own
// knob and switch art, kept in IndexedDB by the start of its SHA-256 (store.js); the code carries those ids, and the
// pictures themselves travel through Pavillion Hub in a later step (a store for the Hub lane to host).
//
// A RIG1 code is the Hardware Lab's own (docs/design/2026-11-11-hardware-lab/lab.html, shareCode and readCode), so a
// kit built in the lab opens here: 'RIG1.' and base64url of {n: name, fx, cut, mesh, mat, knob, own, a?: {k, s, n}}.
import { KIT_PARTS } from './hw/hw.js'
import { artIds, forgetArt, recallArt, rememberArt } from './store.js'

const KEY = 'crbn-rig/kits'
const PART_KEYS = Object.keys(KIT_PARTS)
const HEXID = /^[0-9a-f]{32}$/
export const MAX_KITS = 50
export const NAME_MAX = 24, ART_NAME_MAX = 32, ART_MAX_BYTES = 2 * 1024 * 1024
export const ART_TYPES = ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg']

const isPart = (key, v) => KIT_PARTS[key][1].some((o) => o[0] === v)
const artOf = (a) => {
  const id = (v) => (typeof v === 'string' && HEXID.test(v) ? v : null)
  const name = typeof (a?.name ?? a?.n) === 'string' ? (a.name ?? a.n).slice(0, ART_NAME_MAX) : ''
  return { knob: id(a?.knob ?? a?.k), sw: id(a?.sw ?? a?.s), name }
}
/** A kit checked part by part: null if any part is unknown. */
function kitOf(o, id) {
  if (!o || typeof o !== 'object') return null
  const kit = { id, name: typeof (o.name ?? o.n) === 'string' ? (o.name ?? o.n).slice(0, NAME_MAX) : '' }
  for (const k of PART_KEYS) { if (!isPart(k, o[k])) return null; kit[k] = o[k] }
  kit.art = artOf(o.art ?? o.a)
  return kit
}
const newId = () => 'my-' + (crypto.randomUUID?.() ?? String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 10)
export const isOwnId = (id) => typeof id === 'string' && id.startsWith('my-')

/** The kept kits, in the order they were made. */
export function loadKits() {
  let list = []
  try { list = JSON.parse(localStorage.getItem(KEY) ?? '{}')?.kits ?? [] } catch { /* none */ }
  const seen = new Set()
  return (Array.isArray(list) ? list : []).map((k) => kitOf(k, typeof k?.id === 'string' && /^my-[a-z0-9]{1,24}$/.test(k.id) ? k.id : newId()))
    .filter((k) => k && !seen.has(k.id) && seen.add(k.id)).slice(0, MAX_KITS)
}
export function saveKits(kits) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, kits })); return true } catch { return false }
}

// CRBN's parts (D-RIG-009 (b)): where a kit built from has a part the builder does not offer (Valve's knobs), CRBN's.
const CRBN_PARTS = { fx: 'circuit', cut: 'honeycomb', mesh: 'perf', mat: 'carbon', knob: 'obsidian', own: '#d92b52' }
/** A new kit from a kit's parts (an energy kit, or one of the player's), named after the ones already kept. */
export function makeKit(from, kits) {
  const parts = Object.fromEntries(PART_KEYS.map((k) => [k, isPart(k, from?.[k]) ? from[k] : CRBN_PARTS[k]]))
  const base = kitOf(parts, newId())
  const taken = new Set(kits.map((k) => k.name))
  let n = 1
  while (taken.has(n === 1 ? 'My kit' : `My kit ${n}`)) n++
  base.name = n === 1 ? 'My kit' : `My kit ${n}`
  if (from?.art) base.art = artOf(from.art)
  return base
}

// ---------------------------------------------------------------- the share code
const b64url = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))

export function shareCode(kit) {
  const o = { n: kit.name }
  for (const k of PART_KEYS) o[k] = kit[k]
  const a = kit.art ?? {}
  if (a.knob || a.sw) o.a = { k: a.knob ?? '', s: a.sw ?? '', n: a.name ?? '' }
  return 'RIG1.' + b64url(JSON.stringify(o))
}
/** The kit in a RIG1 code, found anywhere in the text pasted (a message with a code in it), or null. */
export function readCode(text) {
  const m = /RIG1\.([A-Za-z0-9_-]{8,4000})/.exec(String(text ?? ''))
  if (!m) return null
  try { return kitOf(JSON.parse(unb64url(m[1])), newId()) } catch { return null }
}
/** Two kits with the same name, parts and art. */
export const sameKit = (a, b) => a.name === b.name && PART_KEYS.every((k) => a[k] === b[k]) && JSON.stringify(artOf(a.art)) === JSON.stringify(artOf(b.art))

// ---------------------------------------------------------------- players' art
const URLS = new Map()
/** The picture URL of a kept piece of art, or null if this browser does not have it. */
export async function artURL(id) {
  if (!id) return null
  if (URLS.has(id)) return URLS.get(id)
  const rec = await recallArt(id)
  if (!rec || !ART_TYPES.includes(rec.type)) return null
  const url = URL.createObjectURL(new Blob([rec.bytes], { type: rec.type }))
  URLS.set(id, url)
  return url
}
export const artURLNow = (id) => (id && URLS.get(id)) || null

async function hashId(bytes) {
  if (crypto.subtle) return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
  // no SubtleCrypto (an insecure origin): FNV-1a, four ways, still 32 hex digits
  let out = ''
  for (let w = 0; w < 4; w++) { let h = 0x811c9dc5 ^ w; for (const b of bytes) h = Math.imul(h ^ b, 0x01000193); out += (h >>> 0).toString(16).padStart(8, '0') }
  return out
}
function decodes(url) {
  return new Promise((ok) => { const im = new Image(); im.onload = () => ok(im.naturalWidth > 0 && im.naturalHeight > 0 ? im : null); im.onerror = () => ok(null); im.src = url })
}
/**
 * Brings in a player's picture for a knob or a switch: SVG, PNG, WebP or JPEG up to 2 MB that decodes as a picture.
 * Returns { id, url, kept, shape } or { error } in words a person reads. `shape` is the picture's width over its height.
 */
export async function importArt(file) {
  if (!file) return { error: 'No file was chosen.' }
  const type = file.type || ({ svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[file.name?.split('.').pop()?.toLowerCase()] ?? '')
  if (!ART_TYPES.includes(type)) return { error: 'Use an SVG, PNG, WebP or JPEG picture.' }
  if (file.size > ART_MAX_BYTES) return { error: 'That picture is over 2 MB.' }
  let bytes
  try { bytes = new Uint8Array(await file.arrayBuffer()) } catch { return { error: 'That file could not be read.' } }
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const im = await decodes(url)
  if (!im) { URL.revokeObjectURL(url); return { error: 'That file is not a picture this browser can draw.' } }
  const id = await hashId(bytes)
  if (URLS.has(id)) URL.revokeObjectURL(url)
  else URLS.set(id, url)
  const kept = await rememberArt(id, type, bytes)
  return { id, url: URLS.get(id), kept, shape: im.naturalWidth / im.naturalHeight }
}
/** Forgets the art no kept kit wears, when Rig starts and nothing is drawn yet. Art a kit stops wearing (replaced,
 *  cleared, or its kit deleted) stays until then, so a kit deleted and opened again from its code keeps its art. */
export async function tidyArt(kits) {
  const worn = new Set(kits.flatMap((k) => [k.art?.knob, k.art?.sw]))
  for (const id of await artIds()) if (!worn.has(id)) await forgetArt(id)
}
