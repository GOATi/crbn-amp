// Renders CRBN Rig's placeholder icon (icon.html) with headless Edge and writes it where the builds take it:
//   NeuralAmpModeler/resources/NeuralAmpModeler.ico   the Windows app icon (16..256, PNG entries)
//   web/src/icons/icon-{32,180,192,512}.png            the web version's favicon, touch and manifest icons
//   dist/icons/icon-<size>.png                         every size, for the Hub pictures (gitignored)
// Run from the repo root: node packaging/icons/render.mjs [--edge <path to msedge.exe>]
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { DEFAULT_EDGE, startHeadlessEdge } from '../../scripts/headless-edge.mjs'

const args = process.argv.slice(2)
const edge = args.includes('--edge') ? args[args.indexOf('--edge') + 1] : DEFAULT_EDGE
const root = resolve(import.meta.dirname, '..', '..')

// Edge will not run a module script from file://, and on Windows its --dump-dom prints nothing we can read, so the page
// is served from the repo on loopback for the one run and POSTs what it drew back to /result.
const TYPES = { '.html': 'text/html', '.woff2': 'font/woff2', '.js': 'text/javascript' }
let deliver
const result = new Promise((ok, fail) => { deliver = ok; setTimeout(() => fail(new Error('icon.html sent nothing in 60 s')), 60000).unref() })
const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/result') {
    const parts = []
    req.on('data', (d) => parts.push(d)).on('end', () => { res.writeHead(204).end(); deliver(Buffer.concat(parts).toString()) })
    return
  }
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return }
  let bytes
  try { bytes = readFileSync(path) } catch { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(bytes)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const page = `http://127.0.0.1:${server.address().port}/packaging/icons/icon.html`

const browser = startHeadlessEdge(page, { edge, args: ['--disable-gpu'] })
let body
try {
  body = await result
} finally {
  await browser.stop()
  server.close()
}
if (body.startsWith('ERR')) throw new Error(`icon.html: ${body}`)
const pngs = Object.fromEntries(Object.entries(JSON.parse(body)).map(([s, b64]) => [Number(s), Buffer.from(b64, 'base64')]))

const write = (path, bytes) => { mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, bytes) }

// The .ico: a 6-byte header, a 16-byte entry per image, then the PNGs (Windows Vista and later read PNG entries).
const ICO = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const header = Buffer.alloc(6 + 16 * ICO.length)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(ICO.length, 4)
let offset = header.length
ICO.forEach((s, i) => {
  const e = 6 + 16 * i, png = pngs[s]
  header.writeUInt8(s >= 256 ? 0 : s, e); header.writeUInt8(s >= 256 ? 0 : s, e + 1)
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6)
  header.writeUInt32LE(png.length, e + 8); header.writeUInt32LE(offset, e + 12)
  offset += png.length
})
write(join(root, 'NeuralAmpModeler', 'resources', 'NeuralAmpModeler.ico'), Buffer.concat([header, ...ICO.map((s) => pngs[s])]))
for (const s of [32, 180, 192, 512]) write(join(root, 'web', 'src', 'icons', `icon-${s}.png`), pngs[s])
for (const [s, png] of Object.entries(pngs)) write(join(root, 'dist', 'icons', `icon-${s}.png`), png)
console.log(`icons: NeuralAmpModeler.ico (${ICO.join(', ')}), web/src/icons (32, 180, 192, 512), dist/icons (${Object.keys(pngs).join(', ')})`)
