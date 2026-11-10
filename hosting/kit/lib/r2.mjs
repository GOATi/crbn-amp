/**
 * A minimal Cloudflare R2 client over its S3 API — PUT, GET and ListObjectsV2, signed with AWS
 * Signature V4 on `node:crypto` and `fetch`. No dependencies.
 *
 * Ported from wonderman-web-toolkit `scripts/lib/r2.mjs` (fa14f46). The signer and the client are
 * unchanged; what changed is where credentials come from, because a kit shared between projects
 * cannot hard-code one project's variable names, and an R2 token is scoped to ONE bucket:
 *
 *   %USERPROFILE%\.r2\<bucket>.json   { "accountId", "accessKeyId", "secretAccessKey",
 *                                       "accessClientId"?, "accessClientSecret"? }
 *   <PREFIX>_ACCOUNT_ID, <PREFIX>_ACCESS_KEY_ID, <PREFIX>_SECRET_ACCESS_KEY,
 *   <PREFIX>_ACCESS_CLIENT_ID, <PREFIX>_ACCESS_CLIENT_SECRET
 *
 * The environment is read ONLY when the project's publish.json names an `envPrefix`, and then it
 * wins field by field. With no prefix, a variable set for some other project can never leak in.
 * The two `accessClient*` fields are optional: a Cloudflare Access service token, sent on the
 * publish script's own probes of the host when the host sits behind Access (RUNBOOK §6).
 *
 * Credentials never appear in config, logs or errors. A problem names fields, variables and the
 * file — never a value.
 */
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where a bucket's credentials live on this PC — outside every repo, and never on a synced drive. */
export const credentialsFile = (bucket, home = homedir()) => join(home, '.r2', `${bucket}.json`);

const REQUIRED = { accountId: 'ACCOUNT_ID', accessKeyId: 'ACCESS_KEY_ID', secretAccessKey: 'SECRET_ACCESS_KEY' };
const OPTIONAL = { accessClientId: 'ACCESS_CLIENT_ID', accessClientSecret: 'ACCESS_CLIENT_SECRET' };

/**
 * `{ credentials }` or `{ problem }`. `credentials` always has the three R2 fields and has the two
 * Access fields only when BOTH are present.
 */
export function readCredentials({ bucket, envPrefix, env = process.env, file = credentialsFile(bucket) }) {
  let fromFile = {};
  if (existsSync(file)) {
    try {
      fromFile = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      return { problem: `${file} is not valid JSON (${error.message}).` };
    }
  }
  const pick = (field, suffix) => {
    const value = (envPrefix && env[`${envPrefix}_${suffix}`]) || fromFile[field];
    return typeof value === 'string' && value.trim() && !value.includes('<') ? value.trim() : null;
  };
  const credentials = {};
  const missing = [];
  for (const [field, suffix] of Object.entries(REQUIRED)) {
    const value = pick(field, suffix);
    if (value) credentials[field] = value;
    else missing.push(field);
  }
  if (missing.length) {
    const vars = envPrefix ? `\n    or set ${missing.map((f) => `${envPrefix}_${REQUIRED[f]}`).join(', ')} in the environment` : '';
    return {
      problem:
        `no R2 credentials for bucket "${bucket}": missing ${missing.join(', ')}.\n` +
        `    Write them to ${file} as { "accountId", "accessKeyId", "secretAccessKey" }${vars}.\n` +
        `    (A value still holding a <placeholder> counts as missing.) The token is an R2 API token with\n` +
        `    Object Read & Write on this bucket only — RUNBOOK §4.`,
    };
  }
  const id = pick('accessClientId', OPTIONAL.accessClientId);
  const secret = pick('accessClientSecret', OPTIONAL.accessClientSecret);
  if (id && secret) Object.assign(credentials, { accessClientId: id, accessClientSecret: secret });
  return { credentials };
}

const sha256hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding, as SigV4 requires: encodeURIComponent plus !'()*. */
export const uriEncode = (s) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** An object key as a URL path: each segment encoded, the slashes kept. */
export const encodeKey = (key) => key.split('/').map(uriEncode).join('/');

/**
 * The SigV4 `Authorization` header for one request. Pure: the clock and every input are
 * arguments, so AWS's published example pins it byte for byte (test/r2.test.mjs).
 *
 * `path` is already encoded; `query` is a plain object; `headers` must include `host`,
 * `x-amz-date` and `x-amz-content-sha256` — every header given is signed.
 */
export function signV4({ method, path, query = {}, headers, payloadHash, accessKeyId, secretAccessKey, region, service, amzDate }) {
  const date = amzDate.slice(0, 8);
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(String(query[k]))}`)
    .join('&');
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonicalHeaders = names.map((h) => `${h}:${lower[h]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), service), 'aws4_request');
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/** `20260926T010203Z` */
const amzDateNow = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * A client for one bucket. `endpoint` defaults to the account's R2 endpoint; publish.json may
 * override it (an EU-jurisdiction bucket is `https://<account>.eu.r2.cloudflarestorage.com`, and
 * the kit's own end-to-end test points it at a local fake). `fetchImpl` is injectable for tests.
 */
export function r2Client({ credentials, bucket, endpoint, fetchImpl = fetch }) {
  const origin = (endpoint ?? `https://${credentials.accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, '');
  const host = new URL(origin).host;

  async function request(method, key, { query = {}, body, headers = {} } = {}) {
    const path = `/${bucket}` + (key === undefined ? '' : `/${encodeKey(key)}`);
    const payloadHash = sha256hex(body ?? '');
    const amzDate = amzDateNow();
    const signed = { host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, ...headers };
    const authorization = signV4({
      method, path, query, headers: signed, payloadHash,
      accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey,
      region: 'auto', service: 's3', amzDate,
    });
    const qs = new URLSearchParams(query).toString();
    const { host: _host, ...sent } = signed; // fetch sets Host itself
    return fetchImpl(`${origin}${path}${qs ? `?${qs}` : ''}`, {
      method,
      headers: { ...sent, authorization },
      body,
    });
  }

  async function failed(res, what) {
    const text = await res.text().catch(() => '');
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
    return new Error(`${what}: HTTP ${res.status}${code ? ` ${code}` : ''}`);
  }

  return {
    bucket,

    /** PUT one object. `md5` (base64) makes R2 verify the bytes it stored. */
    async put(key, body, { contentType, md5 } = {}) {
      const headers = { 'content-type': contentType ?? 'application/octet-stream' };
      if (md5) headers['content-md5'] = md5;
      const res = await request('PUT', key, { body, headers });
      if (!res.ok) throw await failed(res, `PUT ${key}`);
      return res.headers.get('etag');
    },

    /** The object's body as text, or null when there is no such key. */
    async getText(key) {
      const res = await request('GET', key);
      if (res.status === 404) return null;
      if (!res.ok) throw await failed(res, `GET ${key}`);
      return res.text();
    },

    /** Every object under `prefix` as `{ key, size, etag }` — ListObjectsV2, paged. */
    async list(prefix) {
      const objects = [];
      let token;
      do {
        const query = { 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) };
        const res = await request('GET', undefined, { query });
        if (!res.ok) throw await failed(res, `LIST ${prefix}`);
        const xml = await res.text();
        for (const [, body] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const field = (name) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(body)?.[1] ?? '';
          objects.push({
            key: decodeXml(field('Key')),
            size: Number(field('Size')),
            etag: decodeXml(field('ETag')).replaceAll('"', ''),
          });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
          ? decodeXml(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '')
          : undefined;
      } while (token);
      return objects;
    },
  };
}

const decodeXml = (s) =>
  s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e]);
