// CRBN Rig's engine wrapper: instantiates rig-engine.wasm (web/engine/rig_engine.cpp, standalone WebAssembly) and
// wraps its C API. It runs inside the AudioWorklet (rig-processor.js) and in Node (web/engine/test.mjs), so it uses
// nothing either lacks: no TextEncoder or TextDecoder (an AudioWorkletGlobalScope has neither), no fetch.

/** Parameter ids, as rig_engine.cpp numbers them. */
export const PARAM = Object.freeze({
  inputDB: 0, gateOn: 1, gateThresholdDB: 2, eqOn: 3, bass: 4, middle: 5, treble: 6, outputDB: 7,
  outputMode: 8, calibrateInput: 9, inputCalibrationDBu: 10, slim: 11,
})

/** The desktop's defaults (NeuralAmpModeler's constructor). */
export const DEFAULTS = Object.freeze({
  inputDB: 0, gateOn: 1, gateThresholdDB: -80, eqOn: 1, bass: 5, middle: 5, treble: 5, outputDB: 0,
  outputMode: 1, calibrateInput: 0, inputCalibrationDBu: 12, slim: 0,
})

const INFO = Object.freeze({
  loaded: 0, hasLoudness: 1, loudness: 2, hasInputLevel: 3, inputLevel: 4, hasOutputLevel: 5, outputLevel: 6,
  modelSampleRate: 7, slimmable: 8, latencyFrames: 9,
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
    /** Loads a capture from the bytes of its .nam file. Returns { ok: true } or { ok: false, error }. */
    loadCapture(bytes) {
      const ptr = x.rig_text_buffer(bytes.length)
      views()
      u8.set(bytes, ptr)
      if (x.rig_load_model(bytes.length) === 0) return { ok: true, info: this.captureInfo() }
      return { ok: false, error: errorText() }
    },
    clearCapture() { x.rig_clear_model() },
    captureInfo() {
      if (!info('loaded')) return null
      return {
        loudness: info('hasLoudness') ? info('loudness') : null,
        inputLevel: info('hasInputLevel') ? info('inputLevel') : null,
        outputLevel: info('hasOutputLevel') ? info('outputLevel') : null,
        sampleRate: info('modelSampleRate'),
        slimmable: info('slimmable') === 1,
        latencyFrames: info('latencyFrames'),
      }
    },
    /** The input peak (after the input gain) since the last call. */
    takeInputPeak() { return x.rig_take_input_peak() },
  }
}
