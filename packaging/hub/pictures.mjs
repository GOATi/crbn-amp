// Makes CRBN Rig's Hub listing folder, dist/hub-listing/: words.json and pictures.json from here, and the pictures
// rendered from art/art.html with headless Edge (the sizes the other CRBN apps use, playbook §6.1). The pictures never
// go in the repo (crbn-launcher docs/new-app-on-pavillion-hub.md §6.1).
//   node packaging/hub/pictures.mjs        after node web/build.mjs, node web/shots.mjs and node packaging/icons/render.mjs,
//                                          with the desktop capture at dist/shots/desktop.png (desktop-shot.mjs) and the
//                                          gear at dist/shots/gear-*.png (gear-shots.mjs)
//     --only=desktop,hero                  render only these pieces (and `web`, the web shot's copy), leaving every
//                                          other picture in the folder as it is: the CDN keeps a name for a day, so a
//                                          picture changes only under a new name
//     --desk=desktop-salvage.png           frame another capture from dist/shots;  --out=<folder> instead of the listing
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { screenshot } from '../../scripts/headless-edge.mjs'

const root = resolve(import.meta.dirname, '..', '..')
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const out = resolve(root, arg('out') ?? join('dist', 'hub-listing'))
const only = arg('only')?.split(',')
const desk = arg('desk')
mkdirSync(out, { recursive: true })
for (const need of ['dist/shots/web-capsule.png', 'dist/shots/web-holo.png', 'dist/shots/web-redline.png', 'dist/shots/web-daylight.png', `dist/shots/${desk ?? 'desktop.png'}`, 'dist/icons/icon-512.png', 'dist/shots/gear-crbn-amp.png', 'dist/shots/gear-crbn-cab.png', 'dist/shots/gear-hammer-amp.png', 'dist/shots/gear-compact-amp.png', 'dist/shots/gear-rack-amp.png']) {
  if (!existsSync(join(root, need))) throw new Error(`${need} is missing (see this file's header)`)
}

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' }
const server = createServer((req, res) => {
  const file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return }
  let bytes
  try { bytes = readFileSync(file) } catch { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(bytes)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const art = (piece) => `http://127.0.0.1:${server.address().port}/packaging/hub/art/art.html?piece=${piece}${desk ? `&desk=${encodeURIComponent(desk)}` : ''}`

const pieces = [
  ['hero', 'crbn-rig-hero-3.png', 1920, 1080], // -3: the gear (the kits, R1)
  ['card', 'crbn-rig-card-3.png', 1920, 1080],
  ['cover', 'crbn-rig-cover-4.png', 600, 840], // -4: four kits stacked, the owner's pick
  ['logo', 'crbn-rig-logo-2.png', 800, 240, true],
  ['desktop', 'crbn-rig-shot-2-desktop-2.png', 1920, 1080], // -2: the app on Rig's page (R2b)
  ['looks', 'crbn-rig-shot-3-looks-4.png', 1920, 1080],
  // to compare, rendered only when --only names them
  ['hero-shots', 'compare-hero-shots.png', 1920, 1080, false, true],
  ['cover-close', 'compare-cover-close.png', 600, 840, false, true],
]
try {
  for (const [piece, name, width, height, transparent] of pieces.filter(([p, , , , , compare]) => only ? only.includes(p) : !compare)) {
    await screenshot(art(piece), join(out, name), { width, height, transparent })
    console.log(`${name} ${width}x${height} (${(statSync(join(out, name)).size / 1024).toFixed(0)} KiB)`)
  }
} finally { server.close() }
if (!only || only.includes('web')) copyFileSync(join(root, 'dist', 'shots', 'web-capsule.png'), join(out, 'crbn-rig-shot-1-web-3.png'))
if (arg('out')) {
  console.log(`pictures: ${out}`) // a preview, not the listing
} else {
  copyFileSync(join(import.meta.dirname, 'words.json'), join(out, 'words.json'))
  copyFileSync(join(import.meta.dirname, 'pictures.json'), join(out, 'pictures.json'))
  for (const f of JSON.parse(readFileSync(join(out, 'pictures.json'), 'utf8')).storeMedia) {
    if (statSync(join(out, f)).size > 10 * 1024 * 1024) throw new Error(`${f} is over 10 MB`)
  }
  console.log(`listing folder: ${out}`)
}
