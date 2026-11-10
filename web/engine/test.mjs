// The web engine's test: every example capture NAM Core ships, played through the WebAssembly engine
// (dist/engine/rig-engine.wasm) and through the same engine source built natively with MSVC (the desktop's compiler),
// compared sample by sample, with the WebAssembly engine's speed against real time.
// Run from the repo root after node web/engine/build.mjs:   node web/engine/test.mjs [--no-native]
//
// The input is NAM Core's example DI clip (example_audio/input.wav, 24-bit, 48 kHz). The chain is the engine's
// defaults, which are the desktop's (gate at -80 dB, EQ flat at 5/5/5, normalized output). One case runs the engine at
// 44.1 kHz so a 48 kHz capture goes through the desktop's resampler (ResamplingNAM) in both builds.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createEngine } from '../src/engine.js'

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
  const newest = Math.max(...sources.map((s) => statSync(s).mtimeMs))
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
console.log(failures ? `${failures} FAILED` : 'web engine: all cases pass')
process.exit(failures ? 1 : 0)
