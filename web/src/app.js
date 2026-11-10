// CRBN Rig's page (D-CRBN-021 (d)): the signal chain, the audio graph and the files, drawn to the owner's picks
// (D-RIG-008): the amp's faceplate, LED meters and the Amp front layout by default, each a person's choice in the look
// menu with Rig's finish (finish.js) and the suite's look (look.js, D-CRBN-023 / D-CRBN-024).
//
//   source (the guitar through getUserMedia, or the demo riff) -> AudioWorkletNode 'crbn-rig' (rig-processor.js: input
//   gain, gate, capture, EQ, DC blocker, output gain) -> ConvolverNode (the cabinet IR, scaled and truncated as the
//   desktop's ImpulseResponse does) -> AnalyserNode (the output meter) -> the speakers.
import { DEFAULTS } from './engine.js'
import { DEFAULT_CUSTOM, FINISHES, HEX_RE, finishHex, finishVars, hex2rgb, hsv2rgb, inkFor, readouts, rgb2hex, rgb2hsv } from './finish.js'
import { scaledIR } from './ir.js'
import { applyPrefs, fontOf, loadLooks, loadPrefs, lookList, looks, ownPrefs, sanitize, savePrefs, setEvery, sharesAcrossApps } from './look.js'
import { forgetFile, loadSettings, recallFile, rememberFile, saveSettings } from './store.js'

const $ = (id) => document.getElementById(id)
const ENGINE_PARAMS = Object.keys(DEFAULTS)
const root = document.documentElement

// Pavillion Hub's own view for web tools marks its user agent `PavillionTool/<app id>` (pavillion_client
// hub/apps/desktop/src/main/toolView.ts), as crbn-photo-live's hub.ts reads it. There a pavillion://app/<id> link, sent
// with window.open, brings up the app's Library card, and an https window.open goes to the person's browser.
const TOOL_MARK = /(?:^|\s)PavillionTool\/([PS]2K[1-9A-HJ-NP-Za-km-z]{44})(?:\s|$)/
const hubApp = TOOL_MARK.exec(navigator.userAgent)?.[1] ?? null
const PAGE_DEFAULTS = { ...DEFAULTS, irOn: 1 }

// ------------------------------------------------------------------------------------------------- settings
const settings = { ...PAGE_DEFAULTS }
for (const [k, v] of Object.entries(loadSettings())) if (k in PAGE_DEFAULTS && Number.isFinite(Number(v))) settings[k] = Number(v)
let saveTimer = 0
function setSetting(name, value) {
  settings[name] = value
  if (ENGINE_PARAMS.includes(name)) node?.port.postMessage({ type: 'param', name, value })
  if (name === 'irOn') route()
  reflect(name)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveSettings(settings), 300)
}

// ------------------------------------------------------------------------------------------------- knobs
// Each knob carries both drawings: an arc knob for the islands and the stripe, and a pointer knob on a 0-to-10 skirt
// for the faceplate; the stylesheet shows the one the amp's drawing wants.
const knobs = new Map()
const fmt = (v, unit, step) => {
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const s = (unit === 'dB' || unit === 'dBu') && v > 0 ? '+' : ''
  return `${s}${v.toFixed(d)}${unit ? ' ' + unit : ''}`
}
const polar = (deg, r, c = 32) => [c + r * Math.sin((deg * Math.PI) / 180), c - r * Math.cos((deg * Math.PI) / 180)]
function makeKnob(el) {
  const name = el.dataset.param, min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step, unit = el.dataset.unit ?? ''
  const A0 = -135, A1 = 135, R = 26, P0 = -150, P1 = 150
  const arc = (a, b) => { const [x0, y0] = polar(a, R), [x1, y1] = polar(b, R); return `M${x0} ${y0} A${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${x1} ${y1}` }
  const ticks = Array.from({ length: 11 }, (_, i) => { const d = P0 + 30 * i, [x0, y0] = polar(d, i % 5 === 0 ? 24.5 : 26), [x1, y1] = polar(d, 30); return `M${x0.toFixed(2)} ${y0.toFixed(2)} L${x1.toFixed(2)} ${y1.toFixed(2)}` }).join(' ')
  el.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    `<g class="k-arc"><path class="track" d="${arc(A0, A1)}"/><path class="arc"/><circle class="cap" cx="32" cy="32" r="18"/><line class="pointer" x1="32" y1="32" x2="32" y2="18"/></g>` +
    `<g class="k-plate"><path class="tick" d="${ticks}"/><circle class="skirt" cx="32" cy="32" r="20"/><circle class="pcap" cx="32" cy="32" r="12.5"/><circle class="shine" cx="32" cy="32" r="12.5"/><line class="ppointer" x1="32" y1="32" x2="32" y2="13"/></g>` +
    '</svg><span class="label"></span><output></output>'
  el.querySelector('.label').textContent = el.dataset.label
  el.setAttribute('role', 'slider'); el.tabIndex = 0
  el.setAttribute('aria-label', el.dataset.aria ?? el.dataset.label)
  el.setAttribute('aria-valuemin', min); el.setAttribute('aria-valuemax', max)
  const out = el.querySelector('output'), arcEl = el.querySelector('.arc'), ptr = el.querySelector('.pointer'), pptr = el.querySelector('.ppointer')
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  const draw = (v) => {
    const t = (v - min) / (max - min), a = A0 + t * (A1 - A0)
    // Bipolar controls (dB around 0) light from the centre; the rest from the start.
    const from = min < 0 && max > 0 && unit !== 'dBu' ? A0 + ((0 - min) / (max - min)) * (A1 - A0) : A0
    arcEl.setAttribute('d', Math.abs(a - from) < 0.5 ? '' : arc(Math.min(from, a), Math.max(from, a)))
    const [x, y] = polar(a, 13); ptr.setAttribute('x2', x); ptr.setAttribute('y2', y)
    const [px, py] = polar(P0 + t * (P1 - P0), 19); pptr.setAttribute('x2', px); pptr.setAttribute('y2', py)
    out.textContent = fmt(v, unit, step)
    el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', fmt(v, unit, step))
  }
  const set = (v) => setSetting(name, clamp(v))
  let drag = null
  el.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; el.setPointerCapture(e.pointerId); drag = { y: e.clientY, v: settings[name] }; el.focus() })
  el.addEventListener('pointermove', (e) => {
    if (!drag) return
    const range = (max - min) * (e.shiftKey ? 0.1 : 1)
    set(drag.v + ((drag.y - e.clientY) / 180) * range)
  })
  const end = () => { drag = null }
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end)
  el.addEventListener('dblclick', () => set(PAGE_DEFAULTS[name]))
  el.addEventListener('wheel', (e) => { e.preventDefault(); set(settings[name] + Math.sign(-e.deltaY) * step * (e.shiftKey ? 1 : 10)) }, { passive: false })
  el.addEventListener('keydown', (e) => {
    const big = (max - min) / 10, k = e.key
    const d = { ArrowUp: step * 10, ArrowRight: step * 10, ArrowDown: -step * 10, ArrowLeft: -step * 10, PageUp: big, PageDown: -big }[k]
    if (d !== undefined) set(settings[name] + (e.shiftKey ? d / 10 : d))
    else if (k === 'Home') set(min)
    else if (k === 'End') set(max)
    else return
    e.preventDefault()
  })
  knobs.set(name, draw)
}

