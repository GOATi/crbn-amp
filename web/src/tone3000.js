// CRBN Rig and TONE3000 (build plan R8, P3-UX U7, docs/R8-TONE3000.md): a person signs in to their own TONE3000
// account, browses and searches TONE3000 inside Rig's library, hearts tones, and plays a capture they ask for, which
// Rig keeps in their library folder with its credit so it plays offline. Everything goes through TONE3000's public API
// (https://www.tone3000.com/api) under its API terms (https://www.tone3000.com/api/terms), as the person, with
// TONE3000's own OAuth (PKCE, a public client: Rig holds no secret).
//
// Both builds run this same code and call TONE3000 straight from the page (its API answers any origin). Only signing in
// differs: the web version opens TONE3000 in a popup that comes back to /tone3000.html; the desktop app's host gives
// the popup its own WebView2 and catches the redirect to http://127.0.0.1/callback before it is made (RigWebView.cpp),
// handing it to the page (onCallback below).
//
// Calls happen only on a person's action, through a limiter that keeps Rig well under TONE3000's limit.

/** Rig's publishable key on TONE3000 (the OAuth client_id; public by design). */
export const CLIENT_ID = 't3k_pub_J6MuMOba14a05Nl3Luf4Mp1Zj7Ik7oPi'
export const SITE = 'https://www.tone3000.com'
const LIVE_API = `${SITE}/api/v1`
const TOKENS_KEY = 'crbn-rig/tone3000'
/** Rig's own ceiling, per person, under TONE3000's 100 a minute. */
const PER_MINUTE = 60
const DESKTOP_REDIRECT = 'http://127.0.0.1/callback'

/**
 * TONE3000's sign-off (its API terms: an integration like Rig's is reviewed before it is published). Until then the
 * TONE3000 tab and buttons show only in a browser that opened Rig with ?tone3000 (kept there; ?tone3000=off forgets
 * it), so TONE3000 can review it on the live site while players do not see it. Set true once TONE3000 signs off.
 */
export const RELEASED = false
const PREVIEW_KEY = 'crbn-rig/tone3000-preview'
export function tone3000On(loc = globalThis.location) {
  try {
    const q = new URLSearchParams(loc?.search ?? '')
    if (q.has('tone3000')) { if (q.get('tone3000') === 'off') localStorage.removeItem(PREVIEW_KEY); else localStorage.setItem(PREVIEW_KEY, '1') }
    return RELEASED || localStorage.getItem(PREVIEW_KEY) === '1'
  } catch { return RELEASED }
}

/** The words TONE3000 shows for its gear and formats (its examples' labels, "matching the TONE3000 UI"). */
export const GEAR_LABEL = { amp: 'Amp Head', 'amp-cab': 'Amp + Cab', 'full-rig': 'Amp + Cab', pedal: 'Pedal', outboard: 'Outboard', cab: 'Cabinet', space: 'Spaces', experimental: 'Experimental' }
export const FORMAT_LABEL = { nam: 'NAM', ir: 'IR', 'aida-x': 'AIDA-X', 'aa-snapshot': 'Snapshot', proteus: 'Proteus' }
export const LICENSE_LABEL = { t3k: 'T3K licence', 'cc-by': 'CC BY', 'cc-by-sa': 'CC BY-SA', 'cc-by-nc': 'CC BY-NC', 'cc-by-nc-sa': 'CC BY-NC-SA', 'cc-by-nd': 'CC BY-ND', 'cc-by-nc-nd': 'CC BY-NC-ND', cco: 'CC0', cc0: 'CC0' }
/** What Rig can play: NAM captures and IRs. */
export const PLAYABLE = new Set(['nam', 'ir'])
export const creatorName = (u) => u?.display_name || u?.username || 'Unknown'

/**
 * Where the API is. TONE3000's own, except in Rig's self-test, which serves a recorded TONE3000 on the page's own
 * origin and names it with ?t3k=/path (only a path on this origin is taken, never another host).
 */
export function apiBase(loc = globalThis.location) {
  try {
    const q = new URLSearchParams(loc?.search ?? '').get('t3k')
    if (q && /^\/[A-Za-z0-9_\-/]*$/.test(q) && !q.includes('//')) return `${loc.origin}${q.replace(/\/+$/, '')}`
  } catch { /* the live API */ }
  return LIVE_API
}

