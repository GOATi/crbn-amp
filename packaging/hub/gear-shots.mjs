// The gear for the store's hero, card and cover (packaging/hub/art/art.html): each kit's amp, and the CRBN cabinet, as
// the web version draws them, at 3x, with the demo riff playing so the energy is lit. It runs web/probe.mjs over
// dist/web, so build first.
//   node web/build.mjs; node packaging/hub/gear-shots.mjs     -> dist/shots/gear-<kit>-amp.png, gear-crbn-cab.png
//     --kits=crbn,hammer,compact,rack                         the kits (the cover's stack is these four, in order)
//     --out=<folder>                                          instead of dist/shots
//     --salvage=orange,perf,copper,valves,tags,258637         Salvage's sheet, grille, metal, glow, words and seed (the
//                                                             crop of every piece): the default is the owner's pick, his
//                                                             setup on seed 258637 (SYNC:RIG-018; docs/BUILD_PLAN.md R1c)
// The riff's moment differs on every run, so the lit honeycomb does too: look at the shots before rendering pictures.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const out = resolve(root, arg('out') ?? join('dist', 'shots')).replaceAll('\\', '/')
const kits = (arg('kits') ?? 'crbn,hammer,compact,rack').split(',')
const [sheet, mesh, metal, glow, words, seed] = (arg('salvage') ?? 'orange,perf,copper,valves,tags,258637').split(',')
const salvage = { v: 2, finish: 'own', custom: '#f29077', layout: 'b', amp: 'b', meters: 'b', kit: 'hammer', salv: { sheet, mesh, metal, glow, words }, seed: +seed, salvWords: words }
mkdirSync(out, { recursive: true })

const steps = []
for (const kit of kits) {
  // Salvage's choices and seed are the page's saved settings, so they go in before the page that reads them
  if (kit === 'hammer') steps.push({ go: '/', w: 1536, h: 864, dpr: 1, settle: 600 }, { eval: `localStorage.setItem('crbn-rig/rig', ${JSON.stringify(JSON.stringify(salvage))}), 'salvage set'` })
  steps.push(
    { go: kit === 'hammer' ? '/?example&look=capsule' : `/?example&look=capsule&kit=${kit}`, w: 1536, h: 864, dpr: 3, settle: 1500 },
    { eval: "document.getElementById('play-demo').click(), document.querySelector('#hw-amp .hw').dataset.kit" },
    { wait: 2300 },
    { shot: `${out}/gear-${kit}-amp.png`, sel: '#hw-amp', pad: 0 },
  )
  if (kit === 'crbn') steps.push({ shot: `${out}/gear-crbn-cab.png`, sel: '#hw-cab', pad: 0 })
}
const file = join(tmpdir(), 'crbn-rig-gear-steps.json')
writeFileSync(file, JSON.stringify(steps, null, 1))
const run = spawnSync(process.execPath, [join(root, 'web', 'probe.mjs'), file], { cwd: root, stdio: 'inherit' })
process.exit(run.status ?? 1)