// What a switch turns off dims with it: the gate's threshold, the EQ's three knobs, the cabinet.
const DIMS = { gateOn: ['gateThresholdDB'], eqOn: ['bass', 'middle', 'treble'] }
function reflect(name) {
  const v = settings[name]
  knobs.get(name)?.(v)
  for (const box of document.querySelectorAll(`input[type=checkbox][data-param="${name}"]`)) {
    box.checked = v > 0.5
    const word = box.closest('.toggle')?.querySelector('.tg-state')
    if (word) word.textContent = v > 0.5 ? 'On' : 'Off'
  }
  for (const b of document.querySelectorAll(`.segmented[data-param="${name}"] button`)) b.setAttribute('aria-checked', String(+b.dataset.value === v))
  for (const p of DIMS[name] ?? []) document.querySelector(`.knob[data-param="${p}"]`)?.classList.toggle('off', v < 0.5)
  if (name === 'irOn') $('cab').classList.toggle('off', v < 0.5)
}

// ------------------------------------------------------------------------------------------------- the audio graph
let ctx = null, node = null, convolver = null, analyser = null
let micStream = null, micSource = null, demoSource = null, demoBuffer = null
let wasmBytes = null
let messageId = 0
const waiting = new Map()

async function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') await ctx.resume(); return }
  ctx = new AudioContext({ latencyHint: 'interactive' })
  wasmBytes ??= await (await fetch('rig-engine.wasm')).arrayBuffer()
  await ctx.audioWorklet.addModule('rig-processor.js')
  node = new AudioWorkletNode(ctx, 'crbn-rig', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCountMode: 'max', channelInterpretation: 'discrete',
    processorOptions: { wasm: wasmBytes.slice(0) },
  })
  node.port.onmessage = (e) => onWorklet(e.data)
  for (const name of ENGINE_PARAMS) node.port.postMessage({ type: 'param', name, value: settings[name] })
  convolver = new ConvolverNode(ctx, { disableNormalization: true })
  analyser = new AnalyserNode(ctx, { fftSize: 1024 })
  analyser.connect(ctx.destination)
  route()
  if (capture.bytes) {
    const result = await sendCapture()
    if (!result.ok) { toast(`${capture.name}: ${result.error}`); await clearCapture() }
  }
  if (ir.bytes) { try { await prepareIR() } catch { toast(`${ir.name}: not a WAV the browser can read.`); await clearIR() } }
  ctx.onstatechange = updateStatus
  requestAnimationFrame(meterLoop)
}

function route() {
  if (!node) return
  node.disconnect(); convolver.disconnect()
  if (settings.irOn > 0.5 && convolver.buffer) { node.connect(convolver); convolver.connect(analyser) }
  else node.connect(analyser)
}

function onWorklet(m) {
  if (m.type === 'meter') meters.input(m.input, m.raw)
  else if (m.type === 'capture') { waiting.get(m.id)?.(m); waiting.delete(m.id) }
  else if (m.type === 'error') toast(`The engine could not start: ${m.error}`)
  else if (m.type === 'log') console.debug('[engine]', m.line)
}

const ask = (msg, transfer) => new Promise((ok) => { const id = ++messageId; waiting.set(id, ok); node.port.postMessage({ ...msg, id }, transfer) })

