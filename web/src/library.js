// CRBN Rig's library (build plan R4, P3-UX U3): the person's folder of captures (.nam) and cabinet IRs (.wav), listed
// with what each file says about itself, searched as they type, filtered by chips, sorted, starred, and played with a
// click. The same index runs in both builds; only where the files come from differs:
//
//   - a browser: the folder the person picked with showDirectoryPicker (or dropped, where the browser hands over a
//     handle), its handle kept in IndexedDB so the folder comes back next visit; where that API is missing, a folder
//     chosen through <input webkitdirectory> or dropped, kept for the visit;
//   - the desktop app (D-RIG-017): the folder its own dialog picked, read by crbn-rig.exe (NeuralAmpModeler/RigLibrary.cpp),
//     which also watches it and says when it changes.
//
// The index keeps, per file, its relative path, size and modified time, and what was read from it: a capture's
// metadata (name, gear type, make and model, tone type, who captured it, its sample rate), an IR's length and rate.
// It is kept in IndexedDB (in the desktop app, under the app's WebView2 profile in its settings folder), and a fresh
// scan reads only the files that changed since. Favourites are relative paths, kept per folder.
//
// What a file says is read from its head and tail, never the whole file: a NAM capture puts its metadata near the top
// (the trainer writes version, metadata, architecture, config, weights), and its sample rate after the weights; a
// SlimmableContainer keeps each submodel's metadata inside it and its own at the end. RigLibrary.cpp reads them by the
// same rules (namInfo, wavInfo below), and the desktop check compares the two.
import { libDelete, libGet, libPut } from './store.js'

/** Bump when an entry's shape or what is read changes: cached entries of another version are read again. */
export const INDEX_VERSION = 1
export const HEAD_BYTES = 16384
export const TAIL_BYTES = 8192
export const WAV_HEAD_BYTES = 65536
const MAX_FILES = 50000
const MAX_DEPTH = 12

// ------------------------------------------------------------------------------------------------- reading a file
const isWs = (c) => c === 32 || c === 9 || c === 10 || c === 13
/** The index of the quote closing the string opened at `i`, or -1. */
function stringEnd(s, i) {
  for (let j = i + 1; j < s.length; j++) {
    const c = s.charCodeAt(j)
    if (c === 92) j++ // a backslash escapes the next character
    else if (c === 34) return j
  }
  return -1
}
/** The index of the brace closing the object opened at `k`, or -1 if it does not close in `s`. */
function objectEnd(s, k) {
  let depth = 0
  for (let j = k; j < s.length; j++) {
    const c = s.charCodeAt(j)
    if (c === 34) { j = stringEnd(s, j); if (j < 0) return -1 }
    else if (c === 123) depth++
    else if (c === 125 && --depth === 0) return j
  }
  return -1
}
/** After a key's closing quote at `end`: the index of its value's '{', or -1 when it is not a key with an object. */
function objectAfterKey(s, end) {
  let j = end + 1
  while (j < s.length && isWs(s.charCodeAt(j))) j++
  if (s.charCodeAt(j) !== 58) return -1 // ':'
  j++
  while (j < s.length && isWs(s.charCodeAt(j))) j++
  return s.charCodeAt(j) === 123 ? j : -1
}
/** The head's "metadata" objects: the top level's, and the first nested one (a container's submodel's). */
function headMetadata(s) {
  let depth = 0, nested = null
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 34) {
      const end = stringEnd(s, i)
      if (end < 0) break
      if (end - i === 9 && s.startsWith('metadata', i + 1)) {
        const k = objectAfterKey(s, end)
        const e = k < 0 ? -1 : objectEnd(s, k)
        if (e > 0) {
          if (depth === 1) return { top: s.slice(k, e + 1), nested }
          nested ??= s.slice(k, e + 1)
        }
      }
      i = end
    } else if (c === 123 || c === 91) depth++
    else if (c === 125 || c === 93) depth--
  }
  return { top: null, nested }
}
/** The tail's last "metadata" object that closes in it (a container's own, written after its submodels). */
function tailMetadata(t) {
  for (let at = t.lastIndexOf('"metadata"'); at >= 0; at = at > 0 ? t.lastIndexOf('"metadata"', at - 1) : -1) {
    const k = objectAfterKey(t, at + 9)
    const e = k < 0 ? -1 : objectEnd(t, k)
    if (e > 0) return t.slice(k, e + 1)
  }
  return null
}
/** The last "sample_rate" number in `t`, or null. */
function lastSampleRate(t) {
  const re = /"sample_rate"\s*:\s*(\d+(?:\.\d+)?)/g
  let m, rate = null
  while ((m = re.exec(t))) rate = Number(m[1])
  return rate > 0 ? rate : null
}

