# r2-host-kit — a site served from Cloudflare R2 through a Worker

**Kit version 1 · 2026-09-28.** Setting a project up for the first time? Read [RUNBOOK.md](RUNBOOK.md). This page is
the reference: the tracked copy that lives in each project at `hosting/kit/README.md`.

## What it does

```
 your repo ──publish.mjs──▶ R2 bucket ◀──binding── Worker ◀── https://<host>/  (visitors)
            (S3 API, token)   builds/<id>/…        build-host.mjs
                              published/<id>.json  serves the build current.json names
                              current.json
```

- **Every build is uploaded whole** under its own prefix, `builds/<id>/`. Uploading never disturbs what visitors load.
- **`current.json` is the one pointer.** A promote writes it, and so does a rollback. The Worker re-reads it every
  15 s, so a promote is live within 15 s everywhere.
- **The bucket stays private.** Only the Worker reads it, through a binding. Nothing is ever public on the bucket.
- **A session publishes with one command** and never touches Cloudflare. The dashboard work is once per project
  ([RUNBOOK.md](RUNBOOK.md)).

This is the Wonderman programme's dev-host machinery (it serves `dev1.wondermannation.com`), made project-free.

## The files

| Path | What | Provenance |
|---|---|---|
| `worker/build-host.mjs` | The Worker. It serves the promoted build at `/` (or under `PREFIX`), answers `/__build`, returns 503 until a build is promoted, handles ranges and ETags, and edge-caches files by build id | **Byte-identical** to wonderman-web-toolkit `hosting/build-host.mjs` @ `46ac71e` |
| `worker/build-host-lib.mjs` | Its pure parts: path → key, the cache rule, ranges, `PREFIX` | Byte-identical to toolkit `hosting/build-host-lib.mjs` @ `a551d86` |
| `publish.mjs` | The CLI: gate → build → check → upload → verify → promote | Generalised from toolkit `scripts/publish.mjs` @ `a551d86`. The upload, verify, marker and promote steps are the toolkit's. The gate is new, and Wonderman's play check is removed |
| `lib/r2.mjs` | A zero-dependency R2 client (SigV4 on `node:crypto`) | Toolkit `scripts/lib/r2.mjs` @ `fa14f46`, with credentials made per-bucket |
| `lib/publish-lib.mjs` | Config validation, content types, the build id, the upload plan | Toolkit `scripts/lib/publish.mjs` @ `fa14f46`, plus the config and the id |
| `stage.mjs` | For a repo with no build step, copies an allowlist into the artifact folder | New |
| `test/*.test.mjs` | 45 tests. They include an end-to-end run: the real CLI against a local fake R2, with the real Worker serving from it | Worker and signer tests from the toolkit; the rest new |
| `templates/` | `publish.json`, `wrangler.jsonc`, `r2-credentials.json`, `hosting-README.md` | New |

Needs **Node ≥ 20** and **git**. It adds no npm dependencies. Deploying the Worker uses `npx wrangler@4`, once.

## How it sits in a project

```
<repo>/
  hosting/
    kit/            ← this folder, copied whole; vendored, and committed
    wrangler.jsonc  ← the project's Worker: name, bucket, hostname   (from templates/)
    publish.json    ← the project's publish config                   (from templates/)
    README.md       ← the project's own record of its hosting        (from templates/hosting-README.md)
  dist/             ← the artifact; GITIGNORED
```

`kit/` is vendored. Change it only deliberately, and when you do, add a line to the table below so a later upgrade
doesn't silently drop the change.

| Local changes to this copy of the kit | Why |
|---|---|
| `worker/build-host.mjs`: an optional `FALLBACK` var (e.g. `index.html`). An extensionless path the build lacks answers that file (200) instead of 404. Unset, the Worker is byte-for-byte the kit's behaviour. One test added at the end of `test/build-host.test.mjs`. 2026-09-28 | The Hub is a single-page app. Without it, a reload or a deep link on any route but `/` was a plain 404 on the live host. The kit has no SPA fallback; worth taking upstream into the shelf kit |

## Commands (run from the repo root)

```powershell
node hosting/kit/publish.mjs --dry-run            # what would go, and whether a real run would be refused. Nothing is sent
node hosting/kit/publish.mjs --promote            # build, check, upload, verify, then serve it
node hosting/kit/publish.mjs                      # the same without the promote: uploaded, but visitors see nothing new
node hosting/kit/publish.mjs --list               # what the bucket holds; ▶ is what is served
node hosting/kit/publish.mjs --promote-only=<id>  # serve an uploaded build. This is also the ROLLBACK
node hosting/kit/stage.mjs                        # restage dist/ by hand (publish runs it for you as the build)
node --test "hosting/kit/test/*.test.mjs"         # the kit's own tests (~1 min; they never touch the network)
curl -s https://<host>/__build                    # what the host is serving right now
```

A project may wrap these in npm scripts, for example `"host": "node hosting/kit/publish.mjs"`, then
`npm run host -- --promote`. Every promote prints the rollback command. Put that command in the announcement.

## The gate — what `publish.mjs` refuses, in order

1. **A dirty working tree.** A build must be exactly a commit, and untracked files count as dirt. This is checked
   before the build runs. A `--dry-run` still shows the plan and then says the real run would be refused.
