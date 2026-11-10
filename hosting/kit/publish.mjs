/**
 * Publishes a project's built site to its build host: an R2 bucket served by worker/build-host.mjs.
 * Run from the repo root.
 *
 *   node hosting/kit/publish.mjs [--config=hosting/publish.json] --dry-run     what would go, and whether it may
 *   node hosting/kit/publish.mjs --promote                                     build, check, upload, then serve it
 *   node hosting/kit/publish.mjs                                               build, check, upload — players see nothing yet
 *   node hosting/kit/publish.mjs --list                                        what the bucket holds; ▶ marks what is served
 *   node hosting/kit/publish.mjs --promote-only=<build-id>                     serve an uploaded build (this is also the rollback)
 *
 * The gate, in order: the git tree is clean → `build` runs → the artifact has an index.html and
 * every file has a content type → `check` passes (skipped by --dry-run) → the build and check left
 * the tree as they found it. Only then is anything sent. Upload and promote are separate steps on
 * purpose: an upload goes to the build's own prefix and touches nothing players load; a promote
 * moves the one pointer the Worker serves.
 *
 * Generalised from wonderman-web-toolkit `scripts/publish.mjs` (a551d86): the upload, verify,
 * marker and promote steps are the toolkit's; the toolkit's gate (its build log's `checked` stamp)
 * and its Wonderman-only play check are replaced by the config's `build` and `check` commands.
 *
 * Credentials come from %USERPROFILE%\.r2\<bucket>.json or the environment, never from config
 * (lib/r2.mjs).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { r2Client, readCredentials } from './lib/r2.mjs';
import {
  DEFAULT_CONFIG, POINTER_KEY, buildIdFor, buildPrefix, contentTypeFor, eachLimited, markerKey, md5Of, planUpload,
  readConfig, untypedFiles, verifyUpload, walkArtifact, withRetry,
} from './lib/publish-lib.mjs';

const args = process.argv.slice(2);
const USAGE = 'Usage: publish.mjs [--config=<path>] [--promote] [--dry-run] | --promote-only=<build-id> | --list';

/**
 * A refusal. Thrown, never `process.exit(1)`: the runner at the foot of this file prints it and sets
 * `process.exitCode`, so the process always ends by itself — see there for why that matters.
 */
class Fatal extends Error {
  constructor(problems, title) {
    super(title);
    this.problems = problems;
    this.title = title;
  }
}

function fatal(problems, title = 'Cannot publish:') {
  throw new Fatal(problems, title);
}

function git(root, ...gitArgs) {
  const r = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) fatal([`git ${gitArgs.join(' ')} failed: ${(r.stderr || r.error?.message || '').trim()}`]);
  return r.stdout.trim();
}

/** Runs a config command through the shell, in the repo root, output streamed. True when it exits 0. */
function runCommand(label, command, root, env) {
  console.log(`\n  ${label}: ${command}`);
  const r = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit', env: { ...process.env, ...env } });
  return r.status === 0;
}

