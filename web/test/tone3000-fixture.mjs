// A recorded TONE3000 for Rig's checks (build plan R8, docs/R8-TONE3000.md): TONE3000 has no sandbox, and Rig's tests
// never call it. This answers as its API does (https://www.tone3000.com/api, the shapes in its docs' Types, checked
// against live answers on 2026-11-15), for made-up tones by made-up creators, with NAM Core's example captures and a
// generated IR as the files. web/check.mjs serves it under /__t3k; the page is pointed at it with ?t3k=/__t3k.
//
// It is strict where Rig must be right: PKCE S256 is checked on the token exchange, every call but sign-in needs the
// bearer token, a model's file needs it too, an omitted `architecture` hides A2 models (as TONE3000 does), and every
// call is logged so the self-test can count them.
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const CLIENT_ID = 't3k_pub_J6MuMOba14a05Nl3Luf4Mp1Zj7Ik7oPi'
const LIVE = 'https://www.tone3000.com/api/v1'

/** A short cabinet IR: 48 kHz, 16-bit, mono, 4,800 samples of a decaying click. */
function cabIR() {
  const n = 4800, b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.exp(-i / 300) * Math.cos(i / 3) * 20000 * (i === 0 ? 1 : 0.6)), 44 + i * 2)
  return b
}

