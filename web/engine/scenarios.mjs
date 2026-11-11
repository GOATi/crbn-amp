// The squeal guard's and auto-off's cases (build plan R3): the signals web/engine/test.mjs plays through both builds of
// the engine. Every signal is made here, from a seed, so both builds hear exactly the same samples.
//
//   - feedback: a real loop. The engine's output comes back into its input through a delay and a resonance (a speaker
//     heard by a pickup or a laptop's microphone), at a loop gain above 1 at one frequency, over a guitar's hiss and a
//     pluck, or over the demo riff. The tone grows until the capture saturates, as a squeal does.
//   - pulled jacks: the riff, a spike near full scale, then mains hum at 50 or 60 Hz, or dead silence.
//   - what must never trip either: the riff, long notes (clean and at high gain, steady and beating), chords hit hard
//     and muted, a low B after a hit, and sine sweeps.
//
// A high-gain capture is made here too (fuzzCapture): an LSTM of one cell whose gate is held open, so it is
// tanh(tanh(drive * x)), a fuzz that saturates on any note. NAM Core's own examples are mostly clean.

export const RATE = 48000

/** A NAM capture that is a fuzz: tanh(tanh(drive * x)), with its loudness for the normalized output. */
export function fuzzCapture(drive = 30) {
  // LSTM weights: W (rows i, f, g, o; columns x, h), the bias, the first h and c, the head's weight and bias.
  const weights = [0, 0, 0, 0, drive, 0, 0, 0, 20, -20, 0, 20, 0, 0, 1, 0]
  return JSON.stringify({
    version: '0.5.4', architecture: 'LSTM', config: { input_size: 1, hidden_size: 1, num_layers: 1 }, weights,
    sample_rate: RATE, metadata: { name: 'Test fuzz', gear_type: 'pedal', tone_type: 'hi_gain', loudness: -4 },
  })
}

function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const db = (d) => Math.pow(10, d / 20)

/** Gaussian-ish noise at `level` dBFS RMS. */
export function noise(n, level, seed) {
  // three uniforms summed: a standard deviation of 1/2
  const r = prng(seed), out = new Float32Array(n), a = 2 * db(level)
  for (let i = 0; i < n; i++) out[i] = a * (r() + r() + r() - 1.5)
  return out
}

/** The demo riff (NAM Core's DI clip), looped to `seconds`, at `rate` (linearly resampled). */
export function riff(di, seconds, rate = RATE) {
  const n = Math.round(seconds * rate), out = new Float32Array(n), step = di.rate / rate
  for (let i = 0; i < n; i++) {
    const p = (i * step) % di.samples.length, k = Math.floor(p), f = p - k
    out[i] = di.samples[k] * (1 - f) + di.samples[(k + 1) % di.samples.length] * f
  }
  return out
}

/**
 * A plucked string: harmonics at 1/n^1.5, each decaying (the fundamental to -60 dB in `t60` seconds, higher ones faster),
 * with an optional second string `beat` Hz above at `depth` of its level (two strings, or a string's two planes, beat).
 */
export function pluck(hz, seconds, { rate = RATE, peak = 0.5, t60 = 8, beat = 0, depth = 0, harmonics = 8 } = {}) {
  const n = Math.round(seconds * rate), out = new Float32Array(n)
  let max = 0
  for (let h = 1; h <= harmonics; h++) {
    const f = hz * h
    if (f >= rate * 0.45) break
    const amp = 1 / Math.pow(h, 1.5), tau = (t60 / (1 + 0.35 * (h - 1))) / 6.908
    for (let i = 0; i < n; i++) {
      const t = i / rate, env = Math.exp(-t / tau) * Math.min(1, t / 0.002)
      out[i] += amp * env * (Math.sin(2 * Math.PI * f * t + h) + (beat ? depth * Math.sin(2 * Math.PI * (f + beat * h) * t + 2 * h) : 0))
    }
  }
  for (const v of out) max = Math.max(max, Math.abs(v))
  for (let i = 0; i < n; i++) out[i] *= peak / max
  return out
}

/** A logarithmic sine sweep. */
export function sweep(f0, f1, seconds, level, rate = RATE) {
  const n = Math.round(seconds * rate), out = new Float32Array(n), k = Math.log(f1 / f0), a = db(level)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    out[i] = a * Math.sin(2 * Math.PI * f0 * seconds / k * (Math.exp(t / seconds * k) - 1))
  }
  return out
}

