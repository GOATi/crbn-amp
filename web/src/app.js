// CRBN Rig's page (D-CRBN-021 (d)): the signal chain, the audio graph and the files, drawn to the owner's picks
// (D-RIG-008): the amp's faceplate, LED meters and the Amp front layout by default, each a person's choice in the look
// menu with Rig's finish (finish.js) and the suite's look (look.js, D-CRBN-023 / D-CRBN-024).
//
// The same page is the desktop app's window (D-RIG-017, build plan R2). Its audio is one of two backends with the same
// calls: audio-web.js in a browser (the engine in an AudioWorklet, Web Audio around it), or audio-desktop.js inside
// crbn-rig.exe (the engine compiled into the app, through the audio driver).
import { createDesktopAudio, inDesktopApp } from './audio-desktop.js'
import { createWebAudio } from './audio-web.js'
import { DEFAULTS, MUTED } from './engine.js'
import { DEFAULT_CUSTOM, FINISHES, HEX_RE, finishHex, finishVars, hex2rgb, hsv2rgb, inkFor, readouts, rgb2hex, rgb2hsv } from './finish.js'
import { DEFAULT_KIT, KIT_LIST, KIT_PARTS, SALVAGE_CHOICES, SALVAGE_DEFAULTS, artTemplate, createHardware } from './hw/hw.js'
import { ART_NAME_MAX, ART_TYPES, MAX_KITS, NAME_MAX, artURL, artURLNow, importArt, isOwnId, loadKits, makeKit, readCode, saveKits, sameKit, shareCode, tidyArt } from './kits.js'
import { createLibrary } from './library.js'
import { createLibraryView } from './library-view.js'
import { applyPrefs, fontOf, loadLooks, loadPrefs, lookList, looks, ownPrefs, sanitize, savePrefs, setEvery, sharesAcrossApps } from './look.js'
import { PADS, captureKey, createPadsView, createStandby } from './pads.js'
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
  if (ENGINE_PARAMS.includes(name)) audio.setParam(name, value)
  if (name === 'irOn') audio.setIROn(value > 0.5)
  if (name === 'guardOn' || name === 'autoOff') { syncProtection(); syncPower() }
  reflect(name)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveSettings(settings), 300)
}

