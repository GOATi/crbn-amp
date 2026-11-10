// CRBN Rig's AudioWorklet: runs the engine (engine.js over rig-engine.wasm) on the audio rendering thread, one render
// quantum at a time. Input channels are summed to mono, as the desktop standalone sums its inputs; the mono result is
// written to every output channel. The page talks to it through the port:
//   in:  { type: 'param', name, value }   { type: 'capture', id, bytes }   { type: 'clearCapture', id }
//   out: { type: 'ready', sampleRate }   { type: 'capture', id, ok, info | error }   { type: 'meter', input, raw }
//        { type: 'log', line }   { type: 'error', error }
import { createEngine } from './engine.js'

const METER_EVERY = 12 // render quanta between meter messages (about 30 a second at 48 kHz)

class RigProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.engine = null
    this.queue = []
    this.mono = new Float32Array(128)
    this.wet = new Float32Array(128)
    this.rawPeak = 0
    this.quanta = 0
    this.port.onmessage = (e) => (this.engine ? this.handle(e.data) : this.queue.push(e.data))
    createEngine(options.processorOptions.wasm, sampleRate, (line) => this.port.postMessage({ type: 'log', line }))
      .then((engine) => {
        this.engine = engine
        for (const m of this.queue.splice(0)) this.handle(m)
        this.port.postMessage({ type: 'ready', sampleRate })
      })
      .catch((err) => this.port.postMessage({ type: 'error', error: String(err?.message ?? err) }))
  }

  handle(m) {
    if (m.type === 'param') this.engine.setParam(m.name, m.value)
    else if (m.type === 'capture') {
      const result = this.engine.loadCapture(new Uint8Array(m.bytes))
      this.port.postMessage({ type: 'capture', id: m.id, ...result })
    } else if (m.type === 'clearCapture') {
      this.engine.clearCapture()
      this.port.postMessage({ type: 'capture', id: m.id, ok: true, info: null })
    }
  }

  process(inputs, outputs) {
    const out = outputs[0]
    const n = out[0].length
    if (this.engine === null) {
      for (const ch of out) ch.fill(0)
      return true
    }
    if (this.mono.length !== n) { this.mono = new Float32Array(n); this.wet = new Float32Array(n) }
    const mono = this.mono
    mono.fill(0)
    for (const ch of inputs[0] ?? []) for (let i = 0; i < n; i++) mono[i] += ch[i]
    let raw = this.rawPeak
    for (let i = 0; i < n; i++) { const a = Math.abs(mono[i]); if (a > raw) raw = a }
    this.rawPeak = raw

    this.engine.process(mono, this.wet)
    for (const ch of out) ch.set(this.wet)

    if (++this.quanta >= METER_EVERY) {
      this.quanta = 0
      this.port.postMessage({ type: 'meter', input: this.engine.takeInputPeak(), raw: this.rawPeak })
      this.rawPeak = 0
    }
    return true
  }
}

registerProcessor('crbn-rig', RigProcessor)
