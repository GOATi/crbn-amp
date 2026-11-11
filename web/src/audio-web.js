// CRBN Rig's audio in a browser (the web version, D-CRBN-021 (d)): the engine runs in an AudioWorklet over
// rig-engine.wasm, and Web Audio does the rest.
//
//   source (the guitar through getUserMedia, or the demo riff) -> AudioWorkletNode 'crbn-rig' (rig-processor.js: input
//   gain, gate, capture, EQ, DC blocker, output gain) -> ConvolverNode (the cabinet IR, scaled and truncated as the
//   desktop's ImpulseResponse does) -> GainNode (Standby's 20 ms fade) -> AnalyserNode (the output meter) -> speakers.
//
// app.js drives this or audio-desktop.js (the desktop app, D-RIG-017) through the same calls.
import { scaledIR } from './ir.js'

export function createWebAudio({ onError = () => {}, onChange = () => {} } = {}) {
  let ctx = null, node = null, convolver = null, analyser = null, outGain = null
  let micStream = null, micSource = null, demoSource = null, demoBuffer = null, wasmBytes = null
  let irOn = true, standby = false, messageId = 0, scratch = null
  const waiting = new Map()
  const peaks = { input: 0, raw: 0 }

  const ask = (msg, transfer) => new Promise((ok) => { const id = ++messageId; waiting.set(id, ok); node.port.postMessage({ ...msg, id }, transfer) })
  function route() {
    if (!node) return
    node.disconnect(); convolver.disconnect()
    if (irOn && convolver.buffer) { node.connect(convolver); convolver.connect(outGain) }
    else node.connect(outGain)
  }
  function onWorklet(m) {
    if (m.type === 'meter') { peaks.input = Math.max(peaks.input, m.input); peaks.raw = Math.max(peaks.raw, m.raw) }
    else if (m.type === 'capture') { waiting.get(m.id)?.(m); waiting.delete(m.id) }
    else if (m.type === 'error') onError(`The engine could not start: ${m.error}`)
    else if (m.type === 'log') console.debug('[engine]', m.line)
  }
  function closeMic() {
    micSource?.disconnect(); micSource = null
    for (const t of micStream?.getTracks() ?? []) t.stop()
    micStream = null
  }
  function stopDemo() {
    if (!demoSource) return
    try { demoSource.stop() } catch { /* already stopped */ }
    demoSource.disconnect(); demoSource = null
  }

  return {
    kind: 'web',
    get started() { return ctx !== null },
    get sampleRate() { return ctx?.sampleRate ?? null },
    get source() { return demoSource ? 'demo' : micSource ? 'guitar' : null },
    get running() { return Boolean(ctx && ctx.state === 'running' && (micSource || demoSource)) },
    get hasGuitarInput() { return micStream !== null },

    /** Starts the engine with these settings; true the first time (the caller then sends the capture and IR). */
    async start(params) {
      if (ctx) { if (ctx.state === 'suspended') await ctx.resume(); return false }
      ctx = new AudioContext({ latencyHint: 'interactive' })
      wasmBytes ??= await (await fetch('rig-engine.wasm')).arrayBuffer()
      await ctx.audioWorklet.addModule('rig-processor.js')
      node = new AudioWorkletNode(ctx, 'crbn-rig', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCountMode: 'max', channelInterpretation: 'discrete',
        processorOptions: { wasm: wasmBytes.slice(0) },
      })
      node.port.onmessage = (e) => onWorklet(e.data)
      for (const [name, value] of Object.entries(params)) node.port.postMessage({ type: 'param', name, value })
      convolver = new ConvolverNode(ctx, { disableNormalization: true })
      analyser = new AnalyserNode(ctx, { fftSize: 1024 })
      analyser.connect(ctx.destination)
      outGain = new GainNode(ctx, { gain: standby ? 0 : 1 })
      outGain.connect(analyser)
      route()
      ctx.onstatechange = onChange
      return true
    },
    /** A suspended context with something to play comes back; resolves when it has. */
    wake() { return ctx && ctx.state === 'suspended' && (micSource || demoSource) ? ctx.resume() : null },

    setParam(name, value) { node?.port.postMessage({ type: 'param', name, value }) },
    async loadCapture(bytes) {
      const copy = bytes.slice(0)
      return ask({ type: 'capture', bytes: copy.buffer }, [copy.buffer])
    },
    clearCapture() { node?.port.postMessage({ type: 'clearCapture', id: 0 }) },
    /** Throws when the browser cannot read the WAV. */
    async loadIR(bytes) {
      const decoded = await ctx.decodeAudioData(bytes.slice(0).buffer)
      convolver.buffer = scaledIR(decoded, ctx.sampleRate)
      route()
      return { seconds: decoded.duration }
    },
    clearIR() { if (convolver) { convolver.buffer = null; route() } },
    setIROn(on) { irOn = on; route() },
    setStandby(on) {
      standby = on
      if (outGain) {
        const g = outGain.gain, t = ctx.currentTime
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? 0 : 1, t + 0.02)
      }
    },

    /** The guitar through the browser's input (it asks the person the first time). */
    async playGuitar(deviceId) {
      stopDemo()
      closeMic()
      // Guitar wants the raw signal: no echo cancelling, noise suppression or automatic gain.
      const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) }
      micStream = await navigator.mediaDevices.getUserMedia({ audio })
      micSource = new MediaStreamAudioSourceNode(ctx, { mediaStream: micStream })
      micSource.connect(node)
      return micStream.getAudioTracks()[0]?.getSettings().deviceId
    },
    async playDemo() {
      closeMic()
      demoBuffer ??= await ctx.decodeAudioData(await (await fetch('demo/di.wav')).arrayBuffer())
      demoSource = new AudioBufferSourceNode(ctx, { buffer: demoBuffer, loop: true })
      demoSource.connect(node)
      demoSource.start()
    },
    stopDemo,
    stop() { stopDemo(); closeMic(); ctx?.suspend() },
    async listInputs() { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput') },

    /** The peaks since the last call: the input after its gain, the input before it, and the output. */
    takeMeters() {
      let output = 0
      if (analyser) {
        scratch ??= new Float32Array(analyser.fftSize)
        analyser.getFloatTimeDomainData(scratch)
        for (const v of scratch) { const a = Math.abs(v); if (a > output) output = a }
      }
      const m = { input: peaks.input, raw: peaks.raw, output }
      peaks.input = 0; peaks.raw = 0
      return m
    },
    latencyMs() { return ctx ? Math.round(((ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000) : 0 },
    describe() { return null },
  }
}
