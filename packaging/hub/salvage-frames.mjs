// The store's second picture (D-RIG-018 (e), build plan R1c): Salvage, cycling through the owner's good amps of
// SYNC:RIG-018 (#2, #6, #1, #8, #4; docs/BUILD_PLAN.md R1c has each one's settings), as one animated PNG, which the
// Hub's store plays (SYNC:RIG-017 ADDENDUM). Each frame is the amp and its cabinet as the web version draws them at
// 3x with the demo riff playing (web/probe.mjs, as gear-shots.mjs), framed by art/art.html?piece=salvage.
//   node web/build.mjs; node packaging/hub/salvage-frames.mjs     -> dist/hub-listing/<name> (and its frames in dist/shots)
//     --set=r1c                                the frames: r1c, the picture in the store (Total Textures' sheets), or peel,
//                                              the draft on D-RIG-022's photographs (SYNC:RIG-026)
//     --name=crbn-rig-shot-2b-salvage-1.png   the picture's name (the CDN keeps a name for a day: a new picture, a new name;
//                                              each set has its own default)
//     --ms=2000                                how long each frame holds
// Needs Python with Pillow for the join (Box-C has both). The riff's moment differs on every run, so the glow does too:
// look at the frames before uploading.
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { screenshot } from '../../scripts/headless-edge.mjs'

const root = resolve(import.meta.dirname, '..', '..')
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const ms = Number(arg('ms') ?? 2000)
const shots = join(root, 'dist', 'shots'), listing = join(root, 'dist', 'hub-listing')
mkdirSync(shots, { recursive: true }); mkdirSync(listing, { recursive: true })

// The owner's good amps, in the order they cycle: his setup first, a new look, a shuffle of his setup, and so on.
const SETUP = 'Rust and orange · Perforated sheet · Aged copper · Valves · On tags'
const R1C = [
  { n: 2, salv: ['orange', 'perf', 'copper', 'valves', 'tags'], seed: 258637, choices: SETUP },
  { n: 6, salv: ['pale', 'perf', 'copper', 'valves', 'paint'], seed: 651644, choices: 'Pale blue, rust runs · Perforated sheet · Aged copper · Valves · Paint-filled' },
  { n: 1, salv: ['orange', 'perf', 'copper', 'valves', 'tags'], seed: 591410, choices: SETUP, shuffle: true },
  { n: 8, salv: ['red', 'chicken', 'rust', 'neon', 'stamped'], seed: 439322, choices: 'Worn red · Chicken wire · Rusted iron · Neon · Stamped' },
  { n: 4, salv: ['orange', 'perf', 'copper', 'valves', 'tags'], seed: 17617, choices: SETUP, shuffle: true },
]
// The draft on Peeling orange and Scuffed red (D-RIG-022), five of eight candidates shot at SYNC:RIG-026 (docs/BUILD_PLAN.md
// R1c has all eight): the setup on Peeling orange, Scuffed red in chicken wire and neon, the setup cut again, Scuffed red
// with painted words, and Peeling orange in expanded metal. For the owner to judge before anything is uploaded.
const PEEL_SETUP = 'Peeling orange · Perforated sheet · Aged copper · Valves · On tags'
const PEEL = [
  { n: 2, salv: ['peel', 'perf', 'copper', 'valves', 'tags'], seed: 271828, choices: PEEL_SETUP },
  { n: 6, salv: ['scuff', 'chicken', 'rust', 'neon', 'stamped'], seed: 223606, choices: 'Scuffed red · Chicken wire · Rusted iron · Neon · Stamped' },
  { n: 4, salv: ['peel', 'perf', 'copper', 'valves', 'tags'], seed: 141421, choices: PEEL_SETUP, shuffle: true },
  { n: 5, salv: ['scuff', 'perf', 'copper', 'valves', 'paint'], seed: 173205, choices: 'Scuffed red · Perforated sheet · Aged copper · Valves · Paint-filled' },
  { n: 7, salv: ['peel', 'expanded', 'scrap', 'embers', 'stamped'], seed: 244949, choices: 'Peeling orange · Expanded metal · The same scrap · Embers · Stamped' },
]
const SETS = { r1c: [R1C, 'crbn-rig-shot-2b-salvage-1.png'], peel: [PEEL, 'crbn-rig-shot-2b-salvage-2.png'] }
const set = arg('set') ?? 'r1c'
if (!SETS[set]) { console.error(`--set= is one of ${Object.keys(SETS).join(', ')}`); process.exit(1) }
const [FRAMES, defaultName] = SETS[set]
const name = arg('name') ?? defaultName

