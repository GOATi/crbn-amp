// CRBN Rig's pedals (build plan R6, P3-UX U5): up to four captures before the amp, in series, each a stompbox with a
// footswitch, its Drive (the level into its capture) and its Level (out of it). The engine runs them (rig_engine.cpp's
// stages); this page decides which capture each pedal holds. Pedal p keeps two of the engine's slots, AMP_SLOTS + 2p and
// the one after: a new capture loads into the one not heard, and the pedal switches to it once it is warm (a crossfade
// on the desktop, a dip in a browser). Stomped on or off, it fades against the dry signal.
//
// Drive and Level are the page's settings pedalDrive1..4 and pedalLevel1..4, kept and sent like the amp's knobs. The
// board itself is remembered in this browser: each pedal's file (IndexedDB, as the last capture is) and whether it is on.
//
// Drawn as D-RIG-008 (d) picked, stompboxes on a board above the amp: the kit's own pedal on the Hardware drawing (hw.js
// pedalHTML), the Rig Lab's stompbox on the islands and the stripe.
import { AMP_SLOTS, PEDALS } from './engine.js'
import { forgetFile, recallFile, rememberFile } from './store.js'

const KEY = 'crbn-rig/pedals'
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** The two engine slots pedal p (from 0) keeps. */
export const slotsOfPedal = (p) => [AMP_SLOTS + 2 * p, AMP_SLOTS + 2 * p + 1]

/**
 * The board, as the page keeps it.
 * @param audio  the backend: loadSlot(slot, bytes), clearSlot(slot), pedal(p, slot), started
 * @param parse  reads what a capture's bytes say about it (its metadata), and throws when they are not a capture
 * @param onChange  called when anything the board shows changes ('board' when a pedal came or went)
 */
