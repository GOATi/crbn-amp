// Builds CRBN Rig's web version into dist/web, the folder hosting/kit/publish.mjs uploads (D-CRBN-021 (d)).
//   node web/build.mjs [--skip-engine]
//
// dist/web holds the page (web/src, without the looks package's TypeScript sources), the engine
// (dist/engine/rig-engine.wasm, built by web/engine/build.mjs), the demo riff and example capture from NAM Core, the
// licences (LICENSE.txt, ThirdPartyNotices.txt with the web engine's runtime added, NOTICE.txt, MODIFIED-FILES.txt)
// and build.json naming the build. Nothing is fetched.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = join(root, 'dist', 'web')
const git = (...a) => execFileSync('git', ['-C', root, ...a]).toString().trim()

if (!process.argv.includes('--skip-engine')) execFileSync(process.execPath, [join(root, 'web', 'engine', 'build.mjs')], { stdio: 'inherit' })
const engine = join(root, 'dist', 'engine', 'rig-engine.wasm')
if (!existsSync(engine)) throw new Error('dist/engine/rig-engine.wasm is missing: run node web/engine/build.mjs')
const { emsdk } = JSON.parse(readFileSync(join(root, 'dist', 'engine', 'rig-engine.json'), 'utf8'))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
// The page, less the looks package's TypeScript (the page reads looks.json and themes.css; the .ts files are for the
// apps that build).
cpSync(join(root, 'web', 'src'), out, { recursive: true, filter: (src) => !src.endsWith('.ts') })
cpSync(engine, join(out, 'rig-engine.wasm'))
mkdirSync(join(out, 'demo'))
cpSync(join(root, 'NeuralAmpModelerCore', 'example_audio', 'input.wav'), join(out, 'demo', 'di.wav'))
cpSync(join(root, 'NeuralAmpModelerCore', 'example_models', 'wavenet.nam'), join(out, 'demo', 'example.nam'))

// The licences. The desktop's notices cover NAM Core, AudioDSPTools, nlohmann/json, Eigen and the Lanczos resampler;
// the web engine adds the runtime emscripten compiles into it.
const em = join(process.env.EMSDK ?? join(process.env.LOCALAPPDATA ?? '', 'emsdk'), 'upstream', 'emscripten')
const section = (title, body) => `\n\n${title}\n${'-'.repeat(title.length)}\n\n${body.replace(/\r\n/g, '\n').trim()}\n`
let notices = readFileSync(join(root, 'NeuralAmpModeler', 'installer', 'ThirdPartyNotices.txt'), 'utf8').replace(/\r\n/g, '\n').trimEnd() + '\n'
notices += section('The web version: the runtime compiled into rig-engine.wasm',
  `The web engine is built with the Emscripten SDK ${emsdk}. It contains parts of Emscripten's system libraries: musl\n` +
  'libc (MIT, below), LLVM libc++, libc++abi, libunwind and compiler-rt (Apache License 2.0 with LLVM Exceptions,\n' +
  'whose exception asks no notice for compiled code; their text is below for reference), dlmalloc (public domain) and\n' +
  "Emscripten's own code (MIT or University of Illinois/NCSA, below).")
for (const [title, file] of [
  ['Emscripten', join(em, 'LICENSE')],
  ['musl libc', join(em, 'system', 'lib', 'libc', 'musl', 'COPYRIGHT')],
  ['LLVM libc++ (and libc++abi, libunwind, compiler-rt)', join(em, 'system', 'lib', 'libcxx', 'LICENSE.TXT')],
]) notices += section(title, readFileSync(file, 'utf8'))
writeFileSync(join(out, 'ThirdPartyNotices.txt'), notices)
cpSync(join(root, 'LICENSE'), join(out, 'LICENSE.txt'))

const config = readFileSync(join(root, 'NeuralAmpModeler', 'config.h'), 'utf8')
const version = config.match(/#define PLUG_VERSION_STR "([0-9.]+)"/)?.[1] ?? '0.0.0'
const commit = git('rev-parse', 'HEAD')
// Untracked files count: a new page file not yet committed is in the build but in no commit.
const dirty = git('status', '--porcelain', '--ignore-submodules=dirty') !== ''
const now = new Date()
const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13)
const build = `${stamp}-${commit.slice(0, 7)}${dirty ? '-dirty' : ''}`
writeFileSync(join(out, 'NOTICE.txt'), [
  `CRBN Rig ${version}, the web version (build ${build})`,
  'Copyright 2026 GOATi Entertainment Pty Ltd. https://pavillionhub.com/app/crbn-rig',
  '',
  'CRBN Rig is based on Neural Amp Modeler by Steven Atkinson, used under the MIT License (LICENSE.txt). It plays',
  'captures (.nam) and impulse responses (.wav) made by others, such as those on TONE3000 (https://www.tone3000.com);',
  'they belong to their authors and are not part of CRBN Rig. The files a person loads stay in their browser.',
  'The demo riff (demo/di.wav) and the example capture (demo/example.nam) are from Neural Amp Modeler Core (MIT).',
  '',
  'ThirdPartyNotices.txt carries the notices of everything this site contains; look/fonts/LICENSES.md the fonts\'.',
  `MODIFIED-FILES.txt lists the files GOATi changed from the original. Built from GOATi's commit ${commit}.`,
  '',
].join('\n'))
execFileSync('pwsh', ['-NoProfile', '-File', join(root, 'scripts', 'change-list.ps1'), '-Out', join(out, 'MODIFIED-FILES.txt')], { stdio: 'inherit' })

writeFileSync(join(out, 'build.json'), JSON.stringify({ product: 'CRBN Rig', version, build, commit, dirty, emsdk, builtAt: now.toISOString() }, null, 2) + '\n')

const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p) } }
walk(out)
const bytes = files.reduce((s, f) => s + statSync(f).size, 0)
console.log(`web: ${relative(root, out)} build ${build}, ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB`)