/**
 * What a capture says about itself, from the text of its head and its tail (the whole file when it is small): the
 * metadata's text, by the rules above, and its sample rate. `tail` is the same text as `head` for a small file.
 * @returns {{ metadata: string | null, rate: number | null }}
 */
export function namInfo(head, tail) {
  const { top, nested } = headMetadata(head)
  return { metadata: top ?? tailMetadata(tail) ?? nested, rate: lastSampleRate(tail) }
}

/**
 * A WAV's rate, channels, bits and length from its head (the first WAV_HEAD_BYTES) and the file's size; null when it
 * is not a RIFF WAVE with a format chunk. When the data chunk lies past the head, it is taken to fill the rest.
 * @param {Uint8Array} b
 */
export function wavInfo(b, size) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const tag = (at) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3])
  if (b.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null
  let p = 12, fmt = null, data = null
  while (p + 8 <= b.length) {
    const id = tag(p), len = dv.getUint32(p + 4, true)
    if (id === 'fmt ' && p + 24 <= b.length) {
      fmt = { channels: dv.getUint16(p + 10, true), rate: dv.getUint32(p + 12, true), align: dv.getUint16(p + 20, true), bits: dv.getUint16(p + 22, true) }
    } else if (id === 'data') {
      const avail = Math.max(0, size - (p + 8))
      data = len === 0 || len === 0xffffffff || len > avail ? avail : len
      break
    }
    p += 8 + len + (len & 1)
  }
  if (!fmt || !fmt.rate || !fmt.align) return null
  if (data === null) data = Math.max(0, size - p - 8)
  return { rate: fmt.rate, channels: fmt.channels, bits: fmt.bits, seconds: Math.round((data / fmt.align / fmt.rate) * 1e6) / 1e6 }
}

// ------------------------------------------------------------------------------------------------- the entries
/** What NAM's trainer calls the gear (its gear_type), in words, with the chip it is filed under. */
export const GEAR_WORDS = { amp: 'Amp', pedal: 'Pedal', pedal_amp: 'Pedal and amp', amp_cab: 'Amp and cab', amp_pedal_cab: 'Full rig', preamp: 'Preamp', studio: 'Studio', cab: 'Cabinet IR' }
const GEAR_GROUP = { amp: 'amps', preamp: 'amps', pedal_amp: 'amps', pedal: 'pedals', amp_cab: 'rigs', amp_pedal_cab: 'rigs', studio: 'other', cab: 'cabs' }
export const GROUPS = [['amps', 'Amps'], ['pedals', 'Pedals'], ['rigs', 'Full rigs'], ['cabs', 'Cabinets'], ['other', 'Other']]
/** NAM's tone types, from clean to fuzz. */
export const TONES = [['clean', 'Clean'], ['overdrive', 'Overdrive'], ['crunch', 'Crunch'], ['hi_gain', 'High gain'], ['fuzz', 'Fuzz']]
const TONE_WORDS = Object.fromEntries(TONES)
export const SORTS = [['name', 'Name'], ['gear', 'Gear'], ['maker', 'Maker'], ['by', 'Captured by'], ['new', 'Newest']]

export const groupOf = (e) => GEAR_GROUP[e.gear] ?? (e.k === 'ir' ? 'cabs' : 'other')
export const gearWord = (e) => GEAR_WORDS[e.gear] ?? (e.gear ? e.gear.replace(/_/g, ' ') : '')
export const toneWord = (e) => TONE_WORDS[e.tone] ?? (e.tone ? e.tone.replace(/_/g, ' ') : '')
const text = (x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, 160) : '')

/**
 * One file's entry. `f` is { p, s, m } (the relative path with '/', the size, the modified time in ms); `info` is
 * namInfo's or wavInfo's result, or null when the file could not be read.
 */
