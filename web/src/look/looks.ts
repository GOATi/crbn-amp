// The CRBN suite's looks and the choices a user has over them (D-PHOTOLIVE-006, D-CRBN-019): four looks, Capsule by
// default; each brings its own motion and fonts, and the user can override motion, speed, the three fonts, the accent
// and the density. Data only, framework-free: an app's own prefs module resolves a user's choices against it, and
// `./themes.css` holds each look's colours and shapes. `./products.ts` is the product each app is. The shared source
// is crbn-launcher `looks/`; an app vendors it by pin (README.md there).

export type LookId = 'capsule' | 'holo' | 'redline' | 'daylight'
export type MotionId = 'pop' | 'arc' | 'slide' | 'snap' | 'wipe' | 'glitch' | 'off'
export type FontRole = 'display' | 'ui' | 'mono'
export type Density = 'compact' | 'comfortable'

export interface Look {
  id: LookId
  label: string
  blurb: string
  motion: MotionId
  fonts: Record<FontRole, string>
  /** Its own accent, until the user picks another. */
  accent: string
  /** For the look picker's swatch: ground, panel, signature colour. */
  swatch: [string, string, string]
}

export interface Motion {
  id: MotionId
  label: string
  /** An entrance's length at 1×. The rule from the Reskin Lab: nothing in the UI runs past 200 ms at 1×. */
  ms: number
  ease: string
  what: string
}

export interface Font {
  id: string
  label: string
  stack: string
  /** Display faces only: the size factor that matches their cap height, and their letter spacing. */
  scale?: number
  tracking?: string
}

export const LOOKS: readonly Look[] = [
  { id: 'capsule', label: 'Capsule', blurb: 'CarbonLinear’s shapes: floating rounded islands, one pink accent.', motion: 'pop', accent: '#f375b9',
    fonts: { display: 'lexend-giga', ui: 'poppins', mono: 'geist-mono' }, swatch: ['#0b0a0c', '#1c1a20', '#f375b9'] },
  { id: 'holo', label: 'Holo', blurb: 'The CarbonLinear hex cube: plum-black, cyan for live, HUD corner ticks.', motion: 'arc', accent: '#f375b9',
    fonts: { display: 'lexend-mega', ui: 'lexend', mono: 'jetbrains-mono' }, swatch: ['#07060a', '#1a1320', '#4fe3ff'] },
  { id: 'redline', label: 'Redline', blurb: 'Motorsport and forge: charcoal, square corners, a forge-orange redline.', motion: 'slide', accent: '#ff3200',
    fonts: { display: 'helvetica-xc', ui: 'barlow-sc', mono: 'plex-mono' }, swatch: ['#0b0a0a', '#22201f', '#ff3200'] },
  { id: 'daylight', label: 'Daylight', blurb: 'Capsule in light, for bright rooms and colour checks on white.', motion: 'pop', accent: '#f375b9',
    fonts: { display: 'lexend-giga', ui: 'poppins', mono: 'geist-mono' }, swatch: ['#e8e6ea', '#fbfafc', '#f375b9'] },
]
export const DEFAULT_LOOK: LookId = 'capsule'

export const MOTIONS: readonly Motion[] = [
  { id: 'pop', label: 'Pop', ms: 120, ease: 'cubic-bezier(.3,1.45,.5,1)', what: 'Scales up from 94% with a small overshoot; indicators overshoot too.' },
  { id: 'arc', label: 'Arc', ms: 150, ease: 'cubic-bezier(.2,.9,.1,1)', what: 'A wipe led by a glowing edge in the live colour.' },
  { id: 'slide', label: 'Slide', ms: 130, ease: 'cubic-bezier(.2,.9,.1,1)', what: 'Slides 14 px in from its edge on a hard ease-out.' },
  { id: 'snap', label: 'Snap', ms: 90, ease: 'ease-out', what: 'A 4 px rise and fade. The quietest style.' },
  { id: 'wipe', label: 'Wipe', ms: 120, ease: 'cubic-bezier(.4,0,.2,1)', what: 'A reveal from the side it enters from: the CarbonLinear site’s logo reveal.' },
  { id: 'glitch', label: 'Glitch', ms: 110, ease: 'linear', what: 'Two torn frames, then it settles. The loudest style.' },
  { id: 'off', label: 'Off', ms: 0, ease: 'linear', what: 'Every change is instant.' },
]

export const SPEEDS: readonly { value: number; label: string }[] = [
  { value: 0.6, label: 'Quick' },
  { value: 1, label: '1×' },
  { value: 1.5, label: 'Relaxed' },
]

export const FONTS: Record<FontRole, readonly Font[]> = {
  display: [
    { id: 'lexend-giga', label: 'Lexend Giga', stack: "'Lexend Giga', 'Lexend', sans-serif", scale: 0.9, tracking: '.24em' },
    { id: 'lexend-mega', label: 'Lexend Mega', stack: "'Lexend Mega', 'Lexend', sans-serif", scale: 0.92, tracking: '.16em' },
    // CarbonLinear's licensed site face, shown only where vite.config.ts found it (dev builds on the owner's box);
    // anywhere else Big Shoulders stands in, at its own size.
    { id: 'helvetica-xc', label: 'Helvetica Extra Compressed', stack: "'HelvXC', 'Big Shoulders Display', sans-serif", scale: 1.42, tracking: '.05em' },
    { id: 'big-shoulders', label: 'Big Shoulders Display', stack: "'Big Shoulders Display', sans-serif", scale: 1.25, tracking: '.06em' },
    { id: 'system', label: 'System', stack: "system-ui, 'Segoe UI', sans-serif", scale: 1, tracking: '.08em' },
  ],
  ui: [
    { id: 'poppins', label: 'Poppins', stack: "'Poppins', 'Segoe UI', system-ui, sans-serif" },
    { id: 'lexend', label: 'Lexend', stack: "'Lexend', 'Segoe UI', system-ui, sans-serif" },
    { id: 'barlow-sc', label: 'Barlow Semi Condensed', stack: "'Barlow Semi Condensed', 'Segoe UI', system-ui, sans-serif" },
    { id: 'atkinson', label: 'Atkinson Hyperlegible (easiest to read)', stack: "'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif" },
    { id: 'system', label: 'System', stack: "system-ui, 'Segoe UI', sans-serif" },
  ],
  mono: [
    { id: 'geist-mono', label: 'Geist Mono', stack: "'Geist Mono', ui-monospace, Consolas, monospace" },
    { id: 'jetbrains-mono', label: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, Consolas, monospace" },
    { id: 'plex-mono', label: 'IBM Plex Mono', stack: "'IBM Plex Mono', ui-monospace, Consolas, monospace" },
    { id: 'system', label: 'System', stack: 'ui-monospace, Consolas, monospace' },
  ],
}

/** The accent a look uses unless the user picks another. `null` is the look's own. */
export const ACCENTS: readonly { id: string; label: string; hex: string | null }[] = [
  { id: 'look', label: 'The look’s own', hex: null },
  { id: 'pink', label: 'CarbonLinear pink', hex: '#f375b9' },
  { id: 'cyan', label: 'Hex cyan', hex: '#4fe3ff' },
  { id: 'forge', label: 'Forge orange', hex: '#ff3200' },
  { id: 'ice', label: 'Ice blue', hex: '#bdd6ff' },
  { id: 'heliotrope', label: 'Hub heliotrope', hex: '#a25aff' },
  { id: 'gorse', label: 'Hub gorse', hex: '#fffb59' },
]

export const DENSITIES: readonly { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
]

