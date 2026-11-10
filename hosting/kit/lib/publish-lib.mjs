/**
 * The pure parts of publish.mjs and stage.mjs: the config, content types, the file walk, the
 * build id, the upload plan and the bucket's key layout. The network lives in r2.mjs; the Worker
 * that serves the bucket is worker/build-host.mjs, and the key layout below is the contract
 * between them:
 *
 *   builds/<build-id>/…        every file of an artifact, uploaded whole
 *   published/<build-id>.json  written LAST, once every file is verified — a build without it is partial
 *   current.json               { "build": "<build-id>", … } — the pointer the Worker serves
 *
 * The upload plan, verification, retry and concurrency helpers are wonderman-web-toolkit
 * `scripts/lib/publish.mjs` (fa14f46) unchanged. The gate is new: the toolkit's reads Wonderman's
 * build log; this one reads git and the project's own build and check commands.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, normalize, relative } from 'node:path';
import { PREFIX_SHAPE } from '../worker/build-host-lib.mjs';

export { POINTER_KEY } from '../worker/build-host-lib.mjs';
export const buildPrefix = (id) => `builds/${id}/`;
export const markerKey = (id) => `published/${id}.json`;

/** Where publish.mjs and stage.mjs look for the project's config, relative to the repo root. */
export const DEFAULT_CONFIG = 'hosting/publish.json';

// ─────────────────────────────────────────────────────────────────────── config

const FIELDS = ['//', 'bucket', 'url', 'prefix', 'artifact', 'build', 'check', 'envPrefix', 'endpoint', 'contentTypes', 'stage'];
const LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** `{ config }` or `{ problems }` for the JSON at `path`. Keys starting `//` are comments. */
export function readConfig(path) {
  if (!existsSync(path)) {
    return { problems: [`no config at ${path}. Copy templates/publish.json there and fill it in (RUNBOOK §5).`] };
  }
  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { problems: [`${path} is not valid JSON (${error.message}).`] };
  }
  const problems = configProblems(config);
  return problems.length ? { problems: problems.map((p) => `${path}: ${p}`) } : { config };
}

/** Every problem with a parsed config — empty when it may be used. Pure. */
export function configProblems(config) {
  const problems = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return ['must be a JSON object.'];
  const text = (v) => typeof v === 'string' && v.trim() !== '';
  const unknown = Object.keys(config).filter((k) => !FIELDS.includes(k) && !k.startsWith('//'));
  if (unknown.length) problems.push(`unknown field(s) ${unknown.join(', ')} — known: ${FIELDS.slice(1).join(', ')}.`);
  // The template's `<…>` values, not yet filled in. Checked first and alone: the shape rules below would only restate it.
  const placeholders = Object.entries(config).filter(([k, v]) => !k.startsWith('//') && /<[^<>]+>/.test(JSON.stringify(v))).map(([k]) => k);
  if (placeholders.length) return [...problems, `still holds a template <placeholder> in: ${placeholders.join(', ')}.`];

  // R2's own bucket-name rule: 3–63 of lowercase letters, digits and hyphens, not starting or ending with a hyphen.
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.bucket ?? '')) {
    problems.push('"bucket" must be an R2 bucket name: 3–63 lowercase letters, digits and hyphens.');
  }
  if (!text(config.url) || !(/^https:\/\/[^/\s]+$/.test(config.url) || LOCAL_HTTP.test(config.url))) {
    problems.push('"url" must be the host\'s origin, https://<host> — no path, no trailing slash (a path goes in "prefix").');
  }
  if (config.prefix !== undefined && config.prefix !== '' && !PREFIX_SHAPE.test(config.prefix)) {
    problems.push('"prefix" must be plain path segments like "/pub", and the same string as the Worker\'s PREFIX var.');
  }
  if (!text(config.artifact) || !isInsideRepo(config.artifact)) {
    problems.push('"artifact" must be a folder inside the repo, e.g. "dist" — not ".", not absolute, no "..".');
  }
  for (const field of ['build', 'check']) {
    if (config[field] !== undefined && !text(config[field])) problems.push(`"${field}" must be a shell command, or absent.`);
  }
  if (config.envPrefix !== undefined && !/^[A-Z][A-Z0-9_]*$/.test(config.envPrefix)) {
    problems.push('"envPrefix" must be UPPER_SNAKE, e.g. "PMG_R2" (then PMG_R2_ACCOUNT_ID …), or absent.');
  }
  if (config.endpoint !== undefined && !(/^https:\/\/[^/\s]+$/.test(config.endpoint) || LOCAL_HTTP.test(config.endpoint))) {
    problems.push('"endpoint" must be an origin like https://<account>.eu.r2.cloudflarestorage.com, or absent.');
  }
  if (config.contentTypes !== undefined) {
    const ok = config.contentTypes && typeof config.contentTypes === 'object' && !Array.isArray(config.contentTypes) &&
      Object.entries(config.contentTypes).every(([ext, type]) => /^[a-z0-9]+$/.test(ext) && text(type));
    if (!ok) problems.push('"contentTypes" must map lowercase extensions (no dot) to MIME types, e.g. { "glb": "model/gltf-binary" }.');
  }
  if (config.stage !== undefined) {
    const s = config.stage;
    const list = (v) => Array.isArray(v) && v.every((p) => text(p) && isInsideRepo(p));
    if (!s || typeof s !== 'object' || !list(s.include) || s.include.length === 0) {
      problems.push('"stage.include" must be a non-empty list of repo-relative paths (files or folders).');
    } else if (s.exclude !== undefined) {
      // A `*` anywhere but the `*.ext` form is a glob this filter does not do: `art/*.psd` would match nothing, silently.
      const rule = (p) => text(p) && (/^\*\.[A-Za-z0-9]+$/.test(p) || (!p.includes('*') && isInsideRepo(p)));
      if (!(Array.isArray(s.exclude) && s.exclude.every(rule))) {
        problems.push('"stage.exclude" entries are repo-relative paths, or "*.ext" for an extension anywhere — no other globs.');
      }
    }
  }
  return problems;
}