// ------------------------------------------------------------------------------------------------- knobs
// The page's own knobs: arc knobs for the islands and the stripe, and the setup's calibration. With the Hardware
// drawing (the default) the amp's knobs are the kit's own, drawn by hw/hw.js and bound to the same settings.
const knobs = new Map()
const fmt = (v, unit, step) => {
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const s = (unit === 'dB' || unit === 'dBu') && v > 0 ? '+' : ''
  return `${s}${v.toFixed(d)}${unit ? ' ' + unit : ''}`
}
const polar = (deg, r, c = 32) => [c + r * Math.sin((deg * Math.PI) / 180), c - r * Math.cos((deg * Math.PI) / 180)]
function makeKnob(el) {
  const name = el.dataset.param, min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step, unit = el.dataset.unit ?? ''
  const A0 = -135, A1 = 135, R = 26
  const arc = (a, b) => { const [x0, y0] = polar(a, R), [x1, y1] = polar(b, R); return `M${x0} ${y0} A${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${x1} ${y1}` }
  el.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    `<g class="k-arc"><path class="track" d="${arc(A0, A1)}"/><path class="arc"/><circle class="cap" cx="32" cy="32" r="18"/><line class="pointer" x1="32" y1="32" x2="32" y2="18"/></g>` +
    '</svg><span class="label"></span><output></output>'
  el.querySelector('.label').textContent = el.dataset.label
  el.setAttribute('role', 'slider'); el.tabIndex = 0
  el.setAttribute('aria-label', el.dataset.aria ?? el.dataset.label)
  el.setAttribute('aria-valuemin', min); el.setAttribute('aria-valuemax', max)
  const out = el.querySelector('output'), arcEl = el.querySelector('.arc'), ptr = el.querySelector('.pointer')
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  const draw = (v) => {
    const t = (v - min) / (max - min), a = A0 + t * (A1 - A0)
    // Bipolar controls (dB around 0) light from the centre; the rest from the start.
    const from = min < 0 && max > 0 && unit !== 'dBu' ? A0 + ((0 - min) / (max - min)) * (A1 - A0) : A0
    arcEl.setAttribute('d', Math.abs(a - from) < 0.5 ? '' : arc(Math.min(from, a), Math.max(from, a)))
    const [x, y] = polar(a, 13); ptr.setAttribute('x2', x); ptr.setAttribute('y2', y)
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
  hardware?.reflect(name, v)
}

// ------------------------------------------------------------------------------------------------- Rig's hardware
// The kit drawn on the amp and the cabinet (hw/hw.js). Its knobs take each setting's range from the page's own knob,
// and its Power and Standby switches are the amp's (below).
let hardware = null
const specs = {}
function specOf(name) {
  if (specs[name]) return specs[name]
  const el = document.querySelector(`.knob[data-param="${name}"]`)
  if (!el) return null
  const min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step, unit = el.dataset.unit ?? ''
  return (specs[name] = { min, max, step, unit, def: PAGE_DEFAULTS[name], text: (v) => fmt(v, unit, step) })
}
function changeSetting(name, value) {
  const sp = specOf(name)
  setSetting(name, sp ? Math.min(sp.max, Math.max(sp.min, Math.round(value / sp.step) * sp.step)) : value)
}
// ------------------------------------------------------------------------------------------------- power (U1)
// The amp's power and standby (build plan R3, P3-UX U1), drawn as the person picked (D-RIG-008 (d)): a pilot lamp and
// Power and Standby toggles on the amp (B, the default; on the hardware they are the kit's own), a pill in the header
// (A), or a big button at the start of the chain (C), with Space as the key for each. Power off stops what is playing,
// and on again resumes it. Standby is the engine's: the output fades out over 20 ms and the input stays open. The
// squeal guard and auto-off (the engine's too, rig_guard.h) mute the output the same way and the banner says why, in
// words; one click, or Space, brings the output back. Auto-off also mutes when the input device goes away.
let power = true, standby = false, resumeWith = null
let muted = null // why the output is muted, { why: 'squeal' | 'silence' | 'hum' | 'device', hz, seconds }, or null
let lifted = null // the engine's trip count when the person last turned the output back on, until it says unmuted
let lastStatus = null // the engine's last status (engine.js status())
function setPower(on) {
  if (on === power) return
  power = on
  hardware?.setPower(on)
  if (!on) {
    resumeWith = audio.source
    stopAll()
  } else {
    liftMute()
    if (resumeWith) {
      const what = resumeWith
      resumeWith = null
      if (what === 'demo') toggleDemo(); else playGuitar()
    }
  }
  syncPower()
}
/** The person's Standby switch. Taking the amp out of standby also lifts a mute. */
function setStandby(on) {
  standby = on
  if (!on) liftMute()
  audio.setStandby(on)
  syncPower()
  updateStatus()
}
function liftMute() {
  const was = muted
  muted = null
  audio.resume?.()
  lifted = lastStatus?.trips ?? 0
  // An input device that went away is opened again (the default one, in a browser).
  if (was?.why === 'device' && !desktop && power) playGuitar()
}
/** "Turn back on": the banner's button, the pill, the big button and Space. */
function turnBackOn() {
  if (!power) { setPower(true); return }
  setStandby(false)
}
function powerKey() {
  if (!power) setPower(true)
  else if (muted || standby) turnBackOn()
  else setStandby(true)
}
// What the engine or the input device muted the output for, said in the banner.
function setMuted(m) {
  muted = m
  syncPower()
  updateStatus()
}
// Playing turns the amp on.
function powerUp() { if (!power) { power = true; resumeWith = null; hardware?.setPower(true); syncPower() } }

const hzWords = (hz) => (hz >= 1000 ? `${(hz / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : `${Math.round(hz)} Hz`)
function bannerWords() {
  if (!muted) return { title: 'Standby.', body: 'The output faded out; the input stays open, so you can change cables safely.' }
  if (muted.why === 'squeal') {
    return { title: 'The squeal guard muted the output.', body: `A feedback tone at ${hzWords(muted.hz)} held for ${Math.round(muted.seconds * 1000)} ms. Turn down, or move away from the speaker, then turn back on.` }
  }
  if (muted.why === 'silence') return { title: 'Auto-off: the input went dead after a loud pop.', body: 'That is how a cable pulled from the interface sounds. Plug back in, then turn back on.' }
  if (muted.why === 'hum') return { title: `Auto-off: the input turned to ${Math.round(muted.hz)} Hz mains hum after a loud pop.`, body: 'That is how a cable pulled from the guitar sounds. Plug back in, then turn back on.' }
  return desktop
    ? { title: 'Auto-off: the audio device stopped.', body: 'Plug your interface back in, or pick it in Audio settings, then turn back on.' }
    : { title: 'Auto-off: your input device went away.', body: 'It was unplugged, or another app took it. Plug it back in, then turn back on.' }
}
const STATE_WORDS = { on: 'On', standby: 'Standby', muted: 'Muted', off: 'Off' }
function powerState() { return !power ? 'off' : muted ? 'muted' : standby ? 'standby' : 'on' }
// Every power drawing, the kit's switches and pilot, and the banner, from one state.
function syncPower() {
  const st = powerState(), word = STATE_WORDS[st]
  root.dataset.powerState = st
  hardware?.setPower(power)
  hardware?.setStandby(standby || Boolean(muted))
  hardware?.setPilot(word)
  for (const b of document.querySelectorAll('[data-pw-main]')) {
    b.setAttribute('aria-pressed', String(st === 'on'))
    b.dataset.state = st
    b.querySelector('.pw-word').textContent = word
    b.title = st === 'on' ? 'On: Space puts the amp in standby' : 'Turn back on (Space)'
  }
  for (const w of document.querySelectorAll('[data-pw-word]')) w.textContent = word
  $('pw-jewel')?.classList.toggle('off', st !== 'on')
  const pb = document.querySelector('.pw-bat[data-pw="power"]'), sb = document.querySelector('.pw-bat[data-pw="standby"]')
  if (pb) { pb.setAttribute('aria-pressed', String(power)); pb.querySelector('small').textContent = power ? 'On' : 'Off' }
  if (sb) { sb.setAttribute('aria-pressed', String(st === 'on')); sb.querySelector('small').textContent = st === 'on' ? 'Play' : st === 'muted' ? 'Muted' : 'Standby' }
  const guard = $('pw-guard-word')
  if (guard) guard.textContent = settings.guardOn < 0.5 ? 'Squeal guard off' : muted?.why === 'squeal' ? 'Squeal guard tripped' : 'Squeal guard on'
  // The banner: why the output is quiet, and the way back.
  const banner = $('banner'), show = power && (muted || standby)
  banner.hidden = !show
  if (show) {
    const { title, body } = bannerWords()
    $('banner-title').textContent = title
    $('banner-body').textContent = body
    banner.dataset.kind = muted ? 'muted' : 'standby'
    banner.setAttribute('role', muted ? 'alert' : 'status')
  }
  rememberPlaying()
}

// The desktop app plays the guitar when it opens if it was playing when it last closed (the owner's word, R3): it
// keeps whether the guitar is playing, out of standby and unmuted, as it changes.
const PLAYING_KEY = 'crbn-rig/playing'
// Read before anything plays or stops (the backends' first messages arrive after this module has run).
const playAtOpen = (() => { try { return localStorage.getItem(PLAYING_KEY) === '1' } catch { return false } })()
function rememberPlaying() {
  if (!desktop) return
  const playing = power && !standby && !muted && audio.source === 'guitar'
  try { localStorage.setItem(PLAYING_KEY, playing ? '1' : '0') } catch { /* not remembered */ }
}

// The demo riff cannot feed back (nothing listens to a microphone while it plays), and NAM Core's example is a steady
// sine the guard would have to ask about: the guard and auto-off rest while it plays.
function syncProtection() {
  const demo = audio.source === 'demo'
  audio.setParam('guardOn', demo ? 0 : settings.guardOn)
  audio.setParam('autoOff', demo ? 0 : settings.autoOff)
}

// Space is the power key wherever typing or a dialog does not want it. It is taken before a focused button would click.
function wirePowerKey() {
  addEventListener('keydown', (e) => {
    // By its key as well as its code: keys typed without a scan code (an on-screen keyboard, remote input) have no code.
    if (!(e.code === 'Space' || e.key === ' ') || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], dialog, #look-menu, .lm-build')) return
    e.preventDefault()
    powerKey()
  })
  for (const b of document.querySelectorAll('[data-pw-main]')) b.addEventListener('click', () => (powerState() === 'on' ? setStandby(true) : turnBackOn()))
  $('banner-on').addEventListener('click', turnBackOn)
  document.querySelector('.pw-bat[data-pw="power"]')?.addEventListener('click', () => setPower(!power))
  document.querySelector('.pw-bat[data-pw="standby"]')?.addEventListener('click', () => (powerState() === 'on' ? setStandby(true) : turnBackOn()))
}

// ------------------------------------------------------------------------------------------------- the audio
// One backend or the other (above), with the same calls; the page keeps what the person chose and sends it.
const inputLost = () => { if (power) setMuted({ why: 'device', hz: 0, seconds: 0 }) }
let lib = null, libView = null // the library (build plan R4), made in start()
const audio = inDesktopApp()
  ? createDesktopAudio({ onChange: () => updateStatus(), onInputLost: inputLost, onLibChanged: () => lib?.refresh() })
  : createWebAudio({ onError: (text) => toast(text), onChange: () => updateStatus(), onInputLost: inputLost })
const desktop = audio.kind === 'desktop'
let metersRunning = false

async function ensureAudio() {
  const first = await audio.start(Object.fromEntries(ENGINE_PARAMS.map((name) => [name, settings[name]])))
  if (!first) return
  audio.setIROn(settings.irOn > 0.5)
  audio.setStandby(standby)
  syncProtection()
  // The capture chosen before the engine ran, then the pads behind it (build plan R5).
  if (capture.key) {
    try { await hear() } catch (err) { toast(`${capture.name}: ${err?.message ?? err}`); await clearCapture() }
  }
  slots.fill()
  if (ir.bytes) {
    try { await prepareIR(); showIR() } catch (err) { toast(`${ir.name}: ${desktop ? err?.message : 'not a WAV the browser can read.'}`); await clearIR() }
  }
  if (!metersRunning) { metersRunning = true; requestAnimationFrame(meterLoop) }
}

// ------------------------------------------------------------------------------------------------- playing
async function playGuitar() {
  powerUp()
  if (muted) liftMute()
  try {
    await ensureAudio()
    const device = await audio.playGuitar($('input-device').value || undefined)
    syncProtection()
    if (!desktop) await listDevices(device)
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
  syncDemoButton()
  updateStatus()
  syncPower()
}

async function listDevices(current) {
  const sel = $('input-device')
  const inputs = await audio.listInputs()
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
  if (audio.source === 'demo') { audio.stopDemo(); syncProtection(); syncDemoButton(); updateStatus(); return }
  powerUp()
  if (muted) liftMute()
  try {
    await ensureAudio()
    if (!capture.key) await loadExample()
    await audio.playDemo()
    syncProtection()
  } catch (err) {
    toast(`The demo could not play: ${err?.message ?? err}`)
  }
  syncDemoButton()
  updateStatus()
}

function syncDemoButton() {
  const on = audio.source === 'demo'
  $('play-demo').setAttribute('aria-pressed', String(on))
  $('play-demo').textContent = on ? 'Stop the demo riff' : 'Hear the demo riff'
}

function stopAll() { audio.stop(); syncProtection(); syncDemoButton(); updateStatus() }

function updateStatus() {
  rememberPlaying()
  const playing = audio.running
  $('status').classList.toggle('live', playing)
  $('stop').hidden = !playing
  $('start').classList.toggle('compact', audio.started)
  audio.wake()?.then(updateStatus)
  if (desktop) showDriver()
  if (!playing) {
    hardware?.level(0, false)
    // On the desktop, a driver that is not running is said in words (no device, or the device is in use).
    const silent = desktop && audio.started && audio.describe() && !audio.describe().running
    $('status-text').textContent = !power ? 'Off' : muted?.why === 'device' ? 'Auto-off: the input device went away' : silent ? 'No sound from the audio device: open Audio settings' : 'Not playing'
    return
  }
  const ms = audio.latencyMs()
  const what = audio.source === 'demo' ? 'Demo riff' : 'Live'
  const quiet = muted ? (muted.why === 'squeal' ? 'Muted by the squeal guard · ' : 'Auto-off · ') : standby ? 'Standby · ' : ''
  $('status-text').textContent = `${what} · ${quiet}${(audio.sampleRate / 1000).toFixed(1).replace(/\.0$/, '')} kHz · ${ms ? `about ${ms} ms out` : 'low latency'}`
}

// The desktop app's audio device, as its Audio settings left it (the driver's own list, not the browser's).
function showDriver() {
  const d = audio.describe()
  if (!d) return
  const device = d.input && d.output && d.input !== d.output ? `${d.input} in, ${d.output} out` : d.input || d.output || 'No device'
  $('desktop-device').textContent = `${device} · ${d.driver}${d.buffer ? ` · ${d.buffer} samples` : ''}`
}

// ------------------------------------------------------------------------------------------------- the capture
// `from` is { key, p } when it came from the library (its folder's key and its path there), else null.
// The capture the person chose to hear: its key (pads.js's captureKey), name and what it says, and its bytes or a way to
// read them. The engine may still be warming it; it switches once it is warm (build plan R5).
const capture = { key: null, name: '', bytes: null, read: null, meta: null, info: null, from: null, example: false }
let lastCapture = null // the one before it, for the key left of 1

function parseCapture(bytes) {
  let json
  try { json = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new Error('This file is not a NAM capture (it is not JSON).') }
  if (!json || typeof json !== 'object' || !('architecture' in json || 'config' in json)) throw new Error('This file is not a NAM capture.')
  return json.metadata ?? {}
}

// The engine's slots, as this page keeps them, and the pads (build plan R5).
const slots = createStandby({ audio, parse: parseCapture, onChange: (why) => { padsView?.sync(); if (why !== 'pads') syncHeard() } })
let padsView = null, heardState = null

async function useCapture(name, bytes, { remember = true, example = false, from = null } = {}) {
  const meta = parseCapture(bytes)
  await choose({ key: captureKey({ from, example, name, size: bytes.length }), name, bytes, meta, from, example }, { remember })
}

// The one way a capture comes in: a file, a library row, a pad, the example, or the last one back. The engine holds it
// in a slot (loading it unless a slot holds it already) and switches to it once it is warm; a capture that cannot be
// played leaves the one before playing.
async function choose(c, { remember = true } = {}) {
  const previous = { ...capture }
  Object.assign(capture, { key: c.key, name: c.name, bytes: c.bytes ?? null, read: c.read ?? null, meta: c.meta ?? slots.metaOf(c.key), info: null, from: c.from ?? null, example: Boolean(c.example) })
  heardState = null
  showCapture()
  if (audio.started) {
    try { await hear() } catch (err) { Object.assign(capture, previous); showCapture(); throw err }
  }
  if (previous.key && previous.key !== capture.key) lastCapture = previous
  $('pads-last').disabled = !lastCapture
  showCapture()
  libView?.refreshMarks()
  padsView?.sync()
  if (remember) {
    const bytes = capture.bytes ?? await capture.read?.().catch(() => null)
    if (bytes) await rememberFile('capture', capture.name, bytes, capture.from)
  }
}

// Asks the engine for the chosen capture.
async function hear() {
  const r = await slots.play(capture.key, { name: capture.name, meta: capture.meta, bytes: capture.bytes, read: capture.read })
  capture.info = r.info
  capture.meta ??= r.meta
  $('slim').hidden = !r.info?.slimmable
  hardware?.setSlim(Boolean(r.info?.slimmable))
}

// The capture panel says Loading until the engine plays what was chosen.
function syncHeard() {
  const state = capture.key && audio.started ? slots.stateOf(capture.key) : null
  if (state !== heardState) { heardState = state; showCapture() }
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
// The library's star beside what the rig plays, when it came from the folder open now.
function syncRigStars() {
  for (const [slot, f] of [['capture', capture], ['ir', ir]]) {
    const b = $(`${slot}-star`), here = Boolean((f === capture ? f.key : f.bytes) && f.from && lib?.key && f.from.key === lib.key)
    b.hidden = !here
    if (!here) continue
    const on = lib.isFav(f.from.p)
    b.setAttribute('aria-pressed', String(on))
    b.setAttribute('aria-label', on ? 'Starred: in your favourites' : 'Star: add to your favourites')
    b.title = on ? 'In your favourites: click to take it out' : 'Add to your favourites'
  }
}
function showCapture() {
  const drop = $('capture-drop')
  const has = Boolean(capture.key)
  // Until the engine plays it: Loading (read, built, warmed) or Switching (a fade under way).
  const state = has && audio.started ? slots.stateOf(capture.key) : null
  const note = state === 'loading' ? 'Loading…' : state === 'next' ? 'Switching…' : ''
  drop.classList.toggle('has', has)
  drop.querySelector('[data-clear]').hidden = !has
  $('amp-logo').classList.toggle('none', !has)
  syncRigStars()
  if (!has) {
    $('slim').hidden = true
    $('capture-name').textContent = 'None yet'
    $('capture-meta').textContent = lib?.entries.length ? 'Pick one from your library below' : 'Drop a .nam here, or open your library below'
    $('amp-logo').textContent = 'No capture'; $('amp-band-name').textContent = 'No capture'
    $('amp-sub').textContent = 'Drop a .nam capture here'
    fillChips($('amp-chips'), [])
    hardware?.setSlim(false); hardware?.setCapture('', 'Drop a .nam capture here')
    return
  }
  const m = capture.meta ?? {}
  // NAM Core's example names itself "Test Model"; the page calls it what it is.
  const name = capture.example ? 'Example capture' : m.name || capture.name.replace(/\.nam$/i, '')
  $('capture-name').textContent = name
  $('amp-logo').textContent = name; $('amp-band-name').textContent = name
  const chips = [TYPES[m.gear_type] ?? m.gear_type, m.tone_type?.replace(/_/g, ' ')].filter(Boolean)
  fillChips($('amp-chips'), chips)
  const gear = [m.gear_make, m.gear_model].filter(Boolean).join(' ')
  const lines = []
  if (note) lines.push(note)
  if (gear) lines.push(gear)
  if (m.modeled_by) lines.push(`by ${m.modeled_by}`)
  if (capture.example) lines.push('From Neural Amp Modeler Core')
  if (capture.info?.sampleRate && audio.sampleRate && Math.abs(capture.info.sampleRate - audio.sampleRate) > 1) lines.push(`Recorded at ${capture.info.sampleRate / 1000} kHz, resampled`)
  $('capture-meta').textContent = lines.join(' · ')
  $('capture-meta').title = capture.from?.p ?? capture.name
  $('amp-sub').textContent = [note, gear, ...chips, m.modeled_by && `captured by ${m.modeled_by}`].filter(Boolean).join(' · ')
  hardware?.setCapture(note ? `${name} · ${note}` : name, $('amp-sub').textContent)
}

async function clearCapture() {
  if (capture.key) lastCapture = { ...capture }
  $('pads-last').disabled = !lastCapture
  Object.assign(capture, { key: null, name: '', bytes: null, read: null, meta: null, info: null, example: false, from: null })
  if (audio.started) slots.stop() // the dry signal, faded to; the capture stays held
  showCapture()
  libView?.refreshMarks()
  padsView?.sync()
  await forgetFile('capture')
}

// ------------------------------------------------------------------------------------------------- the cabinet IR
const ir = { name: '', bytes: null, seconds: 0, from: null }

async function prepareIR() {
  ir.seconds = (await audio.loadIR(ir.bytes)).seconds
}

async function useIR(name, bytes, { remember = true, from = null } = {}) {
  const previous = { ...ir }
  Object.assign(ir, { name, bytes, from })
  if (audio.started) {
    try { await prepareIR() } catch (err) {
      Object.assign(ir, previous); showIR()
      throw new Error(desktop ? err?.message : 'This file is not a WAV the browser can read.')
    }
  }
  showIR()
  libView?.refreshMarks()
  if (remember) await rememberFile('ir', name, bytes, from)
}

function showIR() {
  const drop = $('ir-drop'), has = Boolean(ir.bytes)
  drop.classList.toggle('has', has)
  drop.querySelector('[data-clear]').hidden = !has
  syncRigStars()
  if (!has) {
    $('ir-name').textContent = 'None'; $('ir-meta').textContent = 'Drop a .wav here for a speaker cabinet'
    $('cab-name').textContent = 'No IR'; $('cab-meta').textContent = 'Drop a .wav here'; hardware?.setIR('', ''); return
  }
  const name = ir.name.replace(/\.wav$/i, ''), meta = ir.seconds ? `${Math.round(ir.seconds * 1000)} ms impulse response` : 'Impulse response'
  $('ir-name').textContent = name; $('ir-meta').textContent = meta
  $('ir-meta').title = ir.from?.p ?? ir.name
  $('cab-name').textContent = name; $('cab-meta').textContent = meta
  hardware?.setIR(name, meta)
}

async function clearIR() {
  Object.assign(ir, { name: '', bytes: null, seconds: 0, from: null })
  audio.clearIR()
  showIR()
  libView?.refreshMarks()
  await forgetFile('ir')
}

// ------------------------------------------------------------------------------------------------- the library
// The person's folder of captures and IRs (build plan R4, P3-UX U3): library.js reads and indexes it, library-view.js
// draws it. A click plays a file through the same path a dropped file takes; a star keeps it among the folder's
// favourites, which build plan R5 puts on standby.
async function playEntry(e) {
  const name = e.p.slice(e.p.lastIndexOf('/') + 1), from = { key: lib.key, p: e.p }
  if (e.k === 'ir') { await useIR(name, await lib.read(e.p), { from }); return }
  // A capture a slot holds already (a pad, or one just played) is switched to at once, unread.
  const p = e.p
  await choose({ key: captureKey({ from }), name, from, read: () => lib.read(p) })
}
function playingPaths() {
  const here = (f) => ((f === capture ? f.key : f.bytes) && f.from && f.from.key === lib?.key ? f.from.p : null)
  return { capture: here(capture), ir: here(ir) }
}

// ------------------------------------------------------------------------------------------------- the pads
// Favourites on standby (build plan R5, P3-UX U4): the library's first ten favourite captures, in the order they were
// starred, held warm by the engine. Keys 1 to 0 play them, the arrows the next and previous, and the key left of 1 the
// capture before this one. Pads hold library favourites only; a dropped file plays but has no star.
function syncPads() {
  const list = []
  if (lib?.key) {
    const byPath = new Map(lib.entries.map((e) => [e.p, e]))
    for (const p of lib.favourites) {
      const e = byPath.get(p)
      if (!e || e.k !== 'nam') continue
      const from = { key: lib.key, p }
      list.push({ key: captureKey({ from }), p, name: e.n, gear: e.gear, source: { name: p.slice(p.lastIndexOf('/') + 1), read: () => lib.read(p) } })
      if (list.length === PADS) break
    }
  }
  slots.setPads(list)
  const empty = $('pads-empty')
  empty.hidden = list.length > 0
  empty.textContent = !lib?.key
    ? 'Open your library, then star captures: the first ten wait here, loaded and warm, on keys 1 to 0.'
    : 'Star captures in your library: the first ten wait here, loaded and warm, on keys 1 to 0.'
}
async function playPad(i) {
  const p = slots.pads[i]
  if (!p) return
  try { await choose({ key: p.key, name: p.source.name, from: { key: lib.key, p: p.p }, read: p.source.read }) } catch (err) { toast(`${p.name}: ${err?.message ?? err}`) }
}
// The next or previous pad from the one playing (from the first or last when no pad plays).
function stepPad(d) {
  const n = slots.pads.length
  if (!n) return
  const at = slots.pads.findIndex((p) => p.key === capture.key)
  playPad(at < 0 ? (d > 0 ? 0 : n - 1) : (at + d + n) % n)
}
async function playLast() {
  if (!lastCapture) return
  const c = lastCapture
  try { await choose(c) } catch (err) { toast(`${c.name}: ${err?.message ?? err}`) }
}
function wirePads() {
  padsView = createPadsView({ el: document.querySelector('.isl.pads'), standby: slots, press: playPad, hint: (i) => (i === slots.pads.length ? 'Star one in your library' : 'Empty') })
  $('pads-last').addEventListener('click', playLast)
  // Keys 1 to 0, the arrows and the key left of 1, wherever typing or a dialog does not want them; arrows also leave a
  // knob, a choice of buttons or the library's list alone.
  addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
    const t = e.target
    if (t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], dialog, #look-menu, .lm-build')) return
    const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)?.[1] ?? (/^[0-9]$/.test(e.key) ? e.key : null)
    if (digit !== null) { e.preventDefault(); playPad(digit === '0' ? 9 : Number(digit) - 1); return }
    if (e.code === 'Backquote' || e.key === '`') { e.preventDefault(); playLast(); return }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (t?.closest?.('[role="slider"], [role="radio"], [role="tab"], [role="listbox"], [role="option"], [role="menuitem"], .lib-body')) return
      e.preventDefault()
      stepPad(e.key === 'ArrowRight' ? 1 : -1)
    }
  })
  syncPads()
  padsView.render()
}

