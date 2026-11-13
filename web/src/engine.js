// CRBN Rig's engine wrapper: instantiates rig-engine.wasm (web/engine/rig_engine.cpp, standalone WebAssembly) and
// wraps its C API. It runs inside the AudioWorklet (rig-processor.js) and in Node (web/engine/test.mjs), so it uses
// nothing either lacks: no TextEncoder or TextDecoder (an AudioWorkletGlobalScope has neither), no fetch.

/** Parameter ids, as rig_engine.cpp numbers them. `standby` and `clearTrip` (any write lifts the guard's or
 *  auto-off's mute) are the power switch's (build plan R3), sent as the person acts, never kept as settings. The slots'
 *  (build plan R5): `play` (any write asks to hear that slot, or none for -1, as soon as it is warm), `switchMode` (0 a
 *  crossfade, 1 a dip), `switchMs` (the whole switch) and `warmRate` (frames of silence warmed per frame heard). The
 *  pedals' (build plan R6): `pedal1` to `pedal4` (any write asks that pedal to hear a slot, or none for -1, as soon as
 *  it is warm), and each pedal's `pedalDrive` (into its capture) and `pedalLevel` (out of it), in dB. */
export const PARAM = Object.freeze({
  inputDB: 0, gateOn: 1, gateThresholdDB: 2, eqOn: 3, bass: 4, middle: 5, treble: 6, outputDB: 7,
  outputMode: 8, calibrateInput: 9, inputCalibrationDBu: 10, slim: 11,
  standby: 12, guardOn: 13, autoOff: 14, clearTrip: 15,
  play: 16, switchMode: 17, switchMs: 18, warmRate: 19,
  pedal1: 20, pedal2: 21, pedal3: 22, pedal4: 23,
  pedalDrive1: 24, pedalDrive2: 25, pedalDrive3: 26, pedalDrive4: 27,
  pedalLevel1: 28, pedalLevel2: 29, pedalLevel3: 30, pedalLevel4: 31,
})

/** How many captures the engine holds (rig_engine.cpp's kSlots): the amp's twelve (ten pads and two for whatever plays
 *  off them), then two for each pedal. */
export const SLOTS = 20
/** The amp's slots, 0 to AMP_SLOTS - 1 (pads.js keeps them). */
export const AMP_SLOTS = 12
/** How many pedals the engine runs in series before the amp (rig_engine.cpp's kPedals); pedal p (from 0) keeps slots
 *  AMP_SLOTS + 2p and the one after. */
export const PEDALS = 4

/** Six bits a pedal (rig_engine.cpp's kStatusPedals): [{ playing (a slot, or -1), switching }], pedal 1 first. */
export function pedalsOf(bits) {
  const out = []
  for (let p = 0; p < PEDALS; p++) { const b = Math.floor(bits / 2 ** (6 * p)) & 63; out.push({ playing: (b & 31) - 1, switching: (b & 32) !== 0 }) }
  return out
}

/** The settings a person keeps, at their defaults: the desktop's (NeuralAmpModeler's constructor), then the squeal
 *  guard and auto-off, both on out of the box (D-RIG-008 (e)), then each pedal's Drive and Level (build plan R6). */
export const DEFAULTS = Object.freeze({
  inputDB: 0, gateOn: 1, gateThresholdDB: -80, eqOn: 1, bass: 5, middle: 5, treble: 5, outputDB: 0,
  outputMode: 1, calibrateInput: 0, inputCalibrationDBu: 12, slim: 0, guardOn: 1, autoOff: 1,
  pedalDrive1: 0, pedalDrive2: 0, pedalDrive3: 0, pedalDrive4: 0, pedalLevel1: 0, pedalLevel2: 0, pedalLevel3: 0, pedalLevel4: 0,
})

/** Why the engine muted its output (rig_guard.h's Why). */
export const MUTED = Object.freeze({ 0: null, 1: 'squeal', 2: 'silence', 3: 'hum' })

const INFO = Object.freeze({
  loaded: 0, hasLoudness: 1, loudness: 2, hasInputLevel: 3, inputLevel: 4, hasOutputLevel: 5, outputLevel: 6,
  modelSampleRate: 7, slimmable: 8, latencyFrames: 9, ready: 10,
})

// UTF-8 to a string without TextDecoder (error messages and the engine's log lines).
function utf8(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++]
    let c = b
    if (b >= 0xf0) { c = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63) }
    else if (b >= 0xe0) { c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63) }
    else if (b >= 0xc0) { c = ((b & 31) << 6) | (bytes[i++] & 63) }
    s += String.fromCodePoint(c)
  }
  return s
}

