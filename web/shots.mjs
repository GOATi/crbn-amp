// Screenshots of CRBN Rig's web version, one per look, for the Hub's store page (packaging/hub/pictures.mjs) and for
// review: dist/shots/web-<look>.png at 1920x1080 (or --size=WxH), from dist/web on loopback through web/probe.mjs.
// Since R9 each is the page stocked as the store shows it (packaging/hub/store-stage.js over store-library.mjs's
// made-up folder: an amp and a cabinet, favourites on the pads, three pedals, a rig on its Push variant, the riff
// playing), laid out at 1920x1080 so the pads fit. Before R9 the page was shot with ?example, before it was ready:
// on R4..R7's page that drew no amp at all. --midi adds dist/shots/web-midi.png (the MIDI dock open on a stand-in MC8,
// in the first look). Run after node web/build.mjs:   node web/shots.mjs [--looks=capsule,holo] [--kit=crbn] [--midi]
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outDir = join(root, 'dist', 'shots')
mkdirSync(outDir, { recursive: true })
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const [width, height] = arg('size', '1920x1080').split('x').map(Number)
const looks = arg('looks', 'capsule,holo,redline,daylight').split(',')
const kit = arg('kit', 'crbn')
const midi = process.argv.includes('--midi')
// The owner's MC8 as logged (SYNC:RIG-032): footswitches CCs on channel 3, his expression pedal CC 13, Program Changes
const MAPS = [
  { name: 'Pedal 1 footswitch', msg: [0xb2, 1, 127] }, { name: 'Pedal 2 footswitch', msg: [0xb2, 2, 127] }, { name: 'Pedal 3 footswitch', msg: [0xb2, 3, 127] },
  { name: 'Variant Q', msg: [0xc2, 0] }, { name: 'Variant W', msg: [0xc2, 1] }, { name: 'Variant E', msg: [0xc2, 2] },
  { name: 'Standby', msg: [0xb2, 8, 127] }, { name: 'Output level', msg: [0xb2, 13, 70] }, { name: 'Rig: Friday set', msg: [0xc2, 5] },
]
const STAGE = "(async () => { try { const m = await import('/__hub/store-library.mjs'); const t = await (await fetch('/demo/example.nam')).text(); return JSON.stringify(await rigStage(m.STORE_RIG, { files: m.storeLibrary(t) })) } catch (e) { return 'ERR ' + e.message } })()"

const work = mkdtempSync(join(tmpdir(), 'crbn-rig-shots-'))
let failed = 0
for (const [i, look] of looks.entries()) {
  const file = join(outDir, `web-${look}.png`), steps = [
    { go: `/?look=${look}&kit=${kit}`, w: width, h: height, dpr: 1, settle: 1200 },
    { evalFile: 'packaging/hub/store-stage.js' },
    { eval: STAGE },
    { wait: 1500 },
    { shot: file },
  ]
  if (midi && i === 0) {
    steps.push({ eval: `(async () => { try { return JSON.stringify(await rigStageMidi(${JSON.stringify(MAPS)})) } catch (e) { return 'ERR ' + e.message } })()` })
    steps.push({ wait: 600 }, { shot: join(outDir, 'web-midi.png') })
  }
  const stepsFile = join(work, `${look}.json`)
  writeFileSync(stepsFile, JSON.stringify(steps))
  const r = spawnSync(process.execPath, [join(root, 'web', 'probe.mjs'), stepsFile], { cwd: root, encoding: 'utf8' })
  const said = `${r.stdout}${r.stderr}`
  if (r.status !== 0 || /"ERR /.test(said)) { failed++; console.log(`${look}: FAILED\n${said.trim()}`); continue }
  console.log(`${file} (${(statSync(file).size / 1024).toFixed(0)} KiB)`)
  if (midi && i === 0) console.log(`${join(outDir, 'web-midi.png')} (${(statSync(join(outDir, 'web-midi.png')).size / 1024).toFixed(0)} KiB)`)
}
process.exit(failed ? 1 : 0)