const join = (...parts) => {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}
const add = (a, b, at = 0) => { for (let i = 0; i < b.length && at + i < a.length; i++) a[at + i] += b[i]; return a }

/** Contacts scraping as a jack comes out: a few milliseconds near full scale, then the plug is gone. */
function crackle(rate, seed) {
  const r = prng(seed), n = Math.round(0.006 * rate), out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = (r() < 0.5 ? -1 : 1) * (0.9 + 0.1 * r()) * (i % 7 < 4 ? 1 : 0.3)
  return out
}

/** Mains hum on a floating input: the mains frequency and its harmonics, odd ones strong, at about -20 dBFS. */
function hum(mains, seconds, rate, seed) {
  const n = Math.round(seconds * rate), out = noise(n, -85, seed)
  const amps = [0.1, 0.02, 0.05, 0.008, 0.03, 0.005, 0.015, 0.003, 0.008]
  const drift = mains * 1.001 // the grid runs a little fast
  for (let i = 0; i < n; i++) {
    const t = i / rate
    for (let k = 0; k < amps.length; k++) out[i] += amps[k] * Math.sin(2 * Math.PI * drift * (k + 1) * t + k)
  }
  return out
}

/** The cases where the input is fixed (no loop). `di` is NAM Core's DI clip, { samples, rate }. */
export function openCases(di) {
  const R = RATE
  const cases = []
  const jack = (name, after, rate = R) => join(riff(di, 1.5, rate), crackle(rate, 7), after)
  // auto-off must trip
  cases.push({ name: 'pulled jack, then 50 Hz hum', input: jack('h50', hum(50, 2, R, 11)), expect: { why: 3, hz: 50 } })
  cases.push({ name: 'pulled jack, then 60 Hz hum', input: jack('h60', hum(60, 2, R, 12)), expect: { why: 3, hz: 60 } })
  cases.push({ name: 'pulled jack, then dead silence', input: jack('dead', noise(2 * R, -105, 13)), expect: { why: 2 } })
  cases.push({ name: 'pulled jack at 44.1 kHz, then 60 Hz hum', rate: 44100, input: join(riff(di, 1.5, 44100), crackle(44100, 7), hum(60, 2, 44100, 14)), expect: { why: 3, hz: 60 } })

  // nothing may trip
  const quiet = { why: 0 }
  cases.push({ name: 'the demo riff, 12 s', input: riff(di, 12), expect: quiet })
  cases.push({ name: 'the demo riff at +20 dB input', input: riff(di, 12), params: { inputDB: 20 }, expect: quiet })
  cases.push({ name: 'the demo riff through a fuzz', capture: 'fuzz', input: riff(di, 12), expect: quiet })
  const notes = [110, 196, 247, 330, 440, 587, 659, 880, 1047, 1319]
  const long = (opts) => join(...notes.map((hz, i) => add(pluck(hz, 3.5, opts), noise(Math.round(3.5 * R), -75, 100 + i))))
  cases.push({ name: 'long notes, clean', input: long({}), expect: quiet })
  cases.push({ name: 'long notes, clean, beating', input: long({ beat: 0.35, depth: 0.45 }), expect: quiet })
  cases.push({ name: 'long notes at +20 dB input', input: long({}), params: { inputDB: 20 }, expect: quiet })
  cases.push({ name: 'long notes through a fuzz', capture: 'fuzz', input: long({ t60: 12 }), expect: quiet })
  cases.push({ name: 'long notes through a fuzz, beating', capture: 'fuzz', input: long({ t60: 12, beat: 0.3, depth: 0.5 }), expect: quiet })
  cases.push({ name: 'long notes through a fuzz, slow decay', capture: 'fuzz', input: long({ t60: 20, beat: 0.2, depth: 0.3 }), expect: quiet })
  // chords hit hard enough to clip the interface, then muted dead, again and again: a spike, but no silence that fast
  const chord = [82.4, 110, 146.8, 196, 246.9, 329.6]
  const hit = () => {
    const n = Math.round(0.9 * R), s = new Float32Array(n)
    for (const hz of chord) add(s, pluck(hz, 0.9, { peak: 1, t60: 3 }))
    let max = 0
    for (const v of s) max = Math.max(max, Math.abs(v))
    for (let i = 0; i < n; i++) {
      const t = i / R, mute = t < 0.12 ? 1 : Math.pow(10, (-600 * (t - 0.12)) / 20) // a palm mute: 600 dB/s
      s[i] *= (0.97 / max) * mute
    }
    return add(s, noise(n, -95, 300))
  }
  cases.push({ name: 'chords hit to clip, then muted', input: join(...Array.from({ length: 10 }, hit)), expect: quiet })
  // a 7-string's low B struck hard: its first peak is the spike, and 61.7 Hz is near the mains
  cases.push({ name: 'a low B struck hard, then held', input: join(riff(di, 1), pluck(61.74, 4, { peak: 0.97, t60: 10 })), expect: quiet })
  cases.push({ name: 'a sine sweep, 20 Hz to 20 kHz in 10 s', input: sweep(20, 20000, 10, -12), expect: quiet })
  cases.push({ name: 'a slow sine sweep, 30 s', input: sweep(20, 20000, 30, -12), expect: quiet })
  cases.push({ name: 'a sine sweep through a fuzz', capture: 'fuzz', input: sweep(20, 20000, 10, -12), expect: quiet })
  return cases
}

