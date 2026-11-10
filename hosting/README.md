# Hosting: CRBN Rig's web version

The browser version of CRBN Rig (`web/`: our own page in the suite's looks over NAM's core compiled to WebAssembly),
served from Cloudflare R2 through a Worker at `https://rig.carbonlinear.com` (crbn-launcher D-CRBN-021 (d)). The wiring
copies CRBN Press's, Mixtape's and Livewire's (D-PHOTOLIVE-021, D-CRBN-017 (c)). The machinery is `hosting/kit/`:
r2-host-kit v1, copied whole on 2026-11-10 from crbn-pdf `hosting/kit` @ 20f2dc86. The kit's reference is
`hosting/kit/README.md`, and the one-time setup is `hosting/kit/RUNBOOK.md`. This page records how **this** project is
wired.

The address is the app's web version in Pavillion Hub: the app record's `links.tool`, which the Hub opens top-level as
"Open the web version" (pavillion_client D-291). It is the interim home; in production the Hub's tools origin may serve
it instead (D-PHOTOLIVE-021 (a)).

## Where things are

| Thing | Value |
|---|---|
| Visitors load | `https://rig.carbonlinear.com` (no workers.dev or preview URL) |
| Who may see it | **Public but unlisted**: anyone with the URL, no login; a noindex meta and a `robots.txt` that disallows everything. The hostname is in Certificate Transparency logs, so it is unlisted, not secret |
| R2 bucket | `crbn-rig-web` (made 2026-11-10 by the session with wrangler: location Oceania) |
| Worker | `crbn-rig-web`: `hosting/wrangler.jsonc` |
| Publish config | `hosting/publish.json` |
| Built from branch | `main` |
| What ships | `node web/build.mjs` → `dist/web/` (gitignored): the page (`web/src`), `rig-engine.wasm` (`web/engine/build.mjs`, emscripten SDK 6.0.13), the demo riff and example capture from NAM Core (`demo/`), the vendored looks (`look/`), `robots.txt`, `build.json` (version, build id, commit), and the licences: `LICENSE.txt`, `ThirdPartyNotices.txt` (the desktop's notices plus the runtime emscripten compiles into the engine), `NOTICE.txt`, `MODIFIED-FILES.txt` |
| The check | `node web/check.mjs`: `dist/web` served on loopback to headless Edge, which runs `web/test/selftest.html` (the page paints in Rig's look; the engine plays the example capture through the real AudioWorklet, equal to the engine run directly; the cabinet stage scales as the desktop's). `--url=https://rig.carbonlinear.com` checks that the live host serves every file of the artifact byte for byte |
| Credentials | `%USERPROFILE%\.r2\crbn-rig-web.json`, never in the repo; the owner pastes them on the PC that publishes (GOATi-Box-C) |

## Publish, roll back

From a clean `main` on GOATi-Box-C, from the repo root:

```powershell
node hosting/kit/publish.mjs --dry-run              # the plan; nothing sent
node hosting/kit/publish.mjs --promote              # build, check, upload, verify, serve
node hosting/kit/publish.mjs --list                 # what the bucket holds; ▶ is what is served
node hosting/kit/publish.mjs --promote-only=<id>    # serve an earlier build: the rollback
node web/check.mjs --url=https://rig.carbonlinear.com
```

Every promote prints its rollback command; put it in the SYNC entry.

## What the web version cannot do

- **Latency.** A browser's audio path (the input, the AudioWorklet, the output) adds latency an audio interface's ASIO
  driver does not; the page shows what the browser reports. It is for trying captures and playing casually; the
  desktop app is for serious playing.
- **Files** come by the browser's picker or drag and drop; nothing is uploaded. The last capture and IR are kept in the
  browser (IndexedDB) so a reload brings them back.
- **Input** is whatever the browser offers: echo cancelling, noise suppression and automatic gain are asked off.