export function entryOf(f, info) {
  const file = f.p.slice(f.p.lastIndexOf('/') + 1), base = file.replace(/\.(nam|wav)$/i, '')
  if (/\.wav$/i.test(file)) {
    return { v: INDEX_VERSION, p: f.p, s: f.s, m: f.m, k: 'ir', n: base, gear: 'cab', make: '', model: '', tone: '', by: '', rate: info?.rate ?? null, ch: info?.channels ?? null, sec: info?.seconds ?? null, bad: !info }
  }
  let md = null
  if (info?.metadata) { try { md = JSON.parse(info.metadata) } catch { md = null } }
  if (!md || typeof md !== 'object' || Array.isArray(md)) md = {}
  return {
    v: INDEX_VERSION, p: f.p, s: f.s, m: f.m, k: 'nam',
    n: text(md.name) || base, gear: text(md.gear_type), make: text(md.gear_make), model: text(md.gear_model),
    tone: text(md.tone_type), by: text(md.modeled_by), rate: info?.rate ?? null, ch: null, sec: null, bad: !info,
  }
}

// ------------------------------------------------------------------------------------------------- searching
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const BY = {
  name: (a, b) => collator.compare(a.n, b.n) || collator.compare(a.p, b.p),
  gear: (a, b) => GROUPS.findIndex((g) => g[0] === groupOf(a)) - GROUPS.findIndex((g) => g[0] === groupOf(b)) || collator.compare(a.n, b.n),
  maker: (a, b) => (!a.make - !b.make) || collator.compare(`${a.make} ${a.model}`, `${b.make} ${b.model}`) || collator.compare(a.n, b.n),
  by: (a, b) => (!a.by - !b.by) || collator.compare(a.by, b.by) || collator.compare(a.n, b.n),
  new: (a, b) => b.m - a.m || collator.compare(a.n, b.n),
}

/**
 * Searches an index: every word typed must appear in an entry's name, file path, make, model, maker of the capture,
 * gear or tone; then the chips. Sorted orders and the folded text are computed once per index and sort, so a search
 * is a single pass. Returns the matching entries in order.
 */
export function createSearch(entries) {
  const hay = new Map(entries.map((e) => [e, fold([e.n, e.p, e.make, e.model, e.by, gearWord(e), toneWord(e), groupOf(e)].join('\n'))]))
  const orders = new Map()
  const ordered = (sort) => { if (!orders.has(sort)) orders.set(sort, [...entries].sort(BY[sort] ?? BY.name)); return orders.get(sort) }
  return {
    entries,
    /** @param {{ text?: string, group?: string, tone?: string, favs?: Set<string> | null, sort?: string }} q */
    find({ text: typed = '', group = '', tone = '', favs = null, sort = 'name' } = {}) {
      const words = fold(typed).split(/\s+/).filter(Boolean)
      const out = []
      for (const e of ordered(sort)) {
        if (group && groupOf(e) !== group) continue
        if (tone && e.tone !== tone) continue
        if (favs && !favs.has(e.p)) continue
        if (words.length) { const h = hay.get(e); if (!words.every((w) => h.includes(w))) continue }
        out.push(e)
      }
      return out
    },
    /** How many entries each chip would show, for the chips worth drawing. */
    counts() {
      const group = {}, tone = {}
      for (const e of entries) { const g = groupOf(e); if (g) group[g] = (group[g] ?? 0) + 1; if (e.tone) tone[e.tone] = (tone[e.tone] ?? 0) + 1 }
      return { group, tone }
    },
  }
}

// ------------------------------------------------------------------------------------------------- where files come from
const wanted = (name) => /\.(nam|wav)$/i.test(name) && !name.startsWith('.')
const decoder = () => new TextDecoder('utf-8')
async function readFileInfo(file) {
  if (/\.wav$/i.test(file.name)) return wavInfo(new Uint8Array(await file.slice(0, WAV_HEAD_BYTES).arrayBuffer()), file.size)
  const td = decoder()
  const head = td.decode(await file.slice(0, HEAD_BYTES).arrayBuffer())
  const tail = file.size <= HEAD_BYTES ? head : td.decode(await file.slice(Math.max(0, file.size - TAIL_BYTES)).arrayBuffer())
  return namInfo(head, tail)
}
/** Runs `fn` over `items`, `width` at a time, calling `progress(done)` as they finish. */
async function pool(items, width, fn, progress = () => {}) {
  const out = new Array(items.length)
  let next = 0, done = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try { out[i] = await fn(items[i], i) } catch { out[i] = null }
      if (++done % 50 === 0) progress(done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker))
  progress(done)
  return out
}

/**
 * A folder handle (showDirectoryPicker, a dropped folder, or the origin's private folder in a test). A browser charges
 * a few milliseconds a file to look at one (its size and time, then its head), so a quick look (`quick`, when the page
 * opens or the person comes back to it) lists the names and opens only the files the index has not seen; "Look again"
 * opens every one, to find files changed in place.
 */
