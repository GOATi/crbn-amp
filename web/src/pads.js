// CRBN Rig's favourites on standby (build plan R5, P3-UX U4). The engine holds up to twelve captures, warm, and plays one
// (rig_engine.cpp's slots); this page decides which captures it holds. Ten are the pads: the library's first ten
// favourite captures, in the order they were starred, on keys 1 to 0. The other two hold whatever plays off the pads (a
// capture clicked in the library, a dropped file, the example), so a switch from one of those to the next still fades.
// The switch itself is the engine's: a crossfade on the desktop, a short dip in a browser.
//
// Pads hold library favourites only (this session's default, for the owner to change): a dropped file plays, but has no
// star until it is in the library's folder.
//
// The pads are drawn as D-RIG-008 (d) picked, from the Rig Lab's drawings: footswitches (A) by default, keycaps (B) and
// a setlist (C) under "Favourites" in the look menu (data-pads on <html>).
import { AMP_SLOTS as SLOTS } from './engine.js'
import { gearWord } from './library.js'

export const PADS = 10
export const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/** A capture's identity: its library folder and path, the example, or a file's name and size. */
export function captureKey({ from = null, example = false, name = '', size = 0 }) {
  if (from) return `lib\n${from.key}\n${from.p}`
  if (example) return 'example'
  return `file\n${name}\n${size}`
}

/**
 * The engine's slots, as the page keeps them.
 * @param audio  the backend: loadSlot(slot, bytes), play(slot), started
 * @param parse  reads what a capture's bytes say about it (its metadata), and throws when they are not a capture
 * @param onChange  called when what the pads show changes ('pads' when the pads themselves did)
 */
export function createStandby({ audio, parse, onChange = () => {} }) {
  const held = Array(SLOTS).fill(null) // { key, name, meta, info, ready, used, loading }
  let pads = [] // [{ key, name, gear, source }] where source is { name, read } for hold()
  let heard = -1, asked = -1, left = -1, switching = false, tick = 0, filling = null
  const slotOf = (key) => held.findIndex((h) => h?.key === key)

  // A slot to load into: an empty one, else the one used longest ago whose capture is not a pad, not heard, not asked
  // for, and not fading out.
  function freeSlot() {
    const keep = new Set(pads.map((p) => p.key))
    let best = -1
    for (let s = 0; s < SLOTS; s++) {
      if (!held[s]) return s
      if (s === heard || s === asked || (switching && s === left) || keep.has(held[s].key) || held[s].loading) continue
      if (best < 0 || held[s].used < held[best].used) best = s
    }
    return best
  }

  /** Puts a capture in a slot unless one holds it; resolves to the slot, or throws when it cannot be played. */
  function hold(key, source) {
    const at = slotOf(key)
    if (at >= 0) { held[at].used = ++tick; return held[at].loading ?? Promise.resolve(at) }
    const s = freeSlot()
    if (s < 0) return Promise.reject(new Error('Every slot is in use.'))
    const h = { key, name: source.name, meta: source.meta ?? null, info: null, ready: false, used: ++tick, loading: null }
    held[s] = h
    h.loading = (async () => {
      try {
        const bytes = source.bytes ?? await source.read()
        h.meta ??= parse(bytes)
        let r = await audio.loadSlot(s, bytes)
        for (let tries = 0; !r.ok && r.busy && tries < 5; tries++) { await new Promise((ok) => setTimeout(ok, 60)); r = await audio.loadSlot(s, bytes) }
        if (!r.ok) throw new Error(r.error)
        h.info = r.info
        return s
      } catch (err) {
        if (held[s] === h) held[s] = null
        throw err
      } finally {
        h.loading = null
        onChange()
      }
    })()
    onChange()
    return h.loading
  }

  // The pads' captures, loaded one after another (a pad that cannot be read is skipped, and says so).
  function fill() {
    if (!audio.started || filling) return filling
    filling = (async () => {
      for (let again = true; again;) {
        again = false
        for (const p of pads) {
          if (slotOf(p.key) >= 0 || p.failed) continue
          try { await hold(p.key, p.source) } catch (err) { p.failed = String(err?.message ?? err); onChange() }
          again = true
          break // the pads may have changed meanwhile
        }
      }
    })().finally(() => { filling = null })
    return filling
  }

  return {
    slotOf,
    /** What a held capture says about itself (its metadata), or null. */
    metaOf(key) { const s = slotOf(key); return s >= 0 ? held[s].meta : null },
    /** The pads, from the library's favourites: [{ key, name, gear, source: { name, read } }], at most ten. */
    setPads(list) {
      const was = new Map(pads.map((p) => [p.key, p]))
      pads = list.slice(0, PADS).map((p) => ({ ...p, failed: was.get(p.key)?.failed ?? null }))
      onChange('pads')
      fill()
    },
    get pads() { return pads },
    /** Loads the pads (the audio has started). */
    fill,
    /** Plays a capture: holds it if no slot does, then asks the engine for it (it switches once it is warm). */
    async play(key, source) {
      const s = await hold(key, source)
      asked = s
      audio.play(s)
      onChange()
      return { slot: s, info: held[s]?.info ?? null, meta: held[s]?.meta ?? null }
    },
    /** Plays no capture (the dry signal, faded to). */
    stop() { asked = -1; audio.play(-1); onChange() },
    /** What the engine reports: { playing, ready: [slots], switching }. */
    status(st) {
      if (!st) return
      let changed = false
      if (st.playing !== heard) { if (heard >= 0) left = heard; heard = st.playing; changed = true }
      if (st.switching !== switching) { switching = st.switching; changed = true }
      for (let s = 0; s < SLOTS; s++) {
        const r = st.ready.includes(s)
        if (held[s] && held[s].ready !== r) { held[s].ready = r; changed = true }
      }
      if (changed) onChange()
    },
    /** What a key's capture is doing: 'playing', 'next' (asked for, not yet heard), 'ready', 'loading' or 'idle'. */
    stateOf(key) {
      const s = slotOf(key)
      if (s < 0) return audio.started ? 'loading' : 'idle'
      if (s === heard && s === asked) return 'playing'
      if (s === asked) return 'next'
      if (s === heard) return 'playing'
      return held[s].ready ? 'ready' : 'loading'
    },
    /** The slot heard, and its capture's key. */
    get heard() { return heard },
    get heardKey() { return heard >= 0 ? held[heard]?.key ?? null : null },
  }
}

