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

/**
 * The board's drawing: a place for each pedal up to the last one used, and one more to add to, each with the Rig Lab's
 * stompbox (the islands and the stripe) and a holder for the kit's own pedal (the Hardware drawing, hw.js).
 * @param el  the board's row
 * @param pedals  createPedals's
 * @param knob  makes a page knob of a .knob[data-param] element
 * @param hardware  the kits' drawing (setPedals, engage)
 * @param add  called with a place when its "Add a pedal" button is pressed
 * @param stomp  called with a place when its footswitch is pressed
 */
export function createBoardView({ el, pedals, knob, hardware, add, stomp = (p) => pedals.toggle(p) }) {
  let drawn = ''
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-foot], [data-remove], [data-add]')
    if (!t) return
    if (t.dataset.foot) stomp(Number(t.dataset.foot))
    else if (t.dataset.remove) pedals.remove(Number(t.dataset.remove))
    else add(Number(t.dataset.add))
  })

  const knobHTML = (p, which, label) => `<div class="knob" data-param="pedal${which}${p + 1}" data-min="-12" data-max="12" data-step="0.1" data-unit="dB" data-label="${label}" data-aria="Pedal ${p + 1}: ${label.toLowerCase()}"></div>`
  function render() {
    const board = pedals.board
    const last = board.reduce((m, b, p) => (b ? p : m), -1)
    const upto = Math.min(pedals.size - 1, last + 1)
    drawn = board.map((b) => b?.key ?? '').join('|')
    let html = ''
    for (let p = 0; p <= upto; p++) {
      const b = board[p]
      if (!b) {
        html += `<div class="pspot empty" data-pedal="${p}" data-slot="pedal"><button class="padd" type="button" data-add="${p}"><b aria-hidden="true">+</b>Add a pedal</button><small>or drag a capture here from your library</small></div>`
        continue
      }
      html += `<div class="pspot" data-pedal="${p}" data-slot="pedal" title="${esc(b.name)}">` +
        `<div class="stomp"><div class="sk">${knobHTML(p, 'Drive', 'Drive')}${knobHTML(p, 'Level', 'Level')}</div><i class="led" aria-hidden="true"></i>` +
        `<span class="sn">${esc(b.name)}</span><button class="fs" type="button" data-foot="${p}" aria-pressed="false" aria-label="${esc(b.name)}"></button><span class="st"></span></div>` +
        `<div class="rig-hw" data-hw-pedal="${p}"></div>` +
        `<button class="prm" type="button" data-remove="${p}" aria-label="Take ${esc(b.name)} off the board" title="Take it off the board">&times;</button></div>`
    }
    el.innerHTML = html
    for (const k of el.querySelectorAll('.knob[data-param]')) knob(k)
    hardware?.setPedals([...el.querySelectorAll('[data-hw-pedal]')].map((h) => { const p = Number(h.dataset.hwPedal); return { el: h, p, name: board[p].name } }))
    sync()
  }

  // The pedals' states, in place.
  function sync() {
    if (drawn !== pedals.board.map((b) => b?.key ?? '').join('|')) { render(); return }
    for (const spot of el.querySelectorAll('.pspot[data-pedal]:not(.empty)')) {
      const p = Number(spot.dataset.pedal), b = pedals.board[p], state = pedals.stateOf(p)
      if (spot.dataset.state === state) continue
      spot.dataset.state = state
      const on = b.on
      const word = WORD[state] ?? ''
      spot.querySelector('.st').textContent = word
      spot.querySelector('[data-hw-pedal]').dataset.word = word
      const fs = spot.querySelector('.fs')
      fs.setAttribute('aria-pressed', String(on))
      fs.setAttribute('aria-label', `${b.name}: ${on ? 'on' : 'off'}`)
      spot.title = state === 'failed' ? `${b.name}: ${b.failed}` : `${b.name} · ${word}`
      hardware?.engage(p, on, word)
    }
  }
  return { render, sync }
}
