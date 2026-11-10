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

- **the desktop app**: the iPlug2 standalone, `crbn-rig.exe`, installed and updated by the Hub as a folder;
- **the web version**: our own page in the suite's looks (`web/`), with NAM's core compiled to WebAssembly in an
  AudioWorklet, at `https://rig.carbonlinear.com` (public but unlisted).

The owner intends a UX of our own, replacing upstream's. The web page is its seed; iPlug2's WebView2 editor can later
put the same page on the desktop (`docs/PLAN.md`).

## Where things are

| What | Where |
|---|---|
| The plug-in / standalone (C++) | `NeuralAmpModeler/` (`NeuralAmpModeler.cpp`, `NeuralAmpModelerControls.h`, `config.h`, `Colors.h`, `resources/`) |
| Upstream's libraries, vendored (`vendor.json`, `UPSTREAM.md`; D-RIG-001) | `iPlug2/`, `NeuralAmpModelerCore/`, `AudioDSPTools/`, `eigen/` |
| The web version | `web/` (`src/` the page, `engine/` the C++ glue compiled to wasm, `build.mjs`, `check.mjs`) |
| The suite's looks, vendored by pin | `look.json`, `scripts/vendor-look.mjs` into `web/src/look/` (never edit the copy) |
| The Hub folder | `packaging/windows/package.ps1` (and `sign.ps1`), into `dist/hub/` |
| The Hub record and store page | `packaging/hub/` (`words.json`, `pictures.json`, `README.md`) |
| The web host | `hosting/` (the r2-host-kit, `wrangler.jsonc`, `publish.json`, `README.md`) |
| The placeholder icon | `packaging/icons/` (`node packaging/icons/render.mjs`) |
| The plan and progress log | `docs/PLAN.md` |
| **The build plan to finish the Rig push** (sessions R1..R9, in order) | `docs/BUILD_PLAN.md` |
| The look's labs (the owner's picks live in their db) | `docs/design/` |

## Build and check (Box-C)

- **Desktop:** `pwsh packaging/windows/package.ps1` (Visual Studio 18, toolset v145; about a minute). `-SkipBuild` to
  re-package, `-Sign` with the owner's SimplySign session open.
- **Web:** `node web/build.mjs` (emscripten SDK 6.0.13 at `%LOCALAPPDATA%\emsdk`), then `node web/check.mjs`
  (headless Edge on loopback: the page paints in Rig's look, and the engine plays the example capture through the real
  AudioWorklet, equal to the engine run directly). `node web/engine/test.mjs` plays every NAM Core example capture
  through the wasm engine and the same source built with MSVC and compares them sample by sample (most are
  bit-identical). `node web/shots.mjs` takes the store screenshots, one per look.
- **Hosting:** `hosting/README.md` (`node hosting/kit/publish.mjs --promote` from a clean `main`).
- **Icons:** `node packaging/icons/render.mjs` (headless Edge).
- Builds fetch nothing. `dist/` is never committed.

## Rules that are easy to get wrong here

- **Names a person reads say CRBN Rig; identities keep theirs.** The app id is `com.pavillionhub.crbn.amp`; the
  settings folder is `%LOCALAPPDATA%\CRBNAmp` (`BUNDLE_NAME`, one word because macOS bundle ids cannot hold a space);
  the plug-in ids are `'CRig'` / `'Goat'`, never upstream's; the C++ names and `###NeuralAmpModeler###` stay.
- **Rig's cherry `#d92b52` is the accent in Capsule only** (it sits near Daylight's and Holo's error reds), and a clip
  or error mark never relies on colour alone (D-CRBN-021 (b)).
- **The vendored libraries are ours to fix, carefully.** A change to `iPlug2/`, `NeuralAmpModelerCore/`,
  `AudioDSPTools/` or `eigen/` is a reviewed commit, named in its message; the change list shows it under its own
  heading. Prefer a fix in this repo's own files when one will do. Never re-vendor from upstream without the owner.
- Sessions push to `main` (D-CRBN-006). Never push to, or open anything on, sdatkinson's repos.
