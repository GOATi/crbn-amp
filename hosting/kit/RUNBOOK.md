# RUNBOOK — giving a project an R2 bucket, a Worker and a domain

**For:** a Claude Code session in the repo that is getting hosted, working with Garth. The first is
`paint-make-game` (PMG); read **Appendix A** before §1 there.
**Result:** the same publishing workflow Wonderman's dev host (`dev1.wondermannation.com`) runs on. A private R2 bucket
holds every build. A Cloudflare Worker serves whichever build is promoted, on a hostname. Any session can publish, or
roll back, with one command.
**Written** 2026-09-28 from the Wonderman setup (2026-09-26/27) and its toolkit code. The kit's reference is
[README.md](README.md). This page is the one-time setup.

Steps marked **[GARTH]** are his, in the Cloudflare dashboard or in a browser. Everything else is the session's.

---

## 0. Before you start

1. **Read the shelf's rules:** `D:\Dropbox\!Claude_Dropbox\CLAUDE.md`. The short version: the shelf is where you
   pick the kit up, and your repo is where it lives. You copy the kit in and commit it. Nothing may import from
   Dropbox.
2. **Read your own repo's CLAUDE.md** for anything about visibility, confidentiality or outward-facing actions. Those
   rules outrank this runbook.
3. `git status` in your repo. Publishing refuses a dirty tree. If the dirt isn't yours, another session may be live:
   coordinate with it, and never revert or commit its lines.
4. `node --version` must be 20 or later. Check `npx wrangler@4 whoami`: if this PC already deployed Wonderman's
   Workers, it is probably already logged in to the right account.

## 1. Put the decisions to Garth first

Ask these through the **AskUserQuestion** prompt. That is how he wants decisions put, rather than as a prose list.
Don't guess any of them.

| # | Decision | Default to recommend |
|---|---|---|
| 1 | **Who may see it?** *Public* (anyone with the URL, like `dev1`), or *private* (Cloudflare Access: a login by e-mail code, Garth plus whoever he adds) | **Private** whenever the repo holds anything confidential. Access goes on before the first promote (§6), because an unprotected `workers.dev` URL is public from its first deploy |
| 2 | **Names:** the bucket, the Worker, and later the hostname | Bucket `<project>-dev`, Worker the same name. The hostname can wait: `workers.dev` works from day one |
| 3 | **The domain:** a subdomain of a zone already on Cloudflare (`wondermannation.com` is), or a domain of the project's own | Ask. §8 covers both. A new domain registered through Cloudflare Registrar needs no nameserver move |
| 4 | **What ships:** the list of files a visitor's browser may fetch | Propose an allowlist (§3) and let him strike items |
| 5 | **The check:** what must pass before anything is sent | A fast smoke test (the page loads, no console errors), not a long flaky suite |
| 6 | **Which branch** the hosted build comes from | The branch he names. The kit publishes whatever commit is checked out |

Record his answers in your repo's own docs (§9).

## 2. Copy the kit in

```bash
mkdir -p hosting
cp -r 'D:/Dropbox/!Claude_Dropbox/r2-host-kit' hosting/kit      # single quotes: the ! in the path
cp hosting/kit/templates/publish.json   hosting/publish.json
cp hosting/kit/templates/wrangler.jsonc hosting/wrangler.jsonc
node --test "hosting/kit/test/*.test.mjs"                        # 45 pass, ~1 min, no network
```

- Add `dist/` (or whatever your `artifact` folder is) to `.gitignore`.
- If your test runner sweeps the whole repo, keep it out of `hosting/kit/test/`. Those are `node:test` files.
  Playwright's default `testMatch` would pick up `*.test.mjs` if its `testDir` were `.`.
- Commit: `hosting: vendor r2-host-kit v1 (shelf 2026-09-28)`.

## 3. Shape the artifact

The artifact is the folder that is uploaded, served exactly as-is. `index.html` sits at its root.

- **A repo with a bundler** (Vite and similar): set `"build": "npm run build"` and `"artifact"` to its output folder.
  Delete the `stage` block.