// 1. The gear: the page at 1536x864, 3x, as the owner's eight amps were shot (gear-shots.mjs), so each seed crops as he saw it.
const steps = []
FRAMES.forEach(({ salv: [sheet, mesh, metal, glow, words], seed }, i) => {
  const rig = { v: 2, finish: 'own', custom: '#f29077', layout: 'b', amp: 'b', meters: 'b', kit: 'hammer', salv: { sheet, mesh, metal, glow, words }, seed, salvWords: words }
  steps.push(
    { go: '/', w: 1536, h: 864, dpr: 1, settle: 600 },
    { eval: `localStorage.setItem('crbn-rig/rig', ${JSON.stringify(JSON.stringify(rig))}), 'salvage ${seed}'` },
    { go: '/?example&look=capsule', w: 1536, h: 864, dpr: 3, settle: 1500 },
    { eval: "document.getElementById('play-demo').click(), document.querySelector('#hw-amp .hw').dataset.kit" },
    { wait: 2300 },
    { shot: join(shots, `salvage-${i + 1}-amp.png`).replaceAll('\\', '/'), sel: '#hw-amp', pad: 0 },
    { shot: join(shots, `salvage-${i + 1}-cab.png`).replaceAll('\\', '/'), sel: '#hw-cab', pad: 0 },
  )
})
const file = join(tmpdir(), 'crbn-rig-salvage-steps.json')
writeFileSync(file, JSON.stringify(steps, null, 1))
const run = spawnSync(process.execPath, [join(root, 'web', 'probe.mjs'), file], { cwd: root, stdio: 'inherit' })
if (run.status !== 0) process.exit(run.status ?? 1)

// 2. The frames, framed by art.html.
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' }
const server = createServer((req, res) => {
  const f = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!f.startsWith(root + sep)) { res.writeHead(403).end(); return }
  let bytes
  try { bytes = readFileSync(f) } catch { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }).end(bytes)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const frames = []
try {
  for (const [i, fr] of FRAMES.entries()) {
    const out = join(shots, `salvage-frame-${i + 1}.png`)
    const q = new URLSearchParams({ piece: 'salvage', f: String(i + 1), c: fr.choices, s: fr.shuffle ? '1' : '0' })
    await screenshot(`http://127.0.0.1:${server.address().port}/packaging/hub/art/art.html?${q}`, out, { width: 1920, height: 1080 })
    frames.push(out)
    console.log(`frame ${i + 1}: Salvage #${fr.n} (${fr.salv[0]}, seed ${fr.seed})`)
  }
} finally { server.close() }

// 3. One animated PNG, every frame held `ms`, looping.
const py = 'import sys\nfrom PIL import Image\nout, ms, *files = sys.argv[1:]\nframes = [Image.open(f).convert("RGB") for f in files]\nframes[0].save(out, save_all=True, append_images=frames[1:], duration=int(ms), loop=0)\n'
const target = join(listing, name)
const joined = spawnSync('python', ['-c', py, target, String(ms), ...frames], { encoding: 'utf8' })
if (joined.status !== 0) { console.error(joined.stderr); process.exit(1) }
const size = statSync(target).size
console.log(`${name}: ${FRAMES.length} frames of 1920x1080, ${ms} ms each, ${(size / 1048576).toFixed(1)} MB`)
if (size > 10 * 1024 * 1024) { console.error('over 10 MB: the listing takes no picture that large'); process.exit(1) }