2. **A failed `build`.**
3. **A missing `index.html`** at the artifact root, or **any file without a content type**. The failing files are
   named; fix them with `contentTypes`, or leave them out of the artifact.
4. **A failed `check`.** It is skipped by `--dry-run`. It runs with `ARTIFACT_DIR`, `PUBLISH_URL` and
   `PUBLISH_BUCKET` in its environment.
5. **A build or check that changed the tree.** The usual cause is an artifact folder that isn't gitignored.
6. **A build id already in the bucket holding files this artifact lacks.** Upstream calls these stray keys. Investigate
   before publishing over them.

Credentials are read only after all of that. A failed check never needs them.

## `hosting/publish.json`

| Field | Required | Meaning |
|---|---|---|
| `bucket` | ✓ | The R2 bucket name |
| `url` | ✓ | The host's origin, `https://<host>`, with no path and no trailing slash. Start with the `workers.dev` URL and change it when a hostname is attached |
| `artifact` | ✓ | The folder that is uploaded, e.g. `dist`. It must be gitignored. `stage.mjs` wipes it |
| `build` | | A shell command that produces the artifact, e.g. `node hosting/kit/stage.mjs` or `npm run build` |
| `check` | | A shell command that must exit 0 before anything is sent |
| `prefix` | | Serve under a path (`/pub`). It must be **the same string** as the Worker's `PREFIX` var |
| `stage` | | `stage.mjs`'s lists: `include` (repo-relative files and folders) and `exclude` (a path, or `*.ext`) |
| `contentTypes` | | Extra `{ "ext": "mime/type" }`. An unknown extension stops the upload rather than being guessed |
| `envPrefix` | | Read credentials from `<PREFIX>_ACCOUNT_ID` and the like as well as from the file. Without it, the environment is never read |
| `endpoint` | | Override the R2 endpoint, e.g. `https://<account>.eu.r2.cloudflarestorage.com` for an EU-jurisdiction bucket |

Keys starting with `//` are comments. A value still holding a `<placeholder>` from the template is refused by name.

## Credentials

- **The R2 token** goes in `%USERPROFILE%\.r2\<bucket>.json` on each PC that publishes, shaped like
  `templates/r2-credentials.json`. Use one file per bucket, because an R2 token is scoped to one bucket.
- **Never** put it in a repo, the Dropbox shelf, a relay or SYNC entry, or a chat. Garth pastes the values into the file
  himself; a session only ever creates the file from the template.
- For a host behind Cloudflare Access, the same file also holds `accessClientId` and `accessClientSecret`. That service
  token lets `publish.mjs` confirm its promote (RUNBOOK §6).

## How files are cached

- **Browser:** only Vite-style hashed chunks directly in the root `assets/` (`assets/name-AbC123xy.js`) are cached
  forever. Every other file is `no-cache`: it revalidates with its ETag, so after a promote a visitor gets the new file
  on their next load, as a cheap 304 when nothing changed. A site with no bundler is entirely no-cache, which is correct.
- **Cloudflare's edge** (on a custom hostname only; the cache is a no-op on `workers.dev`): the Worker stores each file
  under its **build id**. A promote changes the id, so a stale copy can never be served. `x-wm-edge: hit | miss`
  reports which way a file was served.

## Traps that have already cost a session

- **A hostname goes on the Worker, never on the bucket.** R2 → bucket → *Custom Domains* serves raw keys. `/` returns
  404, every stored build is public under `builds/<id>/`, and the site can't load. Wonderman's `dev1` was attached
  that way first (2026-09-26) and had to be moved.
- **Moving a domain's nameservers with DNSSEC on takes the whole domain offline.** The `.com` DS record outlives
  the move in resolvers' caches for up to 24 h (SERVFAIL everywhere but 1.1.1.1). Turn DNSSEC off at the old registrar,
  **wait a day**, then switch. Don't enable DNSSEC at Cloudflare until that day is out.
- **Protecting only the custom hostname leaves `workers.dev` wide open.** Attach Cloudflare Access to the **Worker**,
  which covers every URL it answers on. Otherwise set `"workers_dev": false`.
- **`process.exit()` after `fetch` aborts Node 24 on Windows** with exit 127, which reports a success as a failure.
  The CLIs set `process.exitCode` and never call `process.exit`, and a test pins that.
- **A Worker route (not a custom domain) needs an orange-clouded host,** and it changes that host's proxying. That's a
  per-host decision for Garth.
- **Free-plan limits:** R2 gives 10 GB of storage free; Workers allow 100,000 requests a day, and every file a visitor
  loads counts as one. Old builds are deleted by hand, in the dashboard.
- **Quote the shelf path.** `D:\Dropbox\!Claude_Dropbox` has a `!` in it. In Git Bash use single quotes
  (`'D:/Dropbox/!Claude_Dropbox'`); a `.bat` file with delayed expansion enabled eats the `!`.

## Upgrading the kit

Copy the shelf's newer `r2-host-kit/` over `hosting/kit/`. Re-apply anything in the local-changes table above. Then run
the tests and a `--dry-run`, and commit. Redeploy the Worker only if `worker/` changed. To check the Worker against
its upstream: `git -C <toolkit> show <commit>:hosting/build-host.mjs | diff - hosting/kit/worker/build-host.mjs`.
