import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker/build-host.mjs';
import {
  buildIdFor, configProblems, contentTypeFor, eachLimited, isInsideRepo, keepStaged, planUpload, untypedFiles,
  verifyUpload, withRetry,
} from '../lib/publish-lib.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOOD = { bucket: 'pmg-dev', url: 'https://pmg.example.com', artifact: 'dist' };

// ─────────────────────────────────────────────────────────────── the config

test('config: a minimal config is valid; every field is checked and each problem says what is wanted', () => {
  assert.deepEqual(configProblems(GOOD), []);
  assert.deepEqual(configProblems({ ...GOOD, '//': 'a comment', '//why': 'another', prefix: '/pub', envPrefix: 'PMG_R2', build: 'x', check: 'y', contentTypes: { glb: 'model/gltf-binary' }, stage: { include: ['index.html'], exclude: ['*.psd', 'art/source'] } }), []);
  const one = (patch, re) => {
    const problems = configProblems({ ...GOOD, ...patch });
    assert.equal(problems.length, 1, `${JSON.stringify(patch)} → ${problems.join(' | ')}`);
    assert.match(problems[0], re);
  };
  one({ bucket: 'PMG_dev' }, /"bucket"/);
  one({ bucket: 'ab' }, /"bucket"/);
  one({ url: 'https://pmg.example.com/' }, /"url"/);
  one({ url: 'https://pmg.example.com/pub' }, /"url".*prefix/);
  one({ url: 'http://pmg.example.com' }, /"url"/);
  one({ prefix: '/../x' }, /"prefix"/);
  one({ artifact: '.' }, /"artifact"/);
  one({ artifact: '../elsewhere' }, /"artifact"/);
  one({ artifact: 'C:/dist' }, /"artifact"/);
  one({ envPrefix: 'pmg' }, /"envPrefix"/);
  one({ contentTypes: { '.glb': 'x' } }, /"contentTypes"/);
  one({ stage: { include: [] } }, /"stage\.include"/);
  one({ stage: { include: ['a'], exclude: ['*.p s d'] } }, /"stage\.exclude"/);
  one({ stage: { include: ['a'], exclude: ['art/*.psd'] } }, /no other globs/);
  one({ buckets: 'typo' }, /unknown field\(s\) buckets/);
  one({ bucket: '<project>-dev', check: '<a command>' }, /template <placeholder> in: bucket, check/);
  // The shipped template is exactly that: valid JSON, every field known, refused until it is filled in.
  const template = JSON.parse(readFileSync(join(KIT, 'templates', 'publish.json'), 'utf8'));
  assert.deepEqual(configProblems(template).filter((p) => !/placeholder/.test(p)), []);
  assert.match(configProblems(template).join(), /placeholder/);
  assert.deepEqual(configProblems({ ...GOOD, url: 'http://127.0.0.1:8123' }), []); // a local host, for tests
});

test('isInsideRepo: relative and inside, never the repo itself', () => {
  for (const p of ['dist', 'dist/', 'a/b', 'a/../b']) assert.ok(isInsideRepo(p), p);
  for (const p of ['.', './', '..', '../x', 'a/../../x', '/abs', 'C:\\x', 'D:/x', '']) assert.ok(!isInsideRepo(p), p);
});

// ─────────────────────────────────────────────────────────────── files and ids

test('stage filter: dot segments and node_modules are always out; exclusions are a path and what is under it, or *.ext', () => {
  const ex = ['art/source', '*.PSD'];
  assert.ok(keepStaged('index.html', ex));
  assert.ok(keepStaged('art/a.png', ex));
  assert.ok(keepStaged('art/sources.png', ex)); // a path rule is a segment, not a string prefix
  assert.ok(!keepStaged('art/source', ex));
  assert.ok(!keepStaged('art/source/x.png', ex));
  assert.ok(!keepStaged('art/b.psd', ex));
  assert.ok(!keepStaged('.env', ex));
  assert.ok(!keepStaged('editor/server/.publish-store.json', ex));
  assert.ok(!keepStaged('editor/node_modules/x.js', ex));
});

