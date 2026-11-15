// The library the store's pictures show (docs/BUILD_PLAN.md R9): a folder called Tones, as a player keeps one, of made-up
// gear by made-up makers and capturers. No real brand, model or person: the store pictures are ours, and the test
// fixture's names (web/test/library-fixture.mjs, real kinds of gear for the index's checks) are not for a store.
// Every capture is NAM Core's example capture (dist/web/demo/example.nam) with its own metadata, so each one loads and
// plays; every IR a short decaying click. One module for both builds' pictures: store-stage.js writes it into the
// browser's private folder for the web version, and desktop-shot.mjs --stage writes it to disk for the desktop app's
// folder dialog. Plain ES, no Node imports.

// [file name, name, gear type, maker, model, tone, captured by]
const CAPTURES = [
  ['Amps/Hollow Oak/Hollow Oak 50 Edge of Breakup', 'Hollow Oak 50 Edge of Breakup', 'amp', 'Hollow Oak', 'Fifty', 'crunch', 'Mara Quill'],
  ['Amps/Hollow Oak/Hollow Oak 50 Clean Bright', 'Hollow Oak 50 Clean Bright', 'amp', 'Hollow Oak', 'Fifty', 'clean', 'Mara Quill'],
  ['Amps/Northgate/Northgate Lead Ch3 Tight', 'Northgate Lead Ch3 Tight', 'amp', 'Northgate', 'Lead 120', 'hi_gain', 'riffsmith'],
  ['Amps/Northgate/Northgate Lead Ch2 Crunch', 'Northgate Lead Ch2 Crunch', 'amp', 'Northgate', 'Lead 120', 'crunch', 'riffsmith'],
  ['Amps/Northgate/Northgate Lead Ch1 Clean', 'Northgate Lead Ch1 Clean', 'amp', 'Northgate', 'Lead 120', 'clean', 'riffsmith'],
  ['Amps/Kettle and Wire/Kettle 18 Chime', 'Kettle 18 Chime', 'amp', 'Kettle & Wire', 'K18', 'clean', 'Ollie Penn'],
  ['Amps/Kettle and Wire/Kettle 18 Cranked', 'Kettle 18 Cranked', 'amp', 'Kettle & Wire', 'K18', 'overdrive', 'Ollie Penn'],
  ['Amps/Low Sun/Low Sun Plexi Jumped', 'Low Sun Plexi Jumped', 'amp', 'Low Sun', 'Super 100', 'crunch', 'tonecellar'],
  ['Amps/Low Sun/Low Sun Plexi Lead Boosted', 'Low Sun Plexi Lead Boosted', 'amp', 'Low Sun', 'Super 100', 'overdrive', 'tonecellar'],
  ['Amps/Brass Fox/Brass Fox Modern Chug', 'Brass Fox Modern Chug', 'amp', 'Brass Fox', 'Vixen 6L6', 'hi_gain', 'Dee Okafor'],
  ['Amps/Brass Fox/Brass Fox Vintage Lead', 'Brass Fox Vintage Lead', 'amp', 'Brass Fox', 'Vixen 6L6', 'overdrive', 'Dee Okafor'],
  ['Amps/Saltmarsh/Saltmarsh Twin Spring Clean', 'Saltmarsh Twin Spring Clean', 'amp', 'Saltmarsh', 'Twin 85', 'clean', 'Juno Hart'],
  ['Amps/Saltmarsh/Saltmarsh Twin Pushed', 'Saltmarsh Twin Pushed', 'amp', 'Saltmarsh', 'Twin 85', 'crunch', 'Juno Hart'],
  ['Amps/Iron Lantern/Iron Lantern Rectified Red', 'Iron Lantern Rectified Red', 'amp', 'Iron Lantern', 'Furnace', 'hi_gain', 'riffsmith'],
  ['Amps/Iron Lantern/Iron Lantern Rectified Orange', 'Iron Lantern Rectified Orange', 'amp', 'Iron Lantern', 'Furnace', 'hi_gain', 'riffsmith'],
  ['Full rigs/Studio A Crunch Stack SM7', 'Studio A Crunch Stack', 'amp_cab', 'Low Sun', 'Super 100 and 4x12', 'crunch', 'tonecellar'],
  ['Full rigs/Desert Lead Rig Room Mic', 'Desert Lead Rig', 'amp_cab', 'Brass Fox', 'Vixen and 2x12', 'overdrive', 'Dee Okafor'],
  ['Full rigs/Glass Clean Rig', 'Glass Clean Rig', 'amp_cab', 'Saltmarsh', 'Twin 85 and 2x12', 'clean', 'Juno Hart'],
  ['Pedals/Green Hush Overdrive', 'Green Hush', 'pedal', 'Moss Audio', 'Green Hush', 'overdrive', 'Mara Quill'],
  ['Pedals/Green Hush Overdrive Tone 2 o clock', 'Green Hush Overdrive Bright', 'pedal', 'Moss Audio', 'Green Hush', 'overdrive', 'Mara Quill'],
  ['Pedals/Clear Lens Boost', 'Clear Lens', 'pedal', 'Moss Audio', 'Clear Lens', 'clean', 'Ollie Penn'],
  ['Pedals/Gold Thread Drive', 'Gold Thread Drive', 'pedal', 'Fennel Works', 'Gold Thread', 'overdrive', 'tonecellar'],
  ['Pedals/Tarpit Fuzz', 'Tarpit Fuzz', 'pedal', 'Fennel Works', 'Tarpit', 'fuzz', 'Kit Varga'],
  ['Pedals/Tarpit Fuzz Gated', 'Tarpit Fuzz Gated', 'pedal', 'Fennel Works', 'Tarpit', 'fuzz', 'Kit Varga'],
  ['Pedals/Germanium Moon Fuzz', 'Germanium Moon Fuzz', 'pedal', 'Larkspur', 'Moon', 'fuzz', 'Kit Varga'],
  ['Pedals/Steel Cut Distortion', 'Steel Cut Distortion', 'pedal', 'Larkspur', 'Steel Cut', 'hi_gain', 'riffsmith'],
  ['Pedals/Low End Lab Bass Preamp', 'Bass Preamp Grit', 'preamp', 'Low End Lab', 'Undertow', 'crunch', 'Low End Lab'],
  ['Pedals/Treble Lift', 'Treble Lift', 'pedal', 'Larkspur', 'Lift', 'clean', 'Ollie Penn'],
]
// [file name, rate, channels, seconds]
const IRS = [
  ['Cabinets/4x12 Thirty Ribbon Close.wav', 48000, 1, 0.17],
  ['Cabinets/4x12 Thirty Dynamic Edge.wav', 48000, 1, 0.17],
  ['Cabinets/2x12 Alnico Blend.wav', 48000, 2, 0.2],
  ['Cabinets/1x12 Open Back Room.wav', 44100, 1, 0.25],
  ['Cabinets/4x10 Bass Cab DI Blend.wav', 48000, 1, 0.15],
]

