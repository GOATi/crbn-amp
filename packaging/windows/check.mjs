// Checks CRBN Rig's desktop app (build plan R2, crbn-launcher D-RIG-017) in the Hub folder package.ps1 laid out.
//
//   node packaging/windows/check.mjs [--folder=<hub folder>] [--no-app]
//
// 1. The engine in the exe: crbn-rig.exe --render plays NAM Core's DI clip through captures at 48 and 44.1 kHz,
//    compared sample by sample with the parity harness dist/native/rig-native-render.exe (node web/engine/test.mjs
//    builds it, and compares it with the web version's WebAssembly). Nothing opens and nothing plays.
// 2. The app itself (skipped with --no-app): started with a throwaway WebView2 profile in dist/desktop-check and
//    DevTools on loopback, then driven as a person would: Rig's page in Rig's look from the app's folder, the desktop's
//    words, the audio driver's status, the demo riff through the native engine with both meters moving, the Output
//    knob, Standby and Space acting on the sound, a cabinet IR scaling it as the desktop always did, auto-off tripping
//    in the native engine and the page saying why, Audio settings opening the driver's dialog, and a screenshot of the
//    window; the library (R4): a generated 5,000-file folder picked in the app's folder dialog, indexed natively in time
//    and read as the web version reads it, searched, played, starred and watched; MIDI (R7): the page's own Web MIDI
//    without a prompt, then a test controller driving the native engine (an expression pedal on Output, a footswitch on
//    a pedal), learned on the dock. Then it opens the app again on the
//    same profile: it was playing the guitar when it closed, so it plays it at once (R3), and the library is back. The riff and the guitar play quietly (Output at -40 and -30 dB) through the default devices.
// It will not start beside a running CRBN Rig (one copy runs at a time). Exit code 0 when every check passes.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { HEAD_BYTES, TAIL_BYTES, WAV_HEAD_BYTES, entryOf, namInfo, wavInfo } from '../../web/src/library.js'
import { libraryFixture } from '../../web/test/library-fixture.mjs'