test('content types: the built-ins, the config\'s extras, and nothing guessed', () => {
  assert.equal(contentTypeFor('a/b.JS'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('m.glb'), 'model/gltf-binary');
  assert.equal(contentTypeFor('x.unity3d'), undefined);
  assert.equal(contentTypeFor('x.unity3d', { unity3d: 'application/octet-stream' }), 'application/octet-stream');
  assert.equal(contentTypeFor('x.constructor'), undefined); // not Object.prototype's
  assert.deepEqual(untypedFiles([{ rel: 'a.png' }, { rel: 'b.unity3d' }, { rel: 'NOEXT' }]), ['b.unity3d', 'NOEXT']);
});

test('buildIdFor: commit time (UTC) · commit · content — deterministic, and different bytes are a different id', () => {
  const files = [{ rel: 'index.html', md5hex: 'aa' }, { rel: 'a.js', md5hex: 'bb' }];
  const id = buildIdFor({ commitEpoch: Date.UTC(2026, 8, 28, 1, 30) / 1000, commit: '6dc1dce', files });
  assert.match(id, /^20260928-0130-6dc1dce-[0-9a-f]{8}$/);
  assert.equal(buildIdFor({ commitEpoch: Date.UTC(2026, 8, 28, 1, 30) / 1000, commit: '6dc1dce', files: [...files].reverse() }), id);
  assert.notEqual(buildIdFor({ commitEpoch: Date.UTC(2026, 8, 28, 1, 30) / 1000, commit: '6dc1dce', files: [files[0], { rel: 'a.js', md5hex: 'cc' }] }), id);
});

test('planUpload resumes: a file is skipped only when size AND md5 match; a stray key is reported', () => {
  const files = [
    { rel: 'index.html', size: 3, md5hex: 'aaa' },
    { rel: 'a.js', size: 5, md5hex: 'bbb' },
    { rel: 'b.js', size: 5, md5hex: 'ccc' },
  ];
  const existing = [
    { key: 'p/index.html', size: 3, etag: 'aaa' }, // identical → skipped
    { key: 'p/a.js', size: 5, etag: 'zzz' },       // same size, other bytes → resent
    { key: 'p/old.js', size: 1, etag: 'x' },       // not in the artifact → stray
  ];
  const plan = planUpload(files, existing, 'p/');
  assert.equal(plan.skipped, 1);
  assert.deepEqual(plan.toSend.map((f) => f.key), ['p/a.js', 'p/b.js']);
  assert.deepEqual(plan.stray, ['p/old.js']);
  assert.deepEqual(verifyUpload(files, files.map((f) => ({ key: `p/${f.rel}`, size: f.size, etag: f.md5hex })), 'p/'), []);
  assert.equal(verifyUpload(files, existing, 'p/').length, 3);
});

test('eachLimited never exceeds its limit and surfaces the first failure; withRetry gives up after its attempts', async () => {
  let running = 0;
  let peak = 0;
  await eachLimited([1, 2, 3, 4, 5, 6, 7], 3, async () => {
    peak = Math.max(peak, ++running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
  });
  assert.equal(peak, 3);
  await assert.rejects(eachLimited([1, 2, 3], 2, async (n) => { if (n === 2) throw new Error('boom'); }), /boom/);
  let calls = 0;
  const sleep = async () => {};
  assert.equal(await withRetry(async () => (++calls < 3 ? Promise.reject(new Error('x')) : 'ok'), { sleep }), 'ok');
  calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw new Error('down'); }, { sleep }), /down/);
  assert.equal(calls, 3);
});

test('neither CLI calls process.exit — on Windows it aborts (exit 127) once fetch has run', () => {
  for (const script of ['publish.mjs', 'stage.mjs']) {
    const code = readFileSync(join(KIT, script), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /process\.exit\s*\(/, script);
    assert.match(code, /process\.exitCode = 1/, script);
  }
});

// ─────────────────────────────────────────────────── a throwaway project repo

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=kit', '-c', 'user.email=kit@example.com', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/**
 * A committed repo laid out as the RUNBOOK sets one up: the kit at hosting/kit/, the config at
 * hosting/publish.json, dist/ gitignored, and a no-build site staged by stage.mjs.
 */
const made = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

function project({ config = {}, files = {}, gitignore = 'dist/\n' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'r2kit-'));
  made.push(dir);
  const home = join(dir, '.home'); // a fake USERPROFILE, inside the repo so one rmdir clears both — dot-named, so staging ignores it
  for (const part of ['lib', 'worker', 'publish.mjs', 'stage.mjs']) cpSync(join(KIT, part), join(dir, 'hosting', 'kit', part), { recursive: true });
  const cfg = {
    bucket: 'pmg-test', url: 'https://host.example', artifact: 'dist', build: 'node hosting/kit/stage.mjs',
    stage: { include: ['index.html', 'game.js', 'art'], exclude: ['art/source', '*.ai'] },
    ...config,
  };
  const all = {
    'hosting/publish.json': JSON.stringify(cfg, null, 2),
    '.gitignore': `${gitignore}.home/\n`,
    'index.html': '<!doctype html><title>v1</title>',
    'game.js': 'console.log(1);',
    'art/a.png': 'PNG-A',
    'art/source/big.psd': 'SOURCE',
    'art/master.ai': 'AI',
    'art/.DS_Store': 'x',
    'secret.txt': 'not listed, never staged',
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    if (text === null) continue;
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return { dir, home };
}

function credentials(home, bucket, extra = {}) {
  mkdirSync(join(home, '.r2'), { recursive: true });
  writeFileSync(join(home, '.r2', `${bucket}.json`), JSON.stringify({ accountId: 'acct', accessKeyId: 'AKTEST', secretAccessKey: 'shh', ...extra }));
}

/** Runs the kit's CLI in the project, asynchronously — the end-to-end test's fake servers live in THIS process. */
function run({ dir, home }, script, ...args) {
  return new Promise((done) => {
    const env = { ...process.env, USERPROFILE: home, HOME: home };
    const child = spawn(process.execPath, [join(dir, 'hosting', 'kit', script), ...args], { cwd: dir, env });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => done({ code, out }));
  });
}

