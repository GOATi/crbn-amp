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
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PARAM, createEngine } from '../src/engine.js'
import { RATE, firstLoud, fuzzCapture, loopCases, loopExcitation, openCases, resonance, runLoop } from './scenarios.mjs'

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
  const headers = readdirSync(join(root, 'web', 'engine')).filter((f) => f.endsWith('.h')).map((f) => join(root, 'web', 'engine', f))
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
console.log(failures ? `${failures} FAILED` : 'web engine: all cases pass')
process.exit(failures ? 1 : 0)
