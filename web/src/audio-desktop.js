// CRBN Rig's audio in the desktop app (crbn-launcher D-RIG-017, build plan R2): the page runs in WebView2 inside
// crbn-rig.exe, and the engine is the same rig_engine.cpp compiled into it, playing through the audio driver (ASIO or
// DirectSound) that its Audio settings pick. This side sends settings, captures and IRs as messages through
// window.chrome.webview; NeuralAmpModeler.cpp lists them and answers. app.js drives this or audio-web.js through the
// same calls.
//
// Standby, the squeal guard and auto-off are the engine's (build plan R3); its status comes with the meters. When the
// driver stops delivering audio while the guitar plays (an interface unplugged), onInputLost says so, unless Audio
// settings was opened in the last 30 s (changing the device or buffer restarts the driver).
//
// The library (build plan R4) reads its folder through the app as well: the app's own folder dialog, the folder's
// listing, what each file says about itself (read natively, by library.js's rules), a file's bytes, and a watch that
// says when the folder changes (onLibChanged).
import { PARAM } from './engine.js'

/** True inside the desktop app's WebView2. */
export const inDesktopApp = () => typeof globalThis.chrome?.webview?.postMessage === 'function'

// The first channel of a WAV at its own rate, decoded by the browser as the web version decodes it (resampling,
// scaling and trimming are the engine's, as the desktop always did them).
async function decodeWav(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const tag = (at) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3])
  if (b.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('This file is not a WAV.')
  let rate = 0
  for (let p = 12; p + 8 <= b.length;) {
    const len = dv.getUint32(p + 4, true)
    if (tag(p) === 'fmt ' && p + 16 <= b.length) { rate = dv.getUint32(p + 12, true); break }
    p += 8 + len + (len & 1)
  }
  if (!(rate >= 3000 && rate <= 768000)) throw new Error('This WAV has a sample rate CRBN Rig cannot read.')
  const decoded = await new OfflineAudioContext(1, 1, rate).decodeAudioData(b.slice(0).buffer)
  return { samples: decoded.getChannelData(0), rate: decoded.sampleRate, seconds: decoded.duration }
}

function base64(floats) {
  const u8 = new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength)
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
  return btoa(s)
}