/**
 * Splits a capture's JSON into its text without its weights and the weights as float32s, for loadSlot (build plan R5).
 * In WebAssembly, reading a decimal number runs in software 128-bit floats: a standard capture's 13,802 weights took 85%
 * of a 40 ms build on the audio thread, where the browser's own JSON.parse reads the whole file in 2.5 ms. Every
 * "weights" array of numbers becomes {"rig.f32": [at, count]} (rig_engine.cpp's PutWeightsBack), with the same floats
 * NAM Core would have read. Runs where TextEncoder does (the page, Node), never in the worklet.
 * @param {Uint8Array | object} capture  the .nam file's bytes, or its parsed JSON
 * @returns {{ text: Uint8Array, weights: Float32Array }}
 */
export function packCapture(capture) {
  const json = capture instanceof Uint8Array ? JSON.parse(new TextDecoder().decode(capture)) : capture
  const parts = []
  let total = 0
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk)
    if (!v || typeof v !== 'object') return v
    const o = {}
    for (const [k, x] of Object.entries(v)) {
      if (k === 'weights' && Array.isArray(x) && x.every((n) => typeof n === 'number')) { o[k] = { 'rig.f32': [total, x.length] }; parts.push(x); total += x.length }
      else o[k] = walk(x)
    }
    return o
  }
  const text = new TextEncoder().encode(JSON.stringify(walk(json)))
  const weights = new Float32Array(total)
  let at = 0
  for (const p of parts) { weights.set(p, at); at += p.length }
  return { text, weights }
}

/**
 * @param {BufferSource | WebAssembly.Module} wasm  the bytes of rig-engine.wasm, or the compiled module
 * @param {number} sampleRate  the rate the engine runs at (the AudioContext's); captures are resampled to their own
 * @param {(line: string) => void} [log]  where the engine's stderr goes
 */