- **A repo with no build step** (vanilla JS served from the source tree): keep
  `"build": "node hosting/kit/stage.mjs"` and fill `stage.include` with every file and folder the browser loads. Start
  from the local server (`serve.js` or similar) and the `<script>`/`<link>` tags of every HTML page, then follow what
  those scripts fetch.
  - It is an **allowlist on purpose.** A new file stays private until someone adds it.
  - Dot-files and `node_modules` are always left out.
  - `exclude` takes paths or `*.ext`, e.g. source art the page never fetches.

Then run the dry run until it is clean:

```bash
node hosting/kit/publish.mjs --dry-run
```

The dry run names every problem: an **untyped file** (usually something that shouldn't ship, so exclude it rather than
type it), a **missing index.html**, an **artifact folder that isn't gitignored**, or a **dirty tree**. It sends nothing
and needs no credentials. Serve the artifact locally and click through it (`npx serve dist` or your own server). Any
request to a server API (`/api/…`) is a **404** on a static host, so the site must cope without one.

## 4. The bucket and the token

1. **The bucket.** **[GARTH]** In the dashboard: *R2 Object Storage → Create bucket*, name from §1, location
   *Automatic* or a hint near the audience (Wonderman's dev buckets are Oceania). Or, with his ok, the session runs
   `npx wrangler@4 r2 bucket create <bucket> --location oc`. **Leave Public Access disabled.** Only the Worker reads the
   bucket.
2. **The token.** **[GARTH]** *R2 Object Storage → Manage API tokens → Create API token*:
   - permission **Object Read & Write**, applied to **this bucket only**;
   - Cloudflare shows the **Access Key ID** and **Secret Access Key** once;
   - the **Account ID** is on the R2 overview page.
3. **The credentials file, on each PC that publishes.** The session creates it from the template. Garth pastes the
   three values in himself, so they never pass through a chat:

   ```powershell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.r2" | Out-Null
   Copy-Item hosting\kit\templates\r2-credentials.json "$env:USERPROFILE\.r2\<bucket>.json"
   notepad "$env:USERPROFILE\.r2\<bucket>.json"     # [GARTH] paste; leave the access* placeholders unless §6 applies
   ```

   It goes **outside every repo, and never in Dropbox.** A second PC gets its own copy (or its own token). Checking it
   is safe: `node hosting/kit/publish.mjs --list` answers `(nothing published yet)` and prints no secret.

## 5. The Worker and publish.json

1. Fill `hosting/wrangler.jsonc`: `name`, `bucket_name`. Leave `routes` commented until §8.
2. **[GARTH] once per PC, if `whoami` said not logged in:** `npx wrangler@4 login`. A browser window asks him to
   approve.
3. Deploy from the repo root:

   ```bash
   npx wrangler@4 deploy --config hosting/wrangler.jsonc
   ```

   Wrangler prints `https://<worker-name>.<account-subdomain>.workers.dev`. A fetch there answers **503 "No build has
   been promoted to this host yet."** That proves the Worker and its bucket binding are live, and it exposes nothing.
   (If `npx` fails with `EBUSY … rename` inside its cache, the cache is locked by another process. Retry, or run the
   cached `wrangler.js` directly.)
4. Fill `hosting/publish.json`: set `bucket`, and set `url` to that `workers.dev` origin. Every remaining `<placeholder>`
   is refused by name.
5. Commit the two configs. Neither holds a secret.

## 6. Private hosting: Cloudflare Access, BEFORE the first promote

Skip this section only if Garth chose *public* in §1.

1. **[GARTH]** Attach Access to the **Worker**: *Workers & Pages → <worker> → Settings → Domains & Routes*, then
   **Enable Cloudflare Access**. Then *Manage Cloudflare Access* to list the e-mail addresses allowed in. Attached to the
   Worker, it covers every URL the Worker answers on: `workers.dev`, previews, and any hostname added later. (Cloudflare
   added this one-click option in October 2025 and Worker-wide Access in August 2026. The dashboard moves, so search
   for "Access" on the Worker's page if the path differs.) Visitors log in with a one-time code sent by e-mail. The
   Zero Trust free plan covers 50 users.
2. **[GARTH]** Create a **service token** so `publish.mjs` can confirm its own promote. Under *Zero Trust → Access →
   Service credentials → Service Tokens → Create*, the **Client ID** and **Client Secret** are shown once. Then add a
   policy to the Worker's Access application: action **Service Auth**, include **Service Token = that token**.
3. **[GARTH]** Paste the two values into the credentials file as `accessClientId` and `accessClientSecret`.
4. Verify both sides:
   - `curl -sI <url>/__build` with no token is a **302 to `<team>.cloudflareaccess.com`**;
   - the same with `-H "CF-Access-Client-Id: …" -H "CF-Access-Client-Secret: …"` is a **200** or the **503**.
   - Don't paste the token into a command that will be echoed into a log. Read it from the file in a small script.

   Without the token a promote still happens, but `publish.mjs` stops at "behind Cloudflare Access … The pointer IS
   moved" instead of confirming it.

If Access is **not** attached to the Worker (say, only to a hostname), set `"workers_dev": false` and redeploy.
Otherwise the `workers.dev` URL serves everything unprotected.

## 7. The first publish

```bash
node hosting/kit/publish.mjs --dry-run      # clean, and says nothing about being refused
node hosting/kit/publish.mjs --promote
```

1. **Read the result.**
   - `✓ <url>/ serves <id>` is success.
   - `Promoted, but not confirmed` means the upload and the pointer are done, but the host didn't answer as expected.
     The problem lines say why. The usual causes are a Worker deployed for another bucket, or a mismatched `prefix`.
2. **Look at it.** Open the URL; `/__build` names the build. Garth opens it on his phone. His eye on the real device
   is the check no script replaces.
3. **Drill the rollback once, at the second publish.** Run the printed `--promote-only=<previous>`, confirm the old
   build is back, and then promote the new one again. Knowing it works is worth one minute.

## 8. A hostname

**8a. A subdomain of a zone already on Cloudflare** (e.g. `<name>.wondermannation.com`):
1. Uncomment `routes` in `hosting/wrangler.jsonc` with `{ "pattern": "<host>", "custom_domain": true }` and redeploy.
   Cloudflare creates the DNS record and the certificate.
2. Change `url` in `publish.json` to `https://<host>` and commit.
3. **Check first that nothing already answers on that name.** Attaching a hostname *replaces* any existing record for
   it (Wonderman's `play` CNAME is waiting for exactly this).
4. **Never** use *R2 → bucket → Custom Domains* (README "Traps").

**8b. Serving under a path** (`https://<host>/pub/…`, because links elsewhere already carry the path): add
`"vars": { "PREFIX": "/pub" }` to the Worker, add `"prefix": "/pub"` to `publish.json` (the same string), and build the
site with relative asset URLs.

**8c. A domain not on Cloudflare yet:**
- **Newly registered:** register it through *Cloudflare Registrar*. The zone lives on Cloudflare from the start, so
  nothing moves. Then do 8a.
- **Held elsewhere:** follow the move Wonderman made (relay repo `docs/CLOUDFLARE.md`):
  1. **Export every DNS record first**, mail and DKIM included.
  2. **If DNSSEC is on, turn it off at the old registrar and wait a full day.** The cached DS record took every
     hostname dark for a day on 2026-09-26.
  3. Add the site to Cloudflare (Free plan), and check its import against the export row by row.
  4. Grey-cloud (DNS only) everything that already exists.
  5. Switch the nameservers.
  6. Verify with `nslookup -type=NS <domain> 1.1.1.1` and against `8.8.8.8`.
  7. Then do 8a.

## 9. Leave it recorded in the repo

The shelf has no history. The repo is the record:

1. `hosting/README.md` from `hosting/kit/templates/hosting-README.md`, filled in: what is hosted where, public or
   private, the names, which PCs hold credentials (never the values), and Garth's §1 answers.
2. **The repo's CLAUDE.md gets a short Hosting section**, because sessions obey what their CLAUDE.md carries. Include:
   - the publish and rollback commands;
   - "credentials live in `%USERPROFILE%\.r2\`, never in the repo";
   - "a hostname goes on the Worker, never on the bucket";
   - the public/private ruling.
3. Your repo's session-log conventions (SYNC.md or similar). If the repo takes part in the Wonderman relay (PMG
   does), append a DONE pointer there: host URL, build id, rollback command. That's rule 8: landings are announced.
4. Commit and push. Only pushed work exists on Garth's other PC.

## 10. The everyday loop

1. Commit.
2. `node hosting/kit/publish.mjs --promote`.
3. Read the `serves` line.
4. Announce with the rollback command.

`--list` shows what the bucket holds. Old builds stay until deleted by hand in the dashboard. Each is small next to
the 10 GB free, so there's no hurry.

---

## Appendix A — PMG (`paint-make-game`)

Facts checked on 2026-09-28 from PMG's own files. Verify anything that may have moved since.

- **PMG is PRIVATE, and holds Wonderman's confidential work product.** Its CLAUDE.md says so in capitals, and says
  to *ask Garth before ANY outward-facing action*. The art under `art/characters/` and the rigs under `editor/rigs/`
  are Wonderman's. Garth has deferred the question of what a future public PMG may expose. So:
  - §1 decision 1 is not a formality. Recommend **private (§6)**, and do §6 before the first promote.
  - A public PMG host is Garth's call, made explicitly. It must not be the side effect of a deploy.
- **"Publish" already means something in PMG:** the creature hand-off to `wonderman-web-creatures`
  (`editor/tools/import-rigs.cjs --publish`, `Publish-Creatures.bat`). Give the web host a different word in PMG's
  scripts, docs and `.bat` names, e.g. `npm run host -- --promote` or `Deploy-Web.bat`, so no session confuses the
  two. The kit's file can stay `publish.mjs`, because it lives under `hosting/kit/`.
- **No build step.** Stage an allowlist (§3):
  - The game is `index.html` → `levels.js`, `audio.js`, `game.js`.
  - The editor is `editor/index.html` → `editor/styles.css`, `editor/src/app.js` and what it imports.
  - Then follow the fetches into `art/`, `audio/`, `fonts/` and `editor/rigs/`.
  - Leave out `docs/`, `ref/`, `tests/`, `feedback/`, the `.bat` files, and root debris such as `undefined`,
    `gh_search.json` and `bubnext_tree.json`.
- **`art/` is 197 MB:** 1,397 PNGs, plus about 1,250 Unity export files (`.anim`, `.controller`, `.prefab`) and a
  `.psd` that the importer bakes into `editor/rigs/`. The gate will name the Unity files as untyped. That is the cue to
  **exclude** them (e.g. `"*.anim"`, `"*.controller"`, `"*.prefab"`), not to type them.
- **`serve.js` hosts three server APIs** that a static host doesn't have:
  - `/api/…`: the publish, browse and leaderboards backend;
  - `/api/v1/store/…`: the projects disk store;
  - the rigs owner-mode API.

  On R2 each of these is a 404. Per `serve.js`'s own comment, the editor probes `/api/v1/store/health` on every boot,
  and a 404 there logs a console error. Decide with Garth what the hosted editor should do: run in browser mode
  (IndexedDB) and treat a 404 like the "disabled" answer, or hide what needs a server. Make that the check's
  zero-console-error bar.
- **The check:** the Playwright suite is large, and one spec is known to time out under load. Write a focused smoke
  test for the check instead: serve `ARTIFACT_DIR`, load the game and the editor, and require no console errors.
- **PMG's tree is often dirty from concurrent sessions,** and it is not always on `main`. Ask which branch the host
  tracks (§1 #6).
- **Other details:**
  - `package.json` still says `bubble-bobble-v1` / `1.0.0`, so the `version` in `current.json` stays `1.0.0`. The
    commit hash in the build id is what identifies a build.
  - PMG commits its `node_modules` on purpose. The kit adds nothing to it.
  - Playwright's `testDir` is `./tests`, so the kit's tests don't collide with the suite.

## Appendix B — where Wonderman's version lives

Read these for background. The kit carries everything a project needs.

| What | Where |
|---|---|
| The Worker and publish script, upstream | `wonderman-web-toolkit`: `hosting/build-host.mjs`, `hosting/README.md`, `scripts/publish.mjs`, `docs/SPEC-build-targets.md` §4.10 |
| Two real Worker configs (root, and under `/pub`) | `wonderman-web-shell`: `hosting/wrangler.jsonc`, `hosting/devshop.wrangler.jsonc` |
| The DNS move and the DNSSEC outage | `wonderman-web-relay`: `docs/CLOUDFLARE.md` |
| The whole ship-to-phone loop Wonderman runs on top of it | `wonderman-web-relay`: `docs/DEV-CUT-RUNBOOK.md` |
