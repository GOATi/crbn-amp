// CRBN Rig's page (D-CRBN-021 (d)): the signal chain, the audio graph and the files.
//
//   source (the guitar through getUserMedia, or the demo riff) -> AudioWorkletNode 'crbn-rig' (rig-processor.js: input
//   gain, gate, capture, EQ, DC blocker, output gain) -> ConvolverNode (the cabinet IR, scaled and truncated as the
//   desktop's ImpulseResponse does) -> AnalyserNode (the output meter) -> the speakers.
import { DEFAULTS } from './engine.js'
import { scaledIR } from './ir.js'
import { applyLook, loadLooks, lookList, savedLook } from './look.js'
import { forgetFile, loadSettings, recallFile, rememberFile, saveSettings } from './store.js'

const $ = (id) => document.getElementById(id)
const ENGINE_PARAMS = Object.keys(DEFAULTS)

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
const knobs = new Map()
const fmt = (v, unit, step) => {
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const s = (unit === 'dB' || unit === 'dBu') && v > 0 ? '+' : ''
  return `${s}${v.toFixed(d)}${unit ? ' ' + unit : ''}`
}
function makeKnob(el) {
  const name = el.dataset.param, min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step, unit = el.dataset.unit ?? ''
  const A0 = -135, A1 = 135, R = 26, C = 32
  const xy = (deg, r = R) => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)]
  const arc = (a, b) => { const [x0, y0] = xy(a), [x1, y1] = xy(b); return `M${x0} ${y0} A${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${x1} ${y1}` }
  el.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><path class="track" d="${arc(A0, A1)}"/><path class="arc"/>` +
    `<circle class="cap" cx="32" cy="32" r="18"/><line class="pointer" x1="32" y1="32" x2="32" y2="18"/></svg>` +
    `<span class="label"></span><output></output>`
  el.querySelector('.label').textContent = el.dataset.label
  el.setAttribute('role', 'slider'); el.tabIndex = 0
  el.setAttribute('aria-label', `${el.closest('.stage')?.querySelector('h2')?.textContent ?? ''} ${el.dataset.label}`.trim())
  el.setAttribute('aria-valuemin', min); el.setAttribute('aria-valuemax', max)
  const out = el.querySelector('output'), arcEl = el.querySelector('.arc'), ptr = el.querySelector('.pointer')
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  const draw = (v) => {
    const t = (v - min) / (max - min), a = A0 + t * (A1 - A0)
    // Bipolar controls (dB around 0) light from the centre; the rest from the start.
    const from = min < 0 && max > 0 && unit !== 'dBu' ? A0 + ((0 - min) / (max - min)) * (A1 - A0) : A0
    arcEl.setAttribute('d', Math.abs(a - from) < 0.5 ? '' : arc(Math.min(from, a), Math.max(from, a)))
    const [x, y] = xy(a, 13); ptr.setAttribute('x2', x); ptr.setAttribute('y2', y)
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

function reflect(name) {
  const v = settings[name]
  knobs.get(name)?.(v)
  for (const box of document.querySelectorAll(`input[type=checkbox][data-param="${name}"]`)) box.checked = v > 0.5
  for (const b of document.querySelectorAll(`.segmented[data-param="${name}"] button`)) b.setAttribute('aria-checked', String(+b.dataset.value === v))
  const stage = { gateOn: 'stage-gate', eqOn: 'stage-eq', irOn: 'stage-ir' }[name]
  if (stage) $(stage).classList.toggle('off', v < 0.5)
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
  const playing = ctx && ctx.state === 'running' && (micSource || demoSource)
  $('status').classList.toggle('live', Boolean(playing))
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
function showCapture(note) {
  const drop = $('capture-drop')
  const has = Boolean(capture.bytes)
  drop.classList.toggle('has', has)
  drop.querySelector('.empty').hidden = has
  drop.querySelector('.loaded').hidden = !has
  $('capture-kind').hidden = true
  if (!has) { $('slim').hidden = true; return }
  const m = capture.meta ?? {}
  // NAM Core's example names itself "Test Model"; the page calls it what it is.
  $('capture-name').textContent = capture.example ? 'Example capture' : m.name || capture.name.replace(/\.nam$/i, '')
  const chips = $('capture-chips'); chips.innerHTML = ''
  for (const c of [TYPES[m.gear_type] ?? m.gear_type, m.tone_type?.replace(/_/g, ' ')].filter(Boolean)) {
    const li = document.createElement('li'); li.textContent = c; chips.append(li)
  }
  const gear = [m.gear_make, m.gear_model].filter(Boolean).join(' ')
  const lines = []
  if (note) lines.push(note)
  if (gear) lines.push(gear)
  if (m.modeled_by) lines.push(`Captured by ${m.modeled_by}`)
  if (capture.example) lines.push('From Neural Amp Modeler Core: drop your own capture to replace it')
  if (capture.info?.sampleRate && ctx && Math.abs(capture.info.sampleRate - ctx.sampleRate) > 1) lines.push(`Recorded at ${capture.info.sampleRate / 1000} kHz, resampled`)
  $('capture-meta').textContent = lines.join(' · ')
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
  if (!has) return
  $('ir-name').textContent = ir.name.replace(/\.wav$/i, '')
  $('ir-meta').textContent = ir.seconds ? `${Math.round(ir.seconds * 1000)} ms impulse response` : 'Impulse response'
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
  // Drop anywhere: a .nam is a capture, a .wav an IR; a drop zone takes its own kind.
  let depth = 0
  addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { depth++; document.body.classList.add('dragging') } })
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging') } })
  addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault() })
  addEventListener('drop', (e) => {
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging')
    for (const d of document.querySelectorAll('.drop.over')) d.classList.remove('over')
    const file = e.dataTransfer?.files[0]
    if (file) takeFile(file, e.target.closest?.('.drop')?.dataset.slot)
  })
  for (const zone of document.querySelectorAll('.drop')) {
    zone.addEventListener('dragover', () => zone.classList.add('over'))
    zone.addEventListener('dragleave', () => zone.classList.remove('over'))
  }
}

// ------------------------------------------------------------------------------------------------- meters
const peakDB = (p) => (p > 0 ? 20 * Math.log10(p) : -Infinity)
const width = (db) => `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`
function meterOf(id) {
  const el = $(id), fill = el.querySelector('.fill'), clip = el.querySelector('.clip')
  let shown = -Infinity, clipUntil = 0
  return (peak, clipped) => {
    const db = peakDB(peak)
    shown = db > shown ? db : shown - 1.2 // a falling bar, about 70 dB a second
    fill.style.width = width(shown)
    const now = performance.now()
    if (clipped) clipUntil = now + 1500
    const on = now < clipUntil
    if (clip.hidden === on) { clip.hidden = !on; el.classList.toggle('has-clip', on) }
  }
}
const meterIn = meterOf('meter-in'), meterOut = meterOf('meter-out')
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

// ------------------------------------------------------------------------------------------------- the rest
let toastTimer = 0
function toast(text, kind = 'error') {
  const t = $('toast')
  t.textContent = text; t.className = `toast ${kind === 'info' ? 'info' : ''}`; t.hidden = false
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true }, 7000)
}

async function start() {
  await loadLooks()
  const sel = $('look')
  for (const l of lookList()) { const o = document.createElement('option'); o.value = l.id; o.textContent = l.label; o.title = l.blurb; sel.append(o) }
  // ?look=<id> picks a look for a scripted screenshot; ?example shows the example capture loaded (no audio starts).
  const query = new URLSearchParams(location.search)
  sel.value = applyLook(query.get('look') ?? savedLook()).id
  sel.addEventListener('change', () => { applyLook(sel.value) })

  for (const el of document.querySelectorAll('.knob[data-param]')) makeKnob(el)
  for (const box of document.querySelectorAll('input[type=checkbox][data-param]')) box.addEventListener('change', () => setSetting(box.dataset.param, box.checked ? 1 : 0))
  for (const seg of document.querySelectorAll('.segmented[data-param]')) {
    for (const b of seg.querySelectorAll('button')) b.addEventListener('click', () => setSetting(seg.dataset.param, +b.dataset.value))
  }
  for (const name of Object.keys(PAGE_DEFAULTS)) reflect(name)

  wireFiles()
  $('play-guitar').addEventListener('click', playGuitar)
  $('play-demo').addEventListener('click', toggleDemo)
  $('stop').addEventListener('click', stopAll)
  $('input-device').addEventListener('change', () => { if (micStream) openMic($('input-device').value).catch((e) => toast(String(e?.message ?? e))) })
  navigator.mediaDevices?.addEventListener?.('devicechange', () => { if (micStream) listDevices($('input-device').value) })
  for (const id of ['about-open', 'about-open-2']) $(id).addEventListener('click', () => $('about').showModal())
  if (hubApp) {
    const openApp = (e) => { e?.preventDefault(); window.open(`pavillion://app/${hubApp}`) }
    const desktop = document.querySelector('.actions a.btn')
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
  showCapture(); showIR()
  document.documentElement.dataset.ready = 'true'
}

start().catch((err) => toast(`CRBN Rig could not start: ${err?.message ?? err}`))
