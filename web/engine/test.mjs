// The web engine's test: every example capture NAM Core ships, played through the WebAssembly engine
// (dist/engine/rig-engine.wasm) and through the same engine source built natively with MSVC (the desktop's compiler),
// compared sample by sample, with the WebAssembly engine's speed against real time.
// Run from the repo root after node web/engine/build.mjs:   node web/engine/test.mjs [--no-native]
//
// The input is NAM Core's example DI clip (example_audio/input.wav, 24-bit, 48 kHz: a second of silence, then a second
// of a 220 Hz sine). The chain is the engine's defaults, which are the desktop's (gate at -80 dB, EQ flat at 5/5/5,
// normalized output), with the squeal guard and auto-off on. One case runs the engine at 44.1 kHz so a 48 kHz capture
// goes through the desktop's resampler (ResamplingNAM) in both builds.
//
// Then the squeal guard's and auto-off's cases (build plan R3, scenarios.mjs), in both builds: feedback through a real
// loop trips the guard within 300 ms, a pulled jack trips auto-off, and the riff, long notes clean and at high gain,
// chords hit hard, and sine sweeps trip nothing; and Standby's fade.
//
// Then the slots (build plan R5), in both builds: a switch between two captures while a note rings, as a crossfade (the
// desktop's) and as a dip (a browser's), equal to a reference made from each capture played alone and faded by hand,
// with no gap in the crossfade; a capture loaded and warmed while another plays, which must not change one sample of
// what is heard; a switch to a capture still cold, which waits for its warm; and weights handed over as floats (the
// page's way) against the same capture read from its text.
//
// Then the pedals (build plan R6), in both builds: two pedals in series before the amp, equal to the chain built by
// hand stage by stage (rig_slot_render, each capture alone); a pedal stomped on and off while a note rings, a crossfade
// against the dry signal in both switch modes; a pedal swapped for another, a crossfade or a dip, each against its
// reference; and a capture asked to play in two places at once, refused.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PARAM, createEngine, packCapture } from '../src/engine.js'
import { RATE, firstLoud, fuzzCapture, loopCases, loopExcitation, openCases, pluck, resonance, runLoop } from './scenarios.mjs'

const root = resolve(import.meta.dirname, '..', '..')
const out = join(root, 'dist', 'engine', 'test')
mkdirSync(out, { recursive: true })
const native = !process.argv.includes('--no-native')

// --- the DI clip -------------------------------------------------------------------------------------------------
function readWav(path) {
  const b = readFileSync(path)
  let p = 12, fmt, data
  while (p + 8 <= b.length) {
    const id = b.toString('latin1', p, p + 4), len = b.readUInt32LE(p + 4)
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }
    if (id === 'data') data = b.subarray(p + 8, p + 8 + len)
    p += 8 + len + (len & 1)
  }
  if (!fmt || !data || fmt.channels !== 1) throw new Error(`${path}: expected a mono WAV`)
  const bytes = fmt.bits / 8, n = Math.floor(data.length / bytes), s = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * bytes
    if (fmt.format === 3) s[i] = data.readFloatLE(o)
    else if (fmt.bits === 16) s[i] = data.readInt16LE(o) / 32768
    else if (fmt.bits === 24) s[i] = data.readIntLE(o, 3) / 8388608
    else if (fmt.bits === 32) s[i] = data.readInt32LE(o) / 2147483648
  }
  return { samples: s, rate: fmt.rate }
}
const di = readWav(join(root, 'NeuralAmpModelerCore', 'example_audio', 'input.wav'))
const inputF32 = join(out, 'input.f32')
writeFileSync(inputF32, Buffer.from(di.samples.buffer, di.samples.byteOffset, di.samples.byteLength))