// ------------------------------------------------------------------------------------------------- playing
async function playGuitar() {
  try {
    await ensureAudio()
    stopDemo()
    await openMic($('input-device').value || undefined)
  } catch (err) {
    if (err?.name === 'NotAllowedError' && hubApp) {
      // The Hub's tool view grants no microphone yet (its TOOL_PERMISSIONS): offer the two places that can hear it.
      $('hub-help').hidden = false
      toast("Pavillion Hub's window can't hear your guitar yet. Open the installed app, or open CRBN Rig in your browser. The demo riff plays here.")
    } else {
      toast(err?.name === 'NotAllowedError'
        ? 'CRBN Rig needs your microphone or audio interface to hear your guitar. Allow it in the address bar, then try again.'
        : `Your input could not be opened: ${err?.message ?? err}`)
    }
  }
  updateStatus()
}

async function openMic(deviceId) {
  closeMic()
  // Guitar wants the raw signal: no echo cancelling, noise suppression or automatic gain.
  const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) }
  micStream = await navigator.mediaDevices.getUserMedia({ audio })
  micSource = new MediaStreamAudioSourceNode(ctx, { mediaStream: micStream })
  micSource.connect(node)
  await listDevices(micStream.getAudioTracks()[0]?.getSettings().deviceId)
}

function closeMic() {
  micSource?.disconnect(); micSource = null
  for (const t of micStream?.getTracks() ?? []) t.stop()
  micStream = null
}

async function listDevices(current) {
  const sel = $('input-device')
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
  sel.innerHTML = ''
  for (const d of inputs) {
    const o = document.createElement('option')
    o.value = d.deviceId; o.textContent = d.label || 'Audio input'
    if (d.deviceId === current) o.selected = true
    sel.append(o)
  }
  sel.disabled = inputs.length === 0
}

async function toggleDemo() {
  if (demoSource) { stopDemo(); updateStatus(); return }
  try {
    await ensureAudio()
    closeMic()
    if (!capture.bytes) await loadExample()
    demoBuffer ??= await ctx.decodeAudioData(await (await fetch('demo/di.wav')).arrayBuffer())
    demoSource = new AudioBufferSourceNode(ctx, { buffer: demoBuffer, loop: true })
    demoSource.connect(node)
    demoSource.start()
    $('play-demo').setAttribute('aria-pressed', 'true')
    $('play-demo').textContent = 'Stop the demo riff'
  } catch (err) {
    toast(`The demo could not play: ${err?.message ?? err}`)
  }
  updateStatus()
}

function stopDemo() {
  if (!demoSource) return
  try { demoSource.stop() } catch { /* already stopped */ }
  demoSource.disconnect(); demoSource = null
  $('play-demo').setAttribute('aria-pressed', 'false')
  $('play-demo').textContent = 'Hear the demo riff'
}

function stopAll() { stopDemo(); closeMic(); ctx?.suspend(); updateStatus() }