// ─────────────────────────────────────────────────────────────── the gate

test('CLI: a dry run stages, names the id and the file count, and sends nothing', async () => {
  const p = project();
  const { code, out } = await run(p, 'publish.mjs', '--dry-run', '--promote');
  assert.equal(code, 0, out);
  assert.match(out, /staged 3 files/);
  assert.match(out, /→ pmg-test\/builds\/\d{8}-\d{4}-[0-9a-f]{7}-[0-9a-f]{8}\/ {2}3 files/);
  assert.match(out, /Dry run — nothing sent\. Would then promote it at https:\/\/host\.example\/\./);
  // Exactly the allowlist, minus the exclusions and the dot-file.
  assert.ok(existsSync(join(p.dir, 'dist', 'art', 'a.png')));
  for (const gone of ['dist/art/source/big.psd', 'dist/art/master.ai', 'dist/art/.DS_Store', 'dist/secret.txt']) assert.ok(!existsSync(join(p.dir, gone)), gone);
});

test('CLI: a dirty tree is refused before anything builds; a dry run shows the plan AND says it would be refused', async () => {
  const p = project();
  writeFileSync(join(p.dir, 'game.js'), 'console.log(2);');
  const real = await run(p, 'publish.mjs', '--promote');
  assert.equal(real.code, 1);
  assert.match(real.out, /DIRTY/);
  assert.match(real.out, /game\.js/);
  assert.ok(!existsSync(join(p.dir, 'dist')), 'the build never ran');

  const dry = await run(p, 'publish.mjs', '--dry-run');
  assert.equal(dry.code, 1);
  assert.match(dry.out, /3 files/);
  assert.match(dry.out, /A real run would be REFUSED/);
});

test('CLI: an artifact folder that is not gitignored is caught — the build changed the tree', async () => {
  const { code, out } = await run(project({ gitignore: '' }), 'publish.mjs', '--dry-run');
  assert.equal(code, 1);
  assert.match(out, /changed the working tree/);
  assert.match(out, /Gitignore the artifact folder/);
});

test('CLI: an untyped file stops the run and is named; the config can type it', async () => {
  const files = { 'art/level.unity3d': 'U' };
  const bad = await run(project({ files }), 'publish.mjs', '--dry-run');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /no content type/);
  assert.match(bad.out, /art\/level\.unity3d/);
  const ok = await run(project({ files, config: { contentTypes: { unity3d: 'application/octet-stream' } } }), 'publish.mjs', '--dry-run');
  assert.equal(ok.code, 0, ok.out);
});

test('CLI: no index.html at the artifact root is refused', async () => {
  const { code, out } = await run(project({ config: { stage: { include: ['game.js'] } } }), 'publish.mjs', '--dry-run');
  assert.equal(code, 1);
  assert.match(out, /has no index\.html at its root/);
});

test('CLI: a failing check stops the run before any credentials are needed; a passing one moves on to them', async () => {
  const failing = await run(project({ config: { check: 'node -e "process.exitCode = 3"' } }), 'publish.mjs');
  assert.equal(failing.code, 1);
  assert.match(failing.out, /the check failed/);
  assert.doesNotMatch(failing.out, /credentials/);

  // The check sees the artifact it is checking.
  const passing = await run(project({ config: { check: 'node -e "require(\'fs\').accessSync(process.env.ARTIFACT_DIR + \'/index.html\')"' } }), 'publish.mjs');
  assert.equal(passing.code, 1);
  assert.match(passing.out, /no R2 credentials for bucket "pmg-test"/);
  assert.match(passing.out, /\.r2[\\/]pmg-test\.json/);
});

