// Builds CRBN Rig's web engine (rig_engine.cpp with NAM Core, AudioDSPTools and the desktop's tone stack and
// resampler) into dist/engine/rig-engine.wasm: standalone WebAssembly with no JavaScript glue, so the AudioWorklet can
// instantiate it directly (web/src/rig-processor.js). Run from the repo root: node web/engine/build.mjs
//
// The toolchain is the emscripten SDK pinned in EMSDK_VERSION, installed once at %LOCALAPPDATA%\emsdk (or $EMSDK).
// Objects are cached in dist/engine/obj and rebuilt when their source or this file is newer. Nothing is fetched.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'

export const EMSDK_VERSION = '6.0.13'
const root = resolve(import.meta.dirname, '..', '..')
const emsdk = process.env.EMSDK ?? join(process.env.LOCALAPPDATA ?? '', 'emsdk')
const emscripten = join(emsdk, 'upstream', 'emscripten')
// em++, not emcc: the link needs libc++.
const emcc = join(emscripten, process.platform === 'win32' ? 'em++.exe' : 'em++')
if (!existsSync(emcc)) throw new Error(`no em++ at ${emcc}: install the emscripten SDK ${EMSDK_VERSION} (emsdk install ${EMSDK_VERSION} && emsdk activate ${EMSDK_VERSION})`)

const pythonDir = join(emsdk, 'python')
const python = existsSync(pythonDir) ? readdirSync(pythonDir).map((d) => join(pythonDir, d, 'python.exe')).find(existsSync) : undefined
const env = { ...process.env, EMSDK: emsdk, EM_CONFIG: join(emsdk, '.emscripten'), ...(python ? { EMSDK_PYTHON: python } : {}) }

const nam = join(root, 'NeuralAmpModelerCore', 'NAM')
const sources = [
  join(root, 'web', 'engine', 'rig_engine.cpp'),
  ...readdirSync(nam).filter((f) => f.endsWith('.cpp')).map((f) => join(nam, f)),
  ...readdirSync(join(nam, 'wavenet')).filter((f) => f.endsWith('.cpp')).map((f) => join(nam, 'wavenet', f)),
  join(root, 'AudioDSPTools', 'dsp', 'dsp.cpp'),
  join(root, 'AudioDSPTools', 'dsp', 'NoiseGate.cpp'),
  join(root, 'AudioDSPTools', 'dsp', 'RecursiveLinearFilter.cpp'),
  join(root, 'NeuralAmpModeler', 'ToneStack.cpp'),
]

const cflags = [
  '-std=c++20', '-O3', '-msimd128', '-fwasm-exceptions',
  // As the desktop builds NAM Core (NeuralAmpModeler-win.props); doubles at the edges, as iPlug2's samples are.
  '-DNAM_ENABLE_A2_FAST', '-DEIGEN_DONT_PARALLELIZE', '-DNDEBUG',
  // iPlug2's IPlugPlatform.h (reached through ResamplingNAM.h) still looks for the old EMSCRIPTEN macro.
  '-DEMSCRIPTEN',
  `-I${join(root, 'eigen')}`, `-I${join(root, 'NeuralAmpModelerCore', 'Dependencies', 'nlohmann')}`,
  '-Wno-deprecated-declarations', '-Wno-unused-command-line-argument',
]
const exports = ['rig_init', 'rig_input', 'rig_output', 'rig_process', 'rig_set_param', 'rig_text_buffer', 'rig_load_model',
  'rig_error', 'rig_clear_model', 'rig_info', 'rig_take_input_peak', 'rig_status', 'rig_slot_load', 'rig_slot_clear', 'rig_slot_info', 'rig_weights_buffer', 'rig_slot_render']
const ldflags = [
  '-O3', '-msimd128', '-fwasm-exceptions', '-sSTANDALONE_WASM=1', '--no-entry', '-sFILESYSTEM=0',
  '-sALLOW_MEMORY_GROWTH=1', '-sINITIAL_MEMORY=33554432', '-sSTACK_SIZE=1048576', '-sERROR_ON_UNDEFINED_SYMBOLS=1',
  `-sEXPORTED_FUNCTIONS=${exports.map((e) => '_' + e).join(',')}`,
]

const out = join(root, 'dist', 'engine')
const objDir = join(out, 'obj')
mkdirSync(objDir, { recursive: true })
const run = (args) => new Promise((ok, fail) => {
  const p = spawn(emcc, args, { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] })
  p.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`em++ exited ${code}: ${args.filter((a) => !a.startsWith('-')).map((a) => relative(root, a)).join(' ')}`))))
})
const quote = (p) => p

const self = statSync(import.meta.filename).mtimeMs
const started = Date.now()
// Objects are named by their path, since NAM Core and AudioDSPTools each have a dsp.cpp.
const objects = sources.map((src) => ({ src, obj: join(objDir, relative(root, src).replace(/[\\/]/g, '__').replace(/\.cpp$/, '.o')) }))
// rig_engine.cpp includes the engine's own headers (rig_guard.h) and the desktop's ResamplingNAM.h, so it is as new as
// the newest of them.
const engineHeaders = [...readdirSync(join(root, 'web', 'engine')).filter((f) => f.endsWith('.h')).map((f) => join(root, 'web', 'engine', f)), join(root, 'NeuralAmpModeler', 'ResamplingNAM.h')].map((f) => statSync(f).mtimeMs)
const newest = (src) => (basename(src) === 'rig_engine.cpp' ? Math.max(statSync(src).mtimeMs, ...engineHeaders) : statSync(src).mtimeMs)
const stale = objects.filter(({ src, obj }) => !existsSync(obj) || statSync(obj).mtimeMs < Math.max(newest(src), self))
const jobs = Math.max(1, Math.min(stale.length, Math.floor(cpus().length / 2)))
let next = 0
await Promise.all(Array.from({ length: jobs }, async () => {
  while (next < stale.length) {
    const { src, obj } = stale[next++]
    await run(['-c', quote(src), '-o', quote(obj), ...cflags])
  }
}))
const wasm = join(out, 'rig-engine.wasm')
await run([...objects.map(({ obj }) => quote(obj)), '-o', quote(wasm), ...ldflags])
const size = statSync(wasm).size
writeFileSync(join(out, 'rig-engine.json'), JSON.stringify({ emsdk: EMSDK_VERSION, exports, bytes: size, builtAt: new Date().toISOString() }, null, 2) + '\n')
console.log(`engine: ${relative(root, wasm)} ${(size / 1024).toFixed(0)} KiB (${stale.length} of ${objects.length} compiled, ${((Date.now() - started) / 1000).toFixed(0)} s)`)