function updateStatus() {
  const playing = Boolean(ctx && ctx.state === 'running' && (micSource || demoSource))
  $('status').classList.toggle('live', playing)
  $('jewel').classList.toggle('on', playing)
  $('jewel-state').textContent = playing ? 'On' : 'Off'
  $('stop').hidden = !playing
  $('start').classList.toggle('compact', Boolean(ctx))
  if (ctx && ctx.state === 'suspended' && (micSource || demoSource)) ctx.resume().then(updateStatus)
  if (!playing) { $('status-text').textContent = 'Not playing'; return }
  const ms = Math.round(((ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000)
  const what = demoSource ? 'Demo riff' : 'Live'
  $('status-text').textContent = `${what} · ${(ctx.sampleRate / 1000).toFixed(1).replace(/\.0$/, '')} kHz · ${ms ? `about ${ms} ms out` : 'low latency'}`
}

// ------------------------------------------------------------------------------------------------- the capture
const capture = { name: '', bytes: null, meta: null, info: null }

function parseCapture(bytes) {
  let json
  try { json = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new Error('This file is not a NAM capture (it is not JSON).') }
  if (!json || typeof json !== 'object' || !('architecture' in json || 'config' in json)) throw new Error('This file is not a NAM capture.')
  return json.metadata ?? {}
}

async function useCapture(name, bytes, { remember = true, example = false } = {}) {
  const meta = parseCapture(bytes)
  const previous = { ...capture }
  Object.assign(capture, { name, bytes, meta, info: null, example })
  showCapture('Loading…')
  if (node) {
    const result = await sendCapture()
    if (!result.ok) {
      Object.assign(capture, previous)
      if (previous.bytes) await sendCapture(); else node.port.postMessage({ type: 'clearCapture', id: 0 })
      showCapture()
      throw new Error(result.error)
    }
  }
  showCapture()
  if (remember) await rememberFile('capture', name, bytes)
}

async function sendCapture() {
  const bytes = capture.bytes.slice(0)
  const result = await ask({ type: 'capture', bytes: bytes.buffer }, [bytes.buffer])
  if (result.ok) {
    capture.info = result.info
    $('slim').hidden = !result.info?.slimmable
  }
  return result
}

async function loadExample() {
  const bytes = new Uint8Array(await (await fetch('demo/example.nam')).arrayBuffer())
  await useCapture('Example capture', bytes, { remember: false, example: true })
}

const TYPES = { amp: 'Amp', pedal: 'Pedal', pedal_amp: 'Pedal and amp', amp_cab: 'Amp and cab', amp_pedal_cab: 'Full rig', preamp: 'Preamp', studio: 'Studio' }
function fillChips(list, chips) {
  list.innerHTML = ''
  for (const c of chips) { const li = document.createElement('li'); li.textContent = c; list.append(li) }
}
function showCapture(note) {
  const drop = $('capture-drop')
  const has = Boolean(capture.bytes)
  drop.classList.toggle('has', has)
  drop.querySelector('.empty').hidden = has
  drop.querySelector('.loaded').hidden = !has
  $('capture-kind').hidden = true
  $('amp-logo').classList.toggle('none', !has)
  if (!has) {
    $('slim').hidden = true
    $('amp-logo').textContent = 'No capture'; $('amp-band-name').textContent = 'No capture'
    $('amp-sub').textContent = 'Drop a .nam capture here'
    fillChips($('amp-chips'), [])
    return
  }
  const m = capture.meta ?? {}
  // NAM Core's example names itself "Test Model"; the page calls it what it is.
  const name = capture.example ? 'Example capture' : m.name || capture.name.replace(/\.nam$/i, '')
  $('capture-name').textContent = name
  $('amp-logo').textContent = name; $('amp-band-name').textContent = name
  const chips = [TYPES[m.gear_type] ?? m.gear_type, m.tone_type?.replace(/_/g, ' ')].filter(Boolean)
  fillChips($('capture-chips'), chips); fillChips($('amp-chips'), chips)
  const gear = [m.gear_make, m.gear_model].filter(Boolean).join(' ')
  const lines = []
  if (note) lines.push(note)
  if (gear) lines.push(gear)
  if (m.modeled_by) lines.push(`Captured by ${m.modeled_by}`)
  if (capture.example) lines.push('From Neural Amp Modeler Core: drop your own capture to replace it')
  if (capture.info?.sampleRate && ctx && Math.abs(capture.info.sampleRate - ctx.sampleRate) > 1) lines.push(`Recorded at ${capture.info.sampleRate / 1000} kHz, resampled`)
  $('capture-meta').textContent = lines.join(' · ')
  $('amp-sub').textContent = [note, gear, ...chips, m.modeled_by && `captured by ${m.modeled_by}`].filter(Boolean).join(' · ')
}

async function clearCapture() {
  Object.assign(capture, { name: '', bytes: null, meta: null, info: null, example: false })
  if (node) node.port.postMessage({ type: 'clearCapture', id: 0 })
  showCapture()
  await forgetFile('capture')
}

// ------------------------------------------------------------------------------------------------- the cabinet IR
const ir = { name: '', bytes: null, seconds: 0 }

async function prepareIR() {
  const decoded = await ctx.decodeAudioData(ir.bytes.slice(0).buffer)
  convolver.buffer = scaledIR(decoded, ctx.sampleRate)
  ir.seconds = decoded.duration
  route()
}

async function useIR(name, bytes, { remember = true } = {}) {
  const previous = { ...ir }
  Object.assign(ir, { name, bytes })
  if (ctx) {
    try { await prepareIR() } catch {
      Object.assign(ir, previous); showIR()
      throw new Error('This file is not a WAV the browser can read.')
    }
  }
  showIR()
  if (remember) await rememberFile('ir', name, bytes)
}

function showIR() {
  const drop = $('ir-drop'), has = Boolean(ir.bytes)
  drop.classList.toggle('has', has)
  drop.querySelector('.empty').hidden = has
  drop.querySelector('.loaded').hidden = !has
  if (!has) { $('cab-name').textContent = 'No IR'; $('cab-meta').textContent = 'Drop a .wav here'; return }
  const name = ir.name.replace(/\.wav$/i, ''), meta = ir.seconds ? `${Math.round(ir.seconds * 1000)} ms impulse response` : 'Impulse response'
  $('ir-name').textContent = name; $('ir-meta').textContent = meta
  $('cab-name').textContent = name; $('cab-meta').textContent = meta
}

async function clearIR() {
  Object.assign(ir, { name: '', bytes: null, seconds: 0 })
  if (convolver) { convolver.buffer = null; route() }
  showIR()
  await forgetFile('ir')
}

// ------------------------------------------------------------------------------------------------- files in
async function takeFile(file, slot) {
  const lower = file.name.toLowerCase()
  slot ??= lower.endsWith('.nam') ? 'capture' : lower.endsWith('.wav') ? 'ir' : null
  if (!slot) { toast('Drop a .nam capture or a .wav cabinet IR.'); return }
  if (file.size > 64 * 1024 * 1024) { toast(`${file.name} is larger than a capture or an IR should be.`); return }
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    if (slot === 'capture') await useCapture(file.name, bytes)
    else await useIR(file.name, bytes)
  } catch (err) {
    toast(`${file.name}: ${err?.message ?? err}`)
  }
}

function wireFiles() {
  for (const b of document.querySelectorAll('[data-pick]')) b.addEventListener('click', () => document.querySelector(`[data-input="${b.dataset.pick}"]`).click())
  for (const input of document.querySelectorAll('[data-input]')) input.addEventListener('change', () => { if (input.files[0]) takeFile(input.files[0], input.dataset.input); input.value = '' })
  for (const b of document.querySelectorAll('[data-clear]')) b.addEventListener('click', () => (b.dataset.clear === 'capture' ? clearCapture() : clearIR()))
  // Drop anywhere: a .nam is a capture, a .wav an IR; a drop zone, the amp and the cabinet take their own kind.
  let depth = 0
  const clearOver = () => { for (const d of document.querySelectorAll('.over')) d.classList.remove('over') }
  addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { depth++; document.body.classList.add('dragging') } })
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging'); clearOver() } })
  addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault() })
  addEventListener('drop', (e) => {
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging'); clearOver()
    const file = e.dataTransfer?.files[0]
    if (file) takeFile(file, e.target.closest?.('[data-slot]')?.dataset.slot)
  })
  for (const zone of document.querySelectorAll('[data-slot]')) {
    zone.addEventListener('dragover', () => zone.classList.add('over'))
    zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('over') })
  }
}

