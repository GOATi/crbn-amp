// CRBN Rig's finishes (crbn-launcher D-RIG-008): the colour of the controls, the amp's faceplate, its lamps and the
// meter faces. A person picks one in the look menu: the look's own (cherry in Capsule, D-RIG-002's tweed gold in Holo
// and Daylight, forge orange in Redline), cherry, gold, rose gold, or a colour of their own from the wheel. The finish
// never reaches the mark, the name or the strip under the header, which stay cherry (D-RIG-008 (c)), and a clip or
// error mark always carries a word, so no finish can be mistaken for one.

// "Kit's own" (the default since R1, D-RIG-009 (e)): each hardware kit wears its own colours, and the page's controls
// take the look's own. Any other finish recolours the kit too.
export const FINISHES = [
  { id: 'own', label: 'Kit’s own' },
  { id: 'look', label: 'The look’s own' },
  { id: 'cherry', label: 'Cherry', hex: '#d92b52' },
  { id: 'gold', label: 'Gold', hex: '#be9851' },
  { id: 'rose', label: 'Rose gold', hex: '#f29077' },
  { id: 'custom', label: 'Custom' },
]
export const DEFAULT_CUSTOM = '#f29077'
const LOOK_OWN = { capsule: '#d92b52', holo: '#be9851', daylight: '#be9851', redline: '#ff3200' }
export const HEX_RE = /^#[0-9a-f]{6}$/i

/** The finish's colour in a look. */
export function finishHex(rig, look) {
  if (rig.finish === 'custom') return HEX_RE.test(rig.custom ?? '') ? rig.custom.toLowerCase() : DEFAULT_CUSTOM
  return FINISHES.find((f) => f.id === rig.finish)?.hex ?? LOOK_OWN[look] ?? LOOK_OWN.capsule
}

// ------------------------------------------------------------------------------------------------- colour
export const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
export const rgb2hex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
export function rgb2hsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360 }
  return [h, mx ? d / mx : 0, mx]
}
export function hsv2rgb(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) }
  return [f(5), f(3), f(1)]
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const unlin = (c) => { c = Math.max(0, Math.min(1, c)); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) }
export function toLab(hex) {
  const [r, g, b] = hex2rgb(hex).map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
export function fromLab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return rgb2hex(unlin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), unlin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), unlin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))
}
/** The distance between two colours, ΔE in OKLab ×100: the looks test holds a default control colour 10 from a state. */
export const deltaE = (x, y) => { const p = toLab(x), q = toLab(y); return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }
const lum = (h) => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const contrast = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }

/** The ink that reads best on a colour: white, or a near-black of its own hue. */
export function inkFor(hex) {
  const [, a, b] = toLab(hex)
  const dark = fromLab([0.22, a * 0.3, b * 0.3])
  return contrast(hex, dark) >= contrast(hex, '#ffffff') ? dark : '#ffffff'
}

/** The CSS custom properties a finish sets on <html>: the colour, its ink, and the brushed faceplate's three shades. */
export function finishVars(hex) {
  const [L, a, b] = toLab(hex), ink = inkFor(hex)
  return {
    '--fin': hex, '--fin-ink': ink,
    '--plate-a': fromLab([Math.min(0.97, L + 0.1), a * 0.75, b * 0.75]),
    '--plate-b': hex,
    '--plate-c': fromLab([Math.max(0.25, L - 0.17), a * 1.08, b * 1.08]),
    '--plate-ink': ink,
  }
}

// Every look's OK, warning and error colours, and the suite's other colours, for the custom colour's readouts.
const STATES = [['Capsule', '#5fd39a', '#f2c037', '#ff5470'], ['Daylight', '#18965a', '#a86a00', '#d1243f'], ['Holo', '#3ecf8e', '#f2c037', '#e0445a'], ['Redline', '#6fdc6a', '#ffb020', '#ff2a3d']]
  .flatMap(([look, ok, warn, bad]) => [[`${look}’s OK green`, ok], [`${look}’s warning amber`, warn], [`${look}’s error red`, bad]])
const OTHERS = [['Rig’s cherry', '#d92b52'], ['Livewire pink', '#f375b9'], ['Mixtape lime', '#c8ff3d'], ['Console amber', '#ffb340'], ['Console sky blue', '#45b4ff'], ['Press cobalt', '#5b8cff'], ['Hub heliotrope', '#a25aff']]

/** What a person sees about their own colour: how its text reads, and how near it sits to a warning or to another app. */
export function readouts(hex) {
  const near = (list) => list.map(([n, c]) => [n, deltaE(hex, c)]).sort((x, y) => x[1] - y[1])[0]
  const ink = inkFor(hex), cr = contrast(hex, ink), st = near(STATES), ot = near(OTHERS)
  return [
    { label: `Text on it (${ink === '#ffffff' ? 'white' : 'dark'})`, value: `${cr.toFixed(1)}:1`, close: cr < 4.5, word: cr < 4.5 ? 'faint' : 'clear' },
    { label: `Nearest warning or error: ${st[0]}`, value: st[1].toFixed(1), close: st[1] < 10, word: st[1] < 10 ? 'close' : 'clear' },
    { label: `Nearest app colour: ${ot[0]}`, value: ot[1].toFixed(1), close: ot[1] < 10, word: ot[1] < 10 ? 'close' : 'clear' },
  ]
}