const root = resolve(import.meta.dirname, '..', '..')
const out = join(root, 'dist', 'desktop-check')
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const config = readFileSync(join(root, 'NeuralAmpModeler', 'config.h'), 'utf8')
const version = config.match(/#define PLUG_VERSION_STR "([0-9.]+)"/)[1]
const folder = resolve(arg('folder') ?? join(root, 'dist', 'hub', `crbn-rig-${version}-windows-x64`))
const exe = join(folder, 'crbn-rig.exe')
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail === '' ? '' : `  (${detail})`}`)
}

if (!existsSync(exe)) throw new Error(`${exe} is missing: run pwsh packaging/windows/package.ps1`)
if (spawnSync('tasklist', ['/FI', 'IMAGENAME eq crbn-rig.exe', '/NH'], { encoding: 'utf8' }).stdout.includes('crbn-rig.exe')) {
  console.log('CRBN Rig is open: close it, then run this again (one copy runs at a time).')
  process.exit(2)
}
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// ---- 1. the engine in the exe ------------------------------------------------------------------------------------
function readWav(path) {
  const b = readFileSync(path)
  let p = 12, fmt, data
  while (p + 8 <= b.length) {
    const id = b.toString('latin1', p, p + 4), len = b.readUInt32LE(p + 4)
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }
    if (id === 'data') data = b.subarray(p + 8, p + 8 + len)
    p += 8 + len + (len & 1)
  }
  const bytes = fmt.bits / 8, s = new Float32Array(Math.floor(data.length / bytes))
  for (let i = 0; i < s.length; i++) {
    const o = i * bytes
    s[i] = fmt.format === 3 ? data.readFloatLE(o) : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : fmt.bits === 24 ? data.readIntLE(o, 3) / 8388608 : data.readInt32LE(o) / 2147483648
  }
  return s
}
const harness = join(root, 'dist', 'native', 'rig-native-render.exe')
if (!existsSync(harness)) throw new Error(`${harness} is missing: run node web/engine/test.mjs`)
const di = readWav(join(root, 'NeuralAmpModelerCore', 'example_audio', 'input.wav'))
const inputF32 = join(out, 'input.f32')
writeFileSync(inputF32, Buffer.from(di.buffer))
const models = join(root, 'NeuralAmpModelerCore', 'example_models')
const asFloats = (path) => { const b = readFileSync(path); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) }
for (const [model, rate] of [['wavenet.nam', 48000], ['wavenet.nam', 44100], ['lstm.nam', 48000], ['A2.nam', 48000]]) {
  const mine = join(out, `${model}-${rate}.app.f32`), ref = join(out, `${model}-${rate}.harness.f32`)
  const a = spawnSync(exe, ['--render', join(models, model), inputF32, mine, String(rate), '128'], { encoding: 'utf8', timeout: 120000 })
  const h = spawnSync(harness, [join(models, model), inputF32, ref, String(rate), '128'], { encoding: 'utf8', timeout: 120000 })
  if (a.status !== 0 || h.status !== 0) { check(`crbn-rig.exe --render ${model} at ${rate} Hz`, false, `exit ${a.status} / harness ${h.status} ${(a.stderr || '').trim()}`); continue }
  const x = asFloats(mine), y = asFloats(ref)
  let max = 0, err = 0, sig = 0
  for (let i = 0; i < y.length; i++) { const d = x[i] - y[i]; max = Math.max(max, Math.abs(d)); err += d * d; sig += y[i] * y[i] }
  const snr = 10 * Math.log10(sig / Math.max(err, 1e-30))
  check(`crbn-rig.exe --render ${model} at ${rate} Hz equals the parity harness`, x.length === y.length && max < 1e-3 && snr > 60,
    `${x.length} samples, max difference ${max.toExponential(2)}, ${snr > 200 ? 'identical' : `${snr.toFixed(0)} dB`}`)
}

// ---- 2. the app -------------------------------------------------------------------------------------------------
if (!process.argv.includes('--no-app')) {
  const port = 9400 + Math.floor(Math.random() * 400)
  // The suite look's file (D-CRBN-025): a throwaway one here, never the person's %APPDATA%\CRBN\suite-look.json.
  const suiteFile = join(out, 'suite-look.json')
  rmSync(suiteFile, { force: true })
  const readSuite = () => { try { return JSON.parse(readFileSync(suiteFile, 'utf8')) } catch { return null } }
  // as another CRBN app writes it (crbn-looks suite.rs): whole, through a temporary file and a rename
  const writeSuite = (v) => { writeFileSync(`${suiteFile}.other.tmp`, JSON.stringify(v, null, 2) + '\n'); renameSync(`${suiteFile}.other.tmp`, suiteFile) }
  const app = spawn(exe, [], {
    stdio: 'ignore',
    env: { ...process.env, CRBN_SUITE_LOOK: suiteFile, WEBVIEW2_USER_DATA_FOLDER: join(out, 'profile'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
  })
  let ws, id = 0
  const pending = new Map(), errors = []
  // Set when the app's DevTools connection closes: every call waiting on it fails with the reason, so the check says
  // so rather than Node leaving with the wait unsettled (a first run of SYNC:RIG-025 ended that way at the library).
  let gone = null
  const send = (method, params = {}) => new Promise((ok, fail) => { if (gone) { fail(new Error(gone)); return } const i = ++id; pending.set(i, { ok, fail }); ws.send(JSON.stringify({ id: i, method, params })) })
  const js = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  const until = async (expression, ms, what) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) { if (gone) throw new Error(`${gone}, waiting for ${what}`); if (await js(expression).catch(() => false)) return true }
    // what the page shows, to say why
    const said = await js("JSON.stringify({ ready: document.documentElement.dataset.ready ?? null, state: document.readyState, toast: document.getElementById('toast')?.textContent ?? '' })").catch((e) => String(e?.message ?? e))
    throw new Error(`timed out waiting for ${what}: ${said}${errors.length ? `; ${errors.slice(0, 2).join(' | ')}` : ''}`)
  }
  // The window's own handles, for the dialog check (PowerShell over user32).
  const ps = (script) => spawnSync('pwsh', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).stdout.trim()
  const user32 = `Add-Type 'using System;using System.Runtime.InteropServices;public static class U{[DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr FindWindowW(string c,string t);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport("user32.dll")]public static extern bool PostMessageW(IntPtr h,uint m,IntPtr w,IntPtr l);[DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);[DllImport("user32.dll")]public static extern IntPtr GetDlgItem(IntPtr d,int i);[DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr SendMessageW(IntPtr h,uint m,IntPtr w,string l);}';`
  try {
    let target
    for (let i = 0; i < 120 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page' && t.url.startsWith('https://crbn-rig.example/')) } catch { /* not yet */ }
      if (!target) await sleep(250)
    }
    if (!target) throw new Error('the app did not open its page (no DevTools target on https://crbn-rig.example/)')
    ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((ok, fail) => { ws.addEventListener('open', ok); ws.addEventListener('error', fail) })
    ws.addEventListener('close', () => {
      gone = `the app’s DevTools connection closed (the app ${app.exitCode === null ? 'still running' : `exited with code ${app.exitCode}`})`
      for (const p of pending.values()) p.fail(new Error(gone))
      pending.clear()
    })
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.fail(new Error(JSON.stringify(m.error))) : p.ok(m.result) }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    })
    await send('Runtime.enable')
    await until("document.documentElement.dataset.ready === 'true'", 30000, 'the page to be ready')

    // The page, from the app's folder, in Rig's look, with the desktop's words.
    const page = await js(`(() => { const h = document.documentElement, cs = (s, p) => getComputedStyle(document.querySelector(s))[p], shown = (s) => document.querySelector(s)?.getClientRects().length > 0
      return { url: location.href, host: h.dataset.host, look: h.dataset.look, product: h.dataset.product, strip: cs('.brand-strip', 'backgroundColor'), kit: !!document.querySelector('#hw-amp .hw.k-crbn'),
        web: shown('#web-link'), desktopLink: shown('#desktop-link'), settings: shown('#audio-settings'), select: shown('#input-device'), playing: document.getElementById('status-text').textContent } })()`)
    check('the app shows Rig’s page from its own folder', page.url === 'https://crbn-rig.example/index.html' && page.host === 'desktop', `${page.url}, host ${page.host}`)
    check('in Rig’s look: Capsule, the cherry strip, the CRBN kit', page.look === 'capsule' && page.product === 'rig' && page.strip === 'rgb(217, 43, 82)' && page.kit, `${page.look}/${page.strip}/${page.kit}`)
    check('the desktop’s words: Web version and Audio settings, no browser input list', page.web && !page.desktopLink && page.settings && !page.select, JSON.stringify({ web: page.web, desktopLink: page.desktopLink, settings: page.settings, select: page.select }))
    check('nothing plays until Play my guitar', page.playing === 'Not playing', page.playing)

    await until("document.getElementById('desktop-device').textContent !== 'The audio driver'", 10000, "the driver's status")
    const device = await js("document.getElementById('desktop-device').textContent")
    check('the audio driver’s status reaches the page', /DirectSound|ASIO/.test(device), device)

    // Meters straight from the app's messages, beside the page's own listener.
    await js("window.__m = []; chrome.webview.addEventListener('message', (e) => { if (e.data?.type === 'meter') window.__m.push(e.data) }); window.__status = null; chrome.webview.addEventListener('message', (e) => { if (e.data?.type === 'status' || e.data?.type === 'ready') window.__status = e.data }); chrome.webview.postMessage({ type: 'hello' }); true")
    await until('window.__status !== null', 5000, 'a status reply')
    const status = await js('window.__status')
    const key = (k) => `document.querySelector('.knob[data-param="outputDB"]').dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true }))`
    await js(key('Home'))
    check('the Output knob goes to -40 dB', (await js(`document.querySelector('.knob[data-param="outputDB"]').getAttribute('aria-valuenow')`)) === '-40')

    await js("document.getElementById('play-demo').click()")
    await until("document.getElementById('status-text').textContent.startsWith('Demo riff')", 30000, 'the demo riff')
    check('the demo riff plays through the app’s engine', true, await js("document.getElementById('status-text').textContent"))
    check('the example capture loads into the native engine', (await js("document.getElementById('capture-name').textContent")) === 'Example capture')

    // A measure: the riff from its top for two seconds, the loudest input and output the app reported.
    const measure = async (ms = 2000) => {
      await js("chrome.webview.postMessage({ type: 'source', source: 'demo' }); true") // the riff restarts at its top
      await sleep(150)
      await js('window.__m = []; true')
      await sleep(ms)
      return js("(() => { let i = 0, o = 0, n = window.__m.length; for (const m of window.__m) { i = Math.max(i, m.input); o = Math.max(o, m.output) } return { input: i, output: o, n } })()")
    }
    const a = await measure()
    check('both meters move while the riff plays', a.input > 0.01 && a.output > 1e-4 && a.n > 30, `input peak ${a.input.toFixed(3)}, output ${a.output.toExponential(2)}, ${a.n} meter messages`)
    for (let i = 0; i < 10; i++) await js(key('ArrowUp'))
    const b = await measure()
    check('Output from -40 to -30 dB raises the sound 10 dB', Math.abs(20 * Math.log10(b.output / a.output) - 10) < 0.5, `${(20 * Math.log10(b.output / a.output)).toFixed(2)} dB`)

    await js("document.querySelector('#hw-amp .sw[data-role=\"standby\"]').click()")
    await sleep(200)
    // 1.5 s: the riff is a second of silence, then its sine (a second measured from its top caught the sine only by timer slop)
    const s = await measure(1500)
    await js("document.querySelector('#hw-amp .sw[data-role=\"standby\"]').click()")
    check('Standby silences the output, the input still heard', s.output < 1e-6 && s.input > 0.01, `output ${s.output.toExponential(2)}, input ${s.input.toFixed(3)}`)

    // Space (build plan R3): the power key puts the amp in standby, through the engine's own fade, and says so.
    const space = "window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })); true"
    await js(space)
    await sleep(200)
    const sp = await measure(1000)
    const said = await js("document.getElementById('banner').hidden ? '' : document.getElementById('banner-title').textContent")
    await js(space)
    const back = await measure(1000)
    check('Space puts the amp in standby and says so; Space again brings it back', sp.output < 1e-6 && sp.input > 0.01 && said === 'Standby.' && back.output > 1e-4,
      `output ${sp.output.toExponential(2)} then ${back.output.toExponential(2)}, "${said}"`)

    // A unit impulse at the driver's rate: the cabinet scales the sound by -18 dB and 48 kHz over the rate.
    const rate = status.sampleRate, wav = Buffer.alloc(44 + 128)
    wav.write('RIFF', 0, 'latin1'); wav.writeUInt32LE(36 + 128, 4); wav.write('WAVEfmt ', 8, 'latin1'); wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
    wav.write('data', 36, 'latin1'); wav.writeUInt32LE(128, 40); wav.writeInt16LE(32767, 44)
    const irPath = join(out, `impulse-${rate}.wav`)
    writeFileSync(irPath, wav)
    await send('DOM.enable')
    const doc = await send('DOM.getDocument')
    const { nodeId } = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[data-input="ir"]' })
    await send('DOM.setFileInputFiles', { nodeId, files: [irPath] })
    await until("/ms impulse response/.test(document.getElementById('ir-meta').textContent)", 10000, 'the IR')
    const c = await measure()
    const expected = 20 * Math.log10(Math.pow(10, -18 / 20) * (48000 / rate) * (32767 / 32768))
    const got = 20 * Math.log10(c.output / b.output)
    check('a cabinet IR scales the sound as the desktop always did', Math.abs(got - expected) < 0.5, `${got.toFixed(2)} dB, expected ${expected.toFixed(2)} at ${rate} Hz`)

    // The Rig builder (R1b): a kit of the player's own, wearing knob art from a file on disk, kept in the app's own
    // storage (IndexedDB under the app's WebView2 profile) and drawn from a blob on the app's origin.
    const knobSvg = join(out, 'my-knob.svg')
    writeFileSync(knobSvg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><circle cx="200" cy="200" r="190" fill="#fc0"/><rect x="190" y="14" width="20" height="120"/></svg>')
    await js("document.getElementById('lm-build-new').click(); true")
    const artInput = await send('DOM.querySelector', { nodeId: (await send('DOM.getDocument')).root.nodeId, selector: '#lm-build input[data-art="knob"]' })
    await send('DOM.setFileInputFiles', { nodeId: artInput.nodeId, files: [knobSvg] })
    await until("/^url\\(\"blob:https:\\/\\/crbn-rig\\.example\\//.test(document.querySelector('#hw-amp .kn .art')?.style.backgroundImage ?? '')", 10000, 'the knob art')
    const built = await js("(() => { const k = JSON.parse(localStorage.getItem('crbn-rig/kits')).kits[0]; return { kit: document.querySelector('#hw-amp .hw').dataset.kit, art: k.art.knob, kept: document.getElementById('lb-art-t').textContent, saveDialog: typeof window.showSaveFilePicker } })()")
    check('the Rig builder: a kit of your own wears knob art from a file, kept', built.kit === 'builder' && built.art?.length === 32 && /kept with your kit/.test(built.kept), JSON.stringify(built))
    await js("document.querySelector('#lm-kits-new [data-kit=\"crbn\"]').click(); true")

    // Real keys from Windows, through the standalone's own message loop (a dialog's, which can keep arrows and Tab from
    // a child window): a kit knob takes the arrow key, a text field takes typing.
    const launcher = join(root, '..', 'crbn-launcher', 'scripts', 'desktop-host', 'shot.ps1')
    if (existsSync(launcher)) {
      const keys = (k, file) => spawnSync('pwsh', ['-NoProfile', '-File', launcher, '-ProcessId', String(app.pid), '-Out', join(out, file), '-Keys', k], { encoding: 'utf8' })
      const knob = "document.querySelector('#hw-amp .kn[data-param=\"bass\"]')"
      const before = Number(await js(`(${knob}.focus(), ${knob}.getAttribute('aria-valuenow'))`))
      keys('{UP}', 'keys-knob.png')
      await sleep(300)
      const after = Number(await js(`${knob}.getAttribute('aria-valuenow')`))
      check('a real arrow key turns a focused knob', Math.abs(after - before - 1) < 1e-9, `${before} -> ${after}`)
      await js("document.getElementById('look-open').click(); document.querySelector('#lm-finish [data-finish=\"custom\"]').click(); const f = document.getElementById('cu-hex'); f.value = ''; f.focus(); true")
      keys('#3fd9e8', 'keys-text.png')
      await sleep(300)
      const typed = await js("document.getElementById('cu-hex').value")
      check('real typing reaches a text field', typed === '#3fd9e8', typed)
      await js("document.querySelector('#lm-finish [data-finish=\"own\"]').click(); document.getElementById('look-close').click(); true")
      // The power key (R3), as Windows delivers it: Space, then Space again.
      await js('document.activeElement?.blur(); true')
      keys(' ', 'keys-space.png')
      await sleep(300)
      const spaced = await js('document.documentElement.dataset.powerState')
      keys(' ', 'keys-space-2.png')
      await sleep(300)
      const unspaced = await js('document.documentElement.dataset.powerState')
      check('a real Space puts the amp in standby, and back', spaced === 'standby' && unspaced === 'on', `${spaced} -> ${unspaced}`)
    }

    // "Use this look in every CRBN app" (D-CRBN-025, build plan R6 step 1): the app reads and writes the suite file for
    // the page (RigSuiteLook.cpp), the look only, and the page follows another app's change to it within about a second.
    {
      const own = await js('document.documentElement.dataset.look')
      const before = readSuite()
      await js("(() => { const s = document.getElementById('lm-suite'); s.checked = true; s.dispatchEvent(new Event('change', { bubbles: true })); return true })()")
      let on = null
      for (const end = Date.now() + 3000; Date.now() < end && !on?.every; await sleep(100)) on = readSuite()
      const keys = Object.keys(on?.prefs ?? {}).sort().join()
      check('the suite switch writes the suite file: on, from Rig, the look only', before === null && on?.version === 1 && on.every === true && on.from === 'rig' && on.prefs.look === own && keys === 'accent,density,display,look,mono,motion,speed,ui', `${JSON.stringify(on)}`)
      const other = own === 'holo' ? 'daylight' : 'holo'
      writeSuite({ version: 1, every: true, from: 'console', prefs: { ...on.prefs, look: other, density: 'compact' } })
      const t0 = Date.now()
      await until(`document.documentElement.dataset.look === '${other}' && document.documentElement.dataset.density === 'compact'`, 5000, 'the look another app shared')
      const ms = Date.now() - t0
      check('another app’s look reaches the app within about a second', ms < 2500, `${other}, compact, in ${ms} ms`)
      writeSuite({ version: 1, every: false, from: 'console', prefs: { ...on.prefs, look: other } })
      await until(`document.documentElement.dataset.look === '${own}' && !document.getElementById('lm-suite').checked`, 5000, 'Rig’s own look back')
      const after = readSuite()
      check('turned off in another app, Rig goes back to its own look and leaves the file alone', after?.every === false && after.from === 'console', `${own}; the file from ${after?.from}`)
    }

    // The library (build plan R4, RigLibrary.cpp): a generated 5,000-file folder on this disk, with NAM Core's examples,
    // picked through the app's own folder dialog (its Folder box typed into, then OK, as a person would), indexed by the
    // app natively, every entry equal to library.js's reading of the same file, searched in time, played, starred, and
    // watched: a file copied in appears by itself.
    {
      const libDir = join(out, 'library'), examplesDir = join(root, 'NeuralAmpModelerCore', 'example_models')
      const template = readFileSync(join(examplesDir, 'wavenet.nam'), 'utf8')
      const files = libraryFixture(5000, template)
      for (const f of readdirSync(examplesDir)) files.push({ path: `NAM Core/${f}`, bytes: readFileSync(join(examplesDir, f)), expect: {} })
      for (const f of files) { mkdirSync(join(libDir, dirname(f.path)), { recursive: true }); writeFileSync(join(libDir, f.path), f.bytes) }
      const listed = files.filter((f) => !f.expect.hidden)

      await js("document.getElementById('lib-choose').click(); true")
      const title = 'Choose the folder with your captures and IRs'
      // The Folder box (1152) takes the path and "Use this folder" (1) is clicked, as a person types and clicks.
      const picked = ps(`${user32} for ($i = 0; $i -lt 50; $i++) { $h = [U]::FindWindowW('#32770', '${title}'); if ($h -ne [IntPtr]::Zero) { $p = 0; [void][U]::GetWindowThreadProcessId($h, [ref]$p); if ($p -eq ${app.pid}) { break } }; $h = [IntPtr]::Zero; Start-Sleep -Milliseconds 100 }
        if ($h -eq [IntPtr]::Zero) { 'no dialog'; return }
        [void][U]::SendMessageW([U]::GetDlgItem($h, 1152), 0x000C, [IntPtr]::Zero, '${libDir.replace(/'/g, "''")}')
        [void][U]::PostMessageW([U]::GetDlgItem($h, 1), 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
        for ($i = 0; $i -lt 40 -and [U]::IsWindow($h); $i++) { Start-Sleep -Milliseconds 100 }
        if ([U]::IsWindow($h)) { [void][U]::PostMessageW($h, 0x0111, [IntPtr]2, [IntPtr]::Zero); 'still open' } else { 'picked' }`)
      await until("/captures/.test(document.getElementById('lib-src').textContent) && !/reading|looking/.test(document.getElementById('lib-src').textContent)", 60000, 'the library to be indexed')
      const head = await js("({ src: document.getElementById('lib-src').textContent, title: document.getElementById('lib-src').title, timing: JSON.parse(document.getElementById('lib-src').dataset.opened) })")
      const caps = listed.filter((f) => f.path.endsWith('.nam')).length
      check('the library: the app’s folder dialog picks a folder', picked === 'picked' && head.title.toLowerCase() === libDir.toLowerCase(), `${picked}: ${head.title}`)
      check('5,000 files (and NAM Core’s examples) index natively in under 10 s', head.timing.ms < 10000 && head.src.endsWith(`${caps.toLocaleString('en-GB')} captures, ${(listed.length - caps).toLocaleString('en-GB')} IRs`), `${head.src}; ${JSON.stringify(head.timing)}`)

      // Both builds read a folder alike: every entry the app read equals library.js's reading of the same file.
      const kept = await js(`new Promise((ok) => { const r = indexedDB.open('crbn-rig'); r.onsuccess = () => { const g = r.result.transaction('lib').objectStore('lib').get('index:path:' + ${JSON.stringify(libDir.toLowerCase())}); g.onsuccess = () => { ok(g.result?.entries ?? []); r.result.close() } } })`)
      const td = new TextDecoder(), byPath = new Map(kept.map((e) => [e.p, e])), differ = []
      for (const f of listed) {
        const b = new Uint8Array(f.bytes)
        const info = f.path.endsWith('.wav') ? wavInfo(b.subarray(0, WAV_HEAD_BYTES), b.length)
          : namInfo(td.decode(b.subarray(0, HEAD_BYTES)), td.decode(b.length <= HEAD_BYTES ? b.subarray(0, HEAD_BYTES) : b.subarray(b.length - TAIL_BYTES)))
        const want = entryOf({ p: f.path, s: b.length, m: 0 }, info), got = byPath.get(f.path)
        if (!got) { differ.push(`${f.path}: not listed`); continue }
        for (const k of ['k', 'n', 'gear', 'make', 'model', 'tone', 'by', 'rate', 'ch', 'sec', 's', 'bad']) if (got[k] !== want[k]) differ.push(`${f.path} ${k}: ${got[k]} vs ${want[k]}`)
      }
      check('the app reads every file as the web version does (RigLibrary.cpp and library.js)', !differ.length && kept.length === listed.length, differ.slice(0, 3).join('; ') || `${kept.length} entries alike`)

      const searchMs = await js(`(async () => { const q = document.getElementById('lib-q'), times = []; for (const v of ['m', 'mar', 'marshall', 'marshall crunch', 'überschall', '']) { await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); const t0 = performance.now(); q.value = v; q.dispatchEvent(new Event('input')); await new Promise((r) => requestAnimationFrame(r)); times.push(performance.now() - t0) } return Math.max(...times) })()`)
      check('a search of 5,000 draws in under 50 ms', searchMs < 50, `${searchMs.toFixed(1)} ms to the frame at worst`)

      await js("(() => { const q = document.getElementById('lib-q'); q.value = 'Core/wavenet.nam'; q.dispatchEvent(new Event('input')); document.querySelector('#lib-body .lib-go').click(); return true })()")
      await until("document.getElementById('capture-name').textContent === 'Test Model' && document.querySelector('#lib-body .lib-row.playing')", 10000, 'the capture from the library')
      await js("document.querySelector('#lib-body .lib-star').click(); true")
      const starred = await js("document.querySelector('#lib-body .lib-star').getAttribute('aria-pressed') === 'true' && document.getElementById('capture-star').getAttribute('aria-pressed') === 'true'")
      check('a click plays a capture from the library in the native engine, and a star keeps it', starred, await js("document.getElementById('capture-meta').textContent"))

      // Favourites on standby (build plan R5): a second favourite makes pad 2; the app builds and warms each pad's
      // capture off the audio thread, and the native engine crossfades between them. A real 2 from Windows while the riff
      // plays, then the left arrow back.
      await js("(() => { const q = document.getElementById('lib-q'); q.value = 'Core/lstm.nam'; q.dispatchEvent(new Event('input')); document.querySelector('#lib-body .lib-star').click(); q.value = ''; q.dispatchEvent(new Event('input')); return true })()")
      const padState = (i) => `document.querySelector('.pads-grid [data-pad="${i}"]')?.dataset.state`
      await js("document.getElementById('play-demo').click(); true")
      await until(`${padState(0)} === 'playing' && ${padState(1)} === 'ready'`, 15000, 'pad 1 heard and pad 2 warm')
      const pads = await js("[...document.querySelectorAll('.pads-grid [data-pad] .pn')].slice(0, 2).map((p) => p.firstChild?.textContent).join(' / ')")
      // timed in the page: from the key's arrival to pad 2 saying Playing (the engine's report comes with the meters)
      await js(`(() => { window.__k = 0; window.__heard = 0; addEventListener('keydown', (e) => { if (e.key === '2' && !window.__k) window.__k = performance.now() }, true); const watch = () => { if (window.__k && ${padState(1)} === 'playing') window.__heard = performance.now(); else requestAnimationFrame(watch) }; watch(); document.activeElement?.blur(); return true })()`)
      if (existsSync(launcher)) spawnSync('pwsh', ['-NoProfile', '-File', launcher, '-ProcessId', String(app.pid), '-Out', join(out, 'keys-pad-2.png'), '-Keys', '2'], { encoding: 'utf8' })
      else await js("document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2', bubbles: true })); true")
      await until(`${padState(1)} === 'playing' && document.getElementById('capture-name').textContent === 'Test LSTM'`, 8000, 'pad 2 by key')
      const keyMs = Math.round(await js('window.__heard - window.__k'))
      await js("document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true })); true")
      await until(`${padState(0)} === 'playing'`, 8000, 'the left arrow')
      check('the pads: a real 2 switches to pad 2 while the riff plays, in the native engine, and the left arrow back', true, `${pads}; Playing ${keyMs} ms after the key arrived (the engine's report rides on the meters, about every 33 ms)`)

      // The pedals (build plan R6): a capture dragged from the library onto the board, built and warmed by the app and
      // heard in the native engine's first pedal stage while the riff plays; its footswitch stomps it off and on, and the
      // board shows the audio thread's load. It stays on the board for the second opening.
      const pedalState = "document.querySelector('#board-row .pspot[data-pedal=\"0\"]')?.dataset.state"
      await js("(() => { const dt = new DataTransfer(); dt.setData('application/x-crbn-rig-library', 'NAM Core/wavenet.nam'); document.querySelector('#board-row .pspot.empty').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); return true })()")
      await until(`${pedalState} === 'on'`, 15000, 'the pedal heard in the native engine')
      const outWith = await measure()
      await js("document.querySelector('#board-row .hw.pedal [data-role=\"foot\"]').click(); true")
      await until(`${pedalState} === 'off'`, 8000, 'the pedal stomped off')
      const outWithout = await measure()
      await js("document.querySelector('#board-row .hw.pedal [data-role=\"foot\"]').click(); true")
      await until(`${pedalState} === 'on'`, 8000, 'the pedal stomped on again')
      const load = await js("document.getElementById('load').textContent")
      check('a pedal from the library plays in the native engine’s first pedal stage; its footswitch stomps it off and on', /^CPU \d+%$/.test(load) && outWith.output > 1e-4 && outWithout.output > 1e-4 && Math.abs(20 * Math.log10(outWith.output / outWithout.output)) > 0.1,
        `${await js("document.querySelector('#board-row .pname')?.textContent")}; output ${outWith.output.toExponential(2)} on, ${outWithout.output.toExponential(2)} off; ${load}`)

      // R6 step 3 (SYNC:RIG-030). The pedal's Tone: its switch on the kit's pedal puts it in, and its knob at +6 dB
      // changes what the native engine plays; switched out, it is the pedal as captured again.
      await js("(() => { const k = document.querySelector('#board-row .hw.pedal .kn[data-param=\"pedalTone1\"]'); k.focus(); k.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); document.querySelector('#board-row .hw.pedal .sw[data-role=\"tone\"]').click(); return true })()")
      const outTone = await measure()
      await js("document.querySelector('#board-row .hw.pedal .sw[data-role=\"tone\"]').click(); true")
      const outBypass = await measure()
      const toneDB = 20 * Math.log10(outTone.output / outBypass.output), bypassDB = 20 * Math.log10(outBypass.output / outWith.output)
      check('a pedal’s Tone reaches the native engine: in at +6 dB it changes the sound; bypassed, the pedal as captured', Math.abs(toneDB) > 0.3 && Math.abs(bypassDB) < 0.3,
        `Tone in ${toneDB.toFixed(2)} dB from bypassed; bypassed ${bypassDB.toFixed(2)} dB from before`)

      // Variants with real keys from Windows: W, the pedal stomped off there; Q brings it back on; W off again.
      const variantOn = "[...document.querySelectorAll('#variants [data-variant]')].findIndex((b) => b.getAttribute('aria-checked') === 'true')"
      const realKey = (k, file) => (existsSync(launcher)
        ? spawnSync('pwsh', ['-NoProfile', '-File', launcher, '-ProcessId', String(app.pid), '-Out', join(out, file), '-Keys', k], { encoding: 'utf8' })
        : js(`document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Key${k.toUpperCase()}', key: '${k}', bubbles: true })); true`))
      await js('document.activeElement?.blur(); true')
      await realKey('w', 'keys-variant-w.png')
      await until(`${variantOn} === 1`, 5000, 'variant W by key')
      await js("document.querySelector('#board-row .hw.pedal [data-role=\"foot\"]').click(); true")
      await until(`${pedalState} === 'off'`, 8000, 'the pedal off in W')
      await js('document.activeElement?.blur(); true')
      await realKey('q', 'keys-variant-q.png')
      await until(`${variantOn} === 0 && ${pedalState} === 'on'`, 8000, 'Q: the pedal on again')
      await realKey('w', 'keys-variant-w2.png')
      await until(`${variantOn} === 1 && ${pedalState} === 'off'`, 8000, 'W: the pedal off again')
      check('variants: real Q and W switch the pedals while the riff plays, in the native engine', true, await js("[...document.querySelectorAll('#variants .vn')].map((n) => n.textContent).join(', ')"))

      // A rig file imported through the app's file box: its second pedal found in the library by its path and heard in
      // the native engine's second stage, its variant picked; then saved by name for the second opening.
      const rigFile = join(out, 'imported.rig.json')
      writeFileSync(rigFile, JSON.stringify({
        format: 'crbn-rig', version: 1, name: 'Desktop rig', amp: { name: 'wavenet.nam', path: 'NAM Core/wavenet.nam', size: null }, ir: null,
        pedals: [{ name: 'wavenet.nam', path: 'NAM Core/wavenet.nam', size: null }, { name: 'lstm.nam', path: 'NAM Core/lstm.nam', size: null }, null, null],
        settings: { gateOn: 1, gateThresholdDB: -80, eqOn: 1, bass: 6, middle: 5, treble: 5, outputDB: -30, irOn: 1 },
        variants: [{ name: 'Clean', pedals: [{ on: false }, { on: true, drive: 2 }, null, null] }, { name: 'Push', pedals: [{ on: true }, { on: true }, null, null] }, { name: 'Lead', pedals: [{ on: true, toneOn: true, tone: 3 }, { on: false }, null, null] }],
        variant: 0,
      }))
      const fileBox = await send('DOM.querySelector', { nodeId: (await send('DOM.getDocument')).root.nodeId, selector: '#rig-file' })
      await send('DOM.setFileInputFiles', { nodeId: fileBox.nodeId, files: [rigFile] })
      const pedal2 = "document.querySelector('#board-row .pspot[data-pedal=\"1\"]')?.dataset.state"
      await until(`document.getElementById('rig-name').value === 'Desktop rig' && ${pedal2} === 'on' && ${pedalState} === 'off'`, 20000, 'the imported rig')
      const imported = await js("({ names: [...document.querySelectorAll('#board-row .hw.pedal .pname')].map((n) => n.textContent).join(', '), drive: Number(document.querySelector('#board-row .hw.pedal .kn[data-param=\"pedalDrive2\"]')?.getAttribute('aria-valuenow')) })")
      await js("document.getElementById('rig-save').click(); true")
      await until("JSON.parse(localStorage.getItem('crbn-rig/rigs') ?? '{}').book?.length === 1 && document.getElementById('rig-bar').dataset.state === 'saved'", 5000, 'the rig saved')
      check('a rig file imported in the app finds its pedals in the library; the native engine plays the second in its second stage', imported.names === 'Test Model, Test LSTM' && imported.drive === 2, JSON.stringify(imported))

      // R7 (SYNC:RIG-031, D-RIG-027): MIDI. The app gives its own page Web MIDI (RigWebView.cpp), so it answers without
      // a prompt and names the controllers plugged in. Then a test controller beside them drives the native engine: an
      // expression pedal learned by dragging the amp's Output knob onto the dock moves the sound, and a footswitch
      // learned from the dock's list stomps the second pedal off and on. The mappings stay for the second opening.
      const realMidi = await js("Promise.race([navigator.requestMIDIAccess().then((a) => ({ ok: true, ports: [...a.inputs.values()].map((p) => p.name) }), (e) => ({ ok: false, error: `${e.name}: ${e.message}` })), new Promise((r) => setTimeout(() => r({ ok: false, error: 'no answer in 5 s (a prompt?)' }), 5000))])")
      check('the app gives its page Web MIDI without asking; it names the controllers plugged in (R7)', realMidi.ok, realMidi.ok ? (realMidi.ports.join(', ') || 'none plugged in') : realMidi.error)
      await js("(() => { const input = { name: 'Test FCB', state: 'connected', onmidimessage: null, close() { return Promise.resolve(this) } }; const access = { inputs: new Map([['t', input]]), outputs: new Map(), onstatechange: null }; navigator.requestMIDIAccess = async () => access; window.__fcb = (...b) => input.onmidimessage?.({ data: new Uint8Array(b) }); document.getElementById('midi-open').click(); document.getElementById('midi-on').click(); return true })()")
      await until("/Test FCB/.test(document.getElementById('midi-ports').textContent)", 5000, 'the test controller')
      const dockState = "document.getElementById('midi-drop').dataset.state"
      await js("(() => { const k = document.querySelector('#hw-amp .kn[data-param=\"outputDB\"]'), d = document.getElementById('midi-drop'); const at = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 } }; const P = (type, p, t) => t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: p.x, clientY: p.y })); const a = at(k), b = at(d); P('pointerdown', a, k); P('pointermove', { x: a.x + 20, y: a.y + 30 }, window); P('pointermove', b, window); P('pointerup', b, d); return true })()")
      await until(`${dockState} === 'learning'`, 3000, 'learning Output by a drag onto the dock')
      await js('__fcb(0xb0, 7, 16); true') // learned, and heard: -40 + 16 / 127 * 80 = -29.9 dB
      await until(`${dockState} === 'learned'`, 3000, 'Output learned')
      const at16 = await measure()
      await js('__fcb(0xb0, 7, 0); true') // the heel: -40 dB
      const at0 = await measure()
      const pedalDB = 20 * Math.log10(at0.output / at16.output)
      check('an expression pedal learned by dragging Output onto the dock moves the native engine’s sound', Math.abs(pedalDB + 10.1) < 0.6 && at0.output > 1e-5,
        `heel ${pedalDB.toFixed(2)} dB from CC 16 (-29.9 dB to -40 dB); ${await js("document.querySelector('.knob[data-param=\"outputDB\"]').getAttribute('aria-valuetext')")}`)
      // The owner's MC8 review (2026-11-14): his pedal sends only 50 to 88; its sweep set by Set heel and Set toe. The toe
      // is held at the heel while the pedal is swept, so the speakers stay quiet, then let go.
      const outRow = "[...document.querySelectorAll('#midi-maps .md-map')].find((li) => /^Output level/.test(li.querySelector('.md-what').textContent))"
      const toeTo = (v) => `(() => { const r = ${outRow}.querySelector('[data-end=\"toe\"]'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); return true })()`
      await js(toeTo(0))
      await js(`(() => { ${outRow}.querySelector('[data-md=\"measure\"]').click(); __fcb(0xb0, 7, 50); ${outRow}.querySelector('[data-md=\"set-heel\"]').click(); __fcb(0xb0, 7, 88); ${outRow}.querySelector('[data-md=\"set-toe\"]').click(); return true })()`)
      await js(toeTo(1000))
      const sweptTo = await js("JSON.stringify(JSON.parse(localStorage.getItem('crbn-rig/midi')).sweeps?.['cc:1:7'] ?? null)")
      await js('__fcb(0xb0, 7, 50); true') // its heel: -40 dB
      const sw50 = await measure()
      await js('__fcb(0xb0, 7, 52); true') // two steps in: -40 + 2 / 38 * 80 = -35.8 dB (unmeasured, -7.2 dB)
      const sw52 = await measure()
      const sweepDB = 20 * Math.log10(sw52.output / sw50.output)
      check('a pedal that sends only 50 to 88, its sweep set by Set heel and Set toe, moves Output from its heel in the native engine', sweptTo === '{"heel":50,"toe":88}' && Math.abs(sweepDB - 4.21) < 0.6 && sw50.output > 1e-5,
        `${sweptTo}; CC 52 is ${sweepDB.toFixed(2)} dB over CC 50 (4.21 expected); ${await js("document.querySelector('.knob[data-param=\"outputDB\"]').getAttribute('aria-valuetext')")}`)
      await js("(() => { const s = document.querySelector('#midi-drop select[data-md=\"pick\"]'), o = [...s.options].find((x) => x.textContent === 'Pedal 2 footswitch'); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return true })()")
      await until(`${dockState} === 'learning'`, 3000, 'learning the second footswitch from the list')
      await js('__fcb(0xb0, 81, 127); true')
      await until(`${dockState} === 'learned'`, 3000, 'the footswitch learned')
      const untouched = await js(`${pedal2} === 'on'`)
      await js('__fcb(0xb0, 81, 127); true')
      await until(`${pedal2} === 'off'`, 8000, 'pedal 2 stomped off by MIDI')
      await js('__fcb(0xb0, 81, 127); true')
      await until(`${pedal2} === 'on'`, 8000, 'pedal 2 stomped on by MIDI')
      check('a footswitch learned from the dock’s list stomps a pedal off and on in the native engine', untouched, await js("document.getElementById('midi-log').textContent.slice(0, 160)"))
      await js("document.getElementById('midi-close').click(); true")
      // the pedal moved Output after the rig was saved: saved again as it plays now, for the second opening
      await js("document.getElementById('rig-save').click(); true")
      await until("document.getElementById('rig-bar').dataset.state === 'saved'", 5000, 'the rig saved again')
      // Push, both pedals on, for the second opening
      await js('document.activeElement?.blur(); true')
      await realKey('w', 'keys-variant-w3.png')
      await until(`${variantOn} === 1 && ${pedalState} === 'on' && ${pedal2} === 'on'`, 8000, 'Push: both pedals on')
      await js("document.getElementById('play-demo').click(); true")

      writeFileSync(join(libDir, 'Copied in.nam'), template)
      await until(`document.getElementById('lib-src').textContent.includes('${(caps + 1).toLocaleString('en-GB')} captures')`, 15000, 'the copied file')
      check('the app watches the folder: a file copied in appears by itself', true, await js("document.getElementById('lib-src').textContent + ' · the amp ' + document.documentElement.dataset.powerState + (document.getElementById('banner').hidden ? '' : ': ' + document.getElementById('banner-title').textContent)"))
      await js("(() => { const q = document.getElementById('lib-q'); q.value = ''; q.dispatchEvent(new Event('input')); return true })()")
    }

    // Auto-off in the app's native engine (build plan R3): the guitar plays, and then the engine hears a pulled jack (a
    // quiet hiss, contacts scraping near full scale, dead silence), sent as the riff past the page, so the guard and
    // auto-off listen as they do to the guitar. The page says why, and Turn back on lifts it.
    await js("document.getElementById('play-guitar').click(); true")
    await until("document.getElementById('status-text').textContent.startsWith('Live')", 10000, 'the guitar')
    {
      const n = rate * 3, jack = new Float32Array(n)
      let seed = 3
      for (let i = 0; i < n; i++) {
        const t = i / rate
        jack[i] = t < 1 ? ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296 - 0.5) * 0.01 : t < 1.006 ? (i % 2 ? -0.97 : 0.97) : 0
      }
      const b64 = Buffer.from(jack.buffer).toString('base64')
      await js(`chrome.webview.postMessage({ type: 'demo', id: 77, rate: ${rate}, samples: '${b64}' }); chrome.webview.postMessage({ type: 'source', source: 'demo' }); true`)
    }
    await until("!document.getElementById('banner').hidden && /^Auto-off/.test(document.getElementById('banner-title').textContent)", 10000, 'auto-off in the app')
    const offWords = await js("document.getElementById('banner-title').textContent + ' ' + document.getElementById('banner-body').textContent")
    await js("document.getElementById('banner-on').click(); chrome.webview.postMessage({ type: 'source', source: 'live' }); true")
    await sleep(300)
    const liftedOff = await js("document.getElementById('banner').hidden && document.documentElement.dataset.powerState === 'on'")
    const afterLift = liftedOff ? '' : await js("` (then: ${document.documentElement.dataset.powerState}, ${document.getElementById('banner').hidden ? 'no banner' : document.getElementById('banner-title').textContent}, ${document.getElementById('status-text').textContent})`")
    check('auto-off: a pulled jack in the native engine mutes it, the page says why, Turn back on lifts it', liftedOff && /went dead after a loud pop/.test(offWords), offWords + afterLift)

    // The page's look in the screenshot, then Audio settings: iPlug2's own dialog, owned by the app.
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(out, 'app-page.png'), Buffer.from(shot.data, 'base64'))
    if (existsSync(launcher)) spawnSync('pwsh', ['-NoProfile', '-File', launcher, '-ProcessId', String(app.pid), '-Out', join(out, 'app-window.png')], { encoding: 'utf8' })
    await js("chrome.webview.postMessage({ type: 'source', source: 'none' }); document.getElementById('audio-settings').click(); true")
    const found = ps(`${user32} for ($i = 0; $i -lt 40; $i++) { $h = [U]::FindWindowW('#32770', 'Preferences'); if ($h -ne [IntPtr]::Zero) { $p = 0; [void][U]::GetWindowThreadProcessId($h, [ref]$p); if ($p -eq ${app.pid}) { [void][U]::PostMessageW($h, 0x0111, [IntPtr]2, [IntPtr]::Zero); 'found'; break } }; Start-Sleep -Milliseconds 100 }`)
    check('Audio settings opens the driver’s dialog', found === 'found', found || 'no Preferences window')
    check('no script errors in the page', errors.length === 0, errors.slice(0, 3).join(' | '))
  } catch (err) {
    check('the app check ran to the end', false, err?.message ?? err)
  } finally {
    try { ws?.close() } catch { /* closed */ }
    // Closed as a person closes it, with the audio still running: it must leave cleanly.
    const exited = new Promise((ok) => app.once('exit', (code) => ok(code)))
    ps(`$p = Get-Process -Id ${app.pid} -ErrorAction SilentlyContinue; if ($p) { [void]$p.CloseMainWindow(); if (-not $p.WaitForExit(10000)) { Stop-Process -Id ${app.pid} -Force } }`)
    const code = await Promise.race([exited, sleep(12000).then(() => 'still running')])
    check('closing the window ends the app cleanly', code === 0, `exit code ${code}`)
  }

  // Another app turns the suite look on while Rig is closed: Rig opens in it.
  writeSuite({ version: 1, every: true, from: 'console', prefs: { look: 'redline', motion: null, speed: 1, display: null, ui: null, mono: null, accent: 'look', density: 'comfortable' } })
  // Opened again on the same profile: it was playing the guitar when it closed, so it plays the guitar now (the owner's
  // word in R3, with the squeal guard on), where a first run waits for Play my guitar.
  const again = spawn(exe, [], {
    stdio: 'ignore',
    env: { ...process.env, CRBN_SUITE_LOOK: suiteFile, WEBVIEW2_USER_DATA_FOLDER: join(out, 'profile'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port + 1}` },
  })
  let ws2
  try {
    let target
    for (let i = 0; i < 120 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port + 1}/json`)).json()).find((t) => t.type === 'page' && t.url.startsWith('https://crbn-rig.example/')) } catch { /* not yet */ }
      if (!target) await sleep(250)
    }
    if (!target) throw new Error('the app did not open its page the second time')
    ws2 = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((ok, fail) => { ws2.addEventListener('open', ok); ws2.addEventListener('error', fail) })
    let id2 = 0
    const waiting2 = new Map()
    ws2.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && waiting2.has(m.id)) { waiting2.get(m.id)(m.result); waiting2.delete(m.id) } })
    const js2 = (expression) => new Promise((ok) => { const i = ++id2; waiting2.set(i, (r) => ok(r?.result?.value)); ws2.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, returnByValue: true } })) })
    let text = ''
    for (const end = Date.now() + 20000; Date.now() < end; await sleep(200)) {
      text = (await js2("document.documentElement.dataset.ready === 'true' ? document.getElementById('status-text').textContent : ''")) ?? ''
      if (text.startsWith('Live')) break
    }
    check('opened again after playing, it plays the guitar at once', text.startsWith('Live'), text || 'no status')
    const shared = await js2("[document.documentElement.dataset.look, document.getElementById('lm-suite').checked].join()")
    check('opened again, it draws the suite look another app turned on', shared === 'redline,true', shared)
    // The library's folder opens again by itself, with the favourite starred last time.
    let favs = ''
    for (const end = Date.now() + 30000; Date.now() < end; await sleep(200)) {
      favs = (await js2("(() => { const s = document.getElementById('lib-src').textContent; if (!/captures/.test(s) || /reading|looking/.test(s)) return ''; const c = document.querySelector('#lib-chips [data-favs]'); c.click(); const r = [...document.querySelectorAll('#lib-body .lib-row:not(.hd) b')].map((b) => b.textContent).join(); c.click(); return s + ' | ' + r })()")) ?? ''
      if (favs) break
    }
    check('opened again, the library’s folder is back with its favourites', /captures/.test(favs) && favs.endsWith('| Test LSTM,Test Model'), favs || 'no library')
    // and the pads with them, loaded and warm without a click (R5)
    let padsBack = ''
    for (const end = Date.now() + 15000; Date.now() < end; await sleep(200)) {
      padsBack = (await js2("[0, 1].map((i) => { const b = document.querySelector(`.pads-grid [data-pad=\"${i}\"]`); return `${b?.querySelector('.pn')?.firstChild?.textContent} ${b?.dataset.state}` }).join(' / ')")) ?? ''
      if (/^Test Model (playing|ready) \/ Test LSTM (playing|ready)$/.test(padsBack)) break
    }
    check('opened again, the pads are back, loaded and warm', /^Test Model (playing|ready) \/ Test LSTM (playing|ready)$/.test(padsBack), padsBack)
    // and the board, its pedal heard again in the native engine (R6)
    let boardBack = ''
    for (const end = Date.now() + 15000; Date.now() < end; await sleep(200)) {
      boardBack = (await js2("(() => { const s = document.querySelector('#board-row .pspot[data-pedal=\"0\"]'); return s ? `${s.querySelector('.pname')?.textContent} ${s.dataset.state}` : '' })()")) ?? ''
      if (boardBack === 'Test Model on') break
    }
    check('opened again, the board is back, its pedal heard', boardBack === 'Test Model on', boardBack || 'no board')
    // and the rig open, its variant, both pedals heard (R6 step 3)
    let rigBack = ''
    for (const end = Date.now() + 15000; Date.now() < end; await sleep(200)) {
      rigBack = (await js2("(() => { const v = [...document.querySelectorAll('#variants [data-variant]')].findIndex((b) => b.getAttribute('aria-checked') === 'true'); const s = document.querySelector('#board-row .pspot[data-pedal=\"1\"]'); return `${document.getElementById('rig-name').value} ${document.getElementById('rig-bar').dataset.state} ${v} ${s?.querySelector('.pname')?.textContent} ${s?.dataset.state}` })()")) ?? ''
      if (rigBack === 'Desktop rig saved 1 Test LSTM on') break
    }
    check('opened again, the rig is open in its variant, both pedals heard', rigBack === 'Desktop rig saved 1 Test LSTM on', rigBack)
    // and MIDI (R7): its mappings, the range drawn on Output, and MIDI on again through the app's own Web MIDI, unasked
    let midiBack = ''
    for (const end = Date.now() + 10000; Date.now() < end; await sleep(200)) {
      midiBack = (await js2("(() => { const m = JSON.parse(localStorage.getItem('crbn-rig/midi') ?? '{}'); return `${m.on} ${m.maps?.length} ${Boolean(document.querySelector('#hw-amp .kw > .midi-range.ring'))} ${document.getElementById('midi-open').dataset.state} ${document.getElementById('midi-open').title}` })()")) ?? ''
      if (/^true 2 true (on|empty) /.test(midiBack)) break
    }
    check('opened again, MIDI is on through the app’s own Web MIDI, its mappings back and Output’s range drawn', /^true 2 true (on|empty) /.test(midiBack), midiBack)
    await js2("document.getElementById('stop').click(); true")
  } catch (err) {
    check('the second opening ran to the end', false, err?.message ?? err)
  } finally {
    try { ws2?.close() } catch { /* closed */ }
    const exited = new Promise((ok) => again.once('exit', (code) => ok(code)))
    ps(`$p = Get-Process -Id ${again.pid} -ErrorAction SilentlyContinue; if ($p) { [void]$p.CloseMainWindow(); if (-not $p.WaitForExit(10000)) { Stop-Process -Id ${again.pid} -Force } }`)
    await Promise.race([exited, sleep(12000)])
  }
}

const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `${failed.length} of ${results.length} FAILED` : `desktop check: all ${results.length} checks pass (${folder})`)
process.exit(failed.length ? 1 : 0)
