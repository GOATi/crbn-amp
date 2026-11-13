// CRBN Rig's AudioWorklet: runs the engine (engine.js over rig-engine.wasm) on the audio rendering thread, one render
// quantum at a time. Input channels are summed to mono, as the desktop standalone sums its inputs; the mono result is
// written to every output channel. The page talks to it through the port:
//   in:  { type: 'param', name, value }   { type: 'slot', id, slot, text, weights }   { type: 'clearSlot', id, slot }
//   out: { type: 'ready', sampleRate }   { type: 'slot', id, ok, info | error, busy }
//        { type: 'meter', input, raw, status, slots }   (status: what muted the output and why; slots: which is heard,
//        which are warm; engine.js)
//        { type: 'log', line }   { type: 'error', error }
// Standby, the squeal guard and auto-off are the engine's (build plan R3), set as params like the rest; so is `play`,
// the slot to hear (build plan R5). A slot's capture comes as engine.js's packCapture made it on the page (its JSON
// without its weights, and the weights as floats), and is built here, on the audio thread, in a few milliseconds.
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
    else if (m.type === 'slot') {
      const result = this.engine.loadSlot(m.slot, { text: new Uint8Array(m.text), weights: new Float32Array(m.weights) })
      this.port.postMessage({ type: 'slot', id: m.id, ...result })
    } else if (m.type === 'clearSlot') {
      this.port.postMessage({ type: 'slot', id: m.id, ok: this.engine.clearSlot(m.slot) })
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
      this.port.postMessage({ type: 'meter', input: this.engine.takeInputPeak(), raw: this.rawPeak, status: this.engine.status(), slots: this.engine.slots() })
      this.rawPeak = 0
    }
    return true
  }
}

registerProcessor('crbn-rig', RigProcessor)
