// The suite's looks on CRBN Rig's page (D-CRBN-019): data-product, data-look, data-motion and data-density on <html>,
// and the fonts and display metrics, from the vendored look/looks.json, with a person's own choices over the look's
// defaults as CRBN Livewire keeps them (crbn-photo-live src/theme/prefs.ts; crbn-launcher looks/egui src/prefs.rs):
//   { look, motion, speed, display, ui, mono, accent, density }   null (and the accent "look") is the look's own.
//
// "Use this look in every CRBN app" (D-CRBN-023) is shared as crbn-launcher D-CRBN-024 proposes for the web versions:
// the suite file's JSON, { version: 1, every, from, prefs }, in a `crbn-look` cookie on .carbonlinear.com, which every
// CRBN web version there can read. Turned on, a change goes to the cookie; turned off, Rig goes back to its own.
export const PRODUCT = 'rig'
const OWN = 'crbn-rig/prefs'
const OLD = 'crbn-rig/look' // the page's first key: the look's id alone
const COOKIE = 'crbn-look'

let data = null

/** Loads look/looks.json once. */
export async function loadLooks() {
  data ??= await (await fetch(new URL('./look/looks.json', import.meta.url))).json()
  return data
}
export const looks = () => data

// A licensed face is offered only where it was found, which is nowhere here, so Redline's Helvetica Extra Compressed
// falls back to Big Shoulders Display, as in Mixtape.
export function fontOf(role, id) {
  const list = data.fonts[role]
  const f = list.find((x) => x.id === id) ?? list[0]
  return f.id === 'helvetica-xc' ? (list.find((x) => x.id === 'big-shoulders') ?? list[0]) : f
}

/** A person's choices, checked against looks.json: anything unknown is the look's own. A look Rig lacks (Console's
 *  Old Skool, shared from Console) draws as Rig's default look with the shared fonts, accent and density. */
export function sanitize(p) {
  p = p && typeof p === 'object' ? p : {}
  const pick = (v, ok) => (typeof v === 'string' && ok(v) ? v : null)
  const font = (role) => pick(p[role], (v) => data.fonts[role].some((f) => f.id === v))
  return {
    look: pick(p.look, (v) => data.looks.some((l) => l.id === v)) ?? data.defaultLook,
    motion: pick(p.motion, (v) => data.motions.some((m) => m.id === v)),
    speed: data.speeds.some((s) => s.value === p.speed) ? p.speed : 1,
    display: font('display'), ui: font('ui'), mono: font('mono'),
    accent: pick(p.accent, (v) => data.accents.some((a) => a.id === v)) ?? 'look',
    density: p.density === 'compact' ? 'compact' : 'comfortable',
  }
}

// ------------------------------------------------------------------------------------------------- where they are kept
const onCarbonLinear = () => /(^|\.)carbonlinear\.com$/i.test(location.hostname)
/** True where the suite switch reaches the other CRBN web versions (a page on carbonlinear.com). */
export const sharesAcrossApps = onCarbonLinear

function readCookie() {
  try {
    const c = document.cookie.split('; ').find((x) => x.startsWith(COOKIE + '='))
    if (!c) return null
    const v = JSON.parse(decodeURIComponent(c.slice(COOKIE.length + 1)))
    return v && v.version === 1 && typeof v.every === 'boolean' && v.prefs && typeof v.prefs === 'object' ? v : null
  } catch { return null }
}
function writeCookie(every, prefs) {
  const value = encodeURIComponent(JSON.stringify({ version: 1, every, from: PRODUCT, prefs }))
  const domain = onCarbonLinear() ? '; Domain=.carbonlinear.com' : ''
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  try { document.cookie = `${COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}${domain}` } catch { /* cookies blocked */ }
}
function readOwn() {
  try {
    const own = JSON.parse(localStorage.getItem(OWN) ?? 'null')
    if (own) return own
    const old = localStorage.getItem(OLD)
    return old ? { look: old } : null
  } catch { return null }
}

/** { prefs, every }: the suite's look when its switch is on, else Rig's own. */
export function loadPrefs() {
  const shared = readCookie()
  return shared?.every ? { prefs: sanitize(shared.prefs), every: true } : { prefs: sanitize(readOwn()), every: false }
}
/** Rig's own choices (what the page goes back to when the suite switch is turned off). */
export const ownPrefs = () => sanitize(readOwn())

/** Keeps a change: in the suite's cookie while the switch is on, else as Rig's own. */
export function savePrefs(prefs, every) {
  if (every) { writeCookie(true, prefs); return }
  try { localStorage.setItem(OWN, JSON.stringify(prefs)) } catch { /* private mode: not remembered */ }
}
/** Turns the suite switch on (this look for every CRBN app) or off (each app its own). */
export function setEvery(on, prefs) { writeCookie(on, prefs) }

/** The shared look, if another app changed it since `since` (a JSON string), else null. */
export function sharedChange(since) {
  const shared = readCookie()
  if (!shared?.every) return null
  const p = sanitize(shared.prefs)
  return JSON.stringify(p) === since ? null : p
}

// ------------------------------------------------------------------------------------------------- applying them
/** Puts prefs on <html>. Returns the look and the accent the person chose over Rig's finish (null: the finish). */
export function applyPrefs(p) {
  const look = data.looks.find((l) => l.id === p.look) ?? data.looks.find((l) => l.id === data.defaultLook) ?? data.looks[0]
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const motion = data.motions.find((m) => m.id === (reduced ? 'off' : (p.motion ?? look.motion))) ?? data.motions[0]
  const display = fontOf('display', p.display ?? look.fonts.display), ui = fontOf('ui', p.ui ?? look.fonts.ui), mono = fontOf('mono', p.mono ?? look.fonts.mono)
  const root = document.documentElement
  root.dataset.product = PRODUCT
  root.dataset.look = look.id
  root.dataset.motion = motion.id
  root.dataset.density = p.density
  const off = motion.id === 'off', k = p.speed ?? 1
  const vars = {
    '--font-display': display.stack, '--font-ui': ui.stack, '--font-mono': mono.stack,
    '--d-scale': String(display.scale ?? 1), '--d-track': display.tracking ?? '.08em',
    '--d1': off ? '0ms' : `${Math.round(70 * k)}ms`, '--d2': off ? '0ms' : `${Math.round(150 * k)}ms`,
    '--ease-ind': motion.id === 'pop' && motion.ease ? motion.ease : 'cubic-bezier(.2,.9,.1,1)',
  }
  for (const [name, v] of Object.entries(vars)) root.style.setProperty(name, v)
  return { look, accent: data.accents.find((a) => a.id === p.accent)?.hex ?? null }
}

export const lookList = () => data.looks.map((l) => ({ id: l.id, label: l.label, blurb: l.blurb, swatch: l.swatch, fonts: l.fonts }))
