// Vendors the suite's looks into an app at a pinned commit (D-CRBN-019). An app copies this file once into its own
// scripts/ and keeps a `look.json` beside its package.json:
//
//   { "repo": "https://github.com/GOATi/crbn-launcher.git", "commit": "<the full 40-character sha>", "into": "src/look" }
//
//   node scripts/vendor-look.mjs                 copy looks/ at the pinned commit into `into` (committed, so builds need no fetch)
//   node scripts/vendor-look.mjs --commit <sha>  move the pin, then copy
//   node scripts/vendor-look.mjs --local ../crbn-launcher   copy the working tree instead, while authoring a look (never commit that)
//
// What arrives: themes.css, looks.ts, products.ts, entrance.ts, looks.json, fonts/ (woff2, fonts.css, LICENSES.md) and
// VENDORED.json naming the commit. Node built-ins and git only. Moving the pin is its own commit, after the looks change it
// points at is pushed, as crbn-photo-live's editor.json is moved.

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const pinFile = resolve('look.json')
const pin = JSON.parse(readFileSync(pinFile, 'utf8'))
if (!pin.repo || !pin.into) throw new Error('look.json needs repo and into')
const commit = flag('--commit') ?? pin.commit
const local = flag('--local')
// The full sha: GitHub serves a fetch by sha only for the whole 40 characters.
if (!local && !/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('look.json needs the full 40-character commit sha (or pass --commit <sha>)')

const into = resolve(pin.into)
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()

let source
let tmp
if (local) {
  source = join(resolve(local), 'looks')
} else {
  tmp = mkdtempSync(join(tmpdir(), 'crbn-look-'))
  git(tmp, 'init', '-q')
  git(tmp, 'fetch', '-q', '--depth', '1', pin.repo, commit)
  git(tmp, 'checkout', '-q', 'FETCH_HEAD', '--', 'looks')
  source = join(tmp, 'looks')
}
if (!existsSync(join(source, 'themes.css'))) throw new Error(`${source}: no looks/themes.css there`)

rmSync(into, { recursive: true, force: true })
mkdirSync(into, { recursive: true })
for (const f of ['themes.css', 'looks.ts', 'products.ts', 'entrance.ts', 'looks.json']) cpSync(join(source, f), join(into, f))
cpSync(join(source, 'fonts'), join(into, 'fonts'), { recursive: true })
const full = local ? `local working tree ${resolve(local)} (NOT a pin: do not commit)` : git(tmp, 'rev-parse', 'FETCH_HEAD')
writeFileSync(join(into, 'VENDORED.json'), JSON.stringify({ repo: pin.repo, commit: local ? null : full, path: 'looks', vendoredAt: new Date().toISOString() }, null, 2) + '\n')
if (!local && commit !== pin.commit) writeFileSync(pinFile, JSON.stringify({ ...pin, commit }, null, 2) + '\n')
if (tmp) rmSync(tmp, { recursive: true, force: true })
console.log(`looks vendored into ${pin.into} from ${full}`)
