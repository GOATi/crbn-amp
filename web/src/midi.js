// CRBN Rig's MIDI (build plan R7, P3-UX U6; crbn-launcher D-RIG-027): a player's floor controller or expression pedal
// drives the page's own controls. Both builds read it the same way, through Web MIDI: the browser asks the person first,
// and the desktop app grants it to its own page (RigWebView.cpp), so a mapping made in one works the same in the other.
//
// Learning is by drag and drop (the owner's U6): drag a control onto the MIDI dock, or click it while the dock is open,
// then press the footswitch or move the pedal; the first message that fits maps it. A message drives one control, and a
// control takes one message, so learning again moves either. What a message does depends on the control:
//   - a knob takes a CC, from its heel (CC 0) to its toe (CC 127), a part of its sweep or the whole, drawn on the knob;
//   - a switch (the gate, the EQ, the cabinet, a pedal's Tone or footswitch, Standby, Power) takes a CC, a note or a
//     Program Change: toggled on each press (a value of 64 or more), or momentary, on while held (which also suits a
//     controller that toggles its switch itself, sending 127 then 0);
//   - a favourite, a variant, a rig and the like are picked by a Program Change, or a press.
// Mappings are kept in this browser (localStorage), apart from rigs: they are the player's controller, not a sound.
//
// Ports are opened only while MIDI is on, and closed when it is turned off, so another app (the MC8's editor, say) can
// have them: on Windows a USB MIDI port has one user at a time.

const KEY = 'crbn-rig/midi'
const MAX_MAPS = 128
const LOG = 8
const NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

/** A message's bytes as { type: 'cc' | 'pc' | 'note', ch (1 to 16), num, value }, or null for what Rig does not map
 *  (clock, active sensing, pitch bend and the rest). A note off, or a note on at velocity 0, is a note at value 0. */
export function parseMidi(data) {
  if (!data || data.length < 2) return null
  const s = data[0], type = s & 0xf0, ch = (s & 0x0f) + 1
  if (type === 0xb0 && data.length >= 3) return { type: 'cc', ch, num: data[1] & 127, value: data[2] & 127 }
  if (type === 0xc0) return { type: 'pc', ch, num: data[1] & 127, value: 127 }
  if (type === 0x90 && data.length >= 3) return { type: 'note', ch, num: data[1] & 127, value: data[2] & 127 }
  if (type === 0x80 && data.length >= 3) return { type: 'note', ch, num: data[1] & 127, value: 0 }
  return null
}
export const msgKey = (m) => `${m.type}:${m.ch}:${m.num}`
const noteName = (n) => `${NOTES[n % 12]}${Math.floor(n / 12) - 1}`
/** "CC 20 · ch 1", "PC 3 · ch 1", "Note C4 · ch 10": as a controller's editor names them, numbers from 0. */
export function describeMsg(m, withValue = false) {
  const what = m.type === 'cc' ? `CC ${m.num}` : m.type === 'pc' ? `PC ${m.num}` : `Note ${noteName(m.num)}`
  const value = withValue && m.type !== 'pc' ? (m.type === 'note' ? (m.value ? ' on' : ' off') : ` = ${m.value}`) : ''
  return `${what}${value} · ch ${m.ch}`
}

// ------------------------------------------------------------------------------------------------- what is mapped
/** Kinds of control. A knob is continuous; the "switches" are on or off; the rest are picked. */
const SWITCHES = new Set(['switch', 'stomp', 'standby', 'power'])
const PICKS = new Set(['pad', 'variant', 'rig', 'last', 'next', 'prev'])
export const isSwitch = (t) => SWITCHES.has(t?.kind)
export const isKnob = (t) => t?.kind === 'knob'
export const targetKey = (t) => (t.param ? `${t.kind}:${t.param}` : t.id ? `${t.kind}:${t.id}` : Number.isInteger(t.i) ? `${t.kind}:${t.i}` : Number.isInteger(t.p) ? `${t.kind}:${t.p}` : t.kind)

