// Sets Rig's page up as the store's pictures show it (docs/BUILD_PLAN.md R9), through the page's own controls, as a
// player would: the library open on store-library.mjs's folder, an amp and a cabinet from it, favourites on the pads, three
// pedals on the board (the second's Tone in, the third stomped off), a rig saved on its Push variant, and the demo riff
// playing. A plain script, evaluated in the page: web/probe.mjs runs it for the web version (the folder written into the
// browser's private folder and given in place of the folder picker), desktop-shot.mjs --stage for the desktop app (the
// folder already picked in the app's own dialog). Then, for the MIDI picture, rigStageMidi(): the dock open with a stand-in
// controller named as the owner's MC8 is, and mappings learned through the dock's own list.
globalThis.rigStage = async (rig, { files } = {}) => {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)]
  const steps = []
  const wait = async (fn, ms, what) => {
    for (const end = performance.now() + ms; performance.now() < end; await new Promise((r) => setTimeout(r, 50))) if (fn()) return
    throw new Error(`timed out waiting for ${what} (after ${steps.join(', ')}; toast “${$('#toast')?.hidden ? '' : $('#toast')?.textContent}”)`)
  }
  const src = () => $('#lib-src').textContent
  const sel = (attr, path) => `[${attr}="${CSS.escape(path)}"]`

  if (files) {
    // the web version: the folder in the browser's private folder, given as a person's pick would give it (a worker's
    // sync access handles, as web/test/library-fixture.mjs writes them)
    const code = `onmessage = async (e) => {
      const { name, files } = e.data, root = await navigator.storage.getDirectory()
      try { await root.removeEntry(name, { recursive: true }) } catch {}
      const top = await root.getDirectoryHandle(name, { create: true })
      for (const f of files) {
        const parts = f.path.split('/'); let d = top
        for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true })
        const a = await (await d.getFileHandle(parts.at(-1), { create: true })).createSyncAccessHandle()
        a.truncate(0); a.write(f.bytes, { at: 0 }); a.flush(); a.close()
      }
      postMessage('done')
    }`
    const worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })))
    await new Promise((ok, fail) => { worker.onmessage = ok; worker.onerror = (e) => fail(new Error(e.message)); worker.postMessage({ name: 'Tones', files }) })
    worker.terminate()
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Tones')
    window.showDirectoryPicker = async () => dir
    $('#lib-choose').click()
  }
  await wait(() => /captures/.test(src()) && !/reading|looking/.test(src()), 30000, 'the library')
  // sorted by gear: the amps first, then the cabinets, pedals and rigs
  $('#lib-sort').value = 'gear'
  $('#lib-sort').dispatchEvent(new Event('change', { bubbles: true }))
  steps.push('library')

  // the audio first (the pads load once it has started), with the riff
  $('#play-demo').click()
  await wait(() => $('#play-demo').getAttribute('aria-pressed') === 'true', 15000, 'the riff')
  steps.push('riff')

  $(sel('data-go', rig.amp)).click()
  await wait(() => $('#lib-body .lib-row.playing') && $('#capture-name').textContent !== 'None yet', 10000, 'the amp')
  $(sel('data-go', rig.ir)).click()
  await wait(() => /impulse response/.test($('#ir-meta').textContent), 10000, 'the cabinet')
  steps.push('amp and cabinet')

  for (const p of rig.favourites) {
    const star = $(sel('data-star', p))
    if (star.getAttribute('aria-pressed') !== 'true') star.click()
  }
  steps.push('favourites')

  const spot = (i) => $(`#board-row .pspot[data-pedal="${i}"]`)
  for (const [i, p] of rig.pedals.entries()) {
    await wait(() => spot(i), 5000, `place ${i + 1} on the board`)
    const dt = new DataTransfer()
    dt.setData('application/x-crbn-rig-library', p)
    spot(i).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    await wait(() => spot(i)?.dataset.state === 'on', 15000, `pedal ${i + 1}`)
  }
  steps.push('pedals')

  $('#rig-name').value = rig.rig
  $('#rig-name').dispatchEvent(new Event('input', { bubbles: true }))
  $(`#variants [data-variant="${rig.variant}"]`).click()
  await wait(() => $(`#variants [data-variant="${rig.variant}"]`).getAttribute('aria-checked') === 'true', 3000, 'the variant')
  const pedal = (i) => $(`#board-row [data-pedal="${i}"]:not(.pspot)`) ?? spot(i)
  pedal(rig.toneOn)?.querySelector('[data-role="tone"]')?.click()
  pedal(rig.off)?.querySelector('[data-role="foot"]')?.click()
  await wait(() => spot(rig.off)?.dataset.state === 'off', 5000, `pedal ${rig.off + 1} off`)
  $('#rig-save').click()
  // the save is async (the rig's files kept first): its toast comes, then goes after 7 s
  await wait(() => !$('#toast').hidden && /^Saved /.test($('#toast').textContent), 5000, 'the rig saved')
  steps.push('rig')

  // the pads warm, and the riff a while for the energy
  await wait(() => $$('.pads-grid [data-pad]').filter((p) => !p.classList.contains('empty')).every((p) => !/load/i.test(p.dataset.state ?? '')), 20000, 'the pads')
  await wait(() => $('#toast').hidden, 10000, 'the toast to go') // "Saved Friday set."
  document.activeElement?.blur()
  return { library: src(), capture: $('#capture-name').textContent, ir: $('#ir-name').textContent, pads: $$('.pads-grid [data-pad]:not(.empty)').length, pedals: rig.pedals.map((_, i) => spot(i)?.dataset.state), rig: $('#rig-name').value }
}

