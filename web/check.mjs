// Checks CRBN Rig's web build (D-CRBN-021 (d)); hosting/publish.json runs it before anything is uploaded.
//
//   node web/check.mjs                    the artifact (ARTIFACT_DIR, else dist/web) served on loopback to headless
//                                         Edge, which runs web/test/selftest.html: the page paints in Rig's look,
//                                         and the engine plays the example capture through the real AudioWorklet,
//                                         equal to the engine run directly, with the cabinet stage scaled as the
//                                         desktop's; the power switch, Standby, the squeal guard in a real feedback
//                                         loop through the worklet, and auto-off through the page's own input;
//                                         the library (R4): NAM Core's examples and a generated folder opened as the
//                                         person's folder, searched, filtered, played, starred and reopened after a
//                                         reload, and a generated 5,000-file folder indexed and searched in time;
//                                         MIDI (R7): the browser's own Web MIDI, allowed over DevTools as a person
//                                         allows it in the browser's prompt, then a test controller driving the page.
//   node web/check.mjs --url=<origin>     the live host: /__build names a build, and every file of the artifact is
//                                         served byte for byte (SHA-256).
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import { DEFAULT_EDGE, startHeadlessEdge } from '../scripts/headless-edge.mjs'

const root = resolve(import.meta.dirname, '..')
const artifact = resolve(process.env.ARTIFACT_DIR ?? join(root, 'dist', 'web'))
const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6)

const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p) } }
walk(artifact)

if (urlArg) {
  const origin = urlArg.replace(/\/+$/, '')
  const build = await (await fetch(`${origin}/__build`)).text()
  const local = JSON.parse(readFileSync(join(artifact, 'build.json'), 'utf8'))
  console.log(`${origin}/__build: ${build.trim()}`)
  let bad = 0
  for (const f of files) {
    const rel = relative(artifact, f).split(sep).join('/')
    const res = await fetch(`${origin}/${rel}`)
    const there = res.ok ? createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex') : `HTTP ${res.status}`
    const here = createHash('sha256').update(readFileSync(f)).digest('hex')
    if (there !== here) { bad++; console.log(`  differs: ${rel} (${there.slice(0, 12)} vs ${here.slice(0, 12)})`) }
  }
  console.log(bad ? `${bad} of ${files.length} files differ from ${local.build}` : `the host serves ${local.build}: all ${files.length} files match`)
  process.exit(bad ? 1 : 0)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.nam': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}
let deliver, midiGrant = null, devtoolsWs = null
// The MIDI permission (build plan R7), given over DevTools when the self-test asks for it at /__midi-granted (a grant
// made as the browser starts, before the page loads, did not hold).
const result = new Promise((ok, fail) => { deliver = ok; setTimeout(() => fail(new Error('the self-test sent nothing in 240 s')), 240000).unref() })
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (req.method === 'POST' && path === '/__result') {
    const parts = []
    req.on('data', (d) => parts.push(d)).on('end', () => { res.writeHead(204).end(); deliver(JSON.parse(Buffer.concat(parts).toString())) })
    return
  }
  if (path === '/__midi-granted') { (midiGrant ??= grantMidi()).then((g) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(g))); return }
  // /__selftest/ is web/test; /__examples/ NAM Core's example captures, which the library indexes (build plan R4)
  const [prefix, dir] = path.startsWith('/__selftest/') ? ['/__selftest/', join(root, 'web', 'test')] : path.startsWith('/__examples/') ? ['/__examples/', join(root, 'NeuralAmpModelerCore', 'example_models')] : ['/', artifact]
  const base = dir
  const rel = path.slice(prefix.length) || 'index.html'
  const file = normalize(join(base, rel.endsWith('/') ? rel + 'index.html' : rel))
  if (!file.startsWith(base + sep)) { res.writeHead(403).end(); return }
  let bytes
  try { bytes = readFileSync(file) } catch { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(bytes)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const edge = process.env.EDGE ?? DEFAULT_EDGE
// The page's "guitar" in this browser (build plan R3): Edge's fake input plays a pulled jack, over and over (two seconds
// of a quiet string's hiss, contacts scraping near full scale, then three seconds of dead silence), so the self-test
// sees auto-off trip through the page's own input, worklet and banner.
const jackWav = join(mkdtempSync(join(tmpdir(), 'crbn-rig-jack-')), 'pulled-jack.wav')
{
  const rate = 48000, n = rate * 5, pcm = Buffer.alloc(44 + n * 2)
  pcm.write('RIFF', 0, 'latin1'); pcm.writeUInt32LE(36 + n * 2, 4); pcm.write('WAVEfmt ', 8, 'latin1'); pcm.writeUInt32LE(16, 16)
  pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(rate, 24); pcm.writeUInt32LE(rate * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34)
  pcm.write('data', 36, 'latin1'); pcm.writeUInt32LE(n * 2, 40)
  let seed = 1
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    const v = t < 2 ? (rnd() - 0.5) * 0.01 : t < 2.006 ? (rnd() < 0.5 ? -0.97 : 0.97) : 0
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2)
  }
  writeFileSync(jackWav, pcm)
}
const devtools = 9500 + Math.floor(Math.random() * 400)
const browser = startHeadlessEdge(`http://127.0.0.1:${server.address().port}/__selftest/selftest.html`, {
  edge,
  args: [`--remote-debugging-port=${devtools}`, '--autoplay-policy=no-user-gesture-required', '--window-size=1500,1000', '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${jackWav}`],
})
// Allows Web MIDI for the page's origin, as a person does in the browser's prompt (Browser.grantPermissions). Edge
// checks every Web MIDI request against the SysEx permission (as WebView2 asks for it, RigWebView.cpp), so both.
async function grantMidi() {
  try {
    let url
    for (let i = 0; i < 80 && !url; i++) {
      try { url = (await (await fetch(`http://127.0.0.1:${devtools}/json/version`)).json()).webSocketDebuggerUrl } catch { await new Promise((r) => setTimeout(r, 250)) }
    }
    if (!url) throw new Error('no DevTools on the headless browser')
    // kept open to the end: Edge drops a DevTools grant when its session closes
    const ws = devtoolsWs = new WebSocket(url)
    await new Promise((ok, fail) => { ws.addEventListener('open', ok); ws.addEventListener('error', () => fail(new Error('DevTools refused'))) })
    const answer = await new Promise((ok) => {
      ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id === 1) ok(m) })
      ws.send(JSON.stringify({ id: 1, method: 'Browser.grantPermissions', params: { origin: `http://127.0.0.1:${server.address().port}`, permissions: ['midi', 'midiSysex'] } }))
    })
    return answer.error ? { ok: false, error: answer.error.message } : { ok: true }
  } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
}
let report
try { report = await result } finally { try { devtoolsWs?.close() } catch { /* closed */ } await browser.stop(); server.close() }

for (const c of report.checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail.split('\n')[0]})` : ''}`)
if (report.realtime) console.log(`engine speed in this browser: ${report.realtime}x real time; worklet render ${report.workletMs} ms`)
if (report.library) console.log(`library: 5,000 files indexed in ${(report.library.indexMs / 1000).toFixed(2)} s (listing ${report.library.scan?.listMs} ms, reading ${report.library.scan?.readMs} ms); the slowest search ${report.library.searchMs} ms to the frame`)
const failed = report.checks.filter((c) => !c.ok)
console.log(failed.length ? `${failed.length} FAILED (${report.userAgent})` : `web check: all ${report.checks.length} checks pass in ${report.userAgent.match(/Edg\/[\d.]+/)?.[0] ?? 'Edge'}`)
process.exit(failed.length ? 1 : 0)
