// Screenshots of CRBN Rig's web version, one per look, for the Hub's store page (packaging/hub/pictures.mjs) and for
// review: dist/shots/web-<look>.png at 1920x1080 (or --size=WxH), laid out at 1536x864 and drawn at 1.25x, from
// dist/web on loopback with the example capture shown (?example). Run after node web/build.mjs:   node web/shots.mjs
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { screenshot } from '../scripts/headless-edge.mjs'

const root = resolve(import.meta.dirname, '..')
const site = join(root, 'dist', 'web')
const outDir = join(root, 'dist', 'shots')
mkdirSync(outDir, { recursive: true })
const [width, height] = (process.argv.find((a) => a.startsWith('--size='))?.slice(7) ?? '1920x1080').split('x').map(Number)
const looks = (process.argv.find((a) => a.startsWith('--looks='))?.slice(8) ?? 'capsule,holo,redline,daylight').split(',')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }

const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = normalize(join(site, p === '/' ? 'index.html' : p.slice(1)))
  if (!file.startsWith(site + sep)) { res.writeHead(403).end(); return }
  let bytes
  try { bytes = readFileSync(file) } catch { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(bytes)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
try {
  for (const look of looks) {
    const file = join(outDir, `web-${look}.png`)
    await screenshot(`http://127.0.0.1:${server.address().port}/?example&look=${look}`, file, { width, height, scale: 1.25 })
    console.log(`${file} (${(statSync(file).size / 1024).toFixed(0)} KiB)`)
  }
} finally { server.close() }
