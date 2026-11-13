// CRBN Rig's rigs and variants (build plan R6 step 3, P3-UX U5; the owner's picks at SYNC:RIG-030). A rig is a chain:
// the pedals on the board, the amp's capture, the cabinet IR, and the amp's sound (the gate, the EQ, the output level,
// the cabinet on or off). Rigs sit beside the pads (the owner's pick): the pads stay the library's favourite captures on
// keys 1 to 0, and opening a rig sets the board, the amp and the cabinet.
//
// A variant is the same rig with its pedals set another way: which are on, and each one's Drive, Level and Tone (the
// owner's pick). Three to a rig, on Q, W and E, named Clean, Push and Lead until the player renames them. The variant
// picked follows the player: stomping a pedal or turning one of its knobs changes that variant, and the others keep
// theirs. The amp, the cabinet and the board itself are the rig's, the same in every variant.
//
// Rigs are kept in this browser (localStorage) as references to files, never the files: a file in the library is named
// by its path in the folder, its name and its size; a file that came from elsewhere (dropped, or added from a file) is
// kept beside the rig in IndexedDB (store.js), under its name and size. A rig exported is a small JSON file of names and
// references only (FORMAT below); imported, each reference is looked for in the library open now: the same path, else
// the same file name and size, else the one file of that name.
import { PEDALS } from './engine.js'

const KEY = 'crbn-rig/rigs'
export const VARIANTS = 3
export const VARIANT_KEYS = ['Q', 'W', 'E']
export const VARIANT_NAMES = ['Clean', 'Push', 'Lead']
/** The file's mark and version. A later version may add fields; this one reads only its own. */
export const FORMAT = 'crbn-rig'
export const VERSION = 1
/** The amp's settings a rig keeps, and their ranges. The input level and its calibration are the player's interface, not
 *  the rig's, so they stay as they are. */
export const RIG_SETTINGS = Object.freeze({
  gateOn: [0, 1, true], gateThresholdDB: [-100, 0], eqOn: [0, 1, true], bass: [0, 10], middle: [0, 10], treble: [0, 10],
  outputDB: [-40, 40], irOn: [0, 1, true],
})
/** A pedal's settings in a variant, with the page's setting each one is (pedal<Name><place>), and its range. */
export const PEDAL_SETTINGS = Object.freeze({ drive: ['Drive', -12, 12], level: ['Level', -12, 12], tone: ['Tone', -6, 6], toneOn: ['ToneOn', 0, 1] })
/** A pedal new to a variant: off, its knobs at their middles, its Tone bypassed. */
export const PEDAL_DEFAULT = Object.freeze({ on: false, drive: 0, level: 0, tone: 0, toneOn: 0 })
const MAX_RIGS = 200
const MAX_FILE = 64 * 1024
const NAME_MAX = 60

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d)
export const tidyName = (s, d = '') => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '') || d

/** A pedal's settings for one variant, from anything: null for an empty place. */
export function tidyEntry(e) {
  if (!e || typeof e !== 'object') return null
  const out = { on: e.on === true || e.on === 1 }
  for (const [k, [, lo, hi]] of Object.entries(PEDAL_SETTINGS)) out[k] = k === 'toneOn' ? (e[k] === true || e[k] === 1 ? 1 : 0) : num(e[k], lo, hi, 0)
  return out
}

/** A reference to a file, from anything: { name, path, size }, { example: true }, or null. */
export function tidyRef(r) {
  if (!r || typeof r !== 'object') return null
  if (r.example === true) return { example: true, name: 'Example capture' }
  const name = typeof r.name === 'string' ? r.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255).trim() : ''
  if (!name || /[\\/]/.test(name)) return null
  const path = typeof r.path === 'string' && r.path.length <= 1024 && !r.path.includes('\\') && !r.path.split('/').includes('..') ? r.path : null
  const size = Number.isInteger(r.size) && r.size >= 0 ? r.size : null
  return { name, path, size }
}

/** A whole rig, from anything a file or this browser held; throws, in words, when it is not one. */
export function tidyRig(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('This file is not a CRBN Rig rig.')
  if (x.format !== FORMAT) throw new Error('This file is not a CRBN Rig rig.')
  if (!(Number.isInteger(x.version) && x.version >= 1)) throw new Error('This rig file has no version CRBN Rig knows.')
  const settings = {}
  for (const [k, [lo, hi, sw]] of Object.entries(RIG_SETTINGS)) {
    const v = x.settings?.[k]
    if (typeof v === 'number' && Number.isFinite(v)) settings[k] = sw ? (v > 0.5 ? 1 : 0) : clamp(v, lo, hi)
    else if (typeof v === 'boolean' && sw) settings[k] = v ? 1 : 0
  }
  const pedals = Array.from({ length: PEDALS }, (_, p) => tidyRef(Array.isArray(x.pedals) ? x.pedals[p] : null))
  const variants = Array.from({ length: VARIANTS }, (_, i) => {
    const v = Array.isArray(x.variants) ? x.variants[i] : null
    return { name: tidyName(v?.name, VARIANT_NAMES[i]), pedals: Array.from({ length: PEDALS }, (_, p) => (pedals[p] ? tidyEntry(v?.pedals?.[p]) ?? { ...PEDAL_DEFAULT } : null)) }
  })
  return {
    format: FORMAT, version: VERSION,
    name: tidyName(x.name, 'Imported rig'),
    amp: tidyRef(x.amp), ir: tidyRef(x.ir), settings, pedals, variants,
    variant: Number.isInteger(x.variant) && x.variant >= 0 && x.variant < VARIANTS ? x.variant : 0,
  }
}

