// CRBN Rig's library on the page (build plan R4, P3-UX U3): the folder's captures and IRs, drawn as the person picked
// in the look menu (D-RIG-008 (d)): A, a dense list with the gear and tone as chips and a star on every row (the
// default); B, cards; C, shelves by gear. Search as you type, chips for the gear, favourites and tone, a sort, a star
// on everything, and a click to play. library.js holds the index; app.js plays what is picked.
import { GROUPS, SORTS, TONES, gearWord, groupOf, toneWord } from './library.js'

const ICON = {
  amp: '<path d="M9 6V4.5h6V6"/><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/><path d="M7 8.3h.01M10 8.3h.01M13 8.3h.01"/><path d="M7 13.5v3M10 13.5v3M13 13.5v3M16 13.5v3"/>',
  pedal: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="9.5" cy="7" r="1.4"/><circle cx="14.5" cy="7" r="1.4"/><circle cx="12" cy="15.5" r="2.6"/>',
  cab: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  rig: '<rect x="2.5" y="9" width="5" height="8" rx="1"/><rect x="9.5" y="6" width="7" height="11" rx="1"/><rect x="18.5" y="8" width="3" height="9" rx=".8"/><path d="M7.5 13h2M16.5 13h2"/>',
  star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
}
const svg = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`
const GROUP_ICON = { amps: 'amp', pedals: 'pedal', rigs: 'rig', cabs: 'cab', other: 'amp' }
const PAGE = 40 // rows drawn at a time (about three screens of the list); more as the person scrolls
const SHELF = 40 // cards on a shelf before "more"
const VIEW_KEY = 'crbn-rig/library-view'
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const n = (x) => x.toLocaleString('en-GB')

/** The line under a name: who captured it and the gear, or an IR's length and rate. */
function sub(e) {
  if (e.k === 'ir') {
    const bits = []
    if (e.sec) bits.push(e.sec < 1 ? `${Math.round(e.sec * 1000)} ms` : `${e.sec.toFixed(1)} s`)
    if (e.rate) bits.push(`${+(e.rate / 1000).toFixed(1)} kHz`)
    if (e.ch > 1) bits.push(e.ch === 2 ? 'stereo' : `${e.ch} channels`)
    if (e.bad) bits.push('not a WAV CRBN Rig can read')
    return bits.join(' · ')
  }
  const gear = [e.make, e.model].filter(Boolean).join(' ')
  return [e.by && `by ${e.by}`, gear].filter(Boolean).join(' · ') || (e.bad ? 'could not be read' : '')
}

/**
 * @param {{ lib: ReturnType<import('./library.js').createLibrary>, play: (e) => Promise<void>, playing: () => { capture: string|null, ir: string|null },
 *           toast: (text: string, kind?: string) => void, pickFiles: () => void }} o
 */
export function createLibraryView({ lib, play, playing, toast, pickFiles, dragType = null }) {
  const $ = (id) => document.getElementById(id)
  const body = $('lib-body'), chips = $('lib-chips'), q = $('lib-q'), sortSel = $('lib-sort')
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') ?? {} } catch { /* the defaults */ }
  const view = { text: '', group: '', tone: '', favs: false, sort: SORTS.some((s) => s[0] === saved.sort) ? saved.sort : 'name', limit: PAGE }
  let results = [], lastMs = 0, observer = null

  sortSel.innerHTML = SORTS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')
  sortSel.value = view.sort

  const drawing = () => document.documentElement.dataset.library || 'a'
  const isPlaying = (e) => { const p = playing(); return e.k === 'ir' ? p.ir === e.p : p.capture === e.p }
  const tag = (e) => (isPlaying(e) ? '<span class="lib-tag">Playing</span>' : '')
  const star = (e) => {
    const on = lib.isFav(e.p)
    return `<button class="lib-star" type="button" data-star="${esc(e.p)}" aria-pressed="${on}" aria-label="${on ? 'Starred' : 'Star'}: ${esc(e.n)}" title="${on ? 'In your favourites: click to take it out' : 'Add to your favourites'}">${svg('star')}</button>`
  }
  const icon = (e) => svg(GROUP_ICON[groupOf(e)] ?? (e.k === 'ir' ? 'cab' : 'amp'))
  // A capture can be dragged onto the board as a pedal, or onto the amp (build plan R6).
  const drag = (e) => (dragType && e.k === 'nam' ? ' draggable="true"' : '')
  const row = (e) => `<li class="lib-row${isPlaying(e) ? ' playing' : ''}" data-p="${esc(e.p)}">${star(e)}` +
    `<button class="lib-go" type="button" data-go="${esc(e.p)}" title="${esc(e.p)}"${drag(e)}><span class="lib-gl">${icon(e)}</span>` +
    `<span class="lib-ln"><b>${esc(e.n)}</b><small>${esc(sub(e))}${tag(e)}</small></span>` +
    `<span class="lib-chip">${esc(gearWord(e))}</span><span class="lib-chip tone">${esc(toneWord(e))}</span></button></li>`
  const card = (e) => `<li class="lib-card${isPlaying(e) ? ' playing' : ''}" data-p="${esc(e.p)}">` +
    `<button class="lib-go" type="button" data-go="${esc(e.p)}" title="${esc(e.p)}"${drag(e)}><span class="lib-gl">${icon(e)}</span><b>${esc(e.n)}</b>` +
    `<span class="lib-m">${esc([gearWord(e), toneWord(e)].filter(Boolean).join(' · ') || sub(e))}</span>${tag(e)}</button>${star(e)}</li>`
  const more = (left) => `<li class="lib-more"><button class="btn small ghost" type="button" data-more>Show ${n(Math.min(PAGE, left))} more of ${n(left)}</button></li>`

  function drawEmpty() {
    const box = $('lib-empty'), st = lib.status, f = lib.folder
    let html = ''
    if (st === 'none') {
      html = '<p><b>Point Rig at your captures.</b> Choose the folder where you keep your <code>.nam</code> captures and <code>.wav</code> IRs (your TONE3000 downloads, say). Rig lists them with what each file says about itself' +
        (lib.canPick ? ', and keeps the folder for next time.' : '. This browser forgets the folder when you close the page.') + '</p>' +
        '<div class="row"><button class="btn primary" type="button" data-choose>Choose a folder&hellip;</button></div>'
    } else if (st === 'ask') {
      html = `<p><b>Open ${esc(f?.name)} again?</b> Your browser asks once a visit before Rig may read your folder.</p>` +
        `<div class="row"><button class="btn primary" type="button" data-regrant>Open ${esc(f?.name)}</button><button class="btn ghost" type="button" data-choose>Choose another&hellip;</button></div>`
    } else if (st === 'error') {
      html = `<p><b>${esc(lib.error)}</b></p><div class="row"><button class="btn" type="button" data-again>Try again</button><button class="btn ghost" type="button" data-choose>Choose another&hellip;</button></div>`
    } else if (st === 'ready' && lib.entries.length === 0) {
      html = `<p>There are no <code>.nam</code> captures or <code>.wav</code> IRs in ${esc(f?.name)}.</p>`
    } else if (st === 'scanning' && lib.entries.length === 0) {
      html = '<p class="lib-reading">Reading your folder&hellip;</p>'
    }
    box.innerHTML = html
    box.hidden = !html
  }

  function drawHead() {
    const st = lib.status, f = lib.folder, src = $('lib-src')
    const caps = lib.entries.filter((e) => e.k === 'nam').length, irs = lib.entries.length - caps
    const counted = `${n(caps)} ${caps === 1 ? 'capture' : 'captures'}, ${n(irs)} ${irs === 1 ? 'IR' : 'IRs'}`
    const { done, total } = lib.progress
    src.textContent = !f ? 'No folder yet'
      : st === 'scanning' ? `${f.name} · ${total ? `reading ${n(done)} of ${n(total)}…` : 'looking for changes…'}`
        : st === 'ask' ? `${f.name} · waiting for your OK`
          : st === 'error' ? `${f.name} · could not be read`
            : `${f.name} · ${counted}`
    src.title = f?.path ?? f?.name ?? ''
    // The last scan's timing, for the checks (library.js timing).
    if (lib.timing) src.dataset.timing = JSON.stringify(lib.timing)
    if (lib.opened) src.dataset.opened = JSON.stringify(lib.opened)
    $('lib-choose').textContent = f ? 'Change…' : 'Choose a folder…'
    $('lib-choose').title = f ? 'Choose another folder' : ''
    $('lib-again').hidden = !f || st === 'ask' || st === 'none'
    $('lib-tools').hidden = lib.entries.length === 0
  }

  function drawChips() {
    const { group, tone } = lib.counts()
    const chip = (attr, val, label, on, count) => `<button type="button" class="lib-fchip" ${attr}="${val}" aria-pressed="${on}"${count !== undefined ? ` title="${n(count)}"` : ''}>${label}</button>`
    chips.innerHTML = chip('data-group', '', 'All', !view.group) +
      GROUPS.filter(([g]) => group[g]).map(([g, t]) => chip('data-group', g, t, view.group === g, group[g])).join('') +
      chip('data-favs', '1', `${svg('star')}Favourites`, view.favs, lib.favCount) +
      TONES.filter(([t]) => tone[t]).map(([t, label]) => chip('data-tone', t, label, view.tone === t, tone[t])).join('')
  }

  function drawBody() {
    observer?.disconnect()
    if (lib.entries.length === 0) { body.innerHTML = ''; body.hidden = true; return }
    body.hidden = false
    const t0 = performance.now()
    results = lib.find(view)
    body.dataset.findMs = (performance.now() - t0).toFixed(1)
    const d = drawing()
    body.dataset.drawing = d
    if (!results.length) {
      const why = view.favs && !lib.favCount ? 'You have no favourites in this folder yet: star a capture to keep it here.' : `Nothing matches${view.text ? ` “${esc(view.text)}”` : ''}${view.group || view.tone || view.favs ? ' with these chips' : ''}.`
      body.innerHTML = `<p class="lib-none">${why} <button class="linkish" type="button" data-clear-search>Show everything</button></p>`
    } else if (d === 'c' && !view.group) {
      // Shelves: a row per kind of gear, scrolling sideways; "more" opens that shelf alone.
      const by = new Map()
      for (const e of results) { const g = groupOf(e) || 'other'; if (!by.has(g)) by.set(g, []); by.get(g).push(e) }
      body.innerHTML = '<div class="lib-shelves">' + GROUPS.filter(([g]) => by.has(g)).map(([g, t]) => {
        const list = by.get(g)
        return `<section class="lib-shelf-sec" aria-label="${t}"><div class="lib-shelf-h"><span class="sec">${t}</span><small>${n(list.length)}</small></div>` +
          `<ul class="lib-shelf">${list.slice(0, SHELF).map(card).join('')}${list.length > SHELF ? `<li class="lib-card lib-shelf-more"><button class="lib-go" type="button" data-shelf="${g}"><b>${n(list.length - SHELF)} more</b><span class="lib-m">Show all ${t.toLowerCase()}</span></button></li>` : ''}</ul></section>`
      }).join('') + '</div>'
    } else {
      const shown = results.slice(0, view.limit), left = results.length - shown.length
      body.innerHTML = d === 'a'
        ? `<ul class="lib-list"><li class="lib-row hd" aria-hidden="true"><span></span><span></span><span>Name</span><span>Gear</span><span class="tone">Tone</span></li>${shown.map(row).join('')}${left > 0 ? more(left) : ''}</ul>`
        : `<ul class="lib-cards">${shown.map(card).join('')}${left > 0 ? more(left) : ''}</ul>`
      const btn = body.querySelector('[data-more]')
      if (btn && 'IntersectionObserver' in window) {
        observer = new IntersectionObserver((seen) => { if (seen.some((s) => s.isIntersecting)) showMore() }, { root: body, rootMargin: '200px' })
        observer.observe(btn)
      }
    }
    lastMs = performance.now() - t0
    body.dataset.ms = lastMs.toFixed(1)
    body.dataset.count = String(results.length)
  }

  function showMore() {
    const keep = body.scrollTop
    view.limit += PAGE
    drawBody()
    body.scrollTop = keep
  }

  /** Everything, keeping the list's scroll and the row in focus. */
  function render() {
    drawHead(); drawEmpty()
    if (lib.entries.length) drawChips()
    redraw()
  }
  /** The rows again, keeping the list's scroll and the row in focus. */
  function redraw() {
    const keep = body.scrollTop, focused = document.activeElement?.closest?.('#lib-body [data-go], #lib-body [data-star]')
    const again = focused && (focused.dataset.go !== undefined ? `[data-go="${CSS.escape(focused.dataset.go)}"]` : `[data-star="${CSS.escape(focused.dataset.star)}"]`)
    drawBody()
    body.scrollTop = keep
    if (again) body.querySelector(again)?.focus()
  }
  /** A favourite changed: its stars, the chip's count, and the list if it shows favourites only. */
  function syncFav(p) {
    if (view.favs) { render(); return }
    const on = lib.isFav(p)
    for (const b of body.querySelectorAll(`[data-star="${CSS.escape(p)}"]`)) {
      const name = b.closest('[data-p]')?.querySelector('b')?.textContent ?? ''
      b.setAttribute('aria-pressed', String(on))
      b.setAttribute('aria-label', `${on ? 'Starred' : 'Star'}: ${name}`)
      b.title = on ? 'In your favourites: click to take it out' : 'Add to your favourites'
    }
    const chip = chips.querySelector('[data-favs]')
    if (chip) chip.title = n(lib.favCount)
  }

  // ---- what the person does
  // Back to the top before the rows change, while the layout is still clean: after, it would force the new rows' layout
  // there and then.
  const setView = (patch) => { Object.assign(view, patch, { limit: PAGE }); body.scrollTop = 0; drawChips(); drawBody() }
  q.addEventListener('input', () => setView({ text: q.value }))
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { body.querySelector('.lib-go')?.focus(); e.preventDefault() }
    else if (e.key === 'Enter') { const first = results[0]; if (first) go(first.p) }
    else if (e.key === 'Escape' && q.value) { q.value = ''; setView({ text: '' }); e.stopPropagation() }
  })
  sortSel.addEventListener('change', () => {
    view.sort = sortSel.value
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ sort: view.sort })) } catch { /* not kept */ }
    setView({})
  })
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if ('group' in b.dataset) setView({ group: b.dataset.group })
    else if ('tone' in b.dataset) setView({ tone: view.tone === b.dataset.tone ? '' : b.dataset.tone })
    else if ('favs' in b.dataset) setView({ favs: !view.favs })
  })
  async function go(p) {
    const e = lib.entries.find((x) => x.p === p)
    if (!e) return
    try { await play(e) } catch (err) { toast(`${e.n}: ${err?.message ?? err}`) }
  }
  body.addEventListener('dragstart', (ev) => {
    const go = ev.target.closest?.('[data-go][draggable="true"]')
    if (!go || !dragType) return
    ev.dataTransfer.setData(dragType, go.dataset.go)
    ev.dataTransfer.setData('text/plain', go.dataset.go.slice(go.dataset.go.lastIndexOf('/') + 1))
    ev.dataTransfer.effectAllowed = 'copy'
  })
  body.addEventListener('click', (ev) => {
    const t = ev.target.closest('button')
    if (!t) return
    if (t.dataset.star !== undefined) { lib.toggleFav(t.dataset.star); return }
    if (t.dataset.go !== undefined) { go(t.dataset.go); return }
    if (t.dataset.more !== undefined) { showMore(); return }
    if (t.dataset.shelf !== undefined) { setView({ group: t.dataset.shelf }); return }
    if (t.dataset.clearSearch !== undefined) { q.value = ''; setView({ text: '', group: '', tone: '', favs: false }) }
  })
  // Up and down move through the list, as through a menu.
  body.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return
    const all = [...body.querySelectorAll('.lib-go')], i = all.indexOf(document.activeElement)
    if (i < 0) return
    ev.preventDefault()
    if (ev.key === 'ArrowUp' && i === 0) { q.focus(); return }
    all[Math.max(0, Math.min(all.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  })
  const panel = body.closest('.lib')
  panel.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button')
    if (!t) return
    if (t.id === 'lib-choose' || t.dataset.choose !== undefined) choose()
    else if (t.dataset.regrant !== undefined) { if (!(await lib.regrant())) toast('Your browser did not let CRBN Rig read the folder. Choose it again to try once more.') }
    else if (t.id === 'lib-again' || t.dataset.again !== undefined) lib.refresh()
  })
  async function choose() {
    if (!lib.canPick) { pickFiles(); return }
    try { await lib.choose() } catch (err) {
      if (err?.name === 'AbortError') return
      // A view that refuses the folder picker (some embedded browsers) still offers the folder input.
      pickFiles()
    }
  }

  return {
    render,
    /** library.js's onChange: a scan's count redraws the heading, a favourite its stars, the rest everything. */
    changed(why, p) { if (why === 'progress') drawHead(); else if (why === 'fav') syncFav(p); else render() },
    /** The playing marks and stars only, after a capture or IR is picked. */
    refreshMarks() { if (lib.entries.length) redraw() },
    get lastMs() { return lastMs },
  }
}