// ------------------------------------------------------------------------------------------------- PKCE
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
function randomText(n = 32) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b64url(b) }
async function challengeOf(verifier) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))) }

// ------------------------------------------------------------------------------------------------- tokens
function loadTokens() { try { const t = JSON.parse(localStorage.getItem(TOKENS_KEY) ?? 'null'); return t?.refresh_token ? t : null } catch { return null } }
function saveTokens(t) { try { if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t)); else localStorage.removeItem(TOKENS_KEY) } catch { /* not kept */ } }

/** A file or folder name from TONE3000's words: no path characters, no dots at the ends, not too long. */
export function safeName(s, max = 80) {
  const t = String(s ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').slice(0, max).trim()
  return t || 'Untitled'
}
/** The folder a tone's captures are kept in, under the library: TONE3000/<creator> - <title> (<id>). */
export function toneFolder(tone) { return `TONE3000/${safeName(`${creatorName(tone.user)} - ${tone.title}`, 100)} (${tone.id})` }
/** A model's file name: its name, with the extension its model_url ends in (.nam or .wav). */
export function modelFile(model, tone) {
  const ext = (/\.(nam|wav)(?:$|\?)/i.exec(new URL(model.model_url, SITE).pathname) ?? [, tone?.format === 'ir' ? 'wav' : 'nam'])[1].toLowerCase()
  return `${safeName(model.name || `Model ${model.id}`)}.${ext}`
}

/**
 * The credit kept beside a tone's captures in the library (tone3000.json), so a capture always carries who made it,
 * its licence and a way back to its page, offline too. `kept` is the models kept so far, with their file names.
 */
export function creditOf(tone, kept) {
  const u = tone.user ?? {}
  return {
    tone3000: 1,
    tone: { id: tone.id, title: tone.title, url: tone.url, gear: tone.gear, format: tone.format, license: tone.license, image: tone.images?.[0] ?? null, makes: (tone.makes ?? []).map((m) => m.name), description: String(tone.description ?? '').split('\n').slice(0, 3).join('\n').slice(0, 400) },
    creator: { username: u.username ?? '', display_name: u.display_name ?? null, url: u.url ?? '', avatar_url: u.avatar_url ?? null },
    models: kept.map((m) => ({ id: m.id, name: m.name, size: m.size ?? null, architecture: m.architecture_version ?? null, file: m.file })),
  }
}
/** A tone3000.json's text, read back: null when it is not one. */
export function readCredit(text) {
  try {
    const c = JSON.parse(text)
    if (c?.tone3000 !== 1 || !c.tone?.id || !Array.isArray(c.models)) return null
    return c
  } catch { return null }
}

/**
 * The client. `host` is the audio backend (the desktop's catches the sign-in redirect); `onChange()` is called when
 * the person signs in or out.
 */
export function createTone3000({ desktop = false, onChange = () => {}, base = apiBase() } = {}) {
  let tokens = loadTokens(), refreshing = null, flow = null
  const stamps = []
  const changed = () => onChange()
  const redirectUri = desktop ? DESKTOP_REDIRECT : `${location.origin}/tone3000.html`

  // ---------------------------------------------------------------- the limiter
  async function slot() {
    for (;;) {
      const now = Date.now()
      while (stamps.length && now - stamps[0] > 60000) stamps.shift()
      if (stamps.length < PER_MINUTE) { stamps.push(now); return }
      await new Promise((r) => setTimeout(r, 60000 - (now - stamps[0]) + 50))
    }
  }

  // ---------------------------------------------------------------- tokens
  async function tokenCall(body) {
    await slot()
    const r = await fetch(`${base}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...body, client_id: CLIENT_ID }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.access_token) { const e = new Error(j.error_description || j.error || `TONE3000 said ${r.status}`); e.status = r.status; e.code = j.error; throw e }
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
  }
  function keep(t, user) { tokens = { ...t, user: user ?? tokens?.user ?? null }; saveTokens(tokens) }
  function end() { tokens = null; saveTokens(null); changed() }
  async function refresh() {
    if (!tokens?.refresh_token) throw Object.assign(new Error('Not signed in to TONE3000.'), { status: 401 })
    refreshing ??= (async () => {
      try { keep(await tokenCall({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })) }
      catch (e) { if (e.status === 400 || e.status === 401) end(); throw e }
      finally { refreshing = null }
    })()
    return refreshing
  }
  async function bearer() {
    if (!tokens) throw Object.assign(new Error('Not signed in to TONE3000.'), { status: 401 })
    if (Date.now() > tokens.expires_at - 60000) await refresh()
    return tokens.access_token
  }

  // ---------------------------------------------------------------- calls
  /** A GET (or another method) to the API as the person; one retry after a refresh on 401. */
  async function call(path, params = {}, method = 'GET', raw = false) {
    const url = new URL(base + path)
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    for (let attempt = 0; ; attempt++) {
      await slot()
      const r = await fetch(url, { method, headers: { authorization: `Bearer ${await bearer()}` } })
      if (r.status === 401 && attempt === 0) { await refresh(); continue }
      if (r.status === 429) throw Object.assign(new Error('TONE3000 asks Rig to slow down. Try again in a minute.'), { status: 429 })
      if (!r.ok) throw Object.assign(new Error(r.status === 404 ? 'That tone is not on TONE3000 any more, or is private.' : `TONE3000 said ${r.status}.`), { status: r.status })
      if (raw) return r
      return r.status === 204 ? null : r.json()
    }
  }

  // ---------------------------------------------------------------- signing in (the prompt flows)
  /** Hands a redirect's query to the flow waiting for it (the web's /tone3000.html, or the desktop host). */
  function onCallback(query) {
    if (!flow) return false
    const q = query instanceof URLSearchParams ? query : new URLSearchParams(String(query).replace(/^[^?]*\?/, ''))
    flow.done(q)
    return true
  }
  if (!desktop && typeof window !== 'undefined') {
    window.addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.type === 't3k_callback') onCallback(new URLSearchParams(e.data.query)) })
    try { new BroadcastChannel('crbn-rig-t3k').onmessage = (e) => { if (e.data?.type === 't3k_callback') onCallback(new URLSearchParams(e.data.query)) } } catch { /* no channel */ }
  }

  /**
   * TONE3000's own page in a popup: sign in, and with `prompt` its picker (select_tone) or a kept tone (load_tone).
   * Resolves { toneId } (null without a pick), or { canceled: true }. Must start from a person's click (a popup).
   */
  async function prompt({ prompt: kind = 'select_tone', toneId = null, gears = '', format = '' } = {}) {
    if (flow) { flow.popup?.focus?.(); return flow.promise }
    // A full-page flow left unfinished would send this popup's answer back to the page instead (tone3000.html).
    try { sessionStorage.removeItem('crbn-rig/t3k-flow') } catch { /* none */ }
    const verifier = randomText(48), state = randomText(16)
    const url = new URL(`${base}/oauth/authorize`)
    const p = { client_id: CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', code_challenge: await challengeOf(verifier), code_challenge_method: 'S256', state, menubar: 'true' }
    if (kind) p.prompt = kind
    if (kind === 'load_tone' && toneId) p.tone_id = String(toneId)
    if (kind) p.architecture = '2'
    if (gears) p.gears = gears
    if (format) p.format = format
    for (const [k, v] of Object.entries(p)) url.searchParams.set(k, v)
    let done
    const promise = new Promise((ok) => { done = ok })
    const w = 480, h = 700, left = Math.max(0, (screen.availWidth - w) / 2), top = Math.max(0, (screen.availHeight - h) / 2)
    const popup = window.open(url.href, 't3k', `popup=yes,width=${w},height=${h},left=${left},top=${top}`)
    if (!popup && desktop) throw new Error('CRBN Rig could not open TONE3000’s window. Try again.')
    if (!popup) {
      // Popups refused: the whole page goes, and /tone3000.html brings the answer back here.
      try { sessionStorage.setItem('crbn-rig/t3k-flow', JSON.stringify({ verifier, state, redirectUri })) } catch { /* lost */ }
      location.assign(url.href)
      return new Promise(() => {})
    }
    const f = { popup, done: null, promise: null }
    flow = f
    f.promise = (async () => {
      // A browser's popup closed by the person: canceled. (The desktop's host says so itself, after any answer.)
      const closed = desktop ? 0 : setInterval(() => { if (popup.closed) setTimeout(() => done(new URLSearchParams('canceled=true')), 300) }, 500)
      const q = await promise
      clearInterval(closed)
      try { if (popup && !popup.closed) popup.close() } catch { /* gone */ }
      return finish(q, { verifier, state, redirectUri })
    })().finally(() => { if (flow === f) flow = null })
    f.done = done
    return f.promise
  }

  /** A callback's query, checked and its code exchanged: { toneId } or { canceled } or throws. */
  async function finish(q, { verifier, state, redirectUri: ru }) {
    const code = q.get('code')
    if (q.get('canceled') === 'true' && !code) return { canceled: true }
    if (q.get('state') !== state) throw new Error('TONE3000’s answer did not match Rig’s question. Try again.')
    if (q.get('error')) { if (q.get('error') === 'access_denied') return { canceled: true }; throw new Error(`TONE3000 said ${q.get('error')}.`) }
    if (!code) return { canceled: true }
    keep(await tokenCall({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: ru }), null)
    try { tokens.user = await call('/user'); saveTokens(tokens) } catch { /* named later */ }
    changed()
    const id = Number(q.get('tone_id'))
    return { toneId: id > 0 ? id : null, canceled: q.get('canceled') === 'true' }
  }

  /** After a full-page sign-in: the answer /tone3000.html left, finished here. Null when there was none. */
  async function resume() {
    let pending = null
    try { pending = JSON.parse(sessionStorage.getItem('crbn-rig/t3k-callback') ?? 'null'); sessionStorage.removeItem('crbn-rig/t3k-callback') } catch { /* none */ }
    let ask = null
    try { ask = JSON.parse(sessionStorage.getItem('crbn-rig/t3k-flow') ?? 'null'); sessionStorage.removeItem('crbn-rig/t3k-flow') } catch { /* none */ }
    if (!pending || !ask) return null
    return finish(new URLSearchParams(pending), ask)
  }

  // ---------------------------------------------------------------- what Rig asks for
  /** All of a tone's models Rig can play, every architecture it has (A2 is hidden unless asked for). */
  async function modelsOf(tone) {
    const archs = tone.format === 'ir' ? ['2'] : [tone.a2_models_count > 0 && '2', tone.a1_models_count > 0 && '1', tone.custom_models_count > 0 && 'custom'].filter(Boolean)
    if (!archs.length) archs.push('2')
    const out = []
    for (const a of archs) {
      const r = await call('/models', { tone_id: tone.id, architecture: a, page: 1, page_size: 100 })
      out.push(...(r?.data ?? []))
    }
    return out.filter((m, i) => out.findIndex((x) => x.id === m.id) === i)
  }

  return {
    get signedIn() { return Boolean(tokens) },
    get user() { return tokens?.user ?? null },
    get base() { return base },
    redirectUri,
    onCallback,
    prompt,
    resume,
    /** Signs out of TONE3000 in Rig: forgets the tokens and who it was. TONE3000 has no call to revoke them. */
    signOut() { end() },
    /** The person: { username, display_name, avatar_url, url }. */
    async me() { const u = await call('/user'); if (tokens) { tokens.user = u; saveTokens(tokens) } changed(); return u },
    /** One of the person's lists: 'favorited', 'created', 'downloaded' (paged), or 'trending', 'latest' (ten). */
    async list(kind, { page = 1, pageSize = 24, gear = '', query = '' } = {}) {
      if (kind === 'trending') return { ...(await call('/tones/trending', { gear })), page: 1, total_pages: 1 }
      if (kind === 'latest') return { ...(await call('/tones/latest')), page: 1, total_pages: 1 }
      return call(`/tones/${kind}`, { page, page_size: pageSize, gear, query })
    },
    /** TONE3000's search, NAM and IR only (A2 included). */
    search({ query = '', page = 1, gears = '', format = '', sort = '' } = {}) {
      return call('/tones/search', { query, page, page_size: 25, gears, format, sort, architecture: format === 'ir' ? '' : '2' })
    },
    tone(id) { return call(`/tones/${id}`, { architecture: '2' }) },
    models: modelsOf,
    /** Hearts a tone on TONE3000, or takes the heart away. */
    async favorite(id, on) { await call(`/tones/${id}/favorite`, {}, on ? 'PUT' : 'DELETE'); return on },
    /** A model's file, asked for by the person: its bytes. */
    async download(model) {
      const u = new URL(model.model_url, SITE)
      const path = u.pathname.replace(/^\/api\/v1/, '') + u.search
      const r = await call(path, {}, 'GET', true)
      return new Uint8Array(await r.arrayBuffer())
    },
  }
}