export function createDesktopAudio({ onError = () => {}, onChange = () => {}, onInputLost = () => {}, onLibChanged = () => {} } = {}) {
  const view = globalThis.chrome.webview
  const post = (m) => view.postMessage(m)
  let status = null, source = null, begun = false, demoSent = null, messageId = 0, gotReady, engine = null, settingsAt = -Infinity
  const ready = new Promise((ok) => { gotReady = ok })
  const waiting = new Map()
  const peaks = { input: 0, raw: 0, output: 0 }
  const ask = (msg) => new Promise((ok) => { const id = ++messageId; waiting.set(id, ok); post({ ...msg, id }) })

  view.addEventListener('message', (e) => {
    const m = e.data
    if (!m || typeof m !== 'object') return
    if (m.type === 'meter') {
      peaks.input = Math.max(peaks.input, m.input); peaks.raw = Math.max(peaks.raw, m.raw); peaks.output = Math.max(peaks.output, m.output)
      if ('muted' in m) engine = { muted: m.muted, hz: m.hz, trips: m.trips, seconds: m.seconds }
    } else if (m.type === 'libChanged') {
      onLibChanged()
    } else if (m.type === 'ready' || m.type === 'status') {
      const was = status?.running
      status = m
      if (was && !m.running && source === 'guitar' && performance.now() - settingsAt > 30000) onInputLost()
      gotReady(m)
      onChange()
    } else if (waiting.has(m.id)) {
      waiting.get(m.id)(m); waiting.delete(m.id)
    }
  })
  post({ type: 'hello' })

  return {
    kind: 'desktop',
    get started() { return begun },
    get sampleRate() { return status?.sampleRate ?? null },
    get source() { return source },
    // The driver plays whenever the app is open; "running" is the page's own: something chosen to play.
    get running() { return Boolean(begun && source && status?.running) },
    get hasGuitarInput() { return source === 'guitar' },

    async start(params) {
      await ready
      if (begun) return false
      begun = true
      for (const [name, value] of Object.entries(params)) this.setParam(name, value)
      return true
    },
    wake() { return null },

    setParam(name, value) { if (name in PARAM) post({ type: 'param', id: PARAM[name], value: Number(value) }) },
    async loadCapture(bytes) {
      // A .nam capture is JSON: it goes as its text.
      return ask({ type: 'capture', text: new TextDecoder().decode(bytes) })
    },
    clearCapture() { post({ type: 'clearCapture', id: 0 }) },
    async loadIR(bytes) {
      let wav
      try { wav = await decodeWav(bytes) } catch (err) { throw new Error(err?.message?.startsWith('This') ? err.message : 'This file is not a WAV CRBN Rig can read.') }
      const r = await ask({ type: 'ir', rate: wav.rate, samples: base64(wav.samples) })
      if (!r.ok) throw new Error(r.error)
      return { seconds: r.seconds }
    },
    clearIR() { post({ type: 'clearIR' }) },
    setIROn(on) { post({ type: 'irOn', on: Boolean(on) }) },
    setStandby(on) { this.setParam('standby', on ? 1 : 0) },
    /** The person turned the output back on: the squeal guard's or auto-off's mute lifts. */
    // Only the engine's own next report says it is unmuted: marking the last one unmuted here let a meter message already
    // on its way, still muted, read as a new trip and mute the page again (found in R4's desktop check).
    resume() { this.setParam('clearTrip', 1) },

    /** The guitar through the driver's inputs: no permission to ask, the device is the Audio settings' pick. */
    async playGuitar() { source = 'guitar'; post({ type: 'source', source: 'live' }) },
    async playDemo() {
      demoSent ??= (async () => {
        const wav = await decodeWav(new Uint8Array(await (await fetch('demo/di.wav')).arrayBuffer()))
        const r = await ask({ type: 'demo', rate: wav.rate, samples: base64(wav.samples) })
        if (!r.ok) throw new Error(r.error)
      })()
      try { await demoSent } catch (err) { demoSent = null; throw err }
      source = 'demo'
      post({ type: 'source', source: 'demo' })
    },
    // On the desktop the guitar is what plays when nothing else does: the riff hands back to it.
    stopDemo() { if (source === 'demo') this.playGuitar() },
    stop() { source = null; post({ type: 'source', source: 'none' }) },
    async listInputs() { return [] },

    takeMeters() {
      const m = { ...peaks, status: engine }
      peaks.input = 0; peaks.raw = 0; peaks.output = 0
      return m
    },
    latencyMs() { return status?.latencyMs ? Math.round(status.latencyMs) : 0 },
    /** The driver and its devices, as Audio settings left them. */
    describe() { return status },
    openAudioSettings() { settingsAt = performance.now(); post({ type: 'audioSettings' }) },
    /** The window's title bar follows the page's look. */
    setTitleBar(dark, caption) { post({ type: 'chrome', dark: Boolean(dark), caption }) },

    // The library's folder, read by the app (library.js's desktop source).
    /** The app's folder dialog: { ok, path } or { ok: false } when the person cancels. */
    libPick(start = '') { return ask({ type: 'libPick', start }) },
    /** Every .nam and .wav under the folder: { ok, files: [{ p, s, m }], truncated, error }. */
    libList(folder) { return ask({ type: 'libList', folder }) },
    /** What each file says: { items: [{ p, metadata, rate } | { p, wav } | { p, error }] }. */
    libMeta(folder, paths) { return ask({ type: 'libMeta', folder, paths }) },
    /** One file's bytes: { ok, b64, error }. */
    libRead(folder, path) { return ask({ type: 'libRead', folder, path }) },
    /** Watches the folder (an empty path stops): the app says libChanged when its files change. */
    libWatch(folder) { post({ type: 'libWatch', folder }) },
  }
}
