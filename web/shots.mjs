// Screenshots of CRBN Rig's web version, one per look, for the Hub's store page (packaging/hub/pictures.json) and for
// review: dist/shots/web-<look>.png at 1920x1080 (or --size=WxH), the page served from dist/web on loopback with the
// example capture shown (?example). Run from the repo root after node web/build.mjs:   node web/shots.mjs
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { DEFAULT_EDGE } from '../scripts/headless-edge.mjs'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const site = join(root, 'dist', 'web')
const outDir = join(root, 'dist', 'shots')
mkdirSync(outDir, { recursive: true })
const [w, h] = (process.argv.find((a) => a.startsWith('--size='))?.slice(7) ?? '1920x1080').split('x').map(Number)
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
const port = server.address().port

// Edge's --screenshot returns before the file is written: wait until it exists and stops growing (playbook §10).
async function shot(url, file) {
  rmSync(file, { force: true })
  const profile = mkdtempSync(join(tmpdir(), 'crbn-rig-edge-'))
  // Laid out at 80 % of the picture's size and drawn at 1.25x, so the page reads as it does on a laptop screen.
  spawn(DEFAULT_EDGE, ['--headless', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${profile}`,
    `--window-size=${Math.round(w / 1.25)},${Math.round(h / 1.25)}`, '--force-device-scale-factor=1.25',
    '--virtual-time-budget=6000', `--screenshot=${file}`, url], { stdio: 'ignore' }).on('error', () => {})
  let last = -1
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 250))
    if (existsSync(file)) { const s = statSync(file).size; if (s > 0 && s === last) break; last = s }
  }
  spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${profile.split(sep).pop()}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 400))
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }) } catch { /* left for the OS */ }
  if (!existsSync(file)) throw new Error(`no screenshot for ${url}`)
}

for (const look of looks) {
  const file = join(outDir, `web-${look}.png`)
  await shot(`http://127.0.0.1:${port}/?example&look=${look}`, file)
  console.log(`${file} (${(statSync(file).size / 1024).toFixed(0)} KiB)`)
}
server.close()