function handleSource(dir) {
  let files = new Map() // relative path -> File, from the last listing
  let handles = new Map() // relative path -> its handle
  return {
    kind: 'handle', name: dir.name, key: `handle:${dir.name}`, handle: dir,
    async list(old = new Map(), quick = false) {
      const found = []
      const walk = async (d, prefix, depth) => {
        const subs = []
        for await (const [name, h] of d.entries()) {
          if (found.length >= MAX_FILES) return
          if (h.kind === 'directory') { if (depth < MAX_DEPTH && !name.startsWith('.')) subs.push([h, `${prefix}${name}/`]) }
          else if (wanted(name)) found.push([h, prefix + name])
        }
        for (const [h, p] of subs) await walk(h, p, depth + 1)
      }
      await walk(dir, '', 0)
      handles = new Map(found.map(([h, p]) => [p, h]))
      const open = quick ? found.filter(([, p]) => !old.has(p)) : found
      const got = await pool(open, 64, async ([h, p]) => { const f = await h.getFile(); return [p, f] })
      files = new Map(got.filter(Boolean))
      return found.map(([, p]) => { const f = files.get(p), o = old.get(p); return f ? { p, s: f.size, m: f.lastModified } : o ? { p, s: o.s, m: o.m } : null }).filter(Boolean)
    },
    async info(list, progress) { return pool(list, 64, (f) => readFileInfo(files.get(f.p)), progress) },
    async read(p) {
      // Opened now: a File read at listing time goes stale if the file has changed since.
      let h = handles.get(p)
      if (!h) {
        let d = dir
        const parts = p.split('/')
        for (const part of parts.slice(0, -1)) d = await d.getDirectoryHandle(part)
        h = await d.getFileHandle(parts.at(-1))
      }
      return new Uint8Array(await (await h.getFile()).arrayBuffer())
    },
  }
}

/** Files without a handle: an <input webkitdirectory>, or a dropped folder read entry by entry. Kept for the visit. */
function filesSource(name, list) {
  const files = new Map(list.filter(([p]) => wanted(p.slice(p.lastIndexOf('/') + 1))).slice(0, MAX_FILES))
  return {
    kind: 'files', name, key: `files:${name}`,
    async list() { return [...files].map(([p, f]) => ({ p, s: f.size, m: f.lastModified })) },
    async info(list, progress) { return pool(list, 16, (f) => readFileInfo(files.get(f.p)), progress) },
    async read(p) { const f = files.get(p); if (!f) throw new Error('That file is no longer here.'); return new Uint8Array(await f.arrayBuffer()) },
  }
}

/** A folder on this computer, read by the desktop app (the audio backend's lib* calls). */
function desktopSource(host, path) {
  const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path
  return {
    kind: 'path', name, path, key: `path:${path.toLowerCase()}`,
    async list() {
      const r = await host.libList(path)
      if (!r.ok) throw new Error(r.error || 'The folder could not be read.')
      return r.files
    },
    async info(list, progress) {
      const out = []
      for (let i = 0; i < list.length; i += 400) {
        const r = await host.libMeta(path, list.slice(i, i + 400).map((f) => f.p))
        const by = new Map((r.items ?? []).map((x) => [x.p, x]))
        for (const f of list.slice(i, i + 400)) {
          const x = by.get(f.p)
          out.push(!x || x.error ? null : x.wav !== undefined ? x.wav : { metadata: x.metadata ?? null, rate: x.rate ?? null })
        }
        progress(out.length)
      }
      return out
    },
    async read(p) {
      const r = await host.libRead(path, p)
      if (!r.ok) throw new Error(r.error || 'The file could not be read.')
      const bin = atob(r.b64), bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return bytes
    },
  }
}

// Reads a dropped folder's entries (the older API every browser has), with each file's path under it.
async function entryFiles(root) {
  const out = []
  const readAll = (reader) => new Promise((ok, fail) => {
    const all = []
    const more = () => reader.readEntries((batch) => { if (!batch.length) ok(all); else { all.push(...batch); more() } }, fail)
    more()
  })
  const walk = async (dir, prefix, depth) => {
    for (const e of await readAll(dir.createReader())) {
      if (out.length >= MAX_FILES) return
      if (e.isDirectory) { if (depth < MAX_DEPTH && !e.name.startsWith('.')) await walk(e, `${prefix}${e.name}/`, depth + 1) }
      else if (wanted(e.name)) out.push([prefix + e.name, await new Promise((ok, fail) => e.file(ok, fail))])
    }
  }
  await walk(root, '', 0)
  return out
}