/**
 * The feedback cases: a loop through the engine. `hz` is the resonance, `loop` the loop gain there (the engine's own
 * gain at `hz` is measured first and divided out), `delayMs` the trip from the speaker back to the input.
 */
export function loopCases() {
  return [
    { name: 'feedback at 2.4 kHz', hz: 2400, loop: 1.25, seconds: 4 },
    { name: 'feedback at 2.4 kHz, slowly growing', hz: 2400, loop: 1.1, seconds: 6 },
    { name: 'feedback at 800 Hz', hz: 800, loop: 1.25, seconds: 4 },
    { name: 'feedback at 5 kHz over the riff', hz: 5000, loop: 1.5, seconds: 4, riff: true },
    { name: 'feedback at 1.2 kHz through a fuzz', hz: 1200, loop: 1.25, seconds: 4, capture: 'fuzz' },
    { name: 'feedback at 3.2 kHz through a fuzz over the riff', hz: 3200, loop: 2, seconds: 4, capture: 'fuzz', riff: true },
    { name: 'feedback at 2.4 kHz at 44.1 kHz', hz: 2400, loop: 1.25, seconds: 4, rate: 44100 },
  ]
}

/** A resonance at `hz` (the RBJ band-pass, 0 dB at its peak), as the five coefficients both loops use. */
export function resonance(hz, q, rate) {
  const w = (2 * Math.PI * hz) / rate, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha
  return [alpha / a0, 0, -alpha / a0, (-2 * Math.cos(w)) / a0, (1 - alpha) / a0]
}

/** The loop's excitation: a guitar's hiss, a pluck at 0.2 s, or the riff. */
export function loopExcitation(c, di) {
  const rate = c.rate ?? RATE, n = Math.round(c.seconds * rate)
  const x = noise(n, -60, 500)
  if (c.riff) add(x, riff(di, c.seconds, rate))
  else add(x, pluck(196, 2, { rate, peak: 0.2, t60: 2 }), Math.round(0.2 * rate))
  return x
}

/**
 * Runs the loop one block at a time: in[n] = excitation[n] + g * resonance(out[n - delay]). `process(input, output)`
 * runs one block of the engine. The same arithmetic, in the same order, as web/engine/native_render.cpp's --feedback.
 */
export function runLoop(process, excitation, coef, gain, delay, block = 128) {
  const [b0, b1, b2, a1, a2] = coef
  const n = excitation.length, out = new Float32Array(n), inBlock = new Float32Array(block)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let at = 0; at < n; at += block) {
    const k = Math.min(block, n - at)
    for (let i = 0; i < k; i++) {
      const j = at + i - delay
      const x = j >= 0 ? out[j] : 0
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1; x1 = x; y2 = y1; y1 = y
      inBlock[i] = excitation[at + i] + gain * y
    }
    process(inBlock.subarray(0, k), out.subarray(at, at + k))
  }
  return out
}

/** The level (dBFS of a sine) at `hz` in each 10 ms of `x`, and the first time it reaches `level`. */
export function firstLoud(x, hz, rate, level = -24) {
  const w = Math.round(0.01 * rate)
  for (let at = 0; at + w <= x.length; at += w) {
    let re = 0, im = 0
    for (let i = 0; i < w; i++) { const p = (2 * Math.PI * hz * (at + i)) / rate; re += x[at + i] * Math.cos(p); im -= x[at + i] * Math.sin(p) }
    const amp = (2 * Math.sqrt(re * re + im * im)) / w
    if (20 * Math.log10(Math.max(amp, 1e-12)) >= level) return at / rate
  }
  return null
}