/**
 * stage.mjs's filter: does a repo-relative, forward-slashed path survive? Any segment starting with
 * "." and any node_modules are always out; then each `exclude` rule — a path (itself and anything
 * under it) or `*.ext` (that extension anywhere, any case).
 */
export function keepStaged(rel, exclude = []) {
  if (rel.split('/').some((s) => s.startsWith('.') || s === 'node_modules')) return false;
  for (const rule of exclude) {
    if (rule.startsWith('*.')) {
      if (rel.toLowerCase().endsWith(rule.slice(1).toLowerCase())) return false;
    } else {
      const r = rule.replaceAll('\\', '/').replace(/\/+$/, '');
      if (rel === r || rel.startsWith(`${r}/`)) return false;
    }
  }
  return true;
}

/** A repo-relative path that stays inside the repo and is not the repo itself. */
export function isInsideRepo(p) {
  if (typeof p !== 'string' || isAbsolute(p) || /^[A-Za-z]:/.test(p)) return false;
  const n = normalize(p).replaceAll('\\', '/').replace(/\/+$/, '');
  return n !== '' && n !== '.' && n !== '..' && !n.startsWith('../');
}

// ─────────────────────────────────────────────────────────────── content types

/** Content types by extension, lower-cased. An extension not here (or in config.contentTypes) stops the upload: guessing is how a .js is served as text/plain. */
export const CONTENT_TYPES = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  cjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  webmanifest: 'application/manifest+json',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  xml: 'application/xml',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  psd: 'image/vnd.adobe.photoshop',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  wasm: 'application/wasm',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  gz: 'application/gzip',
  zip: 'application/zip',
  bin: 'application/octet-stream',
};

const own = (o, k) => (Object.hasOwn(o, k) ? o[k] : undefined);

export const contentTypeFor = (file, extra = {}) => {
  const ext = extname(file).slice(1).toLowerCase();
  return own(extra, ext) ?? own(CONTENT_TYPES, ext);
};

/** Files whose extension has no content type — each named, so the fix is one line in config.contentTypes. */
export function untypedFiles(files, extra = {}) {
  return files.filter((f) => !contentTypeFor(f.rel, extra)).map((f) => f.rel);
}

