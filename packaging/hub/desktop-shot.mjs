// The store's desktop capture (packaging/hub/pictures.mjs frames it): CRBN Rig's desktop app from the Hub folder
// package.ps1 laid out, playing the demo riff, captured as the screen shows its window (title bar and all, Windows'
// invisible borders left out) into dist/shots/desktop.png.
//
//   node packaging/hub/desktop-shot.mjs [--kit=crbn] [--look=capsule] [--size=1280x640] [--output=-12]
//                                       [--out=dist/shots/desktop.png] [--folder=<hub folder>]
//
// --size is the page's own area (the window's client area); the window grows to fit the page if it would scroll.
// The app starts with a throwaway WebView2 profile in the temp folder and DevTools on loopback, so the person's own
// settings are neither read nor changed. (On GOATi-Box-C a fresh profile on D:, a full hard disk, kept the page from
// getting ready for 13 to 30 seconds; on C:, an SSD, it takes about two.) The look, the kit (Salvage is `hammer`, in
// the owner's setup by default) and Output come from the flags. The riff plays through the default device for about
// three seconds, Output at --output dB, and the picture is taken at a loud moment so the meters and the energy show.
// The window must be on screen and uncovered while it is captured; the script brings it to the front.
// It will not start beside a running CRBN Rig (one copy runs at a time).
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const version = readFileSync(join(root, 'NeuralAmpModeler', 'config.h'), 'utf8').match(/#define PLUG_VERSION_STR "([0-9.]+)"/)[1]
const folder = resolve(arg('folder', join(root, 'dist', 'hub', `crbn-rig-${version}-windows-x64`)))
const exe = join(folder, 'crbn-rig.exe')
const shot = resolve(root, arg('out', join('dist', 'shots', 'desktop.png')))
const [width, height] = arg('size', '1280x640').split('x').map(Number)
const outputDB = Number(arg('output', '-12'))
const query = new URLSearchParams({ look: arg('look', 'capsule'), kit: arg('kit', 'crbn') })
const work = join(tmpdir(), 'crbn-rig-desktop-shot')
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))

if (!existsSync(exe)) throw new Error(`${exe} is missing: run pwsh packaging/windows/package.ps1`)
if (!(outputDB >= -40 && outputDB <= 40)) throw new Error('--output is -40 to 40 dB')
if (spawnSync('tasklist', ['/FI', 'IMAGENAME eq crbn-rig.exe', '/NH'], { encoding: 'utf8' }).stdout.includes('crbn-rig.exe')) {
  throw new Error('CRBN Rig is running: close it first (one copy runs at a time)')
}
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
mkdirSync(dirname(shot), { recursive: true })

// The window, through user32 and DWM: its client area sized, and its visible bounds (DWMWA_EXTENDED_FRAME_BOUNDS,
// which leaves out the invisible resize borders) copied from the screen.
const WIN = `Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class Win {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int n);
}
'@
[Win]::SetProcessDPIAware() | Out-Null
$h = (Get-Process -Id $env:RIG_PID).MainWindowHandle
if ($h -eq [IntPtr]::Zero) { throw 'no main window' }
[Win]::ShowWindow($h, 9) | Out-Null
[Win]::SetForegroundWindow($h) | Out-Null
$w = New-Object Win+RECT; $c = New-Object Win+RECT; $v = New-Object Win+RECT
`
const ps = (body, env = {}) => {
  const r = spawnSync('pwsh', ['-NoProfile', '-Command', WIN + body], { encoding: 'utf8', env: { ...process.env, RIG_PID: String(app.pid), ...env } })
  if (r.status !== 0) throw new Error(`PowerShell: ${r.stderr.trim() || r.stdout.trim()}`)
  return r.stdout.trim()
}
const sizeWindow = (cw, ch) => ps(`[Win]::GetWindowRect($h, [ref]$w) | Out-Null; [Win]::GetClientRect($h, [ref]$c) | Out-Null
$ow = ($w.R - $w.L) - ($c.R - $c.L) + [int]$env:CW; $oh = ($w.B - $w.T) - ($c.B - $c.T) + [int]$env:CH
[Win]::SetWindowPos($h, [IntPtr]::Zero, 40, 40, $ow, $oh, 0x0004) | Out-Null
[Win]::GetClientRect($h, [ref]$c) | Out-Null; "$($c.R - $c.L)x$($c.B - $c.T)"`, { CW: String(cw), CH: String(ch) })
// The capture is armed first (PowerShell's Add-Type takes a second or so), then fired on a line from here, so the
// picture is taken within a frame or two of a loud moment in the riff.
const armCapture = () => new Promise((ok, fail) => {
  const p = spawn('pwsh', ['-NoProfile', '-Command', WIN + `[Console]::Out.WriteLine('armed'); [Console]::Out.Flush()
[void][Console]::In.ReadLine()
[Win]::DwmGetWindowAttribute($h, 9, [ref]$v, 16) | Out-Null
$bw = $v.R - $v.L; $bh = $v.B - $v.T
$bmp = New-Object System.Drawing.Bitmap $bw, $bh
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($v.L, $v.T, 0, 0, $bmp.Size)
$bmp.Save($env:SHOT, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
"$($bw)x$($bh)"`], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, RIG_PID: String(app.pid), SHOT: shot } })
  let text = '', err = ''
  const done = new Promise((res, rej) => p.on('exit', (code) => (code === 0 ? res(text.trim().split(/\r?\n/).pop()) : rej(new Error(`PowerShell: ${err.trim() || text.trim()}`)))))
  p.stderr.on('data', (d) => { err += d })
  p.stdout.on('data', (d) => {
    text += d
    if (text.includes('armed')) { text = ''; ok({ fire: () => { p.stdin.end('go\n'); return done } }) }
  })
  p.on('exit', (code) => { if (code !== 0) fail(new Error(`PowerShell: ${err.trim() || text.trim()}`)) })
})

