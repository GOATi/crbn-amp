# CRBN Rig (crbn-amp): read this first

**This is a CRBN suite repo.** Every session starts in `../crbn-launcher` (its `CLAUDE.md`, then
`../goati-sync/SYNC.md`'s rules, lane registry and this lane's last entry, then `docs/DECISIONS.md`), and logs in
`../goati-sync/SYNC.md` under the lane token **`RIG`**. The suite's decisions win over anything upstream's files say.
The decision that made this app is crbn-launcher **D-CRBN-021**; the playbook it followed is crbn-launcher
`docs/new-app-on-pavillion-hub.md`.

## What this is

CRBN Rig is GOATi's fork of Steven Atkinson's **Neural Amp Modeler** plug-in (MIT, C++ on iPlug2; `UPSTREAM.md`). It
plays captures of real gear (pedals, amp heads, full rigs; `.nam` files, most of them from TONE3000) and cabinet
impulse responses (`.wav`). It reaches Pavillion Hub both ways:

- **the desktop app**: the iPlug2 standalone, `crbn-rig.exe`, installed and updated by the Hub as a folder; since R2a
  (D-RIG-017) its window is the same page in WebView2, over the same engine compiled in;
- **the web version**: our own page in the suite's looks (`web/`), with NAM's core compiled to WebAssembly in an
  AudioWorklet, at `https://rig.carbonlinear.com` (public but unlisted).

The owner intends a UX of our own, replacing upstream's. The page is it, in both builds: every feature is built once,
in the engine and the page, and checked in both (`docs/BUILD_PLAN.md`).

## Where things are

| What | Where |
|---|---|
| The standalone (C++): a thin host since R2a (D-RIG-017), Rig's page over Rig's engine | `NeuralAmpModeler/` (`NeuralAmpModeler.cpp` the host and its message list, `RigWebView.cpp` the WebView2 host, `RigDesktop.cpp` the engine's threads, IR, Standby, riff and meters, `RigLibrary.cpp` the library's folder (its dialog, listing, reading and watch; R4), `config.h`, `resources/`) |
| Upstream's libraries, vendored (`vendor.json`, `UPSTREAM.md`; D-RIG-001), and the WebView2 SDK (D-RIG-017) | `iPlug2/`, `NeuralAmpModelerCore/`, `AudioDSPTools/`, `eigen/`, `WebView2/` |
| The page, for the web version and the desktop app alike | `web/` (`src/` the page, with `audio-web.js` and `audio-desktop.js` its two audio backends, and `kits.js` the players' own kits from the Rig builder (R1b); `library.js` the library's index, read by the same rules as `RigLibrary.cpp`, and `library-view.js` its list, cards and shelves (R4); `engine/` the engine both builds run, compiled to wasm and into the app, with `rig_guard.h` its squeal guard and auto-off (R3); `build.mjs`, `check.mjs`) |
| Rig's hardware: the kits on the amp and cabinet (D-RIG-009..016), ported from the Hardware Lab | `web/src/hw/` (`hw.js`, `hw.css`, `tex/` Salvage's sheets, `fonts/`) |
| The suite's looks, vendored by pin | `look.json`, `scripts/vendor-look.mjs` into `web/src/look/` (never edit the copy) |
| The Hub folder, and the desktop app's check | `packaging/windows/package.ps1` (and `sign.ps1`), into `dist/hub/`; `packaging/windows/check.mjs` |
| The Hub record and store page | `packaging/hub/` (`words.json`, `pictures.json`, `README.md`; `desktop-shot.mjs` the desktop capture, `gear-shots.mjs` the kits' gear for the hero, card and cover, `salvage-frames.mjs` the cycling Salvage picture, `pictures.mjs` the pictures) |
| The web host | `hosting/` (the r2-host-kit, `wrangler.jsonc`, `publish.json`, `README.md`) |
| The placeholder icon | `packaging/icons/` (`node packaging/icons/render.mjs`) |
| The plan and progress log | `docs/PLAN.md` |
| **The build plan to finish the Rig push** (sessions R1..R9, in order) | `docs/BUILD_PLAN.md` |
| The look's labs (the owner's picks live in their db) | `docs/design/` |

