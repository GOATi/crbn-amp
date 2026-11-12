// A generated library folder for the library's checks (build plan R4): web/test/selftest.html writes it into the
// browser's private folder and opens it as a person's folder; packaging/windows/check.mjs writes it to disk for the
// desktop app. Every file is made from NAM Core's example capture (wavenet.nam) with its own metadata, so each is a
// real capture the engine loads, in the shapes the library must read:
//   - most with their metadata near the top, as NAM's trainer writes them (and TONE3000 serves them);
//   - one in twenty larger than the head, with the metadata after the weights (the tail rule, as a container's own);
//   - one in fifty with no metadata at all (the name comes from the file);
//   - one in twenty a cabinet IR (.wav), mono or stereo, 44.1 or 48 kHz;
//   - in folders two deep, with the odd hidden file and folder that must not be listed.
// Deterministic: the same count always makes the same files. Synthetic names of real kinds of gear, for tests only.

const MAKES = [
  ['Marshall', 'JCM800 2203', 'amp'], ['Fender', 'Twin Reverb', 'amp'], ['Mesa/Boogie', 'Dual Rectifier', 'amp'], ['Vox', 'AC30', 'amp'],
  ['Friedman', 'BE-100', 'amp'], ['Peavey', '5150', 'amp'], ['Bogner', 'Überschall', 'amp'], ['Orange', 'Rockerverb 50', 'amp_cab'],
  ['Ibanez', 'TS808', 'pedal'], ['Klon', 'Centaur', 'pedal'], ['Electro-Harmonix', 'Big Muff Pi', 'pedal'], ['Boss', 'DS-1', 'pedal'],
  ['Darkglass', 'Microtubes B7K', 'preamp'], ['ENGL', 'Fireball 100', 'amp_pedal_cab'], ['Diezel', 'VH4', 'pedal_amp'], ['Dumble', 'ODS', 'amp'],
]
const TONES = ['clean', 'overdrive', 'crunch', 'hi_gain', 'fuzz']
const BY = ['Steve', 'Riffmaster', 'tonehunter', 'Mike B', 'Ana Ruiz', 'GOATi', 'Kenji', 'Low End Lab']
const WORDS = ['Edge', 'Lead', 'Rhythm', 'Push', 'Sparkle', 'Chug', 'Bloom', 'Sag', 'Bright', 'Dark', 'Tight', 'Loose']

function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) }

/** A 16-bit PCM WAV of a decaying click, `seconds` long. */
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

/**
 * The folder's files: [{ path, bytes, expect }] where `expect` is what the library should read from it ({ n, gear,
 * make, model, tone, by, rate } for a capture, { rate, ch, sec } for an IR, or { hidden: true } for a file it must not
 * list). `template` is wavenet.nam's text.
 */
export function libraryFixture(count, template) {
  const r = rng(20261112), pick = (a) => a[Math.floor(r() * a.length)]
  const model = JSON.parse(template)
  const enc = new TextEncoder()
  const out = []
  for (let i = 0; i < count; i++) {
    const [make, gearModel, gear] = MAKES[i % MAKES.length]
    const tone = TONES[Math.floor(i / MAKES.length) % TONES.length]
    const folder = `${gear.startsWith('pedal') ? 'Pedals' : 'Amps'}/${make.replace(/\W+/g, ' ').trim()}`
    if (i % 20 === 7) {
      const rate = i % 40 === 7 ? 44100 : 48000, ch = i % 60 === 7 ? 2 : 1, sec = 0.05 + (i % 9) * 0.02
      out.push({ path: `Cabinets/${pick(['V30', 'Greenback', 'Alnico Blue', 'C12N', 'G12T-75'])} ${['SM57', 'R121', 'MD421'][i % 3]} ${i}.wav`, bytes: wav(rate, ch, sec), expect: { k: 'ir', rate, ch, sec } })
      continue
    }
    const name = `${gearModel} ${pick(WORDS)} ${i}`
    const by = BY[i % BY.length]
    const meta = { date: { year: 2026, month: 1 + (i % 12), day: 1 + (i % 28), hour: 12, minute: 0, second: 0 }, loudness: -20 - (i % 10), gain: 0.2 + (i % 7) / 10, name, modeled_by: by, gear_type: gear, gear_make: make, gear_model: gearModel, tone_type: tone, input_level_dbu: 12, output_level_dbu: 10 }
    let text, expect
    if (i % 50 === 13) {
      // no metadata: the file's own name
      const { metadata, ...rest } = model
      text = JSON.stringify(rest)
      expect = { k: 'nam', n: `${make} ${gearModel} unnamed ${i}`, gear: '', make: '', model: '', tone: '', by: '', rate: 48000 }
      out.push({ path: `${folder}/${make} ${gearModel} unnamed ${i}.nam`, bytes: enc.encode(text), expect })
      continue
    } else if (i % 20 === 11) {
      // larger than the head, the metadata at the end (after the weights, as a container writes its own)
      const { metadata, sample_rate, ...rest } = model
      text = JSON.stringify({ ...rest, notes: 'x'.repeat(18000), metadata: meta, sample_rate }, null, 1)
    } else {
      text = JSON.stringify({ version: model.version, metadata: meta, architecture: model.architecture, config: model.config, weights: model.weights, sample_rate: model.sample_rate }, null, i % 3 ? undefined : 2)
    }
    expect = { k: 'nam', n: name, gear, make, model: gearModel, tone, by, rate: 48000 }
    out.push({ path: `${folder}/${name.replace(/[/\\:]/g, '-')}.nam`, bytes: enc.encode(text), expect })
  }
  // never listed: a hidden file, a file in a hidden folder, and a file of another kind
  out.push({ path: '.DS_Store.nam', bytes: enc.encode(template), expect: { hidden: true } })
  out.push({ path: '.cache/old.nam', bytes: enc.encode(template), expect: { hidden: true } })
  out.push({ path: 'Amps/readme.txt', bytes: enc.encode('not a capture'), expect: { hidden: true } })
  return out
}

/**
 * Writes the files into the origin's private folder under `name` (replacing it) and returns its handle, as a folder
 * handle the page can be given in place of showDirectoryPicker's. In a worker, with sync access handles: the async
 * writer takes about 20 ms a file in headless Edge, too slow for 5,000.
 */
export async function writePrivateFolder(name, files) {
  const code = `onmessage = async (e) => {
    const { name, files } = e.data
    const root = await navigator.storage.getDirectory()
    try { await root.removeEntry(name, { recursive: true }) } catch {}
    const top = await root.getDirectoryHandle(name, { create: true }), dirs = new Map([['', top]])
    for (const f of files) {
      const parts = f.path.split('/')
      let key = '', d = top
      for (const p of parts.slice(0, -1)) { key += p + '/'; let h = dirs.get(key); if (!h) { h = await d.getDirectoryHandle(p, { create: true }); dirs.set(key, h) } d = h }
      const a = await (await d.getFileHandle(parts.at(-1), { create: true })).createSyncAccessHandle()
      a.truncate(0); a.write(f.bytes, { at: 0 }); a.flush(); a.close()
    }
    postMessage('done')
  }`
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  const worker = new Worker(url)
  try {
    await new Promise((ok, fail) => {
      worker.onmessage = ok; worker.onerror = (e) => fail(new Error(e.message))
      worker.postMessage({ name, files: files.map((f) => ({ path: f.path, bytes: f.bytes })) })
    })
  } finally { worker.terminate(); URL.revokeObjectURL(url) }
  return (await navigator.storage.getDirectory()).getDirectoryHandle(name)
}