function makeLibrary() {
  lib = createLibrary({ host: audio, onChange: (why, p) => { libView?.changed(why, p); if (why !== 'progress') { syncRigStars(); syncPads() } } })
  libView = createLibraryView({ lib, play: playEntry, playing: playingPaths, toast, pickFiles: () => $('lib-dir').click() })
  $('lib-dir').addEventListener('change', (e) => { const f = e.target.files; if (f?.length) lib.openFiles(f).catch((err) => toast(String(err?.message ?? err))); e.target.value = '' })
  for (const slot of ['capture', 'ir']) {
    $(`${slot}-star`).addEventListener('click', () => { const f = slot === 'ir' ? ir : capture; if (f.from && f.from.key === lib.key) lib.toggleFav(f.from.p) })
  }
  // A browser looks at the folder again when the person comes back to the page (the desktop app watches it instead).
  let lookedAt = Date.now()
  addEventListener('focus', () => {
    if (desktop || lib.status !== 'ready' || !lib.kept || Date.now() - lookedAt < 20000) return
    lookedAt = Date.now()
    lib.refresh({ quick: true })
  })
  libView.render()
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
    const file = e.dataTransfer?.files[0], slot = e.target.closest?.('[data-slot]')?.dataset.slot
    const item = [...(e.dataTransfer?.items ?? [])].find((i) => i.kind === 'file')
    // A folder becomes the library (read during the drop: its items are gone after it); a file plays.
    const folder = item && lib ? lib.openDropped(item) : Promise.resolve(false)
    folder.then((was) => { if (!was && file) takeFile(file, slot) }, (err) => toast(`That folder could not be read: ${err?.message ?? err}`))
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
function meterLoop() {
  const m = audio.takeMeters()
  // The input clips when the source itself does (the interface or file at full scale).
  meterIn(m.input, m.raw >= 0.999)
  // The energy and the kits' lamps follow the input's level (D-RIG-009 (e)).
  hardware?.level(m.input, audio.running)
  meterOut(m.output, m.output >= 0.999)
  // What the engine muted the output for: a new trip shows its banner. After the person turns the output back on,
  // reports still on their way from before are not news; a trip counted since is.
  slots.status(m.slots)
  const st = m.status
  if (st) {
    lastStatus = st
    if (!st.muted && lifted !== null && st.trips <= lifted) lifted = null
    const fresh = lifted === null || st.trips > lifted
    if (st.muted && fresh && !muted && power && audio.running) setMuted({ why: MUTED[st.muted], hz: st.hz, seconds: st.seconds })
  }
  requestAnimationFrame(meterLoop)
}

// ------------------------------------------------------------------------------------------------- the look menu
// Rig's own choices (its finish and its drawings) stay in this browser; the suite's (look, fonts, accent, density)
// follow look.js: Rig's own, or the suite look while "Use this look in every CRBN app" is on.
const RIG_KEY = 'crbn-rig/rig'
// v2 (R1): the hardware kit, Salvage's choices and the seed of its crops. Before v2 the default finish was the look's
// own; a v1 finish of 'look' was never a choice a person made, so it becomes the kit's own.
const RIG_DEFAULTS = { v: 2, finish: 'own', custom: DEFAULT_CUSTOM, layout: 'b', amp: 'b', meters: 'b', power: 'b', library: 'a', pads: 'a', kit: DEFAULT_KIT, salv: { ...SALVAGE_DEFAULTS }, seed: 1 }
const abc = (v, d = 'b') => (/^[abc]$/.test(v) ? v : d)
const kitId = (v) => (KIT_LIST.some((k) => k.id === v) || (isOwnId(v) && kits.some((k) => k.id === v)) ? v : DEFAULT_KIT)
const salvOf = (s) => Object.fromEntries(Object.entries(SALVAGE_DEFAULTS).map(([k, d]) => [k, SALVAGE_CHOICES[k].some((c) => c[0] === s?.[k]) ? s[k] : d]))
function loadRig() {
  let r = {}
  try { r = JSON.parse(localStorage.getItem(RIG_KEY) ?? '{}') ?? {} } catch { /* the defaults */ }
  const finish = r.v !== 2 && r.finish === 'look' ? 'own' : r.finish
  return {
    v: 2,
    finish: FINISHES.some((f) => f.id === finish) ? finish : 'own',
    custom: HEX_RE.test(r.custom ?? '') ? r.custom.toLowerCase() : DEFAULT_CUSTOM,
    layout: abc(r.layout), amp: abc(r.amp), meters: abc(r.meters), power: abc(r.power), library: abc(r.library, 'a'), pads: abc(r.pads, 'a'),
    kit: kitId(r.kit), salv: salvOf(r.salv), seed: Number.isInteger(r.seed) && r.seed > 0 ? r.seed : 1,
  }
}
let rig = { ...RIG_DEFAULTS }, prefs = null, every = false, keepRig = true, keepPrefs = true
// salvWords goes beside the rig so the first paint (index.html's script) draws Salvage's words in their style.
const saveRig = () => { if (keepRig) try { localStorage.setItem(RIG_KEY, JSON.stringify({ ...rig, salvWords: rig.salv.words })) } catch { /* not remembered */ } }

function applyAll() {
  const { look, accent } = applyPrefs(prefs)
  root.dataset.layout = rig.layout; root.dataset.amp = rig.amp; root.dataset.meters = rig.meters; root.dataset.power = rig.power
  if (root.dataset.library !== rig.library) { root.dataset.library = rig.library; libView?.render() }
  if (root.dataset.pads !== rig.pads) { root.dataset.pads = rig.pads; padsView?.render() }
  const hex = finishHex(rig, look.id)
  for (const [k, v] of Object.entries(finishVars(hex))) root.style.setProperty(k, v)
  if (hardware) {
    hardware.setSalvage(rig.salv, rig.seed)
    hardware.setFinish(rig.finish === 'own', hex)
    const own = ownKit()
    if (rig.amp === 'b') hardware.show(own ? drawnKit(own) : rig.kit)
  }
  // A suite accent the person chose wins over the finish on the controls; the faceplate keeps the finish.
  root.style.setProperty('--accent', accent ?? hex)
  root.style.setProperty('--accent-ink', inkFor(accent ?? hex))
  syncMenu(look, hex, accent)
  if (desktop) titleBar()
}
// The desktop app's title bar takes the page's ground: dark or light, and its colour where Windows 11 allows it.
function titleBar() {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor)
  if (!m) return
  const [r, g, b] = m.slice(1, 4).map(Number)
  audio.setTitleBar(0.2126 * r + 0.7152 * g + 0.0722 * b < 128, rgb2hex(r, g, b))
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
  // Rig's hardware: the kits, the classic ones then the energy ones; picking one draws the amp in Hardware.
  const kitChip = (k) => `<button type="button" class="lm-chip" data-kit="${k.id}" aria-pressed="false"><i style="background:${k.swatch}"></i>${k.name}</button>`
  $('lm-kits-classic').innerHTML = KIT_LIST.filter((k) => k.fam === 'classic').map(kitChip).join('')
  $('lm-kits-new').innerHTML = KIT_LIST.filter((k) => k.fam === 'new').map(kitChip).join('')
  for (const id of ['lm-kits-classic', 'lm-kits-new', 'lm-kits-mine']) {
    $(id).addEventListener('click', (e) => { const b = e.target.closest('[data-kit]'); if (b) selectKit(b.dataset.kit) })
  }
  wireBuilder()
  // Salvage's choices for players (D-RIG-012 (b), D-RIG-015), with Shuffle for new crops.
  const SALV_LABELS = { sheet: 'Sheet', mesh: 'Grille', metal: 'Grille metal', glow: 'Glow', words: 'Words' }
  $('lm-salv').innerHTML = Object.entries(SALV_LABELS).map(([key, label]) =>
    `<div class="lm-row"><span id="lm-salv-${key}">${label}</span><div class="lm-chips" role="group" aria-labelledby="lm-salv-${key}">` +
    SALVAGE_CHOICES[key].map(([v, t]) => `<button type="button" class="lm-chip plain" data-salv="${key}" data-val="${v}" aria-pressed="false">${t}</button>`).join('') +
    '</div></div>').join('') + '<div class="lm-row"><span></span><div><button type="button" class="btn small" id="lm-shuffle">Shuffle</button></div></div>'
  $('lm-salv').addEventListener('click', (e) => {
    const b = e.target.closest('[data-salv]')
    if (b) { rig.salv = { ...rig.salv, [b.dataset.salv]: b.dataset.val }; saveRig(); applyAll(); return }
    if (e.target.closest('#lm-shuffle')) { rig.seed = hardware.shuffle(); saveRig() }
  })
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
  const kitOwn = document.querySelector('#lm-finish [data-finish="own"] i')
  if (kitOwn) kitOwn.style.background = ownKit()?.own ?? KIT_LIST.find((k) => k.id === rig.kit)?.swatch ?? hex
  press('#lm-kits-classic [data-kit], #lm-kits-new [data-kit], #lm-kits-mine [data-kit]', (b) => rig.amp === 'b' && b.dataset.kit === rig.kit)
  if (builtFor !== (ownKit()?.id ?? null) || $('lm-build').hidden !== !(ownKit() && rig.amp === 'b')) renderBuilder()
  else syncBuilder()
  $('lm-salv').hidden = rig.kit !== 'hammer' || rig.amp !== 'b'
  press('#lm-salv [data-salv]', (b) => rig.salv[b.dataset.salv] === b.dataset.val)
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

// ------------------------------------------------------------------------------------------------- players' own kits
// The Rig builder (D-RIG-009 (c), D-RIG-010 (f); build plan R1b): a player's kits sit under Yours beside the twenty,
// each built from the energy kits' parts, kept in this browser (kits.js), shared as a RIG1 code, and wearing their own
// knob and switch art if they bring it. The builder edits the kit picked; every change is kept as it is made.
let kits = loadKits(), builtFor = null, kitsTimer = 0, delArmed = 0
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const ownKit = () => (isOwnId(rig.kit) && kits.find((k) => k.id === rig.kit)) || null
const drawnKit = (k) => ({ ...k, art: { knob: artURLNow(k.art.knob), sw: artURLNow(k.art.sw) } })
const artReady = (k) => !k || [k.art.knob, k.art.sw].every((id) => !id || artURLNow(id))
const knobName = (id) => Object.fromEntries(KIT_PARTS.knob[1])[id]
const PART_LABEL = { fx: 'Energy', cut: 'Cutouts', mesh: 'Mesh', mat: 'Faceplate', knob: 'Knobs' }
const ART_ACCEPT = ['.svg', '.png', '.webp', '.jpg', '.jpeg', ...ART_TYPES].join(',')
const ART_NOTE = 'A knob turns as one picture, pointing straight up at its middle setting. A switch is two frames side by side: Off, then On. SVG, PNG, WebP or JPEG, up to 2 MB.'
const ART_AWAY = 'This kit came with its maker’s own art, which isn’t on this computer: shared art travels through Pavillion Hub in a later version. Until then it wears the kit’s own knobs and switches.'
function keepKits(now) {
  clearTimeout(kitsTimer)
  if (!now) { kitsTimer = setTimeout(() => keepKits(true), 300); return }
  if (!saveKits(kits)) toast('This browser won’t keep your kits: they last until you close Rig.')
}
function mineChips() {
  $('lm-kits-mine').innerHTML = kits.map((k) => `<button type="button" class="lm-chip" data-kit="${k.id}" aria-pressed="false"><i style="background:${k.own}"></i>${esc(k.name || 'Unnamed kit')}</button>`).join('')
  $('lm-kits-mine').hidden = !kits.length
  $('lm-mine-note').hidden = kits.length > 0
  $('lm-build-new').disabled = kits.length >= MAX_KITS
  for (const b of document.querySelectorAll('#lm-kits-mine [data-kit]')) b.setAttribute('aria-pressed', String(rig.amp === 'b' && b.dataset.kit === rig.kit))
}
/** Draws a kit picked in the menu; a player's kit waits for its art to come out of this browser's storage first. */
function selectKit(id) {
  rig.kit = kitId(id); rig.amp = 'b'; saveRig()
  const k = ownKit()
  if (!artReady(k)) {
    Promise.all([artURL(k.art.knob), artURL(k.art.sw)]).then(() => { if (rig.kit === k.id) { builtFor = null; applyAll() } })
    return
  }
  applyAll()
}
function addKit(k) {
  if (kits.length >= MAX_KITS) { toast(`You have ${MAX_KITS} kits, the most Rig keeps: delete one to make room.`); return false }
  kits.push(k); keepKits(true); mineChips()
  return true
}
function renderBuilder() {
  const k = ownKit(), box = $('lm-build')
  builtFor = k?.id ?? null
  box.hidden = !k || rig.amp !== 'b'
  if (!k) { box.innerHTML = ''; return }
  const opts = (key) => KIT_PARTS[key][1].map(([v, t]) => `<option value="${v}"${k[key] === v ? ' selected' : ''}>${t}</option>`).join('')
  const has = (p) => Boolean(k.art[p] && artURLNow(k.art[p])), away = (k.art.knob && !has('knob')) || (k.art.sw && !has('sw'))
  box.innerHTML =
    '<div class="lb-head"><span>The Rig builder</span></div>' +
    `<label class="lm-row"><span>Name</span><input class="lm-text" type="text" id="lb-name" maxlength="${NAME_MAX}" value="${esc(k.name)}" placeholder="Name your kit" autocomplete="off" spellcheck="false"></label>` +
    Object.entries(PART_LABEL).map(([key, label]) => `<label class="lm-row"><span>${label}</span><select data-part="${key}">${opts(key)}</select></label>`).join('') +
    `<div class="lm-row"><span id="lb-own-l">Colour</span><div class="lm-chips" role="group" aria-labelledby="lb-own-l">${KIT_PARTS.own[1].map(([v, t]) => `<button type="button" class="lm-chip" data-own="${v}" aria-pressed="false"><i style="background:${v}"></i>${t}</button>`).join('')}</div></div>` +
    '<p class="lm-note" id="lb-own-note" hidden></p>' +
    '<div class="lm-row"><span>Share</span><div class="lb-share"><button class="btn small" type="button" id="lb-copy">Copy the share code</button><input class="lb-code" id="lb-code" type="text" readonly hidden aria-label="This kit’s share code" spellcheck="false"></div></div>' +
    '<div class="lb-art"><b>Your own art</b><p class="lm-note">Draw your own knobs and switches: save a template, draw over it in any art app, and import it here as a new version. It is kept with this kit in this browser.</p>' +
    `<div class="lb-tpl"><select id="lb-tpl" aria-label="The template to start from"><option value="knob">This kit’s knob (${knobName(k.knob)})</option><option value="switch">This kit’s switch (Glow bar)</option><option value="blank-knob">A blank knob</option><option value="blank-switch">A blank switch</option></select>` +
    '<button class="btn small" type="button" id="lb-tpl-save">Save the template</button><button class="btn small ghost" type="button" id="lb-tpl-copy">Copy it</button></div>' +
    `<div class="lb-in"><label class="lb-file" data-on="${has('knob')}">${has('knob') ? 'Knob art in use: replace it' : 'Import knob art'}<input type="file" accept="${ART_ACCEPT}" data-art="knob"></label>` +
    `<label class="lb-file" data-on="${has('sw')}">${has('sw') ? 'Switch art in use: replace it' : 'Import switch art'}<input type="file" accept="${ART_ACCEPT}" data-art="sw"></label></div>` +
    `<label class="lm-row"><span>Version</span><input class="lm-text" type="text" id="lb-art-name" maxlength="${ART_NAME_MAX}" value="${esc(k.art.name)}" placeholder="e.g. Obsidian, my version" autocomplete="off"></label>` +
    `<p class="lm-note" id="lb-art-t" aria-live="polite">${away ? ART_AWAY : ART_NOTE}</p>` +
    `<button class="linkish" type="button" id="lb-art-clear"${k.art.knob || k.art.sw ? '' : ' hidden'}>Back to the kit’s own art</button></div>` +
    '<div class="lb-foot"><button class="btn small ghost" type="button" id="lb-dup">Make a copy</button><button class="btn small ghost lb-del" type="button" id="lb-del">Delete this kit</button></div>'
  syncBuilder()
}
function syncBuilder() {
  const k = ownKit(), note = $('lb-own-note')
  if (!k || !note) return
  for (const b of document.querySelectorAll('#lm-build [data-own]')) b.setAttribute('aria-pressed', String(b.dataset.own === k.own))
  note.hidden = rig.finish === 'own'
  note.textContent = `Rig’s finish (${FINISHES.find((f) => f.id === rig.finish)?.label ?? 'yours'}) colours this kit now. Pick Kit’s own under Rig’s finish to see its own colour.`
}
const artStatus = (text) => { const t = $('lb-art-t'); if (t) t.textContent = text }
async function copyText(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done, 'info'); return true } catch { return false }
}
// A file the page hands the person: the system's Save dialog where the browser has one, else a download.
async function saveText(name, text, type, what) {
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: what, accept: { [type]: ['.' + name.split('.').pop()] } }] })
      const w = await h.createWritable()
      await w.write(new Blob([text], { type })); await w.close()
      return 'saved'
    } catch (e) { if (e?.name === 'AbortError') return 'cancelled' /* a view that refuses the picker downloads instead */ }
  }
  try {
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type }))
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    return 'downloaded'
  } catch { return 'failed' }
}
async function onArt(input) {
  const k = ownKit(), part = input.dataset.art, file = input.files?.[0]
  input.value = ''
  if (!k || !file) return
  artStatus('Bringing it in…')
  const r = await importArt(file)
  if (r.error) { artStatus(r.error); toast(r.error); return }
  if (ownKit() !== k) return
  k.art = { ...k.art, [part]: r.id }
  keepKits(true); builtFor = null; applyAll()
  const shape = part === 'knob'
    ? (Math.abs(r.shape - 1) > 0.08 ? ' It isn’t square, so it is drawn fitted inside the knob.' : '')
    : (Math.abs(r.shape - 1.4) > 0.1 ? ' A switch picture is two frames side by side (420 by 300 in the template); this one is another shape, so its frames may not line up.' : '')
  artStatus((r.kept ? 'Imported, and kept with your kit.' : 'Imported for this visit: this browser won’t keep it.') + shape)
}
function openCode(text) {
  const k = readCode(text)
  if (!k) { toast('That isn’t a CRBN Rig kit code. A code starts with RIG1.'); return false }
  const same = kits.find((x) => sameKit(x, k))
  if (!same && !addKit(k)) return false
  $('lm-code-in').value = ''; $('lm-code').hidden = true; $('lm-code-open').setAttribute('aria-expanded', 'false')
  selectKit((same ?? k).id)
  const art = k.art.knob || k.art.sw ? ' Its own art travels through Pavillion Hub later; until then it wears the kit’s own knobs and switches.' : ''
  toast(`Opened “${k.name || 'a kit'}”${same ? ', which you already have' : ''}: it’s under Yours.${art}`, 'info')
  return true
}
function wireBuilder() {
  mineChips()
  $('lm-build-new').addEventListener('click', () => {
    // from the energy kit or the player's kit on the amp, else from CRBN
    const from = ownKit() ?? KIT_LIST.find((x) => x.id === rig.kit && x.parts)?.parts ?? KIT_LIST.find((x) => x.id === DEFAULT_KIT).parts
    const k = makeKit(from, kits)
    if (!addKit(k)) return
    selectKit(k.id)
    const name = $('lb-name'); if (name) { name.focus(); name.select() }
  })
  $('lm-code-open').addEventListener('click', () => {
    const f = $('lm-code'), open = f.hidden
    f.hidden = !open; $('lm-code-open').setAttribute('aria-expanded', String(open))
    if (open) $('lm-code-in').focus()
  })
  $('lm-code').addEventListener('submit', (e) => { e.preventDefault(); openCode($('lm-code-in').value) })
  const box = $('lm-build')
  box.addEventListener('input', (e) => {
    const k = ownKit(); if (!k) return
    if (e.target.id === 'lb-name') {
      k.name = e.target.value.slice(0, NAME_MAX); keepKits()
      const chip = document.querySelector(`#lm-kits-mine [data-kit="${k.id}"]`)
      if (chip) chip.lastChild.textContent = k.name || 'Unnamed kit'
    } else if (e.target.id === 'lb-art-name') { k.art = { ...k.art, name: e.target.value.slice(0, ART_NAME_MAX) }; keepKits() }
  })
  box.addEventListener('change', (e) => {
    const k = ownKit(); if (!k) return
    const part = e.target.dataset?.part
    if (part && KIT_PARTS[part][1].some((o) => o[0] === e.target.value)) {
      k[part] = e.target.value; keepKits(true); applyAll()
      if (part === 'knob') { const o = box.querySelector('#lb-tpl option[value="knob"]'); if (o) o.textContent = `This kit’s knob (${knobName(k.knob)})` }
    } else if (e.target.dataset?.art) onArt(e.target)
  })
  box.addEventListener('click', async (e) => {
    const k = ownKit(), t = e.target.closest('button'); if (!k || !t) return
    if (t.dataset.own) {
      k.own = t.dataset.own; keepKits(true); mineChips(); applyAll()
    } else if (t.id === 'lb-copy') {
      const code = shareCode(k), field = $('lb-code')
      field.value = code; field.hidden = false
      const art = k.art.knob || k.art.sw ? ' Its own art travels through Pavillion Hub later.' : ''
      if (!(await copyText(code, `Share code copied: anyone who opens it in CRBN Rig gets this kit.${art}`))) { field.focus(); field.select(); toast('Select the code and copy it.', 'info') }
    } else if (t.id === 'lb-tpl-save' || t.id === 'lb-tpl-copy') {
      const { name, svg } = artTemplate($('lb-tpl').value, k)
      if (t.id === 'lb-tpl-copy') { if (!(await copyText(svg, 'Template copied as SVG text: paste it into a new .svg file.'))) toast('This view won’t copy: use Save the template.'); return }
      const r = await saveText(name, svg, 'image/svg+xml', 'SVG picture')
      if (r === 'saved') toast(`Template saved: ${name}`, 'info')
      else if (r === 'downloaded') toast(`Template downloaded: ${name}`, 'info')
      else if (r === 'failed' && !(await copyText(svg, 'The file couldn’t be saved here, so the template is copied as SVG text.'))) toast('The template couldn’t be saved or copied here.')
    } else if (t.id === 'lb-art-clear') {
      k.art = { knob: null, sw: null, name: k.art.name }
      keepKits(true); builtFor = null; applyAll()
      artStatus('Back to the kit’s own knobs and switches.')
    } else if (t.id === 'lb-dup') {
      const c = makeKit(k, kits)
      c.name = `${k.name || 'My kit'} copy`.slice(0, NAME_MAX)
      if (addKit(c)) { selectKit(c.id); toast(`Made a copy: “${c.name}”.`, 'info') }
    } else if (t.id === 'lb-del') {
      if (!delArmed) {
        delArmed = setTimeout(() => { delArmed = 0; t.removeAttribute('data-armed'); t.textContent = 'Delete this kit' }, 4000)
        t.dataset.armed = 'true'; t.textContent = 'Delete it: click again'
        return
      }
      clearTimeout(delArmed); delArmed = 0
      kits = kits.filter((x) => x !== k); keepKits(true)
      rig.kit = DEFAULT_KIT; saveRig(); mineChips(); applyAll()
      toast(`Deleted “${k.name || 'Unnamed kit'}”.`, 'info')
    }
  })
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
  for (const k of ['layout', 'amp', 'meters', 'power']) if (query.has(k)) { rig[k] = abc(query.get(k)); keepRig = false }
  if (query.has('library')) { rig.library = abc(query.get('library'), 'a'); keepRig = false }
  if (query.has('pads')) { rig.pads = abc(query.get('pads'), 'a'); keepRig = false }
  // ?kit= shows a hardware kit (Salvage's id is hammer, after the kit it replaced) for a scripted screenshot
  if (query.has('kit')) { rig.kit = kitId(query.get('kit')); rig.amp = 'b'; keepRig = false }
  if (query.has('finish')) {
    const f = query.get('finish')
    if (HEX_RE.test('#' + f)) { rig.finish = 'custom'; rig.custom = '#' + f.toLowerCase() } else if (FINISHES.some((x) => x.id === f)) rig.finish = f
    keepRig = false
  }
  // art no kit wears any more is forgotten now, before anything draws; then a player's kit draws with its own art
  await tidyArt(kits)
  buildMenu()
  const first = ownKit()
  if (first) await Promise.all([artURL(first.art.knob), artURL(first.art.sw)])
  for (const el of document.querySelectorAll('.knob[data-param]')) makeKnob(el)
  hardware = createHardware({
    ampHolder: $('hw-amp'), cabHolder: $('hw-cab'), spec: specOf, change: changeSetting,
    toggle: (role, on) => (role === 'power' ? setPower(on) : setStandby(!on)),
  })
  applyAll()
  wirePowerKey()
  syncPower()
  if (query.has('menu')) openMenu(true)

  for (const box of document.querySelectorAll('input[type=checkbox][data-param]')) box.addEventListener('change', () => setSetting(box.dataset.param, box.checked ? 1 : 0))
  for (const seg of document.querySelectorAll('.segmented[data-param]')) {
    for (const b of seg.querySelectorAll('button')) b.addEventListener('click', () => setSetting(seg.dataset.param, +b.dataset.value))
  }
  for (const name of Object.keys(PAGE_DEFAULTS)) reflect(name)
  meterIn = meterOf('meter-in'); meterOut = meterOf('meter-out')

  makeLibrary()
  wirePads()
  wireFiles()
  $('play-guitar').addEventListener('click', playGuitar)
  $('play-demo').addEventListener('click', toggleDemo)
  $('stop').addEventListener('click', stopAll)
  $('input-device').addEventListener('change', () => {
    if (audio.hasGuitarInput) audio.playGuitar($('input-device').value).then(listDevices).catch((e) => toast(String(e?.message ?? e)))
  })
  navigator.mediaDevices?.addEventListener?.('devicechange', () => { if (!desktop && audio.hasGuitarInput) listDevices($('input-device').value) })
  if (desktop) {
    // The desktop app (D-RIG-017): Audio settings is the driver's own dialog, and the mark's link stays on the page
    // (the app serves index.html by name).
    for (const id of ['audio-settings', 'audio-settings-2']) $(id).addEventListener('click', () => audio.openAudioSettings())
    document.querySelector('a.mark').setAttribute('href', 'index.html')
  }
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
  if (c) { try { await useCapture(c.name, new Uint8Array(c.bytes), { remember: false, from: c.from ?? null }) } catch { await forgetFile('capture') } }
  const i = await recallFile('ir')
  if (i) { try { await useIR(i.name, new Uint8Array(i.bytes), { remember: false, from: i.from ?? null }) } catch { await forgetFile('ir') } }
  // The library's folder from last time: it shows what it indexed then at once, and looks for changes behind it.
  lib.restore().catch((err) => toast(`Your library could not open: ${err?.message ?? err}`))
  // The desktop app's engine starts with the page, so the capture, IR and status are there at once. Since R3, with the
  // squeal guard on, it plays the guitar when it opens if it was playing when it last closed (the owner's word); a
  // first run still waits for Play my guitar. A browser always waits: it needs a click to make a sound, and asks first.
  if (desktop) await ensureAudio()
  if (desktop && playAtOpen) await playGuitar()
  showCapture(); showIR(); updateStatus()
  root.dataset.ready = 'true'
}

start().catch((err) => toast(`CRBN Rig could not start: ${err?.message ?? err}`))