export function createTone3000Fixture(root) {
  const ex = (f) => readFileSync(join(root, 'NeuralAmpModelerCore', 'example_models', f))
  const FILES = { 'a2.nam': ex('A2.nam'), 'wavenet.nam': ex('wavenet.nam'), 'lstm.nam': ex('lstm.nam'), 'cab.wav': cabIR() }
  const me = { id: 77, username: 'rig-tester', display_name: null, is_verified: false, avatar_url: null, url: 'https://www.tone3000.com/rig-tester', bio: null, links: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
  const maker = { id: 501, username: 'made-up-maker', display_name: 'Made-Up Maker', is_verified: true, avatar_url: null, url: 'https://www.tone3000.com/made-up-maker' }
  const other = { id: 502, username: 'another_capturer', display_name: null, is_verified: false, avatar_url: null, url: 'https://www.tone3000.com/another_capturer' }
  const tone = (id, title, gear, format, user, counts, extra = {}) => ({
    id, user_id: user.id, user, title, description: `${title}: a made-up tone for CRBN Rig's checks.\nSecond line.`, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    published_at: '2026-10-01T00:00:00Z', images: null, is_public: true, links: null, license: extra.license ?? 'cc-by', sizes: ['standard'], makes: [{ id: 1, name: 'Testmaker 50' }], tags: [{ id: 2, name: 'test' }],
    models_count: 0, a1_models_count: counts.a1 ?? 0, a2_models_count: counts.a2 ?? 0, custom_models_count: 0, irs_count: counts.ir ?? 0,
    downloads_count: 1234, favorites_count: 56, is_favorite: false, url: `https://www.tone3000.com/tones/test-${id}`, format, gear, ...extra,
  })
  const TONES = [
    tone(9001, 'Made-Up Plexi Crunch', 'amp-cab', 'nam', maker, { a1: 1, a2: 1 }),
    tone(9002, 'Made-Up Green Drive', 'pedal', 'nam', other, { a1: 1 }, { license: 't3k' }),
    tone(9003, 'Made-Up 4x12 Cab', 'cab', 'ir', maker, { ir: 1 }),
    tone(9004, 'Made-Up Bass Head', 'amp', 'nam', other, { a2: 1 }),
    tone(9005, 'Made-Up Snapshot', 'amp', 'aa-snapshot', other, {}),
  ]
  const MODELS = [
    { id: 81, tone_id: 9001, name: 'Plexi A2 Standard', file: 'a2.nam', size: 'standard', architecture_version: '2' },
    { id: 82, tone_id: 9001, name: 'Plexi A1 Standard', file: 'wavenet.nam', size: 'standard', architecture_version: '1' },
    { id: 83, tone_id: 9002, name: 'Green Drive', file: 'wavenet.nam', size: 'standard', architecture_version: '1' },
    { id: 84, tone_id: 9003, name: '4x12 SM57', file: 'cab.wav', size: null, architecture_version: null },
    { id: 85, tone_id: 9004, name: 'Bass Head A2', file: 'a2.nam', size: 'standard', architecture_version: '2' },
  ]
  const modelOf = (m) => ({
    id: m.id, tone_id: m.tone_id, user_id: 501, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', name: m.name, size: m.size,
    architecture_version: m.architecture_version, content_hash: null, metadata: null,
    model_url: `${LIVE}/models/${m.id}/download/${m.file === 'cab.wav' ? '0f0f0f0f-0000-4000-8000-000000000084.wav' : `0f0f0f0f-0000-4000-8000-0000000000${m.id}.nam`}`,
  })

  const codes = new Map(), access = new Map(), refresh = new Set()
  const favorites = new Set(), downloaded = new Set(), log = []
  let n = 0
  const b64url = (b) => Buffer.from(b).toString('base64url')
  const send = (res, status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }).end(body === undefined ? '' : JSON.stringify(body)) }
  const page = (list, q) => {
    const size = Math.min(Number(q.get('page_size') ?? 10) || 10, 100), p = Math.max(1, Number(q.get('page') ?? 1) || 1)
    return { data: list.slice((p - 1) * size, p * size), page: p, page_size: size, total: list.length, total_pages: Math.max(1, Math.ceil(list.length / size)) }
  }
  const view = (t) => ({ ...t, is_favorite: favorites.has(t.id), models_count: t.format === 'ir' ? t.irs_count : t.a1_models_count + t.a2_models_count })
  const byGear = (list, q) => { const g = q.get('gear'); return g ? list.filter((t) => t.gear === g) : list }

  function tokens() {
    const at = `at-${++n}-${randomBytes(6).toString('hex')}`, rt = `rt-${n}-${randomBytes(6).toString('hex')}`
    access.set(at, Date.now() + 3600e3); refresh.add(rt)
    return { access_token: at, refresh_token: rt, token_type: 'bearer', expires_in: 3600 }
  }

  /** Answers a request whose path starts with /__t3k; false when it is not one. */
  function handle(req, res, path, body) {
    if (!path.startsWith('/__t3k')) return false
    const url = new URL(req.url, `http://${req.headers.host}`)
    const p = path.slice('/__t3k'.length) || '/', q = url.searchParams
    if (p === '/log') { send(res, 200, log); return true }
    log.push({ method: req.method, path: p, query: Object.fromEntries(q), at: Date.now() })

    if (p === '/oauth/authorize') {
      // As TONE3000's page does once the person is signed in and has picked: straight back with a code.
      const redirect = q.get('redirect_uri') ?? ''
      const ok = q.get('client_id') === CLIENT_ID && q.get('response_type') === 'code' && q.get('code_challenge_method') === 'S256' && /^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge') ?? '') && q.get('state')
      const loopback = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(redirect)
      if (!loopback) { send(res, 400, { error: 'invalid_request', error_description: 'redirect_uri' }); return true }
      const back = new URL(redirect)
      back.searchParams.set('state', q.get('state') ?? '')
      if (!ok) back.searchParams.set('error', 'invalid_request')
      else {
        const code = `code-${randomBytes(8).toString('hex')}`
        codes.set(code, { challenge: q.get('code_challenge'), redirect })
        back.searchParams.set('code', code)
        if (q.get('prompt') === 'select_tone') back.searchParams.set('tone_id', String((q.get('gears') ?? '').includes('cab') ? 9003 : 9001))
        if (q.get('prompt') === 'load_tone') back.searchParams.set('tone_id', q.get('tone_id') ?? '')
      }
      res.writeHead(302, { location: back.href }).end()
      return true
    }
    if (p === '/oauth/token' && req.method === 'POST') {
      const f = new URLSearchParams(body.toString())
      if (f.get('client_id') !== CLIENT_ID) { send(res, 401, { error: 'invalid_client' }); return true }
      if (f.get('grant_type') === 'authorization_code') {
        const c = codes.get(f.get('code') ?? '')
        codes.delete(f.get('code') ?? '')
        const proof = b64url(createHash('sha256').update(f.get('code_verifier') ?? '').digest())
        if (!c || c.challenge !== proof || c.redirect !== f.get('redirect_uri')) { send(res, 400, { error: 'invalid_grant' }); return true }
        send(res, 200, tokens()); return true
      }
      if (f.get('grant_type') === 'refresh_token') {
        const rt = f.get('refresh_token') ?? ''
        if (!refresh.delete(rt)) { send(res, 400, { error: 'invalid_grant' }); return true }
        send(res, 200, tokens()); return true
      }
      send(res, 400, { error: 'unsupported_grant_type' }); return true
    }

    const at = (req.headers.authorization ?? '').replace(/^Bearer /, '')
    if (!access.has(at) || access.get(at) < Date.now()) { send(res, 401, { error: 'unauthorized' }); return true }
    let m
    if (p === '/user') send(res, 200, me)
    else if ((m = /^\/tones\/(favorited|downloaded|created)$/.exec(p))) {
      const set = m[1] === 'favorited' ? favorites : m[1] === 'downloaded' ? downloaded : new Set()
      send(res, 200, page(byGear(TONES.filter((t) => set.has(t.id)), q).map(view), q))
    } else if (p === '/tones/trending') send(res, 200, { data: byGear(TONES.filter((t) => t.format !== 'aa-snapshot'), q).map(view) })
    else if (p === '/tones/latest') send(res, 200, { data: [...TONES].reverse().map(view) })
    else if (p === '/tones/search') {
      const words = (q.get('query') ?? '').toLowerCase().split(/\s+/).filter(Boolean), gears = (q.get('gears') ?? '').split('_').filter(Boolean)
      const list = TONES.filter((t) => words.every((w) => t.title.toLowerCase().includes(w)) && (!gears.length || gears.includes(t.gear)) && (!q.get('format') || t.format === q.get('format')) && (q.get('architecture') === '2' || t.a2_models_count === 0 || t.a1_models_count > 0))
      send(res, 200, page(list.map(view), new URLSearchParams({ ...Object.fromEntries(q), page_size: String(Math.min(25, Number(q.get('page_size') ?? 10))) })))
    } else if ((m = /^\/tones\/(\d+)\/favorite$/.exec(p))) {
      const id = Number(m[1])
      if (req.method === 'PUT') { favorites.add(id); send(res, 200, { id: 1, tone_id: id, user_id: '77', created_at: new Date().toISOString() }) } else if (req.method === 'DELETE') { favorites.delete(id); res.writeHead(204).end() } else send(res, 405, {})
    } else if ((m = /^\/tones\/(\d+)$/.exec(p))) {
      const t = TONES.find((x) => x.id === Number(m[1]))
      if (t) send(res, 200, view(t)); else send(res, 404, { error: 'not_found' })
    } else if (p === '/models') {
      const arch = q.get('architecture')
      const list = MODELS.filter((x) => x.tone_id === Number(q.get('tone_id')) && (x.architecture_version === null || (arch ? x.architecture_version === arch : x.architecture_version !== '2')))
      send(res, 200, page(list.map(modelOf), new URLSearchParams({ ...Object.fromEntries(q), page_size: String(Math.min(300, Number(q.get('page_size') ?? 10))) })))
    } else if ((m = /^\/models\/(\d+)\/download\/[0-9a-f-]+\.(nam|wav)$/.exec(p))) {
      const x = MODELS.find((y) => y.id === Number(m[1]))
      if (!x) { send(res, 404, {}); return true }
      downloaded.add(x.tone_id)
      res.writeHead(200, { 'content-type': x.file.endsWith('.wav') ? 'audio/wav' : 'application/json' }).end(FILES[x.file])
    } else send(res, 404, { error: 'not_found' })
    return true
  }
  return { handle, log, favorites, downloaded, TONES, MODELS }
}