/** A rig as its exported file: a small JSON file of names and references, never the captures themselves. */
export function rigFile(rig) {
  const { format, version, name, amp, ir, settings, pedals, variants, variant } = rig
  return JSON.stringify({ format, version, app: 'CRBN Rig', name, amp, ir, pedals, settings, variants, variant }, null, 2) + '\n'
}

/** Reads an exported rig's text; throws, in words, when it is not one. */
export function readRigFile(text) {
  if (typeof text !== 'string' || text.length > MAX_FILE) throw new Error('This file is too large to be a CRBN Rig rig.')
  let x
  try { x = JSON.parse(text) } catch { throw new Error('This file is not a CRBN Rig rig (it is not JSON).') }
  return tidyRig(x)
}

/** A rig's sound, for telling whether the rig playing differs from the one saved (its name aside). */
export const soundOf = (rig) => JSON.stringify({ ...rig, name: '' })

/**
 * Finds a reference in the library open now: the same path, else the same file name and size, else the only file with
 * that name. `kind` is 'nam' or 'ir'. Returns the library's entry, or null.
 */
export function findInLibrary(ref, entries, kind) {
  if (!ref || ref.example || !entries?.length) return null
  const ofKind = (e) => e.k === kind && !e.bad
  if (ref.path) { const e = entries.find((x) => x.p === ref.path && ofKind(x)); if (e && (ref.size === null || e.s === ref.size)) return e }
  const base = ref.name.toLowerCase()
  const same = entries.filter((x) => ofKind(x) && x.p.slice(x.p.lastIndexOf('/') + 1).toLowerCase() === base)
  return (ref.size !== null && same.find((x) => x.s === ref.size)) || (same.length === 1 ? same[0] : null) ||
    (ref.path ? entries.find((x) => x.p === ref.path && ofKind(x)) ?? null : null)
}

/** The IndexedDB key a file kept beside a rig goes under (a file that is not in the library). */
export const keptKey = (ref) => `rf:${ref.name}\n${ref.size ?? ''}`

/** A fresh set of variants: each the board as it is now. */
export const freshVariants = (now) => Array.from({ length: VARIANTS }, (_, i) => ({ name: VARIANT_NAMES[i], pedals: now.map((e) => (e ? { ...e } : null)) }))

/**
 * What this browser keeps: the rigs saved, and the rig playing now (its variants, the one picked, its name, and the
 * saved rig it came from, if any). `book` is [{ id, rig }], newest last.
 */
export function loadRigs() {
  let x = {}
  try { x = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {} } catch { /* none */ }
  const book = []
  for (const r of Array.isArray(x.book) ? x.book : []) {
    try { if (typeof r?.id === 'string' && r.id.length <= 40) book.push({ id: r.id, rig: tidyRig(r.rig) }) } catch { /* not a rig */ }
  }
  const w = x.work && typeof x.work === 'object' ? x.work : null
  const variants = w ? Array.from({ length: VARIANTS }, (_, i) => ({ name: tidyName(w.variants?.[i]?.name, VARIANT_NAMES[i]), pedals: Array.from({ length: PEDALS }, (_, p) => tidyEntry(w.variants?.[i]?.pedals?.[p])) })) : null
  return {
    book: book.slice(-MAX_RIGS),
    work: {
      variant: Number.isInteger(w?.variant) && w.variant >= 0 && w.variant < VARIANTS ? w.variant : 0,
      variants,
      from: typeof w?.from === 'string' && book.some((b) => b.id === w.from) ? w.from : null,
      name: tidyName(w?.name, 'New rig'),
    },
  }
}

/** Keeps the rigs; false when this browser will not keep them. */
export function saveRigs(state) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, book: state.book, work: state.work })); return true } catch { return false }
}

/** A name not yet used in the book: "Name", else "Name 2", "Name 3"... */
export function freeName(book, name, except = null) {
  const used = new Set(book.filter((b) => b.id !== except).map((b) => b.rig.name.toLowerCase()))
  if (!used.has(name.toLowerCase())) return name
  for (let n = 2; ; n++) { const s = `${name.slice(0, NAME_MAX - 4)} ${n}`; if (!used.has(s.toLowerCase())) return s }
}

export const newId = () => `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
export const MAX_RIG_COUNT = MAX_RIGS