const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi
/** A control, from anything: null when it is not one. */
export function tidyTarget(t) {
  if (!t || typeof t !== 'object') return null
  const { kind } = t
  if (kind === 'knob' || kind === 'switch') return typeof t.param === 'string' && /^[A-Za-z0-9]{1,40}$/.test(t.param) ? { kind, param: t.param } : null
  if (kind === 'stomp') return intIn(t.p, 0, 3) ? { kind, p: t.p } : null
  if (kind === 'pad') return intIn(t.i, 0, 9) ? { kind, i: t.i } : null
  if (kind === 'variant') return intIn(t.i, 0, 2) ? { kind, i: t.i } : null
  if (kind === 'rig') return typeof t.id === 'string' && t.id.length > 0 && t.id.length <= 40 ? { kind, id: t.id } : null
  if (kind === 'standby' || kind === 'power' || kind === 'last' || kind === 'next' || kind === 'prev') return { kind }
  return null
}
function tidyMap(x) {
  const target = tidyTarget(x?.target), m = x?.msg
  if (!target || !m || !['cc', 'pc', 'note'].includes(m.type) || !intIn(m.ch, 1, 16) || !intIn(m.num, 0, 127)) return null
  const unit = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d)
  return { target, msg: { type: m.type, ch: m.ch, num: m.num }, mode: x.mode === 'momentary' ? 'momentary' : 'toggle', heel: unit(x.heel, 0), toe: unit(x.toe, 1) }
}
/** What this browser keeps: MIDI on or off, and the mappings. */
export function loadMidi() {
  let x = {}
  try { x = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {} } catch { /* none */ }
  const maps = []
  for (const m of Array.isArray(x.maps) ? x.maps : []) { const t = tidyMap(m); if (t) maps.push(t) }
  return { on: x.on === true, maps: maps.slice(-MAX_MAPS) }
}
function saveMidi(st) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, on: st.on, maps: st.maps })); return true } catch { return false }
}
/** Does a message fit a control being learned? A knob takes a CC; a switch a CC, a note on or a Program Change; a pick
 *  the same. A note off never teaches anything (it is the end of a press). */
export const fits = (t, m) => (isKnob(t) ? m.type === 'cc' : !(m.type === 'note' && m.value === 0))

/**
 * The MIDI engine of the page: ports, learning and mappings.
 * @param act      (target, { value } | { set } | { flip } | { fire }) => words for the monitor ("on", "+3.0 dB"), or ''
 * @param request  () => a Promise of a MIDIAccess (navigator.requestMIDIAccess, or a test's)
 * @param onChange (why) => void: 'ports', 'state', 'maps', 'learn', 'message'
 */