// ─────────────────────────────────────────────────────────────── files and ids

/**
 * Every file under the artifact as `{ path, rel, size }`, `rel` with forward slashes — the key
 * under the build's prefix and the URL path the Worker serves it at. Follows directory links
 * (statSync), so a junction inside an artifact is uploaded rather than silently skipped.
 */
export function walkArtifact(dir) {
  const files = [];
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) files.push({ path, rel: relative(dir, path).replaceAll('\\', '/'), size: stat.size });
    }
  };
  walk(dir);
  return files.sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

/** `{ md5hex, md5b64 }` of a file's bytes. R2 verifies a PUT against Content-MD5 and reports it back as the ETag. */
export function md5Of(path) {
  const digest = createHash('md5').update(readFileSync(path)).digest();
  return { md5hex: digest.toString('hex'), md5b64: digest.toString('base64') };
}

/**
 * A build's id in the bucket: `<commit time, UTC>-<commit>-<content>`, e.g.
 * `20260928-0130-6dc1dce-3f9a0b12`. The time sorts `--list` chronologically; the commit says where
 * it came from; the content hash (every file's path and MD5) means one id names exactly ONE
 * artifact. Re-publishing identical bytes lands on the same id and resumes; different bytes from
 * the same commit get a new id and can never overwrite a build that is being served.
 */
export function buildIdFor({ commitEpoch, commit, files }) {
  const t = new Date(commitEpoch * 1000).toISOString(); // 2026-09-28T01:30:00.000Z
  const when = `${t.slice(0, 4)}${t.slice(5, 7)}${t.slice(8, 10)}-${t.slice(11, 13)}${t.slice(14, 16)}`;
  const content = createHash('sha256');
  for (const f of [...files].sort((a, b) => (a.rel < b.rel ? -1 : 1))) content.update(`${f.rel}\t${f.md5hex}\n`);
  return `${when}-${commit}-${content.digest('hex').slice(0, 8)}`;
}

// ─────────────────────────────────────────────────────────────── the upload plan

/**
 * What an upload must still send, given what the bucket already holds under the prefix — so a
 * run that died halfway resumes rather than restarts. A file is skipped only when its bytes are
 * provably there (same size AND same MD5); anything under the prefix the artifact does not have
 * is `stray`, which means the prefix is not this artifact's and nothing may be trusted.
 */
export function planUpload(files, existing, prefix) {
  const have = new Map(existing.map((o) => [o.key, o]));
  const toSend = [];
  let skipped = 0;
  const wanted = new Set();
  for (const file of files) {
    const key = prefix + file.rel;
    wanted.add(key);
    const there = have.get(key);
    if (there && there.size === file.size && there.etag === file.md5hex) skipped++;
    else toSend.push({ ...file, key });
  }
  const stray = existing.filter((o) => !wanted.has(o.key)).map((o) => o.key);
  return { toSend, skipped, stray };
}

/**
 * After the upload, the bucket must hold every file, byte for byte. Returns the problems — an
 * empty list is the only thing that allows the completion marker to be written.
 */
export function verifyUpload(files, listed, prefix) {
  const { toSend, stray } = planUpload(files, listed, prefix);
  const problems = toSend.slice(0, 10).map((f) => `${f.key} is missing or differs from the artifact`);
  if (toSend.length > 10) problems.push(`…and ${toSend.length - 10} more`);
  for (const key of stray.slice(0, 10)) problems.push(`${key} is in the bucket but not in the artifact`);
  return problems;
}

/** Runs `task` over `items`, `limit` at a time; the first failure rejects after in-flight tasks settle. */
export async function eachLimited(items, limit, task) {
  let next = 0;
  let failure = null;
  const worker = async () => {
    while (failure === null && next < items.length) {
      const item = items[next++];
      try {
        await task(item);
      } catch (error) {
        failure ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw failure;
}

/** Retries a flaky network call: 3 attempts, 1 s then 3 s apart. */
export async function withRetry(fn, { attempts = 3, delays = [1000, 3000], sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts) throw error;
      await sleep(delays[i - 1] ?? delays.at(-1));
    }
  }
}