export function createPedals({ audio, parse, onChange = () => {} }) {
  const board = Array(PEDALS).fill(null) // { key, name, gear, from, read, on, slot (its capture's, or -1), loading, failed }
  // What the engine last said each pedal hears and whether it fades, and what this page last asked it to hear: a slot
  // either names may not be loaded into (a browser's engine refuses; the desktop's would swap it without a fade).
  const heard = Array(PEDALS).fill(-1), fading = Array(PEDALS).fill(false), asked = Array(PEDALS).fill(-1)
  let ready = []
  const ask = (p, s) => { asked[p] = s; audio.pedal(p, s) }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(board.map((b) => (b ? { on: b.on } : null)))) } catch { /* not remembered */ }
  }

  // Of pedal p's two slots, one neither heard nor asked for, once any switch of its has finished.
  async function slotFor(p) {
    const [a, c] = slotsOfPedal(p)
    for (let i = 0; i < 60; i++) {
      const busy = [heard[p], asked[p]]
      const s = !busy.includes(a) ? a : !busy.includes(c) ? c : -1
      if (s >= 0 && !fading[p]) return s
      await sleep(40)
    }
    return heard[p] === a ? c : a
  }

  // Pedal p's capture into its slot not heard; then, if the pedal is on, the switch to it once it is warm.
  async function load(p) {
    const b = board[p]
    if (!b || !audio.started || b.loading) return
    b.loading = true
    b.failed = null
    onChange()
    try {
      const bytes = await b.read()
      let s = await slotFor(p), r = await audio.loadSlot(s, bytes)
      // the slot may still be fading out from the last capture this pedal held
      for (let tries = 0; !r.ok && r.busy && tries < 10 && board[p] === b; tries++) { await sleep(60); s = await slotFor(p); r = await audio.loadSlot(s, bytes) }
      if (board[p] !== b) return
      if (!r.ok) throw new Error(r.error)
      b.slot = s
      if (b.on) ask(p, s)
    } catch (err) {
      if (board[p] === b) b.failed = String(err?.message ?? err)
    } finally {
      b.loading = false
      onChange()
    }
  }

  return {
    get board() { return board },
    get size() { return PEDALS },
    /** The first place with no pedal, or -1. */
    get free() { return board.indexOf(null) },
    /**
     * Puts a capture on the board at place p (a pedal there is replaced, fading into the new one if it was on):
     * `source` is { key, name, gear, from, read() }. Throws when the bytes are not a capture.
     */
    async put(p, source, { on = true, remember = true } = {}) {
      if (!(p >= 0 && p < PEDALS)) throw new Error('There is no room on the board.')
      const bytes = await source.read()
      parse(bytes) // a file that is not a capture never reaches the board
      board[p] = { key: source.key, name: source.name, gear: source.gear ?? null, from: source.from ?? null, read: async () => bytes, on, slot: -1, loading: false, failed: null }
      save()
      onChange('board')
      if (remember) rememberFile(`pedal${p}`, source.name, bytes, source.from ?? null)
      await load(p)
    },
    /** Stomps pedal p on or off (a fade against the dry signal). */
    toggle(p, on) {
      const b = board[p]
      if (!b) return
      b.on = on ?? !b.on
      if (audio.started && b.slot >= 0) ask(p, b.on ? b.slot : -1)
      save()
      onChange()
    },
    /** Takes pedal p off the board: it fades out, and its slots are emptied once it has. */
    remove(p) {
      if (!board[p]) return
      board[p] = null
      if (audio.started) {
        ask(p, -1)
        setTimeout(() => { if (!board[p]) for (const s of slotsOfPedal(p)) audio.clearSlot(s) }, 250)
      }
      forgetFile(`pedal${p}`)
      save()
      onChange('board')
    },
    /**
     * Swaps the pedals at places a and b along the board (R6 step 3), either of them perhaps empty. Each place loads its
     * new capture into a slot of its own and fades into it from what it played (a pedal plays where it stands: a place
     * keeps its two slots), so nothing stops while the board is rearranged. The caller swaps the places' settings.
     */
    async swap(a, b) {
      if (a === b || !(a >= 0 && a < PEDALS && b >= 0 && b < PEDALS) || (!board[a] && !board[b])) return
      const fresh = (x) => (x ? { ...x, slot: -1, loading: false, failed: null } : null)
      const was = [board[a], board[b]]
      board[a] = fresh(was[1]); board[b] = fresh(was[0])
      save()
      onChange('board')
      for (const q of [a, b]) {
        const x = board[q]
        if (!x) {
          if (audio.started) {
            ask(q, -1)
            setTimeout(() => { if (!board[q]) for (const s of slotsOfPedal(q)) audio.clearSlot(s) }, 250)
          }
          forgetFile(`pedal${q}`)
          continue
        }
        // a pedal moved here switched off: the place stops hearing what it played before at once
        if (!x.on && audio.started) ask(q, -1)
        x.read().then((bytes) => rememberFile(`pedal${q}`, x.name, bytes, x.from ?? null)).catch(() => {})
      }
      await Promise.all([a, b].map((q) => (board[q] ? load(q) : null)))
    },
    /** Loads every pedal's capture (the audio has started). */
    async fill() { for (let p = 0; p < PEDALS; p++) if (board[p] && board[p].slot < 0) await load(p) },
    /** The board from last time. */
    async restore() {
      let kept = []
      try { kept = JSON.parse(localStorage.getItem(KEY) ?? '[]') ?? [] } catch { /* none */ }
      for (let p = 0; p < PEDALS; p++) {
        const f = kept[p] ? await recallFile(`pedal${p}`) : null
        if (!f) continue
        const bytes = new Uint8Array(f.bytes)
        try {
          await this.put(p, { key: f.from ? `lib\n${f.from.key}\n${f.from.p}` : `file\n${f.name}\n${bytes.length}`, name: f.name, from: f.from ?? null, read: async () => bytes }, { on: kept[p].on !== false, remember: false })
        } catch { forgetFile(`pedal${p}`) }
      }
    },
    /** What the engine reports: { pedals: [{ playing, switching }], ready: [slots] }. */
    status(st) {
      if (!st?.pedals) return
      let changed = false
      st.pedals.forEach((x, p) => {
        if (heard[p] !== x.playing) { heard[p] = x.playing; changed = true }
        if (fading[p] !== x.switching) { fading[p] = x.switching; changed = true }
      })
      if (st.ready && st.ready.join() !== ready.join()) { ready = st.ready; changed = true }
      if (changed) onChange()
    },
    /** What pedal p is doing: 'empty', 'on', 'off', 'loading' (on, not heard yet) or 'failed'. */
    stateOf(p) {
      const b = board[p]
      if (!b) return 'empty'
      if (b.failed) return 'failed'
      if (!audio.started) return b.on ? 'on' : 'off'
      if (b.loading || (b.on && (b.slot < 0 || heard[p] !== b.slot))) return 'loading'
      return b.on ? 'on' : 'off'
    },
    /** How many pedals are on. */
    get engaged() { return board.filter((b) => b?.on).length },
  }
}