test('CLI: an unknown flag, a positional argument and mixed modes are each refused', async () => {
  const p = project();
  assert.match((await run(p, 'publish.mjs', '--dryrun')).out, /unknown argument: --dryrun/);
  assert.match((await run(p, 'publish.mjs', 'dist')).out, /unknown argument: dist/);
  assert.match((await run(p, 'publish.mjs', '--list', '--promote')).out, /separate runs/);
  assert.match((await run(p, 'publish.mjs', '--list')).out, /no R2 credentials/);
});

test('stage: refuses a tracked artifact folder, a missing include, and an include that overlaps the artifact', async () => {
  const tracked = project({ gitignore: '', files: { 'dist/keep.txt': 'tracked' } });
  const a = await run(tracked, 'stage.mjs');
  assert.equal(a.code, 1);
  assert.match(a.out, /holds files git tracks/);
  assert.equal(readFileSync(join(tracked.dir, 'dist', 'keep.txt'), 'utf8'), 'tracked', 'nothing was wiped');

  const missing = await run(project({ config: { stage: { include: ['index.html', 'nope.js'] } } }), 'stage.mjs');
  assert.match(missing.out, /do not exist: nope\.js/);
  // (dist/ exists on disk but is gitignored, so it is present and untracked — only the overlap is wrong.)
  const overlap = await run(project({ files: { 'dist/x.txt': 'x' }, config: { stage: { include: ['index.html', 'dist'] } } }), 'stage.mjs');
  assert.match(overlap.out, /overlaps the artifact folder/);
});

// ─────────────────────────────────── end to end: a fake R2, the real Worker, the real CLI

/** An S3-shaped R2 on localhost: path-style PUT / GET / ListObjectsV2, Content-MD5 and the payload hash enforced. */
function fakeR2(store) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const [, , ...keyParts] = u.pathname.split('/');
    const key = keyParts.map(decodeURIComponent).join('/');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const bodyHash = createHash('sha256').update(body).digest('hex');
    if (!/^AWS4-HMAC-SHA256 Credential=AKTEST\//.test(req.headers.authorization ?? '') || req.headers['x-amz-content-sha256'] !== bodyHash) {
      res.writeHead(403);
      return res.end('<Error><Code>SignatureDoesNotMatch</Code></Error>');
    }
    if (req.method === 'PUT') {
      const md5 = createHash('md5').update(body).digest();
      if (req.headers['content-md5'] && req.headers['content-md5'] !== md5.toString('base64')) {
        res.writeHead(400);
        return res.end('<Error><Code>BadDigest</Code></Error>');
      }
      store.set(key, { body, type: req.headers['content-type'], etag: md5.toString('hex') });
      res.writeHead(200, { etag: `"${md5.toString('hex')}"` });
      return res.end();
    }
    if (req.method === 'GET' && key === '') {
      const prefix = u.searchParams.get('prefix') ?? '';
      const items = [...store].filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => `<Contents><Key>${esc(k)}</Key><Size>${v.body.length}</Size><ETag>&quot;${v.etag}&quot;</ETag></Contents>`);
      res.writeHead(200, { 'content-type': 'application/xml' });
      return res.end(`<ListBucketResult>${items.join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`);
    }
    const o = req.method === 'GET' ? store.get(key) : undefined;
    res.writeHead(o ? 200 : 404, o ? { 'content-type': o.type } : {});
    return res.end(o ? o.body : '<Error><Code>NoSuchKey</Code></Error>');
  });
}

/** The Worker's R2 binding over the same store. */
function binding(store) {
  const meta = (key, o) => ({ key, size: o.body.length, httpEtag: `"${o.etag}"`, writeHttpMetadata: (h) => h.set('content-type', o.type) });
  return {
    async head(key) {
      const o = store.get(key);
      return o ? meta(key, o) : null;
    },
    async get(key, options = {}) {
      const o = store.get(key);
      if (!o) return null;
      const m = meta(key, o);
      if (options.onlyIf?.get?.('if-none-match') === m.httpEtag) return m;
      return { ...m, body: new Blob([o.body]).stream(), text: async () => o.body.toString('utf8') };
    },
  };
}