async function main() {
  const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const flag = (name) => args.includes(`--${name}`);

  // Unknown flags are fatal: a misspelled --dry-run would upload.
  const VALUED = ['config', 'promote-only'];
  const BARE = ['promote', 'dry-run', 'list'];
  const unknown = args.filter((a) => !VALUED.some((n) => a.startsWith(`--${n}=`)) && !(a.startsWith('--') && BARE.includes(a.slice(2))));
  if (unknown.length) fatal([`unknown argument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}\n    ${USAGE}`]);

  const modes = [flag('list'), option('promote-only') !== undefined, flag('promote') || flag('dry-run')];
  if (modes.filter(Boolean).length > 1) fatal([`--list, --promote-only and an upload are separate runs.\n    ${USAGE}`]);

  // ─────────────────────────────────────────────────────────── 1. repo and config

  const root = git(process.cwd(), 'rev-parse', '--show-toplevel');
  const configPath = resolve(root, option('config') ?? DEFAULT_CONFIG);
  const { config, problems: configProblems } = readConfig(configPath);
  if (configProblems) fatal(configProblems, 'The publish config is not valid:');

  const { bucket, url: hostUrl } = config;
  // Where the build is reached: the origin, under the Worker's PREFIX when the config declares one —
  // the poll and the index check look there, because that is where the links point.
  const servedAt = `${hostUrl}${config.prefix ?? ''}`;
  const extraTypes = config.contentTypes ?? {};

  // ─────────────────────────────────────────────────────────── 2. the bucket and the host

  let credentials = null;
  function client() {
    const read = readCredentials({ bucket, envPrefix: config.envPrefix });
    if (read.problem) fatal([read.problem]);
    credentials = read.credentials;
    return r2Client({ credentials, bucket, endpoint: config.endpoint });
  }

  /**
   * A GET of the host, as the publish script sees it: with the Access service token when there is
   * one, and without following redirects — Cloudflare Access answers an unauthenticated request with
   * a redirect to its login page, and that is worth naming rather than reporting as a wrong build.
   */
  async function probe(path) {
    const headers = credentials?.accessClientId
      ? { 'CF-Access-Client-Id': credentials.accessClientId, 'CF-Access-Client-Secret': credentials.accessClientSecret }
      : {};
    const res = await fetch(`${servedAt}${path}`, { cache: 'no-store', redirect: 'manual', headers });
    const location = res.headers.get('location') ?? '';
    if (res.status >= 300 && res.status < 400 && /cloudflareaccess\.com/.test(location)) {
      return { res, access: true };
    }
    return { res, access: false };
  }

  const ACCESS_HINT =
    `${servedAt} is behind Cloudflare Access and this PC sent no service token it accepts.\n` +
    `    Add "accessClientId" and "accessClientSecret" to the bucket's credentials file, and a Service Auth\n` +
    `    rule for that token to the Worker's Access policy (RUNBOOK §6).`;

  async function readPointer(r2) {
    const text = await r2.getText(POINTER_KEY);
    return text ? JSON.parse(text) : null;
  }

  /** Moves the pointer, then watches the host until it serves the new build — or says it could not. */
  async function promote(r2, id, marker) {
    const before = await readPointer(r2);
    const pointer = {
      build: id,
      version: marker.version,
      commit: marker.commit,
      promoted: new Date().toISOString(),
      previous: before?.build ?? null,
    };
    await withRetry(() => r2.put(POINTER_KEY, JSON.stringify(pointer, null, 1), { contentType: 'application/json' }));
    console.log(`  ✓ ${bucket}/${POINTER_KEY} → ${id}${before?.build ? `  (was ${before.build})` : ''}`);
    const rollback = before?.build && before.build !== id ? `Roll back with: publish.mjs --promote-only=${before.build}` : null;

    // The Worker trusts its copy of the pointer for 15 s (build-host-lib.mjs POINTER_TTL_MS). Polled
    // UNDER the prefix when there is one: that is the path the hostname's links reach, so it proves
    // the route, not just the Worker.
    const deadline = Date.now() + 45_000;
    let seen = null;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const { res, access } = await probe('/__build');
        if (access) fatal([ACCESS_HINT, 'The pointer IS moved — the upload and the promote are complete.', ...(rollback ? [rollback] : [])], 'Promoted, but not confirmed:');
        seen = res.ok ? (await res.json()).build : `HTTP ${res.status}`;
        if (seen === id) break;
      } catch (error) {
        if (error instanceof Fatal) throw error;
        lastError = error;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (seen !== id) {
      fatal(
        [
          `the pointer names ${id}, but ${servedAt}/__build ${seen ? `still reports ${seen}` : `did not answer (${lastError?.message ?? 'no response'})`}.\n` +
            `    Is the Worker deployed for bucket "${bucket}"${config.prefix ? ` with PREFIX "${config.prefix}"` : ''} (RUNBOOK §5)? The upload itself is complete.`,
          ...(rollback ? [rollback] : []),
        ],
        'Promoted, but not confirmed:',
      );
    }
    const { res: index } = await probe('/');
    if (!index.ok || !(index.headers.get('content-type') ?? '').startsWith('text/html')) {
      fatal(
        [`${servedAt}/ answered HTTP ${index.status} ${index.headers.get('content-type') ?? ''} — expected the build's index.html.`, ...(rollback ? [rollback] : [])],
        'Promoted, but not confirmed:',
      );
    }
    console.log(`  ✓ ${servedAt}/ serves ${id}`);
    if (rollback) console.log(`\n  ${rollback}`);
  }

  // ─────────────────────────────────────────────────────────── 3a. --list

  if (flag('list')) {
    const r2 = client();
    const pointer = await readPointer(r2);
    const markers = (await r2.list('published/')).map((o) => o.key.slice('published/'.length, -'.json'.length));
    console.log(`\n${bucket} — served at ${servedAt}/\n`);
    if (!markers.length) console.log('  (nothing published yet)');
    for (const id of markers.sort()) console.log(`  ${id === pointer?.build ? '▶' : ' '} ${id}`);
    console.log(pointer ? `\n  ▶ current since ${pointer.promoted}` : '\n  No build is promoted — the host answers 503.');
    return;
  }

  // ─────────────────────────────────────────────────────────── 3b. --promote-only

  const promoteOnly = option('promote-only');
  if (promoteOnly !== undefined) {
    if (!promoteOnly) fatal([`--promote-only needs a build id — see --list.`]);
    const r2 = client();
    const text = await r2.getText(markerKey(promoteOnly));
    if (!text) fatal([`${bucket} has no completed upload "${promoteOnly}" (no ${markerKey(promoteOnly)}). See publish.mjs --list.`]);
    console.log(`\nPromoting ${promoteOnly} on ${bucket}\n`);
    await promote(r2, promoteOnly, JSON.parse(text));
    return;
  }

  // ─────────────────────────────────────────────────────────── 3c. the gate, then the upload

  const dryRun = flag('dry-run');
  const refusals = [];
  const status = () => git(root, 'status', '--porcelain', '--untracked-files=all');
  const before = status();
  if (before) {
    const lines = before.split('\n');
    const dirty =
      `the working tree is DIRTY — commit first; a build must be exactly a commit:\n` +
      lines.slice(0, 8).map((l) => `      ${l}`).join('\n') + (lines.length > 8 ? `\n      …and ${lines.length - 8} more` : '');
    if (!dryRun) fatal([dirty]);
    refusals.push(dirty);
  }
  const commit = git(root, 'rev-parse', '--short=7', 'HEAD');
  const commitEpoch = Number(git(root, 'log', '-1', '--format=%ct'));
  const pkgPath = join(root, 'package.json');
  const version = existsSync(pkgPath) ? (JSON.parse(readFileSync(pkgPath, 'utf8')).version ?? null) : null;

  const artifact = resolve(root, config.artifact);
  if (config.build && !runCommand('build', config.build, root, {})) fatal([`the build command failed: ${config.build}`]);
  if (!existsSync(artifact)) fatal([`no artifact at ${config.artifact}${config.build ? ' after the build' : ''}.`]);

  const files = walkArtifact(artifact);
  const untyped = untypedFiles(files, extraTypes);
  if (untyped.length) {
    fatal([
      `${untyped.length} file(s) have no content type — add the extension to "contentTypes" in the config,\n` +
        `    or leave the file out of the artifact:\n` + untyped.slice(0, 10).map((f) => `      ${f}`).join('\n'),
    ]);
  }
  if (!files.some((f) => f.rel === 'index.html')) fatal([`${config.artifact} has no index.html at its root — it cannot be served.`]);

  if (config.check && !dryRun) {
    const ok = runCommand('check', config.check, root, { ARTIFACT_DIR: artifact, PUBLISH_URL: servedAt, PUBLISH_BUCKET: bucket });
    if (!ok) fatal([`the check failed: ${config.check}\n    Nothing was sent.`]);
  }

  // A build or check that rewrote a tracked file, or left an untracked one, means the artifact is not the commit.
  const after = status();
  if (after !== before) {
    fatal([
      `the build or check changed the working tree, so the artifact is not exactly commit ${commit}.\n` +
        `    Gitignore the artifact folder ("${config.artifact}/") and any outputs the check writes. Now:\n` +
        after.split('\n').slice(0, 8).map((l) => `      ${l}`).join('\n'),
    ]);
  }

  for (const f of files) Object.assign(f, md5Of(f.path));
  const id = buildIdFor({ commitEpoch, commit, files });
  const prefix = buildPrefix(id);
  const totalMB = (files.reduce((n, f) => n + f.size, 0) / 1024 / 1024).toFixed(1);
  console.log(`\nPublishing ${config.artifact}  (${version ? `v${version} ` : ''}${commit})`);
  console.log(`  → ${bucket}/${prefix}  ${files.length} files, ${totalMB} MB`);

  if (dryRun) {
    console.log(`\n  Dry run — nothing sent${config.check ? ', and the check was not run' : ''}.${flag('promote') ? ` Would then promote it at ${servedAt}/.` : ''}`);
    if (refusals.length) fatal(refusals, 'A real run would be REFUSED:');
    console.log('');
    return;
  }

  const r2 = client();
  const plan = planUpload(files, await r2.list(prefix), prefix);
  if (plan.stray.length) {
    fatal([
      `${bucket}/${prefix} holds ${plan.stray.length} object(s) this artifact does not, e.g. ${plan.stray[0]}.\n` +
        `    A build id names ONE artifact; something else was uploaded under it. Investigate before publishing over it.`,
    ]);
  }
  if (plan.skipped) console.log(`  ${plan.skipped} already there, byte for byte — resuming`);

  let sent = 0;
  await eachLimited(plan.toSend, 8, async (file) => {
    // Read at send time, not up front: a 250 MB artifact held in memory for the whole run buys nothing.
    await withRetry(() => r2.put(file.key, readFileSync(file.path), { contentType: contentTypeFor(file.rel, extraTypes), md5: file.md5b64 }));
    sent++;
    if (sent % 250 === 0 || sent === plan.toSend.length) console.log(`  … ${sent}/${plan.toSend.length}`);
  });

  const problems = verifyUpload(files, await r2.list(prefix), prefix);
  if (problems.length) fatal(problems, `The upload did not verify — ${markerKey(id)} NOT written:`);

  const marker = {
    build: id,
    version,
    commit,
    files: files.length,
    sizeMB: Number(totalMB),
    uploaded: new Date().toISOString(),
  };
  await withRetry(() => r2.put(markerKey(id), JSON.stringify(marker, null, 1), { contentType: 'application/json' }));
  console.log(`  ✓ uploaded and verified: ${files.length} files (${plan.toSend.length} sent) — ${markerKey(id)}`);

  if (flag('promote')) {
    await promote(r2, id, marker);
  } else {
    console.log(`\n  Not promoted — visitors still get the current build. To serve this one:`);
    console.log(`    publish.mjs --promote-only=${id}\n`);
  }
}

// ─────────────────────────────────────────────────────────── the runner
//
// No `process.exit()` anywhere in this file. On Windows, Node 24 ABORTS when the process is torn down
// while `fetch`'s sockets are still closing (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`,
// libuv src/win/async.c) and the exit code becomes 127 — so a run that succeeded reported FAILURE.
// Found on the toolkit's first live run, 2026-09-26. Every path returns, and the exit code is set,
// never forced.
try {
  await main();
} catch (error) {
  if (!(error instanceof Fatal)) throw error;
  console.error(`\n${error.title}\n`);
  for (const p of error.problems) console.error('  ✗ ' + p);
  console.error('');
  process.exitCode = 1;
}