## Build and check (Box-C)

- **Desktop:** `pwsh packaging/windows/package.ps1` (Visual Studio 18, toolset v145, then `node web/build.mjs` for the
  page; a minute or two). `-SkipBuild` to re-package, `-Sign` with the owner's SimplySign session open. Then `node
  packaging/windows/check.mjs` (33 checks): `crbn-rig.exe --render` against the parity harness, then the app itself
  under a throwaway WebView2 profile with DevTools on loopback (the page, the driver's status, the riff through the
  native engine, Output, Standby and Space, an IR, real keys, the library (R4: a generated 5,000-file folder in
  `dist/desktop-check/library` picked in the real folder dialog, indexed natively and read as `library.js` reads it,
  searched, played, starred, watched), auto-off in the native engine, Audio settings, a clean exit), then a second
  opening on the same profile, which plays the guitar at once because it was playing at close (R3) and has the library
  back. It plays the riff and the guitar input quietly through the default devices and will not run beside an open CRBN
  Rig. Stop any headless Edge a stopped probe left behind first (profiles `crbn-rig-edge-*`): it can hold the default
  audio device. `CRBN_RIG_DEVTOOLS=1` gives a release build its developer tools.
- **Web:** `node web/build.mjs` (emscripten SDK 6.0.13 at `%LOCALAPPDATA%\emsdk`), then `node web/check.mjs`
  (headless Edge on loopback: the page paints in Rig's look, the engine plays the example capture through the real
  AudioWorklet, equal to the engine run directly, the squeal guard mutes a real feedback loop through the worklet, and
  auto-off trips through the page's own input, Edge's fake microphone playing a pulled jack; the library opens NAM
  Core's examples and a generated folder from the browser's private folder, and indexes 5,000 files in time; its fixture
  is `web/test/library-fixture.mjs`). `node web/engine/test.mjs`
  plays every NAM Core example capture through the wasm engine and the same source built with MSVC and compares them
  sample by sample (most are bit-identical), then the squeal guard's and auto-off's cases (`web/engine/scenarios.mjs`:
  feedback loops, pulled jacks, and long notes, chords, sweeps and the riff that must trip nothing) in both builds.
  NAM Core's example clip, the page's "demo riff", is a second of silence and a second of a 220 Hz sine.
  `node web/shots.mjs` takes the store screenshots, one per look. `node web/probe.mjs <steps.json>`
  runs script, CPU measures and clipped screenshots against `dist/web` in headless Edge (`web/test` under `/__selftest/`);
  `--clashes` lists class names the hardware kits share with the page's stylesheet.
- **Hosting:** `hosting/README.md` (`node hosting/kit/publish.mjs --promote` from a clean `main`).
- **Icons:** `node packaging/icons/render.mjs` (headless Edge).
- Builds fetch nothing. `dist/` is never committed.

## Rules that are easy to get wrong here

- **Names a person reads say CRBN Rig; identities keep theirs.** The app id is `com.pavillionhub.crbn.amp`; the
  settings folder is `%LOCALAPPDATA%\CRBNAmp` (`BUNDLE_NAME`, one word because macOS bundle ids cannot hold a space);
  the plug-in ids are `'CRig'` / `'Goat'`, never upstream's; the C++ names stay, and so does `###NeuralAmpModeler###`
  when P4 brings a saved state back (R2a removed upstream's).
- **Rig's cherry `#d92b52` is the accent in Capsule only** (it sits near Daylight's and Holo's error reds), and a clip
  or error mark never relies on colour alone (D-CRBN-021 (b)).
- **The vendored libraries are ours to fix, carefully.** A change to `iPlug2/`, `NeuralAmpModelerCore/`,
  `AudioDSPTools/` or `eigen/` is a reviewed commit, named in its message; the change list shows it under its own
  heading. Prefer a fix in this repo's own files when one will do. Never re-vendor from upstream without the owner.
- Sessions push to `main` (D-CRBN-006). Never push to, or open anything on, sdatkinson's repos.