// --- the native build of the same engine ---------------------------------------------------------------------------
const exe = join(root, 'dist', 'native', 'rig-native-render.exe')
function buildNative() {
  const nam = join(root, 'NeuralAmpModelerCore', 'NAM')
  const sources = [
    join(root, 'web', 'engine', 'native_render.cpp'), join(root, 'web', 'engine', 'rig_engine.cpp'),
    ...readdirSync(nam).filter((f) => f.endsWith('.cpp')).map((f) => join(nam, f)),
    ...readdirSync(join(nam, 'wavenet')).filter((f) => f.endsWith('.cpp')).map((f) => join(nam, 'wavenet', f)),
    ...['dsp.cpp', 'NoiseGate.cpp', 'RecursiveLinearFilter.cpp'].map((f) => join(root, 'AudioDSPTools', 'dsp', f)),
    join(root, 'NeuralAmpModeler', 'ToneStack.cpp'),
  ]
  const headers = [...readdirSync(join(root, 'web', 'engine')).filter((f) => f.endsWith('.h')).map((f) => join(root, 'web', 'engine', f)), join(root, 'NeuralAmpModeler', 'ResamplingNAM.h')]
  const newest = Math.max(...[...sources, ...headers].map((s) => statSync(s).mtimeMs))
  if (existsSync(exe) && statSync(exe).mtimeMs > newest) return
  const vswhere = join(process.env['ProgramFiles(x86)'], 'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
  const vs = execFileSync(vswhere, ['-latest', '-products', '*', '-property', 'installationPath']).toString().trim()
  const vcvars = join(vs, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
  // A trailing forward slash: a backslash before the closing quote would escape it.
  const objDir = join(root, 'dist', 'native', 'obj')
  const obj = objDir.replace(/\\/g, '/') + '/'
  mkdirSync(join(objDir, 'adt'), { recursive: true })
  // As the desktop compiles (NOMINMAX keeps Windows' min/max macros off std::min). AudioDSPTools' dsp.cpp goes to its
  // own folder, since NAM Core has a dsp.cpp too and cl names objects after the source.
  const flags = ['/nologo', '/std:c++20', '/O2', '/EHsc', '/MT', '/bigobj', '/W0', '/DNAM_ENABLE_A2_FAST', '/DNDEBUG', '/DNOMINMAX',
    `/I"${join(root, 'eigen')}"`, `/I"${join(root, 'NeuralAmpModelerCore', 'Dependencies', 'nlohmann')}"`]
  const adtDsp = join(root, 'AudioDSPTools', 'dsp', 'dsp.cpp')
  const lines = [
    `@call "${vcvars}" >nul`,
    ['cl', '/c', '/MP', ...flags, `/Fo"${obj}"`, ...sources.filter((s) => s !== adtDsp).map((s) => `"${s}"`)].join(' ') + ' || exit /b 1',
    ['cl', '/c', ...flags, `/Fo"${obj}adt/"`, `"${adtDsp}"`].join(' ') + ' || exit /b 1',
    `cl /nologo /MT /Fe"${exe}" "${obj}*.obj" "${obj}adt/*.obj"`,
  ]
  const bat = join(out, 'build-native.bat')
  writeFileSync(bat, lines.join('\r\n') + '\r\n')
  console.log('building the native engine (MSVC)...')
  const r = spawnSync('cmd.exe', ['/d', '/c', bat], { stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.status !== 0 || !existsSync(exe)) throw new Error(`native build failed:\n${r.stdout}\n${r.stderr}`)
}
if (native) buildNative()

// --- the cases --------------------------------------------------------------------------------------------------
const wasm = new WebAssembly.Module(readFileSync(join(root, 'dist', 'engine', 'rig-engine.wasm')))
const models = join(root, 'NeuralAmpModelerCore', 'example_models')
const cases = readdirSync(models).filter((f) => f.endsWith('.nam')).map((f) => ({ name: f, rate: 48000 }))
cases.push({ name: 'wavenet.nam', rate: 44100 }) // the resampler

const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length)
let failures = 0
const rows = []
for (const c of cases) {
  const capture = readFileSync(join(models, c.name))
  const engine = await createEngine(wasm, c.rate, (l) => console.log(`  [engine] ${l}`))
  const loaded = engine.loadCapture(capture)
  const row = { capture: c.name, rate: c.rate }
  if (!loaded.ok) {
    row.result = `not loaded: ${loaded.error.slice(0, 80)}`
  } else {
    const output = new Float32Array(di.samples.length)
    const block = 128, t0 = performance.now()
    for (let at = 0; at < di.samples.length; at += block) {
      const n = Math.min(block, di.samples.length - at)
      engine.process(di.samples.subarray(at, at + n), output.subarray(at, at + n))
    }
    const ms = performance.now() - t0
    row.realtime = `${(di.samples.length / c.rate / (ms / 1000)).toFixed(1)}x`
    row.rms = rms(output).toExponential(2)
    const finite = output.every(Number.isFinite)
    let ok = finite && rms(output) > 1e-5
    if (native) {
      const nativeOut = join(out, `${c.name}-${c.rate}.native.f32`)
      const r = spawnSync(exe, [join(models, c.name), inputF32, nativeOut, String(c.rate), String(block)], { encoding: 'utf8' })
      if (r.status !== 0) { row.native = `failed: ${(r.stderr || '').trim().slice(0, 60)}`; ok = false }
      else {
        const nb = readFileSync(nativeOut), nv = new Float32Array(nb.buffer, nb.byteOffset, nb.byteLength / 4)
        let max = 0, err = 0
        for (let i = 0; i < output.length; i++) { const d = output[i] - nv[i]; max = Math.max(max, Math.abs(d)); err += d * d }
        const snr = 10 * Math.log10(output.reduce((s, v) => s + v * v, 0) / Math.max(err, 1e-30))
        row.maxDiff = max.toExponential(2)
        row.snrDB = snr > 200 ? 'identical' : snr.toFixed(0)
        if (!(max < 1e-3 && snr > 60)) ok = false
      }
    }
    row.result = ok ? 'ok' : 'FAIL'
    if (!ok) failures++
  }
  rows.push(row)
}
console.table(rows)
// A capture neither build can load is a capture NAM Core does not support, not a web failure; the native build is the
// judge, so a wasm refusal the native build accepts is a failure.
if (native) {
  for (const row of rows.filter((r) => r.result.startsWith('not loaded'))) {
    const r = spawnSync(exe, [join(models, row.capture), inputF32, join(out, 'refused.f32'), String(row.rate)], { encoding: 'utf8' })
    if (r.status === 0) { console.log(`FAIL ${row.capture}: the native build loads it, the web build does not`); failures++ }
  }
}

// --- the squeal guard and auto-off (build plan R3; rig_guard.h, scenarios.mjs) -----------------------------------
// Each case plays through both builds: the WebAssembly engine here, and the native one through the harness with the
// same parameters (and, for feedback, the same loop). Both must agree, sample for sample and on what they muted, and
// both must do what the case expects: feedback trips the guard within 300 ms of turning loud (-24 dBFS at its
// frequency), a pulled jack trips auto-off, and nothing else trips either.
const fuzzPath = join(out, 'fuzz.nam')
writeFileSync(fuzzPath, fuzzCapture())
const capturePath = (c) => (c.capture === 'fuzz' ? fuzzPath : join(models, 'wavenet.nam'))
const WHY = ['nothing', 'the squeal guard', 'auto-off (silence)', 'auto-off (hum)']
async function guardEngine(c, extra = {}) {
  const e = await createEngine(wasm, c.rate ?? RATE)
  const loaded = e.loadCapture(readFileSync(capturePath(c)))
  if (!loaded.ok) throw new Error(`${c.name}: ${loaded.error}`)
  for (const [k, v] of Object.entries({ ...(c.params ?? {}), ...extra })) e.setParam(k, v)
  return e
}
const nativeRun = (c, input, extraArgs) => {
  const inFile = join(out, 'guard-in.f32'), outFile = join(out, 'guard-out.f32'), statusFile = join(out, 'guard-status.json')
  writeFileSync(inFile, Buffer.from(input.buffer, input.byteOffset, input.byteLength))
  const args = [capturePath(c), inFile, outFile, String(c.rate ?? RATE), '128', ...Object.entries(c.params ?? {}).flatMap(([k, v]) => ['--param', `${PARAM[k]}=${v}`]), ...extraArgs, '--status', statusFile]
  const r = spawnSync(exe, args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${c.name}: the native harness exited ${r.status} ${(r.stderr || '').trim()}`)
  const b = readFileSync(outFile)
  return { output: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), status: JSON.parse(readFileSync(statusFile, 'utf8')) }
}
const sameRun = (a, b, sa, sb) => {
  let max = 0
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]))
  const status = sa.muted === sb.muted && sa.trips === sb.trips && Math.abs(sa.hz - sb.hz) < 1e-6 * Math.max(1, sa.hz) && Math.abs(sa.at - sb.at) < 1e-9
  return { ok: a.length === b.length && max < 1e-3 && status, max }
}
const guardRows = []
for (const c of openCases(di)) {
  const e = await guardEngine(c), o = new Float32Array(c.input.length)
  for (let at = 0; at < c.input.length; at += 128) e.process(c.input.subarray(at, at + 128), o.subarray(at, at + 128))
  const s = e.status()
  let ok = s.muted === c.expect.why && (c.expect.hz === undefined || Math.abs(s.hz - c.expect.hz) < 1)
  const row = { case: c.name, muted: WHY[s.muted], at: s.muted ? `${s.at.toFixed(3)} s` : '' }
  if (native) { const n = nativeRun(c, c.input, []), same = sameRun(o, n.output, s, n.status); row.native = same.ok ? 'same' : `differs (${same.max.toExponential(1)}, ${WHY[n.status.muted]})`; ok &&= same.ok }
  row.result = ok ? 'ok' : 'FAIL'
  if (!ok) failures++
  guardRows.push(row)
}
for (const c of loopCases()) {
  const rate = c.rate ?? RATE
  // The engine's own small-signal gain at the resonance (the guard off), so the loop's gain is the case's.
  const probe = await guardEngine(c, { guardOn: 0, autoOff: 0 }), n = Math.round(0.6 * rate), x = new Float32Array(n), y = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = 0.003 * Math.sin((2 * Math.PI * c.hz * i) / rate)
  for (let at = 0; at < n; at += 128) probe.process(x.subarray(at, at + 128), y.subarray(at, at + 128))
  let re = 0, im = 0
  const w = Math.round(0.2 * rate)
  for (let i = n - w; i < n; i++) { const p = (2 * Math.PI * c.hz * i) / rate; re += y[i] * Math.cos(p); im -= y[i] * Math.sin(p) }
  const gain = c.loop / ((2 * Math.hypot(re, im)) / w / 0.003), coef = resonance(c.hz, 8, rate), delay = Math.round(0.007 * rate)
  const excitation = loopExcitation(c, di), e = await guardEngine(c)
  const o = runLoop((i, oo) => e.process(i, oo), excitation, coef, gain, delay)
  const s = e.status(), loud = firstLoud(o, s.hz || c.hz, rate)
  const late = s.muted === 1 ? (loud === null ? 0 : s.at - loud) : null
  let ok = s.muted === 1 && Math.abs(s.hz - c.hz) / c.hz < 0.08 && late !== null && late <= 0.3
  const row = { case: c.name, muted: WHY[s.muted], at: s.muted ? `${s.at.toFixed(3)} s, ${s.hz.toFixed(0)} Hz, ${loud === null ? 'before it was loud' : `${(late * 1000).toFixed(0)} ms after loud`}` : '' }
  if (native) {
    const loopArg = [...coef, gain].map((v) => v.toPrecision(17)).join(',') + `,${delay}`
    const nr = nativeRun(c, excitation, ['--loop', loopArg]), same = sameRun(o, nr.output, s, nr.status)
    row.native = same.ok ? 'same' : `differs (${same.max.toExponential(1)}, ${WHY[nr.status.muted]})`
    ok &&= same.ok
  }
  row.result = ok ? 'ok' : 'FAIL'
  if (!ok) failures++
  guardRows.push(row)
}
console.table(guardRows)

// Standby and the way back, in the engine: a 20 ms fade out, the input still heard, and a fade back in; a trip lifted
// by clearTrip (the page's "Turn back on").
{
  const e = await guardEngine({}), tone = new Float32Array(128), o = new Float32Array(128)
  for (let i = 0; i < 128; i++) tone[i] = 0.1 * Math.sin((2 * Math.PI * 375 * i) / RATE) // whole cycles in a block
  const blocks = (k) => { let peak = 0; for (let j = 0; j < k; j++) { e.process(tone, o); for (const v of o) peak = Math.max(peak, Math.abs(v)) } return peak }
  e.setParam('guardOn', 0) // a steady tone: the guard would ask about it
  const on = blocks(40)
  e.setParam('standby', 1)
  blocks(8) // 1024 samples: the 960 of the fade, and a little
  e.takeInputPeak()
  const quiet = blocks(10), heard = e.takeInputPeak()
  e.setParam('standby', 0)
  blocks(8)
  const back = blocks(10)
  const fade = on > 1e-3 && quiet === 0 && heard > 0.05 && Math.abs(back / on - 1) < 0.05
  console.log(`${fade ? 'ok  ' : 'FAIL'}  Standby fades out in 20 ms with the input heard, and back (${on.toExponential(2)} -> ${quiet} -> ${back.toExponential(2)})`)
  if (!fade) failures++
  // a pulled jack, then the person turns the output back on
  const j = openCases(di).find((c) => c.name === 'pulled jack, then dead silence'), jo = new Float32Array(j.input.length)
  const f = await guardEngine(j)
  for (let at = 0; at < j.input.length; at += 128) f.process(j.input.subarray(at, at + 128), jo.subarray(at, at + 128))
  const tripped = f.status().muted === 2
  f.setParam('clearTrip', 1)
  const lifted = f.status().muted === 0 && f.status().trips === 1
  console.log(`${tripped && lifted ? 'ok  ' : 'FAIL'}  Turning the output back on lifts auto-off's mute`)
  if (!(tripped && lifted)) failures++
}
// --- slots and switches (build plan R5) --------------------------------------------------------------------------
// Two of NAM Core's captures as two pads: the standard WaveNet (TONE3000's common kind) and A2. A note rings (110 Hz,
// plucked), and 0.67 s in, the pad changes. The gate and the EQ are off here: the gate follows the input, and the
// references below play each capture alone, one of them from silence, and fade them after the chain, where the engine
// fades before its EQ and DC blocker (filters a fade does not commute with; the DC blocker's 5 Hz is all that is left).
// The guard and auto-off are off: a steady note is what the guard asks about.
{
  const B = 128, PRE = 100, SW = PRE + 250, MS = 30
  const capA = join(models, 'wavenet_a1_standard.nam'), capB = join(models, 'A2.nam')
  const packA = packCapture(readFileSync(capA)), packB = packCapture(readFileSync(capB))
  const note = pluck(110, 2.5, { t60: 6, peak: 0.5 })
  const input = new Float32Array(PRE * B + note.length)
  input.set(note, PRE * B)
  const base = { guardOn: 0, autoOff: 0, gateOn: 0, eqOn: 0, switchMs: MS, warmRate: 64 }
  // Plays `input` through an engine with these slots and asks, block by block, for what `timeline` says ({ block: slot }).
  // `before` is called before each block (to load a slot mid-way).
  async function render(slots, timeline, params, src = input, before = () => {}) {
    const e = await createEngine(wasm, RATE)
    for (const [k, v] of Object.entries({ ...base, ...params })) e.setParam(k, v)
    for (const [s, packed] of Object.entries(slots)) { const r = e.loadSlot(Number(s), packed); if (!r.ok) throw new Error(r.error) }
    const out = new Float32Array(src.length)
    for (let b = 0, at = 0; at < src.length; b++, at += B) {
      before(e, b)
      if (b in timeline) e.play(timeline[b])
      e.process(src.subarray(at, at + B), out.subarray(at, at + B))
    }
    return { out, slots: e.slots() }
  }
  const nativeSwitch = (params, timeline, slotFiles, src = input) => {
    const inFile = join(out, 'switch-in.f32'), outFile = join(out, 'switch-out.f32'), statusFile = join(out, 'switch-status.json')
    writeFileSync(inFile, Buffer.from(src.buffer, src.byteOffset, src.byteLength))
    const args = ['-', inFile, outFile, String(RATE), String(B),
      ...Object.entries({ ...base, ...params }).flatMap(([k, v]) => ['--param', `${PARAM[k]}=${v}`]),
      ...Object.entries(slotFiles).flatMap(([s, f]) => ['--slot', `${s}=${f}`]),
      ...Object.entries(timeline).flatMap(([b, s]) => ['--at', `${b}:${PARAM.play}=${s}`]), '--status', statusFile]
    const r = spawnSync(exe, args, { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`the native harness exited ${r.status} ${(r.stderr || '').trim()}`)
    const b = readFileSync(outFile)
    return { out: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), status: JSON.parse(readFileSync(statusFile, 'utf8')) }
  }
  const peakOf = (a, from, to) => { let m = 0; for (let i = Math.max(0, from); i < Math.min(a.length, to); i++) m = Math.max(m, Math.abs(a[i])); return m }
  const env = (a, at, w = 120) => { let s = 0; for (let i = at; i < at + w; i++) s += a[i] * a[i]; return Math.sqrt(s / w) }
  const maxDiff = (a, b, from = 0, to = a.length) => { let m = 0; for (let i = from; i < to; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m }
  const rows = []
  const row = (name, ok, detail) => { rows.push({ case: name, detail, result: ok ? 'ok' : 'FAIL' }); if (!ok) failures++ }

  // A switch, crossfade and dip, against the reference: A alone; B alone from silence until it comes in; mixed with the
  // engine's own curves (equal power for the crossfade, a raised cosine out and then in for the dip).
  // A alone, with the same settings as the run it is compared with (its own first fade, from no capture, differs by mode).
  const aloneA = (params) => render({ 1: packA }, { 0: 1 }, params).then((r) => r.out)
  for (const [mode, label] of [[0, 'crossfade'], [1, 'dip']]) {
    const refA = await aloneA({ switchMode: mode })
    const run = await render({ 1: packA, 2: packB }, { 0: 1, [SW]: 2 }, { switchMode: mode })
    const S = run.slots.switchAt, L = Math.round((MS / 1000) * RATE), half = L >> 1, startB = mode ? S + half : S
    const quiet = input.slice(); quiet.fill(0, 0, startB)
    const refB = (await render({ 1: packB }, { 0: 1 }, { switchMode: mode }, quiet)).out
    const ref = new Float32Array(input.length)
    for (let n = 0; n < ref.length; n++) {
      if (n < S) ref[n] = refA[n]
      else if (n >= S + L) ref[n] = refB[n]
      else if (!mode) { const t = (n - S) / L; ref[n] = Math.cos((t * Math.PI) / 2) * refA[n] + Math.sin((t * Math.PI) / 2) * refB[n] }
      else if (n < S + half) ref[n] = 0.5 * (1 + Math.cos((Math.PI * (n - S)) / half)) * refA[n]
      else ref[n] = 0.5 * (1 - Math.cos((Math.PI * (n - S - half)) / (L - half))) * refB[n]
    }
    // A click is broadband; what the references cannot hold is slow: the note's own DC (an asymmetric capture's mean under
    // a note) moves from A's to B's in front of the 5 Hz DC blocker, a bump under 20 Hz dying over 100 ms. So the residual
    // is judged above 100 Hz (two one-pole high-passes), with the whole band as a looser check.
    const from = S - 2400, to = S + L + 9600, peak = peakOf(ref, from, to)
    const diff = new Float64Array(to - from)
    for (let n = from; n < to; n++) diff[n - from] = run.out[n] - ref[n]
    const a = Math.exp((-2 * Math.PI * 100) / RATE)
    for (let pass = 0; pass < 2; pass++) { let px = 0, py = 0; for (let i = 0; i < diff.length; i++) { const x = diff[i]; py = a * (py + x - px); px = x; diff[i] = py } }
    const clickDB = 20 * Math.log10(diff.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / peak)
    const errDB = 20 * Math.log10(maxDiff(run.out, ref, from, to) / peak)
    const untouched = maxDiff(run.out, refA, 0, S) === 0
    // the gap: 2.5 ms windows through the switch, against the quieter capture's level just before and just after it
    const level = Math.min(env(refA, S - 240), env(refB, S + L + 120))
    let lowest = Infinity, under = 0
    for (let n = S; n + 120 <= S + L; n += 120) {
      const r = env(run.out, n) / level
      lowest = Math.min(lowest, r)
      if (r < 0.1) under += 120
    }
    const gapOk = mode ? (under / RATE) * 1000 < 10 : lowest > 0.5
    let ok = S === SW * B && untouched && clickDB < -45 && errDB < -30 && gapOk
    let detail = `starts at block ${S / B}; above 100 Hz ${clickDB.toFixed(0)} dB from the reference (${errDB.toFixed(0)} dB in all); ${mode ? `under -20 dB for ${((under / RATE) * 1000).toFixed(1)} ms` : `never below ${(20 * Math.log10(lowest)).toFixed(1)} dB of the quieter`}; before it, ${untouched ? 'identical to A alone' : 'NOT A alone'}`
    if (native) {
      const n = nativeSwitch({ switchMode: mode }, { 0: 1, [SW]: 2 }, { 1: capA, 2: capB }), d = maxDiff(run.out, n.out)
      ok &&= d < 1e-3 && n.status.switchAt === S
      detail += `; native ${d < 1e-3 && n.status.switchAt === S ? `same (${d.toExponential(1)})` : `DIFFERS (${d.toExponential(1)}, at ${n.status.switchAt})`}`
    }
    row(`a ${label} of ${MS} ms while a note rings`, ok, detail)
  }

  // A capture loaded and warmed while another plays (a browser's way: the page sends it, the audio thread builds it and
  // warms it a little per block), then asked for at once: the sound is A alone, sample for sample, until the switch,
  // which waits for the warm. As the web version runs it: a warm rate of 0.25 and a dip.
  {
    const LOAD = PRE + 60
    const run = await render({ 1: packA }, { 0: 1 }, { switchMode: 1, warmRate: 0.25 }, input, (e, b) => { if (b === LOAD) { const r = e.loadSlot(3, packB); if (!r.ok) throw new Error(r.error); e.play(3) } })
    const S = run.slots.switchAt, waited = (S - LOAD * B) / RATE
    const untouched = maxDiff(run.out, await aloneA({ switchMode: 1, warmRate: 0.25 }), 0, S) === 0
    row('a capture loaded while another plays, and asked for at once', untouched && waited > 0.05 && waited < 1 && run.slots.playing === 3,
      `${untouched ? 'nothing heard changed' : 'THE SOUND CHANGED'} until the switch; the switch waited ${(waited * 1000).toFixed(0)} ms for the warm`)
  }

  // Back to the pad just left: it is warming again, and may be heard at once (its histories are a real signal's).
  {
    const run = await render({ 1: packA, 2: packB }, { 0: 1, [SW]: 2, [SW + 12]: 1 }, { switchMode: 1, warmRate: 0.25 })
    const back = run.slots.switchAt, first = SW * B, L = Math.round((MS / 1000) * RATE)
    row('back to the pad just left, while it warms again', run.slots.playing === 1 && back >= first + L && back <= first + L + 2 * B,
      `the second switch began ${((back - first) / RATE * 1000).toFixed(1)} ms after the first`)
  }

  // Floats handed over (the page's way) and text read by the engine give the same capture, sample for sample.
  {
    let worst = 0
    for (const f of ['wavenet_a1_standard.nam', 'A2.nam', 'slimmable_container.nam', 'wavenet_condition_dsp.nam', 'lstm.nam']) {
      const bytes = readFileSync(join(models, f))
      const viaText = (await render({ 1: bytes }, { 0: 1 }, {}, input.subarray(0, (PRE + 120) * B))).out
      const viaFloats = (await render({ 1: packCapture(bytes) }, { 0: 1 }, {}, input.subarray(0, (PRE + 120) * B))).out
      worst = Math.max(worst, maxDiff(viaText, viaFloats))
    }
    row('weights as floats against the same capture as text (five kinds)', worst === 0, worst === 0 ? 'identical' : `differ by ${worst.toExponential(1)}`)
  }
  console.table(rows)
}

// --- pedals in series (build plan R6) ----------------------------------------------------------------------------
// Pedals before the amp: NAM Core's small WaveNet and a standard one, then the standard WaveNet A1 as the amp. The references build the chain by hand, stage by stage: each pedal's capture alone and raw (rig_slot_render), its Drive
// and Level applied, its switch's fade mixed with the engine's own curves, and the result played into the amp alone.
// The amp then hears exactly what the chain gave it, so the chain must equal it to float rounding (the references
// round each stage to 32 bits; the engine keeps 64 between stages). WaveNets only: after silence, a WaveNet's state is
// the same however long the silence was, so a pedal that idled differs from one that played silence by nothing.
{
  const B = 128, PRE = 100, SW = PRE + 250, MS = 30, L = Math.round((MS / 1000) * RATE)
  const files = { p1: 'wavenet.nam', p2: 'my_model.nam', amp: 'wavenet_a1_standard.nam' }
  const pack = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, packCapture(readFileSync(join(models, f)))]))
  const note = pluck(110, 2.5, { t60: 6, peak: 0.5 })
  const input = new Float32Array(PRE * B + note.length)
  input.set(note, PRE * B)
  const base = { guardOn: 0, autoOff: 0, gateOn: 0, eqOn: 1, switchMs: MS, warmRate: 64 }
  const AMP = 1, PA = 12, PB = 13, PC = 14
  const dB = (v) => 10 ** (v / 20)
  const rows = []
  const row = (name, ok, detail) => { rows.push({ case: name, detail, result: ok ? 'ok' : 'FAIL' }); if (!ok) failures++ }
  const worstDB = (a, b, from = 0, to = a.length) => {
    let m = 0, peak = 0
    for (let i = from; i < to; i++) { m = Math.max(m, Math.abs(a[i] - b[i])); peak = Math.max(peak, Math.abs(b[i])) }
    return m === 0 ? -Infinity : 20 * Math.log10(m / peak)
  }
  // The chain: these slots, these settings, and block by block what the timeline sets ({ block: { param: value } }).
  async function chain(slots, timeline, params = {}, src = input) {
    const e = await createEngine(wasm, RATE)
    for (const [k, v] of Object.entries({ ...base, ...params })) e.setParam(k, v)
    for (const [s, p] of Object.entries(slots)) { const r = e.loadSlot(Number(s), p); if (!r.ok) throw new Error(r.error) }
    const out = new Float32Array(src.length)
    for (let b = 0, at = 0; at < src.length; b++, at += B) {
      for (const [k, v] of Object.entries(timeline[b] ?? {})) e.setParam(k, v)
      e.process(src.subarray(at, at + B), out.subarray(at, at + B))
    }
    return { out, slots: e.slots() }
  }
  // One capture alone and raw, warmed first as the engine warms a slot nothing hears.
  async function alone(packed, src) {
    const e = await createEngine(wasm, RATE)
    e.setParam('warmRate', 64)
    const r = e.loadSlot(0, packed)
    if (!r.ok) throw new Error(r.error)
    const z = new Float32Array(B), o = new Float32Array(B)
    for (let i = 0; i < 64 && !e.slots().ready.includes(0); i++) e.process(z, o)
    const out = new Float32Array(src.length)
    if (!e.renderSlot(0, src, out)) throw new Error('the slot would not play alone')
    return out
  }
  const ampAlone = async (src, params = {}) => (await chain({ [AMP]: pack.amp }, { 0: { play: AMP } }, params, src)).out
  const scaled = (a, g) => a.map((v) => v * g)
  const silentBefore = (a, at) => { const q = a.slice(); q.fill(0, 0, at); return q }
  const nativeChain = (params, timeline, slotFiles) => {
    const inFile = join(out, 'pedal-in.f32'), outFile = join(out, 'pedal-out.f32'), statusFile = join(out, 'pedal-status.json')
    writeFileSync(inFile, Buffer.from(input.buffer, input.byteOffset, input.byteLength))
    const args = ['-', inFile, outFile, String(RATE), String(B),
      ...Object.entries({ ...base, ...params }).flatMap(([k, v]) => ['--param', `${PARAM[k]}=${v}`]),
      ...Object.entries(slotFiles).flatMap(([s, f]) => ['--slot', `${s}=${join(models, files[f])}`]),
      ...Object.entries(timeline).flatMap(([b, set]) => Object.entries(set).map(([k, v]) => ['--at', `${b}:${PARAM[k]}=${v}`]).flat())]
    args.push('--status', statusFile)
    const r = spawnSync(exe, args, { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`the native harness exited ${r.status} ${(r.stderr || '').trim()}`)
    const b = readFileSync(outFile)
    return { out: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), status: JSON.parse(readFileSync(statusFile, 'utf8')) }
  }
  const withNative = (run, params, timeline, slotFiles, detail, from = 0) => {
    if (!native) return [true, detail]
    const n = nativeChain(params, timeline, slotFiles)
    let d = 0
    for (let i = from; i < run.out.length; i++) d = Math.max(d, Math.abs(run.out[i] - n.out[i]))
    const same = d < 1e-3 && n.status.pedalSwitchAt === run.slots.pedalSwitchAt
    return [same, `${detail}; native ${same ? `same (${d.toExponential(1)})` : `DIFFERS (${d.toExponential(1)}, at ${n.status.pedalSwitchAt})`}`]
  }

  // Two pedals and the amp, equal to its stages one by one from the note on. Before it, the chain and the reference may
  // differ by a capture's first breath after its warm (about 3e-6 from a standard WaveNet, -110 dBFS), heard at a
  // different moment in each (the reference's pedals play from the first sample, the chain's fade in a block later);
  // the amp magnifies it, so before the note it is held under -60 dBFS. Then one pedal driven 6 dB harder and 4 dB
  // quieter out. Three gain stages magnify small differences a great deal: driving both pedals and the amp magnifies
  // the references' 32-bit rounding about 85 dB, and a standard WaveNet as the second pedal magnifies the 7e-7 by which
  // MSVC's and the wasm's standard WaveNet differ (the first table) to 3.6e-3 at the amp. So each property is checked
  // where differences stay small: the series is the small WaveNet twice (two captures in two slots), which both builds
  // play identically.
  for (const [name, slots, timeline, params, refOf] of [
    ['two pedals in series, then the amp', { [AMP]: 'amp', [PA]: 'p1', [PC]: 'p1' }, { 0: { play: AMP, pedal1: PA, pedal2: PC } }, {},
      async () => alone(pack.p1, await alone(pack.p1, input))],
    ["a pedal's Drive (+6 dB) and Level (-4 dB)", { [AMP]: 'amp', [PA]: 'p1' }, { 0: { play: AMP, pedal1: PA } }, { pedalDrive1: 6, pedalLevel1: -4 },
      async () => scaled(await alone(pack.p1, scaled(input, dB(6))), dB(-4))],
  ]) {
    const run = await chain(Object.fromEntries(Object.entries(slots).map(([s, k]) => [s, pack[k]])), timeline, params)
    const ref = await ampAlone(await refOf())
    const err = worstDB(run.out, ref, PRE * B)
    let early = 0
    for (let i = 0; i < PRE * B; i++) early = Math.max(early, Math.abs(run.out[i] - ref[i]))
    const earlyDB = 20 * Math.log10(Math.max(early, 1e-30))
    const p = run.slots.pedals
    const heard = Object.keys(timeline[0]).filter((k) => k.startsWith('pedal')).every((k) => p[Number(k.slice(5)) - 1].playing === timeline[0][k])
    const [ok, detail] = withNative(run, params, timeline, slots,
      `${err === -Infinity ? "identical to" : `${err.toFixed(0)} dB from`} the stages run one after another, from the note on (${early === 0 ? "identical" : `${earlyDB.toFixed(0)} dBFS`} before it); pedals hear ${p.map((x) => x.playing).join(', ')}`, PRE * B)
    row(name, ok && err < -80 && earlyDB < -60 && heard, detail)
  }

  // A pedal stomped on, and off, while a note rings: a crossfade against the dry signal in both switch modes (it costs
  // one capture, so a browser does not dip), equal to the reference, and the amp alone until the stomp.
  for (const [on, label] of [[true, 'on'], [false, 'off']]) {
    for (const mode of [0, 1]) {
      const timeline = on ? { 0: { play: AMP }, [SW]: { pedal1: PA } } : { 0: { play: AMP, pedal1: PA }, [SW]: { pedal1: -1 } }
      const run = await chain({ [AMP]: pack.amp, [PA]: pack.p1 }, timeline, { switchMode: mode })
      const S = run.slots.pedalSwitchAt
      const pedal = await alone(pack.p1, on ? silentBefore(input, S) : input)
      const y = new Float32Array(input.length)
      for (let n = 0; n < y.length; n++) {
        const [a, b] = on ? [input[n], pedal[n]] : [pedal[n], input[n]] // going out, coming in
        if (n < S) y[n] = a
        else if (n >= S + L) y[n] = b
        else { const t = (n - S) / L; y[n] = Math.cos((t * Math.PI) / 2) * a + Math.sin((t * Math.PI) / 2) * b }
      }
      const ref = await ampAlone(y, { switchMode: mode })
      const err = worstDB(run.out, ref), before = worstDB(run.out, ref, 0, S)
      const [ok, detail] = withNative(run, { switchMode: mode }, timeline, { [AMP]: 'amp', [PA]: 'p1' },
        `starts at block ${S / B}; ${err.toFixed(0)} dB from a crossfade made by hand (${before === -Infinity ? 'identical' : `${before.toFixed(0)} dB`} before it)`)
      row(`a pedal stomped ${label} while a note rings (${mode ? 'a browser' : 'the desktop'})`, ok && S === SW * B && err < -80, detail)
    }
  }

  // One pedal swapped for another in its place while a note rings: a crossfade on the desktop, a dip in a browser (two
  // captures in one stage), each equal to the reference.
  for (const [mode, label] of [[0, 'crossfade'], [1, 'dip']]) {
    const timeline = { 0: { play: AMP, pedal1: PA }, [SW]: { pedal1: PB } }
    const run = await chain({ [AMP]: pack.amp, [PA]: pack.p1, [PB]: pack.p2 }, timeline, { switchMode: mode })
    const S = run.slots.pedalSwitchAt, half = L >> 1
    const a = await alone(pack.p1, input), b = await alone(pack.p2, silentBefore(input, mode ? S + half : S))
    const y = new Float32Array(input.length)
    for (let n = 0; n < y.length; n++) {
      if (n < S) y[n] = a[n]
      else if (n >= S + L) y[n] = b[n]
      else if (!mode) { const t = (n - S) / L; y[n] = Math.cos((t * Math.PI) / 2) * a[n] + Math.sin((t * Math.PI) / 2) * b[n] }
      else if (n < S + half) y[n] = 0.5 * (1 + Math.cos((Math.PI * (n - S)) / half)) * a[n]
      else y[n] = 0.5 * (1 - Math.cos((Math.PI * (n - S - half)) / (L - half))) * b[n]
    }
    const ref = await ampAlone(y, { switchMode: mode })
    const err = worstDB(run.out, ref)
    const [ok, detail] = withNative(run, { switchMode: mode }, timeline, { [AMP]: 'amp', [PA]: 'p1', [PB]: 'p2' },
      `starts at block ${S / B}; ${err.toFixed(0)} dB from a ${label} made by hand`)
    row(`a pedal swapped for another while a note rings (a ${label})`, ok && S === SW * B && err < -80, detail)
  }

  // A capture plays in one place at a time: a pedal asked for the amp's slot stays as it was.
  {
    const run = await chain({ [AMP]: pack.amp }, { 0: { play: AMP }, 5: { pedal1: AMP } }, {}, input.subarray(0, 40 * B))
    row('a pedal asked for the slot the amp hears', run.slots.pedals[0].playing === -1 && run.slots.playing === AMP, `pedal 1 hears ${run.slots.pedals[0].playing}, the amp ${run.slots.playing}`)
  }
  console.table(rows)
}

console.log(failures ? `${failures} FAILED` : 'web engine: all cases pass')
process.exit(failures ? 1 : 0)