const port = 9400 + Math.floor(Math.random() * 400)
const app = spawn(exe, [], {
  stdio: 'ignore',
  env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: join(work, 'profile'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
})
const exited = new Promise((ok) => app.on('exit', ok))
let ws, id = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((ok, fail) => { const i = ++id; pending.set(i, { ok, fail }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result.value
}
const until = async (expression, ms, what) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await js(expression).catch(() => false)) return
  const seen = await js(`JSON.stringify({ url: location.href, device: document.getElementById('desktop-device')?.textContent,
    status: document.getElementById('status-text')?.textContent, toast: document.getElementById('toast')?.textContent })`).catch((e) => e.message)
  throw new Error(`timed out waiting for ${what} (${seen})`)
}
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
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await until("document.documentElement.dataset.ready === 'true'", 30000, 'the page to be ready')
  await send('Page.navigate', { url: `https://crbn-rig.example/index.html?${query}` })
  await sleep(300)
  await until("document.documentElement.dataset.ready === 'true' && document.fonts.status === 'loaded'", 30000, 'the page to be ready again')
  await until("document.getElementById('desktop-device').textContent !== 'The audio driver'", 10000, "the driver's status")

  // The window: the page's area as asked, taller if the page would scroll.
  let size = sizeWindow(width, height)
  await sleep(500)
  const needed = await js('document.documentElement.scrollHeight')
  if (needed > height) { size = sizeWindow(width, needed); await sleep(500) }

  // Output, by the knob's own keys (1 dB a step from -40), then the riff with the example capture.
  const key = (k) => `document.querySelector('.knob[data-param="outputDB"]').dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true }))`
  await js(key('Home'))
  for (let i = 0; i < outputDB + 40; i++) await js(key('ArrowUp'))
  const knob = await js(`document.querySelector('.knob[data-param="outputDB"]').getAttribute('aria-valuenow')`)
  await js("document.getElementById('play-demo').click()")
  await until("document.getElementById('status-text').textContent.startsWith('Demo riff')", 30000, 'the demo riff')
  await js('document.activeElement?.blur(); true') // no focus ring in the picture
  // Fired on a loud moment: the app's own meter messages (linear peaks), after two seconds for the energy to build.
  await js("window.__peak = 0; chrome.webview.addEventListener('message', (e) => { if (e.data?.type === 'meter') window.__peak = e.data.input }); true")
  const armed = await armCapture()
  await sleep(2000)
  let peak = 0
  for (const end = Date.now() + 15000; Date.now() < end && peak < 0.3; await sleep(15)) peak = await js('window.__peak')
  const captured = await armed.fire()
  await js("document.getElementById('play-demo').click()")
  const state = await js(`(() => ({ look: document.documentElement.dataset.look, kit: [...document.querySelector('#hw-amp .hw').classList].find((c) => c.startsWith('k-')), status: document.getElementById('status-text').textContent }))()`)
  console.log(`${shot}: ${captured} (page ${size}, ${state.look}, ${state.kit}, Output ${knob} dB, input peak ${peak.toFixed(2)} when taken)`)
} finally {
  ws?.close()
  spawnSync('pwsh', ['-NoProfile', '-Command', `(Get-Process -Id ${app.pid} -ErrorAction SilentlyContinue)?.CloseMainWindow() | Out-Null`])
  if (await Promise.race([exited.then(() => true), sleep(10000).then(() => false)]) === false) app.kill()
}
