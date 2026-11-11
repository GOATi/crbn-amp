// Checks CRBN Rig's web build (D-CRBN-021 (d)); hosting/publish.json runs it before anything is uploaded.
//
//   node web/check.mjs                    the artifact (ARTIFACT_DIR, else dist/web) served on loopback to headless
//                                         Edge, which runs web/test/selftest.html: the page paints in Rig's look,
//                                         and the engine plays the example capture through the real AudioWorklet,
//                                         equal to the engine run directly, with the cabinet stage scaled as the
//                                         desktop's.
//   node web/check.mjs --url=<origin>     the live host: /__build names a build, and every file of the artifact is
//                                         served byte for byte (SHA-256).
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.nam': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}
let deliver
const result = new Promise((ok, fail) => { deliver = ok; setTimeout(() => fail(new Error('the self-test sent nothing in 120 s')), 120000).unref() })
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (req.method === 'POST' && path === '/__result') {
    const parts = []
    req.on('data', (d) => parts.push(d)).on('end', () => { res.writeHead(204).end(); deliver(JSON.parse(Buffer.concat(parts).toString())) })
    return
  }
  const base = path.startsWith('/__selftest/') ? join(root, 'web', 'test') : artifact
  const rel = path.startsWith('/__selftest/') ? path.slice('/__selftest/'.length) : path.slice(1) || 'index.html'
  const file = normalize(join(base, rel.endsWith('/') ? rel + 'index.html' : rel))
  if (!file.startsWith(base + sep)) { res.writeHead(403).end(); return }
  let bytes
  try { bytes = readFileSync(file) } catch { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(bytes)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const edge = process.env.EDGE ?? DEFAULT_EDGE
const browser = startHeadlessEdge(`http://127.0.0.1:${server.address().port}/__selftest/selftest.html`, { edge, args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1500,1000'] })
let report
try { report = await result } finally { await browser.stop(); server.close() }

for (const c of report.checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail.split('\n')[0]})` : ''}`)
if (report.realtime) console.log(`engine speed in this browser: ${report.realtime}x real time; worklet render ${report.workletMs} ms`)
const failed = report.checks.filter((c) => !c.ok)
console.log(failed.length ? `${failed.length} FAILED (${report.userAgent})` : `web check: all ${report.checks.length} checks pass in ${report.userAgent.match(/Edg\/[\d.]+/)?.[0] ?? 'Edge'}`)
process.exit(failed.length ? 1 : 0)
