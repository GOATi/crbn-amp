// TONE3000 in Rig's library (build plan R8, docs/R8-TONE3000.md): the library's second tab, beside "My folder", as the
// owner's lab drew it. Signed out, TONE3000's splash and Continue; signed in, the person's TONE3000 (Favorites,
// Downloaded, Created, Trending, Latest, and a search), each tone with its image, gear, format, creator and licence,
// "Powered by TONE3000", and a Browse TONE3000 button into TONE3000's own picker from wherever its tones show. A tone
// opens to its details and a model selector; Play fetches that model (only then), plays it, and keeps it in the
// person's folder with its credit (tone3000.json), so next time it plays from there, offline too.
//
// TONE3000's design requirements (its API docs, 1 to 7) are met here and in app.js's capture panel; its logos are its
// own files in t3k/, unaltered.
import { FORMAT_LABEL, GEAR_LABEL, LICENSE_LABEL, PLAYABLE, SITE, creatorName, creditOf, modelFile, toneFolder } from './tone3000.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const n = (x) => Number(x ?? 0).toLocaleString('en-GB')
const LOGO = '<img class="t3k-logo" src="t3k/tone3000-logo.svg" alt="TONE3000" width="140" height="21">'
const MARK = '<img class="t3k-mark" src="t3k/t3k-mark.svg" alt="" width="33" height="11">'
const HEART = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"/></svg>'
/** The tabs TONE3000 asks for (Favorites, Created, Downloaded), then its optional two. */
const TABS = [['favorited', 'Favorites'], ['downloaded', 'Downloaded'], ['created', 'Created'], ['trending', 'Trending'], ['latest', 'Latest']]
/** Gear to narrow a list or a search by, in TONE3000's words; a cabinet is an IR. */
const GEARS = [['', 'All'], ['amp', 'Amp Head'], ['amp-cab', 'Amp + Cab'], ['pedal', 'Pedal'], ['cab', 'Cabinet IR'], ['outboard', 'Outboard']]
const SPLASH = 'CRBN Rig works with TONE3000 to give you access to a massive library of Neural Amp Modeler (NAM) captures and IRs of real analog gear, created by a global community of musicians.'
const VIEW_KEY = 'crbn-rig/tone3000-view'

/**
 * @param o.t3k    the client (tone3000.js)
 * @param o.lib    the library: where captures are kept, and what is kept already
 * @param o.play   plays a capture or IR: ({ kind: 'nam'|'ir', name, bytes, path }) => Promise; path is its place in the
 *                 library when it was kept there, or null
 * @param o.toast  (text, kind) => void
 * @param o.chooseFolder  opens the library's "Choose a folder…"
 */
