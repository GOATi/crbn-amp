// A probe of the built web version (dist/web) in headless Edge over the DevTools protocol: run script in the page,
// measure its work, take clipped screenshots. It found R1's layout clashes, the self-test's timing and the energy's idle
// cost (SYNC:RIG-015). Run after node web/build.mjs.
//
//   node web/probe.mjs <steps.json>      run the steps, printing each result
//   node web/probe.mjs --clashes         class names the kits' markup (web/src/hw) shares with the page's stylesheet
//
// steps.json is an array, run in order:
//   { "go": "/?example&kit=hammer", "w": 1536, "h": 864, "settle": 900, "dpr": 1,
//     "media": [{ "name": "prefers-reduced-motion", "value": "reduce" }] }    open a page and wait for data-ready
//   { "eval": "document.querySelectorAll('#hw-amp .kn').length" }            print an expression's value (awaits promises)
//   { "shot": "dist/probe/amp.png", "sel": ".chain", "pad": 6 }              a screenshot, of one element if sel is set
//   { "metrics": 6000, "label": "crbn idle" }                                the renderer's task and script time, as a
//                                                                            share of the wall clock over that many ms
//   { "wait": 1000 }
//
// Notes from R1: the self-test (web/test/selftest.html) runs the page inside an iframe, so wait for a drawing to appear
// rather than sleeping a fixed time; a canvas reads back with getImageData (same origin); the energy rests after 30 s
// idle (D-RIG-016 (e)), so a probe that waits longer sees the still frame.
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { startHeadlessEdge } from '../scripts/headless-edge.mjs'

const root = resolve(import.meta.dirname, '..')

if (process.argv[2] === '--clashes') {
  // Each class the kits use that the page's own CSS also names, with the page's rules that name it. A page rule that
  // is not scoped to its own element (as `.bar` was for the header, and `.knobs`) reaches into the kits; scope it.
  const js = readFileSync(join(root, 'web/src/hw/hw.js'), 'utf8'), hwcss = readFileSync(join(root, 'web/src/hw/hw.css'), 'utf8')
  const kit = new Set()
  for (const m of js.matchAll(/class="([^"]*)"/g)) for (const c of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (/^[a-z][\w-]*$/.test(c)) kit.add(c)
  for (const m of hwcss.matchAll(/\.([a-z][\w-]*)/g)) kit.add(m[1])
  const page = readFileSync(join(root, 'web/src/style.css'), 'utf8') + readFileSync(join(root, 'web/src/look/themes.css'), 'utf8')
  const rules = page.split('\n').filter((l) => !l.includes('.rig-hw') && /^[^{]*\{/.test(l)).map((l) => l.slice(0, l.indexOf('{')).trim())
  let n = 0
  for (const c of [...kit].sort()) {
    const hits = rules.filter((sel) => new RegExp(`\\.${c}(?![\\w-])`).test(sel))
    if (hits.length) { n++; console.log(`.${c}\n  ${hits.slice(0, 4).join('\n  ')}${hits.length > 4 ? `\n  (${hits.length - 4} more)` : ''}`) }
  }
  console.log(`${n} shared class names. A rule above that is scoped to the page's own element (\`.knob .arc\`, \`.meter .clip\`) is fine.`)
  process.exit(0)
}

const site = join(root, 'dist', 'web')
const steps = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.nam': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain' }
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = normalize(join(site, p === '/' ? 'index.html' : p.slice(1)))
  if (!file.startsWith(site + sep)) { res.writeHead(403).end(); return }
  let bytes
  try { bytes = readFileSync(file) } catch { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(bytes)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const origin = `http://127.0.0.1:${server.address().port}`
const port = 9300 + Math.floor(Math.random() * 400)
const edge = startHeadlessEdge('about:blank', { args: [`--remote-debugging-port=${port}`, '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] })
let ws, id = 0
const pending = new Map(), logs = []
const send = (method, params = {}) => new Promise((ok, fail) => { const i = ++id; pending.set(i, { ok, fail }); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = (expression) => send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
try {
  let target
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch { await new Promise((r) => setTimeout(r, 250)) }
  }
  if (!target) throw new Error('headless Edge did not open its DevTools port')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((ok) => ws.addEventListener('open', ok))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.fail(new Error(JSON.stringify(m.error))) : p.ok(m.result) }
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text))
    if (m.method === 'Runtime.consoleAPICalled' && /error|warn/.test(m.params.type)) logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
  })
  await send('Runtime.enable'); await send('Page.enable'); await send('Performance.enable')
  for (const s of steps) {
    if (s.go) {
      await send('Emulation.setDeviceMetricsOverride', { width: s.w ?? 1536, height: s.h ?? 864, deviceScaleFactor: s.dpr ?? 1, mobile: false })
      await send('Emulation.setEmulatedMedia', { features: s.media ?? [] })
      await send('Page.navigate', { url: origin + s.go })
      for (let i = 0; i < 150; i++) {
        const r = await evaluate("document.documentElement.dataset.ready === 'true'").catch(() => null)
        if (r?.result?.value) break
        await new Promise((ok) => setTimeout(ok, 100))
      }
      await new Promise((ok) => setTimeout(ok, s.settle ?? 900))
    } else if (s.wait) {
      await new Promise((ok) => setTimeout(ok, s.wait))
    } else if (s.eval) {
      const r = await evaluate(s.eval)
      console.log('eval:', JSON.stringify(r.result?.value ?? r.exceptionDetails?.exception?.description ?? r.result))
    } else if (s.metrics) {
      const m = async () => Object.fromEntries((await send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
      const a = await m(); await new Promise((ok) => setTimeout(ok, s.metrics)); const b = await m()
      const share = (k) => `${((b[k] - a[k]) / (b.Timestamp - a.Timestamp) * 100).toFixed(1)}%`
      console.log(`metrics: ${s.label ?? ''} task ${share('TaskDuration')}, script ${share('ScriptDuration')}`)
    } else if (s.shot) {
      let clip
      if (s.sel) {
        const r = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(s.sel)}).getBoundingClientRect(); return [b.x, b.y + scrollY, b.width, b.height] })()`)
        const [x, y, w, h] = r.result.value, p = s.pad ?? 6
        clip = { x: Math.max(0, x - p), y: Math.max(0, y - p), width: w + 2 * p, height: h + 2 * p, scale: 1 }
      }
      const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) })
      mkdirSync(dirname(resolve(s.shot)), { recursive: true })
      writeFileSync(s.shot, Buffer.from(r.data, 'base64'))
      console.log('shot:', s.shot)
    }
  }
} finally {
  if (logs.length) console.log('page log:\n  ' + logs.join('\n  '))
  try { ws?.close() } catch { /* closed */ }
  await edge.stop()
  server.close()
}