// The MIDI picture: a stand-in for the browser's Web MIDI, its ports named as Windows names the owner's MC8's
// (SYNC:RIG-032), the dock open, and mappings learned through the dock's "Or choose" list, each by a message sent from
// the stand-in. Run after rigStage.
globalThis.rigStageMidi = async (maps) => {
  const $ = (s) => document.querySelector(s)
  const wait = async (fn, ms, what) => {
    for (const end = performance.now() + ms; performance.now() < end; await new Promise((r) => setTimeout(r, 50))) if (fn()) return
    throw new Error(`timed out waiting for ${what} (dock “${$('#midi-drop')?.textContent}”)`)
  }
  const port = (id, name) => ({ id, name, state: 'connected', onmidimessage: null, close() { return Promise.resolve(this) } })
  const ports = ['Morningstar MC8', 'MIDIIN2 (Morningstar MC8)', 'MIDIIN3 (Morningstar MC8)', 'MIDIIN4 (Morningstar MC8)'].map((n, i) => port(`mc8-${i}`, n))
  const access = { inputs: new Map(ports.map((p) => [p.id, p])), outputs: new Map(), onstatechange: null }
  navigator.requestMIDIAccess = async () => access
  const send = (...b) => ports[0].onmidimessage?.({ data: new Uint8Array(b) })
  $('#midi-open').click()
  await wait(() => !$('#midi-dock').hidden, 3000, 'the dock')
  if (!$('#midi-on').checked) $('#midi-on').click()
  await wait(() => /Morningstar MC8/.test($('#midi-ports').textContent), 5000, 'the controller')
  const learned = []
  for (const { name, msg } of maps) {
    const s = $('#midi-drop select[data-md="pick"]'), o = [...s.options].find((x) => x.textContent === name)
    if (!o) { learned.push(`${name}: not in the list`); continue }
    s.value = o.value
    s.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 60))
    send(...msg)
    await new Promise((r) => setTimeout(r, 120))
    learned.push(name)
  }
  // the monitor shows the learning; no message that does something (even W again marks the rig changed)
  await wait(() => $('#toast').hidden, 10000, 'the toast to go')
  document.activeElement?.blur()
  return { ports: $('#midi-ports').textContent.trim(), learned, options: [...$('#midi-drop select[data-md="pick"]').options].slice(0, 60).map((o) => o.textContent) }
}