export function createTone3000View({ t3k, lib, play, toast, chooseFolder }) {
  const $ = (id) => document.getElementById(id)
  const panel = $('t3k'), section = panel.closest('.lib')
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') ?? {} } catch { /* the defaults */ }
  const view = { pane: saved.pane === 't3k' ? 't3k' : 'folder', tab: TABS.some((t) => t[0] === saved.tab) ? saved.tab : 'favorited', gear: '', text: '', page: 1 }
  let list = null, loading = false, error = '', detail = null, searchTimer = 0, ask = 0, firstOpen = true
  const keepView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ pane: view.pane, tab: view.tab })) } catch { /* not kept */ } }

  // ---------------------------------------------------------------- pieces
  const avatar = (u, cls = 't3k-av') => (u?.avatar_url ? `<img class="${cls}" src="${esc(u.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="${cls} none" aria-hidden="true">${esc((creatorName(u)[0] ?? '?').toUpperCase())}</span>`)
  const image = (tone, cls = 't3k-img') => (tone.images?.[0] ? `<img class="${cls}" src="${esc(tone.images[0])}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="${cls} none" aria-hidden="true">${MARK}</span>`)
  const gearOf = (t) => GEAR_LABEL[t.gear] ?? t.gear ?? ''
  const formatOf = (t) => FORMAT_LABEL[t.format] ?? String(t.format ?? '').toUpperCase()
  const heart = (t) => `<button class="t3k-heart" type="button" data-heart="${t.id}" aria-pressed="${Boolean(t.is_favorite)}" aria-label="${t.is_favorite ? 'In your TONE3000 favorites' : 'Add to your TONE3000 favorites'}: ${esc(t.title)}" title="${t.is_favorite ? 'In your TONE3000 favorites: click to take it out' : 'Add to your TONE3000 favorites'}">${HEART}</button>`
  const kept = (t) => (lib.keptTone(t.id) ? '<span class="lib-tag">In your library</span>' : '')
  const card = (t) => `<li class="t3k-card${PLAYABLE.has(t.format) ? '' : ' cant'}" data-tone="${t.id}">` +
    `<button class="t3k-open" type="button" data-open="${t.id}">${image(t)}<b>${esc(t.title)}</b>` +
    `<span class="t3k-m">${esc(gearOf(t))} · ${esc(formatOf(t))}${kept(t)}</span>` +
    `<span class="t3k-by">${avatar(t.user)}${esc(creatorName(t.user))}</span></button>${heart(t)}</li>`
  const browse = (label = 'Browse TONE3000') => `<button class="btn small t3k-browse" type="button" data-browse>${MARK}<span>${label}</span></button>`

  // ---------------------------------------------------------------- drawing
  function drawSplash() {
    panel.innerHTML = `<div class="t3k-splash">${LOGO}<p>${esc(SPLASH)}</p>` +
      '<p class="t3k-fine">You sign in with your own TONE3000 account; Rig keeps what you choose in your library folder, credited to its creator.</p>' +
      '<div class="row"><button class="btn primary" type="button" data-continue>Continue</button>' +
      `<a class="linkish" href="${SITE}" target="_blank" rel="noopener">What is TONE3000? &#8599;</a></div></div>`
  }
  function head() {
    const u = t3k.user
    return `<div class="t3k-head">${LOGO}<a class="t3k-powered" href="${SITE}" target="_blank" rel="noopener">Powered by TONE3000</a><span class="sp"></span>` +
      (u ? `<a class="t3k-me" href="${esc(u.url ?? SITE)}" target="_blank" rel="noopener" title="Your TONE3000 profile">${avatar(u)}<span>${esc(creatorName(u))}</span></a>` : '') +
      `${browse()}<button class="btn small ghost" type="button" data-signout title="Sign out of TONE3000 in CRBN Rig">Sign out</button></div>`
  }
  function drawList() {
    const searching = view.text.trim().length >= 2
    const tabs = `<div class="t3k-tabs" role="tablist" aria-label="Your TONE3000">${TABS.map(([k, t]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${!searching && view.tab === k}">${t}</button>`).join('')}</div>`
    const tools = `<div class="t3k-tools"><label class="lib-search"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>` +
      `<input type="search" id="t3k-q" placeholder="Search TONE3000" aria-label="Search TONE3000" autocomplete="off" spellcheck="false" value="${esc(view.text)}"></label>` +
      `<div class="lib-chips" role="group" aria-label="Gear">${GEARS.filter(([g]) => !(view.tab === 'latest' && g && !searching)).map(([g, t]) => `<button type="button" class="lib-fchip" data-gear="${g}" aria-pressed="${view.gear === g}">${t}</button>`).join('')}</div></div>`
    let body
    if (loading && !list) body = '<p class="lib-reading">Asking TONE3000&hellip;</p>'
    else if (error) body = `<p class="lib-none">${esc(error)} <button class="linkish" type="button" data-retry>Try again</button></p>`
    else if (!list?.data?.length) {
      const why = searching ? `Nothing on TONE3000 matches “${esc(view.text)}”${view.gear ? ' with this gear' : ''}.`
        : view.tab === 'favorited' ? 'You have no TONE3000 favorites yet: heart a tone here or on TONE3000.'
          : view.tab === 'created' ? 'You have not shared tones on TONE3000 yet.'
            : view.tab === 'downloaded' ? 'Nothing downloaded from TONE3000 yet.' : 'Nothing here right now.'
      body = `<p class="lib-none">${why}</p>`
    } else {
      const pages = list.total_pages ?? 1
      body = `<ul class="t3k-cards">${list.data.map(card).join('')}</ul>` +
        (pages > 1 ? `<div class="t3k-pages"><button class="btn small ghost" type="button" data-page="${view.page - 1}"${view.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${view.page} of ${n(pages)}</span><button class="btn small ghost" type="button" data-page="${view.page + 1}"${view.page >= pages ? ' disabled' : ''}>Next</button></div>` : '')
    }
    const partial = searching || ['trending', 'latest'].includes(view.tab)
    const invite = partial ? `<p class="t3k-invite">There is far more on TONE3000. ${browse('Browse all of TONE3000')}</p>` : ''
    const had = document.activeElement?.id === 't3k-q'
    panel.innerHTML = head() + tabs + tools + `<div class="t3k-body" aria-busy="${loading}">${body}</div>` + invite
    if (had) { const i = $('t3k-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length) }
  }
  function drawDetail() {
    const { tone: t, models, pick, busy } = detail
    const playable = PLAYABLE.has(t.format), keptHere = lib.keptTone(t.id)
    const lic = LICENSE_LABEL[t.license] ?? t.license ?? ''
    const desc = String(t.description ?? '').trim()
    const opts = (models ?? []).map((m) => {
      const file = keptHere?.credit.models.find((x) => x.id === m.id)
      return `<li><label class="t3k-model"><input type="radio" name="t3k-model" value="${m.id}"${m.id === pick ? ' checked' : ''}>` +
        `<b>${esc(m.name)}</b><small>${esc([m.size && m.size !== 'standard' ? m.size : '', m.architecture_version ? `A${m.architecture_version === 'custom' ? ' custom' : m.architecture_version}` : '', file ? 'in your library' : ''].filter(Boolean).join(' · '))}</small></label></li>`
    }).join('')
    panel.innerHTML = head() +
      `<div class="t3k-detail"><button class="btn small ghost t3k-back" type="button" data-back>&larr; Back</button>` +
      `<div class="t3k-dhead">${image(t, 't3k-dimg')}<div><h3>${esc(t.title)}</h3>` +
      `<p class="t3k-m">${esc(gearOf(t))} · ${esc(formatOf(t))}${(t.makes ?? []).length ? ` · ${esc(t.makes.map((m) => m.name).join(', '))}` : ''}</p>` +
      `<p class="t3k-by">${avatar(t.user)}<a href="${esc(t.user?.url ?? SITE)}" target="_blank" rel="noopener">${esc(creatorName(t.user))}</a></p>` +
      `<p class="t3k-lic">${esc(lic)} · <a href="${esc(t.url ?? SITE)}" target="_blank" rel="noopener">Open on TONE3000 &#8599;</a></p>${heart(t)}</div></div>` +
      (!playable ? `<p class="lib-none">CRBN Rig plays NAM captures and IRs; this tone is ${esc(formatOf(t))}.</p>`
        : models === null ? '<p class="lib-reading">Asking TONE3000 for its models&hellip;</p>'
          : !models.length ? '<p class="lib-none">This tone has no models Rig can play.</p>'
            : `<fieldset class="t3k-models"><legend>Models</legend><ul>${opts}</ul></fieldset>` +
              `<div class="row"><button class="btn primary" type="button" data-play${busy ? ' disabled' : ''}>${busy ? esc(busy) : 'Play'}</button></div>`) +
      (desc ? `<p class="t3k-desc">${esc(desc.slice(0, 1200))}</p>` : '') + '</div>'
  }
  function draw() {
    section.dataset.pane = view.pane
    for (const b of section.querySelectorAll('[data-pane-tab]')) b.setAttribute('aria-selected', String(b.dataset.paneTab === view.pane))
    if (view.pane !== 't3k') return
    if (!t3k.signedIn) { detail = null; drawSplash(); return }
    // Opened with nothing asked yet (the tab kept from last time): ask now, drawing "Asking" meanwhile.
    if (!detail && !list && !loading && !error) { loading = true; queueMicrotask(load) }
    if (detail) drawDetail(); else drawList()
  }

  // ---------------------------------------------------------------- asking TONE3000
  async function load() {
    if (!t3k.signedIn) return
    const mine = ++ask
    loading = true; error = ''; draw()
    try {
      const searching = view.text.trim().length >= 2
      const g = view.gear
      const r = searching
        ? await t3k.search({ query: view.text.trim(), page: view.page, gears: g, format: g === 'cab' ? 'ir' : '' })
        : await t3k.list(view.tab, { page: view.page, gear: g })
      if (mine !== ask) return
      list = r
      // A first look at an empty Favorites shows what is trending instead.
      if (firstOpen && !searching && view.tab === 'favorited' && !r?.data?.length) { firstOpen = false; view.tab = 'trending'; return load() }
      firstOpen = false
    } catch (e) {
      if (mine !== ask) return
      list = null; error = e?.message ?? String(e)
    } finally { if (mine === ask) { loading = false; draw() } }
  }
  async function openTone(id, { autoplay = false } = {}) {
    detail = { tone: list?.data?.find((t) => t.id === id) ?? { id, title: 'Loading…', user: null, images: null, format: 'nam' }, models: null, pick: null, busy: '' }
    draw()
    try {
      const tone = await t3k.tone(id)
      if (detail?.tone.id !== id) return
      detail.tone = tone; draw()
      if (!PLAYABLE.has(tone.format)) return
      const models = await t3k.models(tone)
      if (detail?.tone.id !== id) return
      detail.models = models
      detail.pick = models[0]?.id ?? null
      draw()
      // A pick from TONE3000's picker plays at once, unless the browser must first ask to write into the folder: that
      // needs the person's own click, so then Play waits for it.
      if (autoplay && detail.pick && (await lib.canKeep()) !== 'ask') await playPick()
    } catch (e) { toast(e?.message ?? String(e)); if (detail?.tone.id === id && !detail.models) { detail = null; draw() } }
  }

  /** Play: the model picked, from the library if kept there, else fetched now and kept. */
  async function playPick() {
    if (!detail?.models || detail.busy) return
    const { tone } = detail, model = detail.models.find((m) => m.id === detail.pick)
    if (!model) return
    const kind = tone.format === 'ir' ? 'ir' : 'nam', dir = `${toneFolder(tone)}/`
    const already = lib.keptTone(tone.id), keptFile = already?.credit.models.find((m) => m.id === model.id)
    const done = (b) => { if (detail?.tone.id === tone.id) { detail.busy = b; draw() } }
    try {
      if (keptFile) {
        done('Playing…')
        await play({ kind, name: keptFile.file, bytes: null, path: already.dir + keptFile.file })
        return
      }
      // A browser asks once before Rig may write into the folder: asked now, on this click.
      let canKeep = await lib.canKeep()
      if (canKeep === 'ask') canKeep = (await lib.askKeep()) ? 'yes' : 'no'
      done('Getting it from TONE3000…')
      const bytes = await t3k.download(model)
      const file = modelFile(model, tone)
      if (canKeep === 'yes') {
        done('Keeping it in your library…')
        const prev = already?.credit ?? lib.creditAt(dir)
        const models = [...(prev?.models ?? []).filter((m) => m.id !== model.id).map((m) => ({ ...m, architecture_version: m.architecture })), { ...model, file }]
        const credit = new TextEncoder().encode(JSON.stringify(creditOf(tone, models), null, 2))
        await lib.keep([[dir + file, bytes], [dir + 'tone3000.json', credit]])
        done('Playing…')
        await play({ kind, name: file, bytes, path: dir + file })
      } else {
        done('Playing…')
        await play({ kind, name: file, bytes, path: null })
        toast(lib.folder ? 'Playing it now. Rig could not keep it in this folder, so it will not be here next time.' : 'Playing it now. Choose a folder for your library and Rig will keep what you play from TONE3000 there.', 'info')
      }
    } catch (e) { toast(`${tone.title}: ${e?.message ?? e}`) } finally { done('') }
  }

  async function heartTone(id, btn) {
    const t = detail?.tone.id === id ? detail.tone : list?.data?.find((x) => x.id === id)
    if (!t) return
    const on = !t.is_favorite
    try {
      await t3k.favorite(id, on)
      t.is_favorite = on
      for (const x of [detail?.tone, ...(list?.data ?? [])]) if (x?.id === id) x.is_favorite = on
      if (view.tab === 'favorited' && !detail && !view.text) load(); else draw()
    } catch (e) { toast(e?.message ?? String(e)); btn?.focus() }
  }

  /** TONE3000's own picker (select_tone): sign in on the way if need be, then the tone picked opens and plays. */
  async function browseT3k({ gears = '', format = '' } = {}) {
    try {
      const r = await t3k.prompt({ prompt: 'select_tone', gears, format })
      if (view.pane !== 't3k') { view.pane = 't3k'; keepView() }
      if (r?.toneId) await openTone(r.toneId, { autoplay: true })
      else { draw(); if (!list) load() }
    } catch (e) { toast(e?.message ?? String(e)) }
  }

  // ---------------------------------------------------------------- what the person does
  section.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-pane-tab]')
    if (!b) return
    view.pane = b.dataset.paneTab; keepView(); draw()
    if (view.pane === 't3k' && t3k.signedIn && !list && !loading) load()
  })
  panel.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button, input[type=radio]')
    if (!t) return
    const d = t.dataset
    if (d.continue !== undefined || d.browse !== undefined) browseT3k()
    else if (d.signout !== undefined) { t3k.signOut(); list = null; detail = null; draw(); toast('Signed out of TONE3000 in CRBN Rig. What you kept stays in your folder.', 'info') }
    else if (d.tab) { view.tab = d.tab; view.text = ''; view.page = 1; detail = null; keepView(); load() }
    else if (d.gear !== undefined) { view.gear = d.gear; view.page = 1; load() }
    else if (d.page) { view.page = Number(d.page); load(); panel.scrollIntoView({ block: 'nearest' }) }
    else if (d.retry !== undefined) load()
    else if (d.open) openTone(Number(d.open))
    else if (d.back !== undefined) { detail = null; draw() }
    else if (d.heart) heartTone(Number(d.heart), t)
    else if (d.play !== undefined) playPick()
    else if (t.name === 't3k-model' && detail) { detail.pick = Number(t.value) }
  })
  panel.addEventListener('input', (ev) => {
    if (ev.target.id !== 't3k-q') return
    view.text = ev.target.value; view.page = 1
    clearTimeout(searchTimer)
    // Searches are rate limited by TONE3000 the hardest: one after the person stops typing, and only from two letters.
    searchTimer = setTimeout(() => { if (view.text.trim().length >= 2 || view.text.trim() === '') load() }, 450)
  })

  return {
    draw,
    /** The client's onChange: signed in or out. */
    changed() { list = null; detail = null; draw(); if (view.pane === 't3k' && t3k.signedIn) load() },
    /** The library changed: "In your library" marks. */
    libChanged() { if (view.pane === 't3k' && t3k.signedIn) draw() },
    /** The amp's, a pedal's or the cabinet's way in (TONE3000's requirement 1): its picker, locked to that gear. */
    browse: browseT3k,
    open(id, { autoplay = false } = {}) { view.pane = 't3k'; keepView(); return openTone(id, { autoplay }) },
    get pane() { return view.pane },
    chooseFolder,
  }
}