const WORD = { on: 'On', off: 'Off', loading: 'Loading', failed: 'Cannot play' }
/** What a pedal's dragged grip carries (R6 step 3): its place, so a drop on another place swaps the two. */
export const PEDAL_DRAG = 'application/x-crbn-rig-pedal'

/** A pedal's page knob: Drive and Level in dB (-12 to +12), Tone a tilt in dB (-6 to +6; R6 step 3). */
export const PEDAL_KNOB = Object.freeze({ Drive: [-12, 12], Level: [-12, 12], Tone: [-6, 6] })

/**
 * The board's drawing, as D-RIG-008 (d) picked and the look menu's "Pedals" row offers (R6 step 3, data-pedals on
 * <html>): stompboxes (b, the default) on a board, each a place with the Rig Lab's stompbox (the islands and the stripe)
 * and a holder for the kit's own pedal (the Hardware drawing, hw.js); rows (a), a list of places with a grip, a switch,
 * the name and the knobs; or chain chips (c), one line from the input to the output with a chip for each pedal, a click
 * on one opening its controls underneath. Every drawing has a place for each pedal up to the last one used and one more
 * to add to; a pedal moves along the board by its grip (dragged onto another place, the two swap) or its arrows.
 * @param el  the board's row
 * @param pedals  createPedals's
 * @param knob  makes a page knob of a .knob[data-param] element
 * @param hardware  the kits' drawing (setPedals, engage)
 * @param add  called with a place when its "Add a pedal" button is pressed
 * @param stomp  called with a place when its footswitch is pressed
 * @param tone  called with a place when its Tone switch is pressed
 * @param toneOn  whether a place's Tone is in
 * @param move  called with two places to swap
 * @param drawing  the drawing picked: 'a', 'b' or 'c'
 * @param chain  the amp's and the cabinet's names for the chips: { amp, cab }
 */