export function createMidi({ act, request = defaultRequest(), onChange = () => {} }) {
  const st = loadMidi()
  let access = null, opening = null, learning = null, error = null, errorText = '', ports = []
  const log = []

  const find = (m) => { const k = msgKey(m); return st.maps.find((x) => msgKey(x.msg) === k) ?? null }
  function run(map, m) {
    const t = map.target
    if (isKnob(t)) return m.type === 'cc' ? act(t, { value: map.heel + (m.value / 127) * (map.toe - map.heel) }) : ''
    const press = m.type === 'pc' || m.value >= 64
    if (!isSwitch(t)) return press ? act(t, { fire: true }) : ''
    if (map.mode === 'momentary' && m.type !== 'pc') return act(t, { set: press })
    return press ? act(t, { flip: true }) : ''
  }
  function handle(data, port) {
    const m = parseMidi(data)
    if (!m) return
    let map = null, said = ''
    if (learning && fits(learning, m)) {
      // A CC learned at a value under 64 is most likely a switch that toggles itself (it sends 0 on every other
      // press): momentary follows it.
      map = { target: learning, msg: { type: m.type, ch: m.ch, num: m.num }, mode: m.type === 'cc' && m.value < 64 ? 'momentary' : 'toggle', heel: 0, toe: 1 }
      const k = msgKey(map.msg), tk = targetKey(map.target)
      st.maps = st.maps.filter((x) => msgKey(x.msg) !== k && targetKey(x.target) !== tk)
      st.maps.push(map)
      st.maps = st.maps.slice(-MAX_MAPS)
      learning = null
      saveMidi(st)
      said = 'learned'
      if (isKnob(map.target)) run(map, m)
    } else if ((map = find(m))) said = run(map, m) || ''
    log.unshift({ port, m, map, said })
    if (log.length > LOG) log.length = LOG
    if (said === 'learned') { onChange('maps'); onChange('learn') }
    onChange('message')
  }

  function wire() {
    ports = []
    for (const input of access.inputs.values()) {
      if (input.state === 'disconnected') continue
      input.onmidimessage = (e) => handle(e.data, input.name || 'MIDI input')
      ports.push(input.name || 'MIDI input')
    }
  }
  async function open() {
    if (access) return true
    if (!request) { error = 'unsupported'; onChange('state'); return false }
    opening ??= (async () => {
      try {
        const a = await request()
        if (!st.on) return false // turned off while the browser was asking
        access = a
        access.onstatechange = () => { if (access) { wire(); onChange('ports') } }
        wire()
        error = null; errorText = ''
        return true
      } catch (err) {
        error = err?.name === 'SecurityError' || err?.name === 'NotAllowedError' ? 'denied' : 'failed'
        errorText = String(err?.message ?? err)
        return false
      } finally { opening = null; onChange('state') }
    })()
    return opening
  }
  function close() {
    if (access) {
      for (const input of access.inputs.values()) {
        input.onmidimessage = null
        try { input.close?.()?.catch?.(() => {}) } catch { /* closed already */ }
      }
      access.onstatechange = null
      access = null
    }
    ports = []
  }

  return {
    get on() { return st.on },
    get connected() { return Boolean(access) },
    get asking() { return Boolean(opening) },
    get ports() { return ports },
    get maps() { return st.maps },
    get learning() { return learning },
    get error() { return error },
    get errorText() { return errorText },
    get log() { return log },
    /** MIDI on (its ports opened, asking first in a browser) or off (its ports let go). */
    async setOn(on) {
      st.on = Boolean(on)
      saveMidi(st)
      if (st.on) { onChange('state'); return open() }
      close(); error = null; learning = null
      onChange('state'); onChange('learn')
      return false
    },
    /** At start: MIDI back on if it was, when `may()` says the ports can open without asking. */
    async resume(may = async () => true) { if (st.on && (await may())) await open(); else onChange('state') },
    /** Waits for the next message that fits `target`. */
    learn(target) { learning = tidyTarget(target); onChange('learn') },
    cancel() { learning = null; onChange('learn') },
    mapOf(target) { const k = targetKey(target); return st.maps.find((x) => targetKey(x.target) === k) ?? null },
    update(map, patch) {
      if (!st.maps.includes(map)) return
      if (patch.mode === 'toggle' || patch.mode === 'momentary') map.mode = patch.mode
      for (const end of ['heel', 'toe']) if (typeof patch[end] === 'number' && Number.isFinite(patch[end])) map[end] = Math.min(1, Math.max(0, patch[end]))
      saveMidi(st)
      onChange('maps')
    },
    remove(map) { st.maps = st.maps.filter((x) => x !== map); saveMidi(st); onChange('maps') },
    /** Drops mappings whose control is gone for good (a rig deleted). */
    prune(keep) { const n = st.maps.length; st.maps = st.maps.filter((x) => keep(x.target)); if (st.maps.length !== n) { saveMidi(st); onChange('maps') } },
  }
}
function defaultRequest() {
  const nav = globalThis.navigator
  return typeof nav?.requestMIDIAccess === 'function' ? () => nav.requestMIDIAccess({ sysex: false }) : null
}

// ------------------------------------------------------------------------------------------------- the dock
/** The controls a person can map, as the page draws them: the page's knobs and the kits', switches, footswitches, the
 *  power switches, favourites, variants, the rig's name and "Last two". */
const MAPPABLE = [
  '.knob[data-param]', '.rig-hw .kn[data-param]', '.rig-hw .fd[data-param]', '.rig-hw .sw[data-param]', '.rig-hw .sw[data-role="power"]',
  '.rig-hw .sw[data-role="standby"]', '.rig-hw [data-role="foot"]', '[data-switch]', '.toggle:has(> input[data-param])',
  'label.check:has(> input[data-param])', '[data-foot]', '[data-pw-main]', '.pw-bat', '.pads-grid [data-pad]:not(.empty)',
  '#variants [data-variant]', '#rig-name', '#pads-last',
].join(', ')
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c])
const polar = (deg, r, c = 32) => [c + r * Math.sin((deg * Math.PI) / 180), c - r * Math.cos((deg * Math.PI) / 180)]
const sweep = (f) => -135 + 270 * f