// ------------------------------------------------------------------------------------------------- meters
// Every meter carries the three drawings (a bar, an LED ladder, a VU needle); the stylesheet shows the person's.
const LEDS = 16
function buildMeter(el) {
  const p = (deg, r) => polar(deg, r, 0).map((v, i) => (i ? v + 30 : v).toFixed(2)) // centred on (0, 30)
  const arcAt = (r, a, b) => { const [x0, y0] = p(a, r), [x1, y1] = p(b, r); return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}` }
  const ticks = [-50, -30, -12, 6, 22, 38, 50].map((d) => { const [x0, y0] = p(d, 23), [x1, y1] = p(d, 27); return `M${x0} ${y0} L${x1} ${y1}` }).join(' ')
  el.innerHTML = '<span class="clip">CLIP</span><div class="m-bar"><i class="fill"></i></div>' +
    `<div class="m-led">${Array.from({ length: LEDS }, (_, i) => `<i class="${i < 10 ? 'g' : i < 14 ? 'y' : 'r'}"></i>`).join('')}</div>` +
    '<svg class="m-vu" viewBox="-40 -6 80 44" aria-hidden="true"><rect class="vf" x="-40" y="-6" width="80" height="44" rx="5"/><rect class="vs" x="-40" y="-6" width="80" height="44" rx="5"/>' +
    `<path class="va" stroke-width="1.6" d="${arcAt(25, -50, 22)}"/><path class="va" stroke-width="4.2" d="${arcAt(25, 22, 50)}"/><path class="vt" stroke-width="1.4" d="${ticks}"/>` +
    '<text x="0" y="22" text-anchor="middle">VU</text><line class="vn" x1="0" y1="30" x2="0" y2="-1"/><circle class="vp" cx="0" cy="30" r="3"/></svg>' +
    `<span class="m-l">${el.dataset.label}</span><output class="m-v">−∞</output>`
}
const peakDB = (p) => (p > 0 ? 20 * Math.log10(p) : -Infinity)
function meterOf(id) {
  const el = $(id)
  buildMeter(el)
  const fill = el.querySelector('.fill'), clip = el.querySelector('.clip'), leds = [...el.querySelectorAll('.m-led i')]
  const needle = el.querySelector('.vn'), value = el.querySelector('.m-v')
  let shown = -Infinity, clipUntil = 0, lit = -1, lastText = 0
  return (peak, clipped) => {
    const db = peakDB(peak)
    shown = db > shown ? db : shown - 1.2 // a falling bar, about 70 dB a second
    const t = Math.max(0, Math.min(1, (shown + 60) / 60))
    fill.style.height = `${(t * 100).toFixed(1)}%`
    const n = Math.round(t * LEDS)
    if (n !== lit) { leds.forEach((l, i) => l.classList.toggle('on', i < n)); lit = n }
    needle.setAttribute('transform', `rotate(${(-50 + 100 * Math.max(0, Math.min(1, (shown + 26) / 26))).toFixed(1)} 0 30)`)
    const now = performance.now()
    if (now - lastText > 120) { value.textContent = Number.isFinite(shown) && shown > -60 ? Math.round(shown).toString().replace('-', '−') : '−∞'; lastText = now }
    if (clipped) clipUntil = now + 1500
    clip.classList.toggle('lit', now < clipUntil)
  }
}
let meterIn = null, meterOut = null
const meters = { inPeak: 0, inRaw: 0, input(p, raw) { this.inPeak = Math.max(this.inPeak, p); this.inRaw = Math.max(this.inRaw, raw) } }
let scratch = null
function meterLoop() {
  // The input clips when the source itself does (the interface or file at full scale).
  meterIn(meters.inPeak, meters.inRaw >= 0.999)
  meters.inPeak = 0; meters.inRaw = 0
  scratch ??= new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(scratch)
  let p = 0
  for (const v of scratch) { const a = Math.abs(v); if (a > p) p = a }
  meterOut(p, p >= 0.999)
  requestAnimationFrame(meterLoop)
}

// ------------------------------------------------------------------------------------------------- the look menu
// Rig's own choices (its finish and its drawings) stay in this browser; the suite's (look, fonts, accent, density)
// follow look.js: Rig's own, or the suite look while "Use this look in every CRBN app" is on.
const RIG_KEY = 'crbn-rig/rig'
const RIG_DEFAULTS = { finish: 'look', custom: DEFAULT_CUSTOM, layout: 'b', amp: 'b', meters: 'b' }
const abc = (v) => (/^[abc]$/.test(v) ? v : 'b')
function loadRig() {
  let r = {}
  try { r = JSON.parse(localStorage.getItem(RIG_KEY) ?? '{}') ?? {} } catch { /* the defaults */ }
  return {
    finish: FINISHES.some((f) => f.id === r.finish) ? r.finish : 'look',
    custom: HEX_RE.test(r.custom ?? '') ? r.custom.toLowerCase() : DEFAULT_CUSTOM,
    layout: abc(r.layout), amp: abc(r.amp), meters: abc(r.meters),
  }
}
let rig = { ...RIG_DEFAULTS }, prefs = null, every = false, keepRig = true, keepPrefs = true
const saveRig = () => { if (keepRig) try { localStorage.setItem(RIG_KEY, JSON.stringify(rig)) } catch { /* not remembered */ } }

function applyAll() {
  const { look, accent } = applyPrefs(prefs)
  root.dataset.layout = rig.layout; root.dataset.amp = rig.amp; root.dataset.meters = rig.meters
  const hex = finishHex(rig, look.id)
  for (const [k, v] of Object.entries(finishVars(hex))) root.style.setProperty(k, v)
  // A suite accent the person chose wins over the finish on the controls; the faceplate keeps the finish.
  root.style.setProperty('--accent', accent ?? hex)
  root.style.setProperty('--accent-ink', inkFor(accent ?? hex))
  syncMenu(look, hex, accent)
}
function commitPrefs() { if (keepPrefs) savePrefs(prefs, every); applyAll() }

function buildMenu() {
  const data = looks()
  $('lm-looks').innerHTML = lookList().map((l) => `<button type="button" class="lm-card" data-look="${l.id}" aria-pressed="false" title="${l.blurb}"><span class="sw3">${(l.swatch ?? []).map((c) => `<i style="background:${c}"></i>`).join('')}</span>${l.label}</button>`).join('')
  $('lm-finish').innerHTML = FINISHES.map((f) => `<button type="button" class="lm-chip" data-finish="${f.id}" aria-pressed="false"><i class="${f.id === 'custom' ? 'wheel-dot' : ''}"${f.hex ? ` style="background:${f.hex}"` : ''}></i>${f.label}</button>`).join('')
  $('lm-accent').innerHTML = data.accents.map((a) => `<button type="button" class="lm-chip" data-accent="${a.id}" aria-pressed="false"><i${a.hex ? ` style="background:${a.hex}"` : ' data-finish-dot'}></i>${a.id === 'look' ? 'Rig’s finish' : a.label}</button>`).join('')
  for (const role of ['display', 'ui', 'mono']) {
    const sel = $(`lm-${role}`)
    sel.innerHTML = '<option value="">The look’s own</option>' + data.fonts[role].filter((f) => f.id !== 'helvetica-xc').map((f) => `<option value="${f.id}">${f.label}</option>`).join('')
    sel.addEventListener('change', () => { prefs[role] = sel.value || null; commitPrefs() })
  }
  $('lm-looks').addEventListener('click', (e) => { const b = e.target.closest('[data-look]'); if (b) { prefs.look = b.dataset.look; commitPrefs() } })
  $('lm-finish').addEventListener('click', (e) => {
    const b = e.target.closest('[data-finish]')
    if (!b) return
    rig.finish = b.dataset.finish; saveRig(); applyAll()
    if (rig.finish === 'custom') drawWheel()
  })
  $('lm-accent').addEventListener('click', (e) => { const b = e.target.closest('[data-accent]'); if (b) { prefs.accent = b.dataset.accent; commitPrefs() } })
  for (const seg of document.querySelectorAll('.segmented[data-rig]')) {
    seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-value]'); if (b) { rig[seg.dataset.rig] = b.dataset.value; saveRig(); applyAll() } })
  }
  $('lm-density').addEventListener('click', (e) => { const b = e.target.closest('button[data-value]'); if (b) { prefs.density = b.dataset.value; commitPrefs() } })
  $('lm-suite').addEventListener('change', (e) => {
    every = e.target.checked
    if (every) setEvery(true, prefs)
    else { setEvery(false, prefs); prefs = ownPrefs() }
    applyAll()
  })
  $('lm-reset').addEventListener('click', () => {
    prefs = sanitize({}); rig = { ...RIG_DEFAULTS }
    saveRig(); commitPrefs()
  })
  $('look-open').addEventListener('click', () => openMenu($('look-menu').hidden))
  $('look-close').addEventListener('click', () => openMenu(false))
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('look-menu').hidden) { openMenu(false); $('look-open').focus() } })
  addEventListener('pointerdown', (e) => {
    if (!$('look-menu').hidden && !e.target.closest('#look-menu, #look-open')) openMenu(false)
  })
  // Another CRBN app may have changed the suite look while this page was in the background.
  addEventListener('focus', () => {
    const now = loadPrefs()
    if (now.every !== every || (now.every && JSON.stringify(now.prefs) !== JSON.stringify(prefs))) {
      every = now.every; prefs = now.every ? now.prefs : ownPrefs(); applyAll()
    }
  })
  wireWheel()
}
function openMenu(open) {
  $('look-menu').hidden = !open
  $('look-open').setAttribute('aria-expanded', String(open))
  if (open) { if (rig.finish === 'custom') drawWheel(); $('lm-looks').querySelector('[aria-pressed="true"]')?.focus() }
}
function syncMenu(look, hex, accent) {
  const press = (sel, on) => { for (const b of document.querySelectorAll(sel)) b.setAttribute('aria-pressed', String(on(b))) }
  press('#lm-looks [data-look]', (b) => b.dataset.look === look.id)
  // Each look card's third swatch is the colour Rig's controls take in that look.
  for (const b of document.querySelectorAll('#lm-looks [data-look]')) {
    const sw = b.querySelectorAll('.sw3 i')[2]
    if (sw) sw.style.background = accent ?? finishHex(rig, b.dataset.look)
  }
  press('#lm-finish [data-finish]', (b) => b.dataset.finish === rig.finish)
  press('#lm-accent [data-accent]', (b) => b.dataset.accent === prefs.accent)
  const own = document.querySelector('#lm-finish [data-finish="look"] i')
  if (own) own.style.background = finishHex({ finish: 'look' }, look.id)
  const dot = document.querySelector('#lm-accent [data-finish-dot]')
  if (dot) dot.style.background = hex
  for (const seg of document.querySelectorAll('.segmented[data-rig] button')) seg.setAttribute('aria-checked', String(rig[seg.parentElement.dataset.rig] === seg.dataset.value))
  for (const b of document.querySelectorAll('#lm-density button')) b.setAttribute('aria-checked', String(b.dataset.value === prefs.density))
  for (const role of ['display', 'ui', 'mono']) {
    const sel = $(`lm-${role}`)
    sel.value = prefs[role] ?? ''
    sel.options[0].textContent = `The look’s own (${fontOf(role, look.fonts[role]).label})`
  }
  $('lm-suite').checked = every
  $('lm-suite-note').textContent = sharesAcrossApps()
    ? (every ? 'On: your look, fonts, accent and density follow you into every CRBN app on carbonlinear.com. Rig’s finish and drawing stay Rig’s.' : 'Off: CRBN Rig keeps a look of its own.')
    : 'Here this keeps the look in this browser only; on carbonlinear.com it reaches every CRBN app.'
  const note = $('lm-finish-note')
  note.hidden = !accent
  if (accent) note.textContent = 'Your accent colours the controls; the finish still colours the faceplate and lamps. Pick “Rig’s finish” under Accent to give the finish the controls too.'
  $('lm-custom').hidden = rig.finish !== 'custom'
  if (rig.finish === 'custom') syncWheel()
}

// the custom colour: a wheel, hue / saturation / brightness and a hex field, with how its text reads and how near it
// sits to a warning or to another app's colour
let hsv = [0, 0, 0], wheelDrawn = false, rigTimer = 0
function drawWheel() {
  if (wheelDrawn) return
  const c = $('wheel-canvas'), dpr = Math.min(2, devicePixelRatio || 1), n = Math.round(150 * dpr)
  c.width = c.height = n
  const g = c.getContext('2d'), img = g.createImageData(n, n), R = n / 2
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - R + 0.5, dy = y - R + 0.5, r = Math.hypot(dx, dy) / R, i = (y * n + x) * 4
      if (r > 1) continue
      const [rr, gg, bb] = hsv2rgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, r, 1)
      img.data[i] = rr; img.data[i + 1] = gg; img.data[i + 2] = bb; img.data[i + 3] = r > 0.985 ? Math.round((255 * (1 - r)) / 0.015) : 255
    }
  }
  g.putImageData(img, 0, 0)
  wheelDrawn = true
}
function syncWheel(from) {
  const hex = rig.custom
  if (from !== 'hsv') { const v = rgb2hsv(hex2rgb(hex)); hsv = [v[1] ? v[0] : hsv[0], v[1], v[2]] }
  const [h, s, v] = hsv, g = (hh, ss, vv) => rgb2hex(...hsv2rgb(hh, ss, vv))
  if (from !== 'hex') { $('cu-hex').value = hex; $('cu-hex').removeAttribute('aria-invalid') }
  $('cu-h').value = Math.round(h); $('cu-s').value = Math.round(s * 100); $('cu-v').value = Math.round(v * 100)
  $('cu-ho').textContent = `${Math.round(h)}°`; $('cu-so').textContent = `${Math.round(s * 100)}%`; $('cu-vo').textContent = `${Math.round(v * 100)}%`
  $('cu-h').style.setProperty('--trk', `linear-gradient(90deg, ${[0, 60, 120, 180, 240, 300, 360].map((x) => g(x, Math.max(s, 0.35), Math.max(v, 0.5))).join(', ')})`)
  $('cu-s').style.setProperty('--trk', `linear-gradient(90deg, ${g(h, 0, v)}, ${g(h, 1, v)})`)
  $('cu-v').style.setProperty('--trk', `linear-gradient(90deg, #000000, ${g(h, s, 1)})`)
  $('wheel-dim').style.opacity = String(1 - v)
  const mark = $('wheel-mark'), R = 75
  mark.style.left = `${R + s * R * Math.cos((h * Math.PI) / 180)}px`; mark.style.top = `${R + s * R * Math.sin((h * Math.PI) / 180)}px`; mark.style.background = hex
  $('cu-read').innerHTML = readouts(hex).map((r) => `<div><span>${r.label}</span><b>${r.value}</b><em class="${r.close ? 'close' : ''}">${r.word}</em></div>`).join('')
}
function setCustom(hex, from) {
  rig.custom = hex
  applyAll()
  if (from) syncWheel(from)
  clearTimeout(rigTimer); rigTimer = setTimeout(saveRig, 250)
}
function wireWheel() {
  const wheel = $('wheel')
  let dragging = false
  const at = (e) => {
    const r = wheel.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - r.left - R, dy = e.clientY - r.top - R
    hsv[0] = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360
    hsv[1] = Math.min(1, Math.hypot(dx, dy) / R)
    if (hsv[2] < 0.05) hsv[2] = 0.85
    setCustom(rgb2hex(...hsv2rgb(...hsv)), 'hsv')
  }
  wheel.addEventListener('pointerdown', (e) => { dragging = true; wheel.setPointerCapture(e.pointerId); at(e) })
  wheel.addEventListener('pointermove', (e) => { if (dragging) at(e) })
  wheel.addEventListener('pointerup', () => { dragging = false })
  wheel.addEventListener('pointercancel', () => { dragging = false })
  for (const [id, k, scale] of [['cu-h', 0, 1], ['cu-s', 1, 100], ['cu-v', 2, 100]]) {
    $(id).addEventListener('input', (e) => { hsv[k] = Number(e.target.value) / scale; setCustom(rgb2hex(...hsv2rgb(...hsv)), 'hsv') })
  }
  $('cu-hex').addEventListener('input', (e) => {
    let v = e.target.value.trim().toLowerCase()
    if (v && v[0] !== '#') v = '#' + v
    const ok = HEX_RE.test(v)
    e.target.setAttribute('aria-invalid', String(!ok && v.length >= 7))
    if (ok) setCustom(v, 'hex')
  })
}

// ------------------------------------------------------------------------------------------------- the rest
let toastTimer = 0
function toast(text, kind = 'error') {
  const t = $('toast')
  t.textContent = text; t.className = `toast ${kind === 'info' ? 'info' : ''}`; t.hidden = false
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true }, 7000)
}

