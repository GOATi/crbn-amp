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
//    knob and Standby acting on the sound, a cabinet IR scaling it as the desktop always did, Audio settings opening
//    the driver's dialog, and a screenshot of the window. The riff plays quietly (Output at -40 and -30 dB) through the
//    default device for about ten seconds.
// It will not start beside a running CRBN Rig (one copy runs at a time). Exit code 0 when every check passes.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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
  const app = spawn(exe, [], {
    stdio: 'ignore',
    env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: join(out, 'profile'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
  })
  let ws, id = 0
  const pending = new Map(), errors = []
  const send = (method, params = {}) => new Promise((ok, fail) => { const i = ++id; pending.set(i, { ok, fail }); ws.send(JSON.stringify({ id: i, method, params })) })
  const js = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  const until = async (expression, ms, what) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await js(expression).catch(() => false)) return true
    throw new Error(`timed out waiting for ${what}`)
  }
  // The window's own handles, for the dialog check (PowerShell over user32).
  const ps = (script) => spawnSync('pwsh', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).stdout.trim()
  const user32 = `Add-Type 'using System;using System.Runtime.InteropServices;public static class U{[DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr FindWindowW(string c,string t);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport("user32.dll")]public static extern bool PostMessageW(IntPtr h,uint m,IntPtr w,IntPtr l);}';`
  try {
    let target
    for (let i = 0; i < 120 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page' && t.url.startsWith('https://crbn-rig.example/')) } catch { /* not yet */ }
      if (!target) await sleep(250)
    }
    if (!target) throw new Error('the app did not open its page (no DevTools target on https://crbn-rig.example/)')
    ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((ok, fail) => { ws.addEventListener('open', ok); ws.addEventListener('error', fail) })
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
    const s = await measure(1000)
    await js("document.querySelector('#hw-amp .sw[data-role=\"standby\"]').click()")
    check('Standby silences the output, the input still heard', s.output < 1e-6 && s.input > 0.01, `output ${s.output.toExponential(2)}, input ${s.input.toFixed(3)}`)

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
    }

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
}

const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `${failed.length} of ${results.length} FAILED` : `desktop check: all ${results.length} checks pass (${folder})`)
process.exit(failed.length ? 1 : 0)
