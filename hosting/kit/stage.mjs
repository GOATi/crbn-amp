/**
 * Stages a no-build site into its artifact folder: copies exactly what the config's `stage.include`
 * names, minus `stage.exclude`, into `artifact`. For a repo that serves its source tree as-is
 * (vanilla JS, no bundler), where "the build" is choosing which files a visitor may fetch.
 *
 *   node hosting/kit/stage.mjs [--config=hosting/publish.json]
 *
 * Wire it as the config's build command — "build": "node hosting/kit/stage.mjs" — so publish.mjs
 * restages from the committed tree on every run.
 *
 * An ALLOWLIST on purpose: a new file in the repo is private until someone adds it here. Always
 * left out, whatever the lists say: any path segment starting with "." (.git, .env, a server's
 * .publish-store.json) and node_modules.
 *
 * `exclude` entries are repo-relative paths (a file, or a folder and everything under it) or
 * `*.ext` (that extension anywhere) — e.g. "art/source", "*.psd", "*.ai".
 */
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_CONFIG, keepStaged, readConfig, walkArtifact } from './lib/publish-lib.mjs';

const args = process.argv.slice(2);

function fail(lines) {
  console.error('\nCannot stage:\n');
  for (const l of lines) console.error('  ✗ ' + l);
  console.error('');
  process.exitCode = 1;
}

function main() {
  const unknown = args.filter((a) => !a.startsWith('--config='));
  if (unknown.length) return fail([`unknown argument(s): ${unknown.join(', ')}. Usage: stage.mjs [--config=<path>]`]);

  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (top.status !== 0) return fail(['not inside a git repository.']);
  const root = top.stdout.trim();
  const configPath = resolve(root, args[0]?.slice('--config='.length) || DEFAULT_CONFIG);
  const { config, problems } = readConfig(configPath);
  if (problems) return fail(problems);
  if (!config.stage) return fail([`${configPath} has no "stage" block — list what a visitor may fetch in "stage.include".`]);

  const out = config.artifact.replaceAll('\\', '/').replace(/\/+$/, '');
  // The artifact folder is wiped and rebuilt, so it must hold nothing git tracks.
  const tracked = spawnSync('git', ['ls-files', '--', out], { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (tracked) return fail([`"${out}" holds files git tracks (e.g. ${tracked.split('\n')[0]}) — the artifact folder must be a gitignored output.`]);

  const missing = config.stage.include.filter((p) => !existsSync(join(root, p)));
  if (missing.length) return fail([`stage.include names paths that do not exist: ${missing.join(', ')}`]);
  const inside = config.stage.include.find((p) => {
    const r = p.replaceAll('\\', '/').replace(/\/+$/, '');
    return r === out || r.startsWith(`${out}/`) || out.startsWith(`${r}/`);
  });
  if (inside) return fail([`stage.include "${inside}" overlaps the artifact folder "${out}".`]);

  const exclude = config.stage.exclude ?? [];
  const dest = join(root, out);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  let count = 0;
  let bytes = 0;
  let dropped = 0;
  for (const entry of config.stage.include) {
    const rel0 = entry.replaceAll('\\', '/').replace(/\/+$/, '');
    const abs = join(root, rel0);
    const files = statSync(abs).isDirectory()
      ? walkArtifact(abs).map((f) => ({ ...f, rel: `${rel0}/${f.rel}` }))
      : [{ path: abs, rel: rel0, size: statSync(abs).size }];
    for (const f of files) {
      if (!keepStaged(f.rel, exclude)) {
        dropped++;
        continue;
      }
      const to = join(dest, f.rel);
      mkdirSync(dirname(to), { recursive: true });
      cpSync(f.path, to);
      count++;
      bytes += f.size;
    }
  }
  console.log(`  staged ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB → ${out}/  (${dropped} left out by the exclusions)`);
}

main();