/** The real Worker behind a local HTTP server — optionally behind a stand-in for Cloudflare Access. */
function host(store, gate) {
  return createServer(async (req, res) => {
    if (gate.access && req.headers['cf-access-client-id'] !== 'id.access') {
      res.writeHead(302, { location: 'https://team.cloudflareaccess.com/cdn-cgi/access/login/x' });
      return res.end();
    }
    gate.skew += 60_000; // every request a fresh isolate: past the Worker's 15 s pointer cache
    const request = new Request(`http://127.0.0.1${req.url}`, { method: req.method });
    const response = await worker.fetch(request, { BUILDS: binding(store) }, { waitUntil() {} });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
}

const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));

test('end to end: upload → promote → the Worker serves it; resume; a second build; rollback; --list; Cloudflare Access', { timeout: 120_000 }, async () => {
  const store = new Map();
  const gate = { access: false, skew: 0 };
  const realNow = Date.now;
  Date.now = () => realNow() + gate.skew;
  const r2 = fakeR2(store);
  const web = host(store, gate);
  try {
    const [r2Port, webPort] = [await listen(r2), await listen(web)];
    const p = project({ config: { url: `http://127.0.0.1:${webPort}`, endpoint: `http://127.0.0.1:${r2Port}` } });
    credentials(p.home, 'pmg-test');
    const served = async (path = '/') => (await fetch(`http://127.0.0.1:${webPort}${path}`)).text();

    // Nothing promoted yet: the Worker's 503.
    assert.match(await served(), /No build has been promoted/);

    const first = await run(p, 'publish.mjs', '--promote');
    assert.equal(first.code, 0, first.out);
    const id1 = /builds\/(\S+)\//.exec(first.out)[1];
    assert.match(first.out, /uploaded and verified: 3 files \(3 sent\)/);
    assert.match(first.out, new RegExp(`serves ${id1}`));
    assert.equal(await served(), '<!doctype html><title>v1</title>');
    assert.equal(await served('/art/a.png'), 'PNG-A');
    assert.equal(JSON.parse(await served('/__build')).build, id1);
    assert.equal(store.get(`builds/${id1}/index.html`).type, 'text/html; charset=utf-8');
    assert.ok(store.has(`published/${id1}.json`));

    // The same commit again: the same id, every file already there, nothing sent.
    const again = await run(p, 'publish.mjs');
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /3 already there, byte for byte — resuming/);
    assert.match(again.out, /\(0 sent\)/);
    assert.match(again.out, new RegExp(`--promote-only=${id1}`));

    // A new commit: a new id, and the promote prints the rollback.
    writeFileSync(join(p.dir, 'index.html'), '<!doctype html><title>v2</title>');
    git(p.dir, 'commit', '-q', '-am', 'v2');
    const second = await run(p, 'publish.mjs', '--promote');
    assert.equal(second.code, 0, second.out);
    const id2 = /builds\/(\S+)\//.exec(second.out)[1];
    assert.notEqual(id2, id1);
    assert.match(second.out, new RegExp(`\\(was ${id1}\\)`));
    assert.match(second.out, new RegExp(`Roll back with: publish\\.mjs --promote-only=${id1}`));
    assert.equal(await served(), '<!doctype html><title>v2</title>');

    const list = await run(p, 'publish.mjs', '--list');
    assert.equal(list.code, 0, list.out);
    assert.match(list.out, new RegExp(`▶ ${id2}`));
    assert.match(list.out, new RegExp(`  ${id1}`));

    const back = await run(p, 'publish.mjs', `--promote-only=${id1}`);
    assert.equal(back.code, 0, back.out);
    assert.equal(await served(), '<!doctype html><title>v1</title>');
    assert.match((await run(p, 'publish.mjs', '--promote-only=nope')).out, /no completed upload "nope"/);

    // Behind Access with no service token: the promote happens, and the refusal says why it cannot be confirmed.
    gate.access = true;
    const blocked = await run(p, 'publish.mjs', `--promote-only=${id2}`);
    assert.equal(blocked.code, 1);
    assert.match(blocked.out, /behind Cloudflare Access/);
    assert.match(blocked.out, /The pointer IS moved/);
    // With the token in the credentials file, the same promote confirms.
    credentials(p.home, 'pmg-test', { accessClientId: 'id.access', accessClientSecret: 'sec' });
    const through = await run(p, 'publish.mjs', `--promote-only=${id2}`);
    assert.equal(through.code, 0, through.out);
    assert.match(through.out, new RegExp(`serves ${id2}`));
  } finally {
    Date.now = realNow;
    r2.close();
    web.close();
  }
});