export async function createEngine(wasm, sampleRate, log = () => {}) {
  let memory
  let u8 = new Uint8Array(0)
  const views = () => { if (u8.buffer !== memory.buffer) u8 = new Uint8Array(memory.buffer) }
  const dv = () => new DataView(memory.buffer)
  // The engine never opens a file; these exist because libc++ links them. stdout and stderr go to `log`.
  let pending = ''
  const wasi = {
    fd_write(fd, iovs, count, written) {
      views(); const d = dv(); let n = 0
      for (let i = 0; i < count; i++) {
        const ptr = d.getUint32(iovs + 8 * i, true), len = d.getUint32(iovs + 8 * i + 4, true)
        pending += utf8(u8.subarray(ptr, ptr + len)); n += len
      }
      let nl
      while ((nl = pending.indexOf('\n')) >= 0) { log(pending.slice(0, nl)); pending = pending.slice(nl + 1) }
      d.setUint32(written, n, true)
      return 0
    },
    fd_read: () => 8, fd_seek: () => 8, fd_close: () => 0, // EBADF: there are no files
    environ_sizes_get(count, size) { const d = dv(); d.setUint32(count, 0, true); d.setUint32(size, 0, true); return 0 },
    environ_get: () => 0,
  }
  const imports = { env: { emscripten_notify_memory_growth: () => views() }, wasi_snapshot_preview1: wasi }
  const result = await WebAssembly.instantiate(wasm, imports)
  const instance = result.instance ?? result
  const x = instance.exports
  memory = x.memory
  x._initialize()
  const maxBlock = x.rig_init(sampleRate)

  let inView = null, outView = null
  const blockViews = () => {
    if (inView === null || inView.buffer !== memory.buffer) {
      inView = new Float32Array(memory.buffer, x.rig_input(), maxBlock)
      outView = new Float32Array(memory.buffer, x.rig_output(), maxBlock)
    }
  }
  const info = (k) => x.rig_info(INFO[k])
  const describe = (get) => {
    if (!get('loaded')) return null
    return {
      loudness: get('hasLoudness') ? get('loudness') : null,
      inputLevel: get('hasInputLevel') ? get('inputLevel') : null,
      outputLevel: get('hasOutputLevel') ? get('outputLevel') : null,
      sampleRate: get('modelSampleRate'),
      slimmable: get('slimmable') === 1,
      latencyFrames: get('latencyFrames'),
    }
  }
  const bits = (v) => { const out = []; for (let s = 0; s < SLOTS; s++) if (v & (1 << s)) out.push(s); return out }
  const errorText = () => { views(); const p = x.rig_error(); let e = p; while (u8[e] !== 0) e++; return utf8(u8.subarray(p, e)) }

  return {
    maxBlock,
    /** Runs one block: `input` mono in, `output` mono out (same length, at most maxBlock). */
    process(input, output) {
      for (let at = 0; at < input.length; at += maxBlock) {
        const n = Math.min(maxBlock, input.length - at)
        blockViews()
        inView.set(input.subarray(at, at + n))
        x.rig_process(n)
        blockViews() // a capture can grow memory; re-read after the call
        output.set(outView.subarray(0, n), at)
      }
    },
    setParam(name, value) { if (name in PARAM) x.rig_set_param(PARAM[name], Number(value)) },
    /** The harness's load (test.mjs): plays a capture from the bytes of its .nam file at once, with no fade (slot 0).
     *  Returns { ok: true, info } or { ok: false, error }. */
    loadCapture(bytes) {
      const ptr = x.rig_text_buffer(bytes.length)
      views()
      u8.set(bytes, ptr)
      if (x.rig_load_model(bytes.length) === 0) return { ok: true, info: this.captureInfo() }
      return { ok: false, error: errorText() }
    },
    clearCapture() { x.rig_clear_model() },
    /** What the capture heard holds, or null. */
    captureInfo() { return describe(info) },
    /** Builds a capture into a slot (build plan R5), cold: the engine warms it a little per block, and a switch to it
     *  (play) starts once it is warm. `capture` is packCapture's { text, weights } (as the page sends it), or a .nam
     *  file's bytes (read by the engine, slowly). Returns { ok: true, info }, { ok: false, error }, or
     *  { ok: false, busy: true } when the slot is heard or fading. */
    loadSlot(slot, capture) {
      const text = capture instanceof Uint8Array ? capture : capture.text
      if (!(capture instanceof Uint8Array)) {
        const wp = x.rig_weights_buffer(capture.weights.length)
        new Float32Array(memory.buffer, wp, capture.weights.length).set(capture.weights)
      }
      const ptr = x.rig_text_buffer(text.length)
      views()
      u8.set(text, ptr)
      const r = x.rig_slot_load(slot, text.length)
      if (r === 0) return { ok: true, info: this.slotInfo(slot) }
      if (r === 2) return { ok: false, busy: true, error: 'That slot is playing.' }
      return { ok: false, error: errorText() }
    },
    /** Empties a slot; false when it is heard or fading. */
    clearSlot(slot) { return x.rig_slot_clear(slot) === 0 },
    slotInfo(slot) { return describe((k) => x.rig_slot_info(slot, INFO[k])) },
    /** Asks to hear a slot (or none, -1) as soon as it is warm. */
    play(slot) { x.rig_set_param(PARAM.play, slot) },
    /** Asks pedal p (from 0) to hear a slot, or none (-1: it passes the signal through), as soon as it is warm. */
    pedal(p, slot) { x.rig_set_param(PARAM.pedal1 + p, slot) },
    /** The harness's look at one capture alone (test.mjs, R6): `input` through a warm slot that nothing hears, raw, into
     *  `output`. False when the slot holds no warm capture, or is heard. */
    renderSlot(slot, input, output) {
      for (let at = 0; at < input.length; at += maxBlock) {
        const n = Math.min(maxBlock, input.length - at)
        blockViews()
        inView.set(input.subarray(at, at + n))
        if (x.rig_slot_render(slot, n) !== 0) return false
        blockViews()
        output.set(outView.subarray(0, n), at)
      }
      return true
    },
    /** The input peak (after the input gain) since the last call. */
    takeInputPeak() { return x.rig_take_input_peak() },
    /** The output's fade and what muted it: { muted: 0 none | 1 squeal guard | 2 auto-off on silence | 3 on hum, hz,
     *  trips (a count since the engine started), seconds (how long it held), at (seconds of audio), gain }. */
    status() {
      return { muted: x.rig_status(0), hz: x.rig_status(1), trips: x.rig_status(2), seconds: x.rig_status(3), at: x.rig_status(4), gain: x.rig_status(5) }
    },
    /** The slots (build plan R5): { playing (the slot heard, a switch's target from its first frame, or -1), held and
     *  ready (lists of slots holding a capture, and a warm one), wanted (a slot asked for and not yet warm, or -2),
     *  switchAt (frames since start when the last switch began), switching, pedals: [{ playing, switching }] (R6), and
     *  pedalSwitchAt (when a pedal's last switch began) }. */
    slots() {
      return { playing: x.rig_status(6), held: bits(x.rig_status(7)), ready: bits(x.rig_status(8)), wanted: x.rig_status(9), switchAt: x.rig_status(10), switching: x.rig_status(11) === 1, pedals: pedalsOf(x.rig_status(12)), pedalSwitchAt: x.rig_status(13) }
    },
    /** The engine's linear memory, in bytes. */
    memoryBytes() { return memory.buffer.byteLength },
  }
}