export function createBoardView({ el, pedals, knob, hardware, add, stomp = (p) => pedals.toggle(p), tone, toneOn, move, drawing = () => 'b', chain = () => ({}) }) {
  let drawn = '', open = -1
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-foot], [data-remove], [data-add], [data-tone], [data-move], [data-open]')
    if (!t) return
    if (t.dataset.foot) stomp(Number(t.dataset.foot))
    else if (t.dataset.remove) { const p = Number(t.dataset.remove); if (open === p) open = -1; pedals.remove(p) }
    else if (t.dataset.tone) tone(Number(t.dataset.tone))
    else if (t.dataset.move) {
      const [p, d] = t.dataset.move.split(':').map(Number)
      const q = p + d
      if (q < 0 || q >= pedals.size) return
      if (open === p) open = q
      move(p, q)
      requestAnimationFrame(() => el.querySelector(`[data-move="${q}:${d}"]`)?.focus())
    } else if (t.dataset.open) { const p = Number(t.dataset.open); open = open === p ? -1 : p; render() }
    else add(Number(t.dataset.add))
  })
  el.addEventListener('dragstart', (e) => {
    const g = e.target.closest?.('[data-grip]')
    if (!g) return
    e.dataTransfer.setData(PEDAL_DRAG, g.dataset.grip)
    e.dataTransfer.effectAllowed = 'move'
  })

  const knobHTML = (p, which) => {
    const [min, max] = PEDAL_KNOB[which]
    return `<div class="knob" data-param="pedal${which}${p + 1}" data-min="${min}" data-max="${max}" data-step="0.1" data-unit="dB" data-label="${which}" data-aria="Pedal ${p + 1}: ${which.toLowerCase()}"></div>`
  }
  const knobsHTML = (p) => `${knobHTML(p, 'Drive')}${knobHTML(p, 'Tone')}${knobHTML(p, 'Level')}`
  const toneHTML = (p, b) => `<button class="tsw" type="button" data-tone="${p}" data-switch="pedalToneOn${p + 1}" aria-pressed="${toneOn(p)}" aria-label="${esc(b.name)}: tone" title="Tone in, or bypassed: the capture as it was captured"><i aria-hidden="true"></i>Tone</button>`
  const gripHTML = (p, b) => `<span class="pgrip" draggable="true" data-grip="${p}" title="Drag onto another place to swap them" aria-hidden="true"><svg viewBox="0 0 10 16"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg></span>`
  const movesHTML = (p, b) => `<span class="pmove"><button type="button" data-move="${p}:-1" aria-label="Move ${esc(b.name)} earlier in the chain" title="Earlier in the chain"${p === 0 ? ' disabled' : ''}>&lsaquo;</button><button type="button" data-move="${p}:1" aria-label="Move ${esc(b.name)} later in the chain" title="Later in the chain"${p === pedals.size - 1 ? ' disabled' : ''}>&rsaquo;</button></span>`
  const removeHTML = (p, b) => `<button class="prm" type="button" data-remove="${p}" aria-label="Take ${esc(b.name)} off the board" title="Take it off the board">&times;</button>`
  const addHTML = (p) => `<button class="padd" type="button" data-add="${p}"><b aria-hidden="true">+</b>Add a pedal</button>`

  const keyOf = () => `${drawing()}|${open}|${pedals.board.map((b) => b?.key ?? '').join('|')}`
  function render() {
    const board = pedals.board, d = drawing()
    const last = board.reduce((m, b, p) => (b ? p : m), -1)
    const upto = Math.min(pedals.size - 1, last + 1)
    if (open >= 0 && !board[open]) open = -1
    drawn = keyOf()
    el.dataset.drawing = d
    let html = ''
    if (d === 'c') {
      // chain chips: input, the pedals, a chip to add one, the amp, the cabinet, the output
      const arr = '<span class="arr" aria-hidden="true">&rarr;</span>', names = chain()
      html += `<div class="pchain" role="list"><span class="pchip io" role="listitem">Input</span>${arr}`
      for (let p = 0; p <= upto; p++) {
        const b = board[p]
        if (!b) { html += `<span class="pchip add" role="listitem" data-pedal="${p}" data-slot="pedal">${addHTML(p)}</span>${arr}`; continue }
        html += `<span class="pchip ped" role="listitem" data-pedal="${p}" data-slot="pedal"><button type="button" class="ccb" data-open="${p}" draggable="true" data-grip="${p}" aria-expanded="${open === p}" title="${esc(b.name)}: its controls"><i class="led" aria-hidden="true"></i><span class="pn">${esc(b.name)}</span><small class="st"></small></button></span>${arr}`
      }
      html += `<span class="pchip amp" role="listitem" data-chip="amp">Amp · <span>${esc(names.amp || 'no capture')}</span></span>${arr}<span class="pchip" role="listitem" data-chip="cab">Cab · <span>${esc(names.cab || 'none')}</span></span>${arr}<span class="pchip io" role="listitem">Output</span></div>`
      if (open >= 0) {
        const b = board[open], p = open
        html += `<div class="cpanel pspot" data-pedal="${p}" data-slot="pedal" role="group" aria-label="${esc(b.name)}">` +
          `<div class="cp-head"><button class="fsw" type="button" data-foot="${p}" aria-pressed="false"><i aria-hidden="true"></i><span class="st"></span></button><span class="pn">${esc(b.name)}</span>${movesHTML(p, b)}${removeHTML(p, b)}</div>` +
          `<div class="sk">${knobsHTML(p)}${toneHTML(p, b)}</div></div>`
      }
    } else if (d === 'a') {
      // rows: a list of places
      for (let p = 0; p <= upto; p++) {
        const b = board[p]
        if (!b) { html += `<div class="prow pspot empty" data-pedal="${p}" data-slot="pedal">${addHTML(p)}<small>or drag a capture here from your library</small></div>`; continue }
        html += `<div class="prow pspot" data-pedal="${p}" data-slot="pedal" title="${esc(b.name)}">${gripHTML(p, b)}` +
          `<button class="fsw" type="button" data-foot="${p}" aria-pressed="false" aria-label="${esc(b.name)}"><i aria-hidden="true"></i></button>` +
          `<span class="pn">${esc(b.name)}</span><span class="st"></span><div class="sk">${knobsHTML(p)}${toneHTML(p, b)}</div>${movesHTML(p, b)}${removeHTML(p, b)}</div>`
      }
    } else {
      for (let p = 0; p <= upto; p++) {
        const b = board[p]
        if (!b) {
          html += `<div class="pspot empty" data-pedal="${p}" data-slot="pedal">${addHTML(p)}<small>or drag a capture here from your library</small></div>`
          continue
        }
        html += `<div class="pspot" data-pedal="${p}" data-slot="pedal" title="${esc(b.name)}">` +
          `<div class="stomp"><div class="sk">${knobsHTML(p)}</div><div class="sl"><i class="led" aria-hidden="true"></i>${toneHTML(p, b)}</div>` +
          `<span class="sn">${esc(b.name)}</span><button class="fs" type="button" data-foot="${p}" aria-pressed="false" aria-label="${esc(b.name)}"></button><span class="st"></span></div>` +
          `<div class="rig-hw" data-hw-pedal="${p}"></div>` +
          `<div class="ptools">${gripHTML(p, b)}${movesHTML(p, b)}</div>${removeHTML(p, b)}</div>`
      }
    }
    el.innerHTML = html
    for (const k of el.querySelectorAll('.knob[data-param]')) knob(k)
    hardware?.setPedals([...el.querySelectorAll('[data-hw-pedal]')].map((h) => { const p = Number(h.dataset.hwPedal); return { el: h, p, name: board[p].name } }))
    for (const s of el.querySelectorAll('.pspot[data-pedal]')) delete s.dataset.state
    sync()
  }

  // The pedals' states, in place; a chip's amp and cabinet names.
  function sync() {
    if (drawn !== keyOf()) { render(); return }
    if (el.dataset.drawing === 'c') {
      const names = chain()
      const a = el.querySelector('[data-chip="amp"] span'), c = el.querySelector('[data-chip="cab"] span')
      if (a && a.textContent !== (names.amp || 'no capture')) a.textContent = names.amp || 'no capture'
      if (c && c.textContent !== (names.cab || 'none')) c.textContent = names.cab || 'none'
    }
    for (const p of pedals.board.keys()) {
      const b = pedals.board[p]
      if (!b) continue
      const state = pedals.stateOf(p), word = WORD[state] ?? ''
      let changed = false
      for (const spot of el.querySelectorAll(`[data-pedal="${p}"]:not(.empty):not(.add)`)) {
        if (spot.dataset.state === state) continue
        spot.dataset.state = state
        changed = true
        for (const st of spot.querySelectorAll('.st')) st.textContent = word
        const hw = spot.querySelector('[data-hw-pedal]')
        if (hw) hw.dataset.word = word
        for (const fs of spot.querySelectorAll('[data-foot]')) {
          fs.setAttribute('aria-pressed', String(b.on))
          fs.setAttribute('aria-label', `${b.name}: ${b.on ? 'on' : 'off'}`)
        }
        const chip = spot.querySelector('.ccb')
        if (chip) chip.title = `${b.name} · ${word}: its controls`
        spot.title = state === 'failed' ? `${b.name}: ${b.failed}` : `${b.name} · ${word}`
      }
      if (changed) hardware?.engage(p, b.on, word)
    }
  }
  return { render, sync, get open() { return open } }
}