/** A 16-bit PCM WAV of a decaying click. */
function wav(rate, channels, seconds) {
  const frames = Math.round(rate * seconds), bytes = new Uint8Array(44 + frames * channels * 2), dv = new DataView(bytes.buffer)
  const put = (at, s) => { for (let i = 0; i < 4; i++) bytes[at + i] = s.charCodeAt(i) }
  put(0, 'RIFF'); dv.setUint32(4, 36 + frames * channels * 2, true); put(8, 'WAVE'); put(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, channels, true); dv.setUint32(24, rate, true)
  dv.setUint32(28, rate * channels * 2, true); dv.setUint16(32, channels * 2, true); dv.setUint16(34, 16, true)
  put(36, 'data'); dv.setUint32(40, frames * channels * 2, true)
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) dv.setInt16(44 + (i * channels + c) * 2, Math.round(Math.exp(-i / (rate * 0.01)) * 20000 * (i % 2 ? -1 : 1)), true)
  return bytes
}

/** The folder's files, [{ path, bytes }], from `template` (example.nam's text). Deterministic. */
export function storeLibrary(template) {
  const model = JSON.parse(template), enc = new TextEncoder()
  const files = CAPTURES.map(([file, name, gear, make, gearModel, tone, by], i) => {
    const metadata = { date: { year: 2026, month: 1 + (i % 10), day: 1 + ((i * 7) % 28), hour: 12, minute: 0, second: 0 }, loudness: -18 - (i % 8), gain: 0.2 + (i % 7) / 10, name, modeled_by: by, gear_type: gear, gear_make: make, gear_model: gearModel, tone_type: tone, input_level_dbu: 12, output_level_dbu: 10 }
    const text = JSON.stringify({ version: model.version, metadata, architecture: model.architecture, config: model.config, weights: model.weights, sample_rate: model.sample_rate })
    return { path: `${file}.nam`, bytes: enc.encode(text) }
  })
  for (const [path, rate, ch, sec] of IRS) files.push({ path, bytes: wav(rate, ch, sec) })
  return files
}

/** What the pictures do with it (store-stage.js): the amp, the cabinet, the favourites in the order starred, the
 *  board's pedals (with the second's Tone in), and the rig. Paths as the library lists them. */
export const STORE_RIG = {
  amp: 'Amps/Low Sun/Low Sun Plexi Jumped.nam',
  ir: 'Cabinets/4x12 Thirty Ribbon Close.wav',
  favourites: [
    'Amps/Low Sun/Low Sun Plexi Jumped.nam', 'Amps/Hollow Oak/Hollow Oak 50 Edge of Breakup.nam', 'Amps/Northgate/Northgate Lead Ch3 Tight.nam',
    'Amps/Kettle and Wire/Kettle 18 Chime.nam', 'Full rigs/Desert Lead Rig Room Mic.nam', 'Amps/Brass Fox/Brass Fox Modern Chug.nam',
    'Amps/Saltmarsh/Saltmarsh Twin Spring Clean.nam', 'Amps/Iron Lantern/Iron Lantern Rectified Red.nam',
  ],
  pedals: ['Pedals/Clear Lens Boost.nam', 'Pedals/Green Hush Overdrive.nam', 'Pedals/Tarpit Fuzz.nam'],
  toneOn: 1, // the second pedal's Tone in
  off: 2, // the third pedal stomped off
  rig: 'Friday set',
  variant: 1, // Push (W)
}