/**
 * The MIDI dock (build plan R7): what is connected, the place to drop a control, the mappings, and a live monitor of
 * what arrives. While it is open the page is in map mode: each control that can be mapped is outlined with its
 * message, and a press on one starts learning it instead of using it.
 * @param targetAt  (element) => the control it is part of, or null
 * @param label     (target) => { name, sub }: what the person calls it
 * @param choices   () => [{ target, name, group }]: every control, for the list beside the drop
 * @param spec      (target) => { min, max, text(v) } for a knob
 * @param notice    () => words when MIDI cannot work here (the Hub's view), or ''
 * @param refuse    (target) => words when that control cannot be mapped yet (a rig not saved), or ''
 */
export function createMidiDock({ midi, button, dock, layer, targetAt, label, choices, spec, desktop = false, notice = () => '', refuse = () => '', onOpen = () => {} }) {
  const $ = (s) => dock.querySelector(s)
  // what map mode leaves alone: the page's own menus and dialogs, and the header's buttons (the dock's among them)
  const AWAY = '#midi-dock, #look-menu, dialog, nav.actions, .toast'
  let open = false, refused = '', refusedTimer = 0, learned = null, learnedTimer = 0, drag = null, ghost = null, swallow = null, paintQueued = false, logQueued = false

  // ---- drawing
  function renderState() {
    const on = midi.on, box = $('#midi-on')
    box.checked = on
    box.closest('.toggle').querySelector('.tg-state').textContent = on ? 'On' : 'Off'
    const ports = midi.ports
    const said = !on ? 'Off' : midi.asking ? 'Asking for MIDI…' : midi.connected ? (ports.length ? ports.join(', ') : 'On: no controller connected') : midi.error === 'unsupported' ? 'Not in this browser' : 'Not connected'
    $('#midi-ports').textContent = said
    button.dataset.state = on && midi.connected ? (ports.length ? 'on' : 'empty') : 'off'
    button.title = on && midi.connected ? `MIDI: ${ports.length ? ports.join(', ') : 'no controller connected'}` : 'MIDI: off'
    renderLearn()
  }
  function noteText() {
    if (refused) return refused
    const n = notice()
    if (n) return n
    if (midi.error === 'unsupported') return 'This browser has no Web MIDI. Use Edge or Chrome, or the desktop app.'
    if (midi.error === 'denied') return 'This browser said no to MIDI. Allow it for this site (the icon at the left of the address bar), then turn MIDI on again.'
    if (midi.error === 'failed') return `MIDI did not start: ${midi.errorText}`
    if (!midi.on) return 'MIDI is off. Choosing a control turns it on' + (desktop ? '.' : ', and your browser asks you first.')
    if (midi.asking) return 'Your browser is asking whether CRBN Rig may use MIDI devices.'
    return ''
  }
  function renderLearn() {
    const zone = $('#midi-drop'), t = midi.learning
    zone.dataset.state = t ? 'learning' : learned ? 'learned' : 'idle'
    const note = noteText()
    let html
    if (t) {
      const { name } = label(t)
      html = `<p class="md-say"><b>${esc(name)}</b>: waiting for MIDI. ${isKnob(t) ? 'Move the pedal or knob you want for it.' : 'Press the footswitch you want for it.'}</p>` +
        `<button class="btn small" type="button" data-md="cancel">Cancel</button>`
    } else {
      // just learned: said first, with the way to the next one under it
      html = (learned ? `<p class="md-say ok"><b>${esc(label(learned.target).name)}</b> is on <code>${esc(describeMsg(learned.msg))}</code>.</p>` : '') +
        '<p class="md-say"><b>Drag a control here</b>, or click one on the page: a knob, a switch, a footswitch, a favourite, a variant, the rig’s name or the power switch. Then press the footswitch or move the pedal you want for it.</p>' +
        '<label class="md-pick"><span>Or choose</span><select data-md="pick"><option value="">A control…</option>' +
        groupOptions() + '</select></label>'
    }
    zone.innerHTML = html + (note ? `<p class="md-note" role="status">${esc(note)}</p>` : '')
  }
  function groupOptions() {
    const groups = new Map()
    choices().forEach((c, i) => { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(`<option value="${i}">${esc(c.name)}</option>`) })
    return [...groups].map(([g, opts]) => `<optgroup label="${esc(g)}">${opts.join('')}</optgroup>`).join('')
  }
  function renderMaps() {
    const list = $('#midi-maps')
    if (!midi.maps.length) { list.innerHTML = '<li class="md-none">Nothing mapped yet.</li>'; return }
    list.innerHTML = midi.maps.map((m, i) => {
      const { name, sub } = label(m.target), t = m.target
      let how = ''
      if (isSwitch(t)) {
        how = m.msg.type === 'pc' ? '<small class="md-how">Each Program Change flips it</small>'
          : `<div class="segmented md-mode" role="radiogroup" aria-label="${esc(name)}: how the switch acts">` +
            `<button type="button" role="radio" data-mode="toggle" aria-checked="${m.mode === 'toggle'}" title="Each press flips it">Toggle</button>` +
            `<button type="button" role="radio" data-mode="momentary" aria-checked="${m.mode === 'momentary'}" title="On while held, off when let go; also for a controller that toggles its own switch">Momentary</button></div>`
      } else if (isKnob(t)) {
        const sp = spec(t)
        const end = (k, word) => `<label class="md-end"><span>${word}</span><input type="range" min="0" max="1000" step="1" value="${Math.round(m[k] * 1000)}" data-end="${k}" aria-label="${esc(name)}: ${word.toLowerCase()} (CC ${k === 'heel' ? 0 : 127})"><output>${esc(sp ? sp.text(sp.min + m[k] * (sp.max - sp.min)) : `${Math.round(m[k] * 100)}%`)}</output></label>`
        how = `<div class="md-range">${end('heel', 'Heel')}${end('toe', 'Toe')}</div>`
      } else how = `<small class="md-how">${m.msg.type === 'pc' ? 'Its Program Change picks it' : 'A press picks it'}</small>`
      return `<li class="md-map" data-i="${i}"><span class="md-what"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>` +
        `<code class="md-msg">${esc(describeMsg(m.msg))}</code>${how}` +
        `<button class="md-rm" type="button" data-md="remove" aria-label="Forget ${esc(name)}’s MIDI" title="Forget this mapping">&times;</button></li>`
    }).join('')
  }
  function renderLog() {
    logQueued = false
    const list = $('#midi-log')
    if (!midi.log.length) { list.innerHTML = `<li class="md-none">${midi.connected ? 'Press a footswitch or move a pedal: what arrives shows here.' : 'Nothing yet.'}</li>`; return }
    list.innerHTML = midi.log.map((e) => {
      const to = e.said === 'learned' ? `learned for ${label(e.map.target).name}` : e.map ? `${label(e.map.target).name}${e.said ? `: ${e.said}` : ''}` : 'not mapped'
      return `<li${e.map ? ' class="hit"' : ''}><span class="md-port">${esc(e.port)}</span><code>${esc(describeMsg(e.m, true))}</code><span class="md-to">${esc(to)}</span></li>`
    }).join('')
  }

  // ---- the knobs' ranges, drawn on every knob mapped (always, not only in map mode)
  function decorate() {
    const ranges = new Map(midi.maps.filter((m) => isKnob(m.target)).map((m) => [m.target.param, m]))
    for (const el of document.querySelectorAll('.knob[data-param] svg, .rig-hw .kn[data-param], .rig-hw .fd[data-param]')) {
      const host = el.tagName === 'svg' ? el.closest('.knob') : el
      const m = ranges.get(host.dataset.param)
      const lo = m ? Math.min(m.heel, m.toe) : 0, hi = m ? Math.max(m.heel, m.toe) : 0
      if (el.tagName === 'svg') {
        let path = el.querySelector('.midi-range')
        if (!m) { path?.remove(); continue }
        if (!path) { path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('class', 'midi-range'); el.appendChild(path) }
        const a = sweep(lo), b = sweep(Math.max(hi, lo + 0.004)), [x0, y0] = polar(a, 30.5), [x1, y1] = polar(b, 30.5)
        path.setAttribute('d', `M${x0.toFixed(2)} ${y0.toFixed(2)} A30.5 30.5 0 ${b - a > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`)
      } else {
        const fader = el.classList.contains('fd'), holder = fader ? el : el.parentElement
        let mark = holder.querySelector(':scope > .midi-range')
        if (!m) { mark?.remove(); continue }
        if (!mark) { mark = document.createElement('i'); mark.className = `midi-range ${fader ? 'span' : 'ring'}`; holder.appendChild(mark) }
        mark.style.setProperty('--lo', lo.toFixed(4)); mark.style.setProperty('--hi', hi.toFixed(4))
      }
    }
  }

  // ---- map mode: every control outlined, with its message
  function paint() {
    paintQueued = false
    decorate()
    if (!open) { layer.replaceChildren(); return }
    const sx = scrollX, sy = scrollY, seen = new Set(), boxes = []
    for (const el of document.querySelectorAll(MAPPABLE)) {
      if (el.closest(AWAY) || !el.getClientRects().length) continue
      const t = targetAt(el)
      if (!t || seen.has(el)) continue
      seen.add(el)
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      const m = midi.mapOf(t), learning = midi.learning && targetKey(midi.learning) === targetKey(t)
      const b = document.createElement('div')
      b.className = `ml-box${m ? ' mapped' : ''}${learning ? ' learning' : ''}`
      b.style.cssText = `left:${r.left + sx - 3}px;top:${r.top + sy - 3}px;width:${r.width + 6}px;height:${r.height + 6}px`
      b.dataset.key = targetKey(t)
      if (m || learning) { const tag = document.createElement('b'); tag.textContent = learning ? 'MIDI…' : describeMsg(m.msg).replace(/ · ch \d+$/, ''); b.appendChild(tag) }
      boxes.push(b)
    }
    layer.replaceChildren(...boxes)
  }
  const queuePaint = () => { if (!paintQueued) { paintQueued = true; requestAnimationFrame(paint) } }
  // Redrawn when the page redraws a part of itself (a kit picked, a pedal added), never for its own marks.
  new MutationObserver((records) => {
    const own = (n) => n.nodeType === 1 && (n.classList?.contains('midi-range') || n.classList?.contains('ml-box'))
    if (records.some((r) => r.target !== layer && ![...r.addedNodes, ...r.removedNodes].every(own))) queuePaint()
  }).observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true })
  addEventListener('resize', queuePaint)

  function setOpen(want) {
    open = want
    dock.hidden = !want
    button.setAttribute('aria-expanded', String(want))
    document.documentElement.dataset.midiMap = want ? 'on' : ''
    if (!want) { midi.cancel(); learned = null; endDrag() }
    room()
    renderState(); renderMaps(); renderLog(); queuePaint()
    if (want) onOpen()
  }
  // the page makes room for the dock below its last row, and the toast sits above it
  function room() {
    const h = open ? dock.offsetHeight : 0
    document.body.style.paddingBottom = h ? `${h}px` : ''
    document.documentElement.style.setProperty('--midi-dock-h', `${h}px`)
  }
  new ResizeObserver(() => { if (open) { room(); queuePaint() } }).observe(dock)

  async function learn(t) {
    if (!t) return
    learned = null
    const why = refuse(t)
    if (why) { refused = why; clearTimeout(refusedTimer); refusedTimer = setTimeout(() => { refused = ''; if (open) renderLearn() }, 5000); renderLearn(); return }
    refused = ''
    if (!midi.on) await midi.setOn(true)
    midi.learn(t)
  }

  // ---- drag and drop (pointer events, so a knob's own drag never starts): from a control onto the dock
  function endDrag() { ghost?.remove(); ghost = null; drag = null; dock.classList.remove('drop-over') }
  const overDock = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest('#midi-dock') != null
  addEventListener('pointerdown', (e) => {
    if (!open || e.button !== 0 || e.target.closest?.(AWAY)) return
    const t = targetAt(e.target)
    if (!t) return
    e.preventDefault(); e.stopPropagation()
    drag = { t, from: e.target, x: e.clientX, y: e.clientY, moved: false }
  }, true)
  addEventListener('pointermove', (e) => {
    if (!drag) return
    e.stopPropagation()
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return
    if (!drag.moved) {
      drag.moved = true
      ghost = document.createElement('div')
      ghost.className = 'midi-ghost'
      ghost.textContent = label(drag.t).name
      document.body.appendChild(ghost)
    }
    ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 10}px)`
    dock.classList.toggle('drop-over', overDock(e))
  }, true)
  addEventListener('pointerup', (e) => {
    if (!drag) return
    e.stopPropagation()
    const { t, moved, from } = drag
    endDrag()
    // the click this press makes lands on the control, or on what holds both it and the dock: that one is swallowed
    swallow = { from, at: performance.now() }
    // a drop on the dock learns it; so does a press without a drag (a click), which is the same for a keyboard or touch
    if (!moved || overDock(e)) learn(t)
  }, true)
  addEventListener('pointercancel', () => endDrag(), true)
  // the press's click (and a double click) must not reach the control: in map mode it is being chosen, not used
  for (const type of ['click', 'dblclick']) {
    addEventListener(type, (e) => {
      if (!open || e.target.closest?.(AWAY)) return
      const ending = swallow && performance.now() - swallow.at < 400 && e.target.contains?.(swallow.from)
      if (ending) swallow = null
      if (targetAt(e.target) || ending) { e.preventDefault(); e.stopPropagation() }
    }, true)
  }
  addEventListener('dragstart', (e) => { if (open && !e.target.closest?.(AWAY) && targetAt(e.target)) e.preventDefault() }, true)
  // Enter on a focused control learns it.
  addEventListener('keydown', (e) => {
    if (!open || e.key !== 'Enter' || e.target.closest?.(AWAY)) return
    const t = targetAt(e.target)
    if (t) { e.preventDefault(); e.stopPropagation(); learn(t) }
  }, true)

  // ---- the dock's own controls
  button.addEventListener('click', () => setOpen(!open))
  $('#midi-close').addEventListener('click', () => { setOpen(false); button.focus() })
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return
    if (midi.learning) midi.cancel()
    else { setOpen(false); button.focus() }
  })
  $('#midi-on').addEventListener('change', (e) => midi.setOn(e.target.checked))
  dock.addEventListener('click', (e) => {
    const b = e.target.closest('[data-md], [data-mode]')
    if (!b) return
    if (b.dataset.md === 'cancel') midi.cancel()
    else if (b.dataset.md === 'remove') { const m = midi.maps[Number(b.closest('[data-i]').dataset.i)]; if (m) midi.remove(m) }
    else if (b.dataset.mode) { const m = midi.maps[Number(b.closest('[data-i]').dataset.i)]; if (m) midi.update(m, { mode: b.dataset.mode }) }
  })
  dock.addEventListener('change', (e) => {
    if (e.target.dataset.md === 'pick' && e.target.value !== '') learn(choices()[Number(e.target.value)]?.target)
  })
  dock.addEventListener('input', (e) => {
    const r = e.target.closest('input[data-end]')
    if (!r) return
    const m = midi.maps[Number(r.closest('[data-i]').dataset.i)]
    if (!m) return
    const end = r.dataset.end, v = Number(r.value) / 1000
    m[end] = v // live, while the slider moves; kept on change
    const sp = spec(m.target)
    r.nextElementSibling.textContent = sp ? sp.text(sp.min + v * (sp.max - sp.min)) : `${Math.round(v * 100)}%`
    decorate()
  })
  dock.addEventListener('change', (e) => { const r = e.target.closest('input[data-end]'); if (r) { const m = midi.maps[Number(r.closest('[data-i]').dataset.i)]; if (m) midi.update(m, { [r.dataset.end]: Number(r.value) / 1000 }) } })

  let blinkTimer = 0
  return {
    get open() { return open },
    setOpen,
    /** midi.js's onChange. */
    changed(why) {
      if (why === 'message') {
        button.classList.add('blink'); clearTimeout(blinkTimer); blinkTimer = setTimeout(() => button.classList.remove('blink'), 90)
        if (open && !logQueued) { logQueued = true; requestAnimationFrame(renderLog) }
        return
      }
      if (why === 'learn' && !midi.learning) {
        const last = midi.log[0]
        if (last?.said === 'learned') { learned = last.map; clearTimeout(learnedTimer); learnedTimer = setTimeout(() => { learned = null; if (open) renderLearn() }, 2600) }
      }
      if (why === 'maps') renderMaps()
      renderState()
      queuePaint()
    },
    /** Something the labels show changed (a pedal, a favourite, a rig's name). */
    relabel() { if (open) { renderMaps(); renderLearn() } queuePaint() },
    paint: queuePaint,
  }
}