// ------------------------------------------------------------------------------------------------- the library
const FAVS_KEY = 'crbn-rig/favourites'
function loadFavs() { try { const f = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '{}'); return f && typeof f === 'object' ? f : {} } catch { return {} } }

/**
 * The library. `host` is the audio backend: the desktop's has the lib* calls. `onChange(why)` is called whenever what
 * a person sees changes: why is 'progress' (a scan's count), 'fav' (a favourite, with its path) or undefined (the
 * folder or the index).
 */
export function createLibrary({ host = null, onChange = () => {} } = {}) {
  const desktop = typeof host?.libList === 'function'
  let source = null, entries = [], search = createSearch([]), favAll = loadFavs(), scanning = null, again = false
  const state = { status: 'none', progress: 0, total: 0, error: '', scannedAt: 0, timing: null, opened: null }
  const changed = (why, p) => onChange(why, p)
  // The open folder's favourites as a set, made again only when they change or the folder does.
  let favSet = null, favFor = null
  const favs = () => { const k = source?.key ?? null; if (favFor !== k || !favSet) { favSet = new Set(k ? favAll[k] ?? [] : []); favFor = k } return favSet }
  const saveFavs = () => { try { localStorage.setItem(FAVS_KEY, JSON.stringify(favAll)) } catch { /* not kept */ } }

  async function open(src, { remember = true } = {}) {
    source = src
    entries = []
    search = createSearch([])
    state.opened = null
    state.status = 'scanning'; state.error = ''; state.progress = 0; state.total = 0
    changed()
    if (remember) {
      if (src.kind === 'handle') await libPut('folder', { kind: 'handle', handle: src.handle, name: src.name })
      else if (src.kind === 'path') await libPut('folder', { kind: 'path', path: src.path, name: src.name })
      else await libDelete('folder')
    }
    // What was indexed last time shows at once; the scan then reads only what changed.
    const cached = await libGet(`index:${src.key}`)
    if (source !== src) return
    const known = Array.isArray(cached?.entries)
    if (known) { entries = cached.entries; search = createSearch(entries); changed() }
    if (src.kind === 'path') host.libWatch?.(src.path)
    await scan({ quick: known && !remember })
  }

  async function scan({ quick = false } = {}) {
    if (!source) return
    if (scanning) { again = true; return scanning }
    const src = source
    scanning = (async () => {
      const t0 = performance.now()
      const quiet = state.status === 'ready' && entries.length > 0 // a fresh look at a folder already shown
      state.status = 'scanning'; state.progress = 0; state.total = 0
      changed(quiet ? 'progress' : undefined)
      try {
        const old = new Map(entries.map((e) => [e.p, e]))
        const files = await src.list(old, quick)
        const listed = performance.now()
        const keep = [], need = []
        for (const f of files) {
          const o = old.get(f.p)
          if (o && o.v === INDEX_VERSION && o.s === f.s && o.m === f.m && !o.bad) keep.push(o); else need.push(f)
        }
        state.total = need.length
        changed('progress')
        const infos = await src.info(need, (n) => { if (source === src) { state.progress = n; changed('progress') } })
        if (source !== src) return
        const read = performance.now()
        entries = [...keep, ...need.map((f, i) => entryOf(f, infos[i]))]
        search = createSearch(entries)
        state.status = 'ready'; state.scannedAt = Date.now()
        // How long it took: listing the folder, reading what changed, and the whole scan with the search built.
        state.timing = { files: files.length, read: need.length, quick, listMs: Math.round(listed - t0), readMs: Math.round(read - listed), ms: Math.round(performance.now() - t0) }
        state.opened ??= state.timing
        if (src.kind !== 'files') await libPut(`index:${src.key}`, { v: INDEX_VERSION, entries })
      } catch (err) {
        if (source !== src) return
        state.status = 'error'
        state.error = err?.name === 'NotFoundError' ? `${src.name} is no longer there.` : err?.name === 'NotAllowedError' ? `CRBN Rig may no longer read ${src.name}.` : err?.message || String(err)
      }
      changed()
    })()
    try { await scanning } finally { scanning = null }
    if (again) { again = false; await scan({ quick }) }
  }

  return {
    get status() { return state.status },
    get progress() { return { done: state.progress, total: state.total } },
    get error() { return state.error },
    /** The last scan's timing: { files, read, listMs, readMs, ms }. */
    get timing() { return state.timing },
    /** The first scan's timing since this folder was opened (a watch or a focus may look again just after). */
    get opened() { return state.opened },
    get folder() { return source ? { name: source.name, kind: source.kind, path: source.path ?? null } : null },
    get entries() { return entries },
    get canPick() { return desktop || typeof window.showDirectoryPicker === 'function' },
    /** True when the picked folder is kept for next time (a handle or a desktop path). */
    get kept() { return source?.kind === 'handle' || source?.kind === 'path' },
    find(q) { return search.find({ ...q, favs: q.favs ? favs() : null }) },
    counts() { return search.counts() },

    /** The folder from last time, if any. A browser may need the person's click to read it again: 'ask' then. */
    async restore() {
      const f = await libGet('folder')
      if (!f) return 'none'
      if (f.kind === 'path' && desktop) { await open(desktopSource(host, f.path), { remember: false }); return 'open' }
      if (f.kind === 'handle' && f.handle) {
        const src = handleSource(f.handle)
        let perm = 'prompt'
        try { perm = await f.handle.queryPermission({ mode: 'read' }) } catch { /* ask */ }
        if (perm === 'granted') { await open(src, { remember: false }); return 'open' }
        source = src; state.status = 'ask'; changed()
        return 'ask'
      }
      return 'none'
    },
    /** The person's click on "Open <folder> again": a browser asks for the handle's permission once more. */
    async regrant() {
      if (source?.kind !== 'handle') return false
      let perm = 'denied'
      try { perm = await source.handle.requestPermission({ mode: 'read' }) } catch { /* refused */ }
      if (perm !== 'granted') { state.status = 'ask'; changed(); return false }
      await open(source, { remember: false })
      return true
    },
    /** "Choose a folder…": the desktop's own dialog, or the browser's folder picker. False when the person cancels. */
    async choose() {
      if (desktop) {
        const r = await host.libPick(source?.path ?? '')
        if (!r?.ok) return false
        await open(desktopSource(host, r.path))
        return true
      }
      const dir = await window.showDirectoryPicker({ id: 'crbn-rig-library', mode: 'read' })
      await open(handleSource(dir))
      return true
    },
    /** A folder from <input webkitdirectory>: each File's webkitRelativePath starts with the folder's name. */
    async openFiles(fileList) {
      const list = [...fileList], top = list[0]?.webkitRelativePath?.split('/')[0] || 'Your folder'
      await open(filesSource(top, list.map((f) => [f.webkitRelativePath ? f.webkitRelativePath.split('/').slice(1).join('/') : f.name, f])))
    },
    /** A dropped folder: its handle where the browser gives one, else its entries. True when it was a folder. */
    async openDropped(item) {
      // Both asked for before anything awaits: a drop's items are gone once its event returns.
      let handle = null
      try { handle = typeof item.getAsFileSystemHandle === 'function' ? item.getAsFileSystemHandle() : null } catch { handle = null }
      const e = item.webkitGetAsEntry?.() ?? null
      const h = handle ? await handle.catch(() => null) : null
      if (h?.kind === 'directory') { await open(handleSource(h)); return true }
      if (!e?.isDirectory) return false
      await open(filesSource(e.name, await entryFiles(e)))
      return true
    },
    /** Looks at the folder again: every file ("Look again", the desktop's watch), or only new names (`quick`). */
    async refresh({ quick = false } = {}) { await scan({ quick }) },
    async forget() {
      source = null; entries = []; search = createSearch([])
      state.status = 'none'
      if (desktop) host.libWatch?.('')
      await libDelete('folder')
      changed()
    },
    /** A file's bytes, to play. */
    async read(p) { if (!source) throw new Error('No folder is open.'); return source.read(p) },
    isFav(p) { return favs().has(p) },
    toggleFav(p) {
      if (!source) return false
      const set = favs()
      if (set.has(p)) set.delete(p); else set.add(p)
      favAll = { ...favAll, [source.key]: [...set] }
      favSet = null
      saveFavs(); changed('fav', p)
      return set.has(p)
    },
    get favCount() { return favs().size },
    /** The open folder's favourites' paths, in the order they were starred (the pads', build plan R5). */
    get favourites() { return [...favs()] },
    /** The key this folder's favourites and index are kept under. */
    get key() { return source?.key ?? null },
  }
}