/**
 * The pads' drawing: footswitches (A), keycaps (B) or a setlist (C), from data-pads on <html>.
 * @param el  the pads' island
 * @param standby  createStandby's
 * @param press  called with a pad's index when it is clicked
 */
export function createPadsView({ el, standby, press, hint = () => '' }) {
  const grid = el.querySelector('.pads-grid')
  let drawn = null
  grid.addEventListener('click', (e) => { const b = e.target.closest('[data-pad]'); if (b && !b.classList.contains('empty')) press(Number(b.dataset.pad)) })
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const WORD = { playing: 'Playing', next: 'Switching', loading: 'Loading', idle: '', ready: '' }

  function render() {
    const drawing = document.documentElement.dataset.pads || 'a'
    const pads = standby.pads
    drawn = `${drawing}|${pads.map((p) => p.key).join('|')}`
    grid.className = `pads-grid pd-${drawing}`
    grid.innerHTML = PAD_KEYS.map((k, i) => {
      const p = pads[i]
      const name = p ? esc(p.name) : esc(hint(i))
      const label = p ? `${p.name}, key ${k}` : `Pad ${k}: empty`
      const tag = '<span class="ptag" aria-hidden="true"></span>'
      const inner = drawing === 'a'
        ? `<kbd>${k}</kbd><i class="led" aria-hidden="true"></i><span class="disc" aria-hidden="true"></span><span class="pn">${name}</span>${tag}`
        : drawing === 'b'
          ? `<span class="kk" aria-hidden="true">${k}</span><span class="pn">${name}</span>${tag}`
          : `<span class="sn" aria-hidden="true">${k}</span><span class="pn">${name}<small>${p ? esc(gearWord({ gear: p.gear })) : ''}</small></span>${tag}`
      return `<button type="button" class="pad${p ? '' : ' empty'}" data-pad="${i}" aria-label="${esc(label)}"${p ? '' : ' disabled'}>${inner}</button>`
    }).join('')
    sync()
  }

  // The pads' states, in place (a pad keeps the focus).
  function sync() {
    const drawing = document.documentElement.dataset.pads || 'a', pads = standby.pads
    if (drawn !== `${drawing}|${pads.map((p) => p.key).join('|')}`) { render(); return }
    grid.querySelectorAll('[data-pad]').forEach((b, i) => {
      const p = pads[i]
      const state = p ? (p.failed ? 'failed' : standby.stateOf(p.key)) : 'empty'
      if (b.dataset.state === state) return
      b.dataset.state = state
      b.classList.toggle('play', state === 'playing')
      b.setAttribute('aria-pressed', String(state === 'playing'))
      const word = state === 'failed' ? 'Cannot play' : WORD[state] ?? ''
      const tag = b.querySelector('.ptag')
      tag.textContent = word
      tag.hidden = !word
      if (p) b.title = state === 'failed' ? `${p.name}: ${p.failed}` : `${p.name}${word ? ` · ${word}` : ''} · key ${PAD_KEYS[i]}`
    })
  }
  return { render, sync }
}
