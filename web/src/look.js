// The suite's looks on CRBN Rig's page (D-CRBN-019): data-product, data-look and data-motion on <html>, and the fonts
// and display metrics each look names, from the vendored look/looks.json. A plain-JavaScript port of what crbn-audio's
// web/src/theme/prefs.ts does, without the user-picked fonts and accents (this page offers the four looks only).
export const PRODUCT = 'rig'
const KEY = 'crbn-rig/look'

let data = null

/** Loads look/looks.json once. */
export async function loadLooks() {
  data ??= await (await fetch(new URL('./look/looks.json', import.meta.url))).json()
  return data
}

// A licensed face is offered only where it was found, which is nowhere here, so Redline's Helvetica Extra Compressed
// falls back to Big Shoulders Display, as in Mixtape.
function fontOf(role, id) {
  const list = data.fonts[role]
  const f = list.find((x) => x.id === id) ?? list[0]
  return f.id === 'helvetica-xc' ? (list.find((x) => x.id === 'big-shoulders') ?? list[0]) : f
}

export function savedLook() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

/** Applies a look by id (or the saved one, or the default) and remembers it. Returns the look. */
export function applyLook(id) {
  const look = data.looks.find((l) => l.id === id) ?? data.looks.find((l) => l.id === data.defaultLook) ?? data.looks[0]
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const motion = data.motions.find((m) => m.id === (reduced ? 'off' : look.motion)) ?? data.motions[0]
  const display = fontOf('display', look.fonts.display), ui = fontOf('ui', look.fonts.ui), mono = fontOf('mono', look.fonts.mono)
  const root = document.documentElement
  root.dataset.product = PRODUCT
  root.dataset.look = look.id
  root.dataset.motion = motion.id
  const off = motion.id === 'off'
  const vars = {
    '--font-display': display.stack, '--font-ui': ui.stack, '--font-mono': mono.stack,
    '--d-scale': String(display.scale ?? 1), '--d-track': display.tracking ?? '.08em',
    '--d1': off ? '0ms' : '70ms', '--d2': off ? '0ms' : '150ms',
    '--ease-ind': motion.id === 'pop' && motion.ease ? motion.ease : 'cubic-bezier(.2,.9,.1,1)',
  }
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  try { localStorage.setItem(KEY, look.id) } catch { /* private mode: the look is not remembered */ }
  return look
}

export const lookList = () => data.looks.map((l) => ({ id: l.id, label: l.label, blurb: l.blurb }))