async function start() {
  await loadLooks()
  // ?look=, ?layout=, ?amp=, ?meters= and ?finish= show a look, drawing or finish for a scripted screenshot without
  // keeping it; ?example shows the example capture loaded (no audio starts).
  const query = new URLSearchParams(location.search)
  ;({ prefs, every } = loadPrefs())
  rig = loadRig()
  if (query.has('look')) { prefs = { ...prefs, look: query.get('look') }; prefs = sanitize(prefs); keepPrefs = false }
  for (const k of ['layout', 'amp', 'meters']) if (query.has(k)) { rig[k] = abc(query.get(k)); keepRig = false }
  if (query.has('finish')) {
    const f = query.get('finish')
    if (HEX_RE.test('#' + f)) { rig.finish = 'custom'; rig.custom = '#' + f.toLowerCase() } else if (FINISHES.some((x) => x.id === f)) rig.finish = f
    keepRig = false
  }
  buildMenu()
  applyAll()
  if (query.has('menu')) openMenu(true)

  for (const el of document.querySelectorAll('.knob[data-param]')) makeKnob(el)
  for (const box of document.querySelectorAll('input[type=checkbox][data-param]')) box.addEventListener('change', () => setSetting(box.dataset.param, box.checked ? 1 : 0))
  for (const seg of document.querySelectorAll('.segmented[data-param]')) {
    for (const b of seg.querySelectorAll('button')) b.addEventListener('click', () => setSetting(seg.dataset.param, +b.dataset.value))
  }
  for (const name of Object.keys(PAGE_DEFAULTS)) reflect(name)
  meterIn = meterOf('meter-in'); meterOut = meterOf('meter-out')

  wireFiles()
  $('play-guitar').addEventListener('click', playGuitar)
  $('play-demo').addEventListener('click', toggleDemo)
  $('stop').addEventListener('click', stopAll)
  $('input-device').addEventListener('change', () => { if (micStream) openMic($('input-device').value).catch((e) => toast(String(e?.message ?? e))) })
  navigator.mediaDevices?.addEventListener?.('devicechange', () => { if (micStream) listDevices($('input-device').value) })
  for (const id of ['about-open', 'about-open-2']) $(id).addEventListener('click', () => $('about').showModal())
  if (hubApp) {
    const openApp = (e) => { e?.preventDefault(); window.open(`pavillion://app/${hubApp}`) }
    const desktop = $('desktop-link')
    desktop.textContent = 'Open the installed app'
    desktop.addEventListener('click', openApp)
    $('hub-open-app').addEventListener('click', openApp)
    $('hub-open-browser').addEventListener('click', () => window.open(location.href))
  }

  try {
    const b = await (await fetch('build.json')).json()
    $('version').textContent = b.version
    $('about-build').textContent = `Version ${b.version} · build ${b.build}`
  } catch { /* a dev serve without build.json */ }

  if (query.has('example')) await loadExample()
  // The person's last capture and IR, if this browser remembered them.
  const c = query.has('example') ? null : await recallFile('capture')
  if (c) { try { await useCapture(c.name, new Uint8Array(c.bytes), { remember: false }) } catch { await forgetFile('capture') } }
  const i = await recallFile('ir')
  if (i) { try { await useIR(i.name, new Uint8Array(i.bytes), { remember: false }) } catch { await forgetFile('ir') } }
  showCapture(); showIR(); updateStatus()
  root.dataset.ready = 'true'
}

start().catch((err) => toast(`CRBN Rig could not start: ${err?.message ?? err}`))
