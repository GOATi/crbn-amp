# CRBN Rig: the build plan to finish the Rig push

**Written 2026-11-11 (SYNC:RIG-006), at the owner's ask:** "write a build plan for the following suite of sessions to
follow in order, to finish off the rig push". Each session below is one RIG session on GOATi-Box-C. Sessions take
them **in order**: a session starts from the `NEXT KICKOFF` of the last `SYNC:RIG-` entry, which names its step here,
and ends by naming the next one. Where a step will not fit one session, it says how to split.

`docs/P3-UX.md` is the brief for what each feature does. This plan is the order, the owner's inputs each step needs,
and when a step is done. The owner's decisions so far are D-CRBN-021 and D-RIG-001..008 (crbn-launcher
`docs/DECISIONS.md`); a new one is the next `D-RIG-NNN`.

## Where the push stands (2026-11-11)

- **Desktop app** on the dev Hub: signed, reviewed, public. It still draws upstream's IGraphics UI, which the owner
  dropped from Rig (D-RIG-007 (a)); its new stompbox icon ships with its next build.
- **Web version** at `https://rig.carbonlinear.com`: the owner's lab picks are live (D-RIG-008): the stompbox mark;
  the Amp front layout, faceplate and LED meters by default, with the other drawings as player's choices; the finishes
  (the look's own, cherry, gold, rose gold `#f29077`, Custom with a colour wheel); Livewire's look menu with the suite
  switch.
- **Store page:** the new pictures are uploaded (record version 10). The desktop screenshot still shows upstream's
  drawing.
- **Not built:** everything in P3 except the look. That is the power switch, squeal guard, library, favourites, rigs
  and pedals, MIDI and TONE3000 (U1 and U3 to U7), and the desktop on the page (U2).

## What "finished" means for this push

1. Every P3 feature (U1 to U7) works in **both** builds, the desktop app and the web version, from one page and one
   engine, each drawn as the owner picked (D-RIG-008 (d)), with the other drawings in the look menu.
2. A **signed desktop build** is published to the dev Hub and confirmed byte for byte. The **web version** is
   promoted. The **store page** shows the new UI in every picture.
3. `docs/PLAN.md`, `docs/P3-UX.md`, `packaging/hub/README.md` and the SYNC log say so.

**Not in this push** unless the owner adds them: P4 (VST3/AU plug-in formats and their installer), the production Hub
(Rig is on dev), a tuner, recording and shared presets (P3-UX's "next steps").

## The sessions, in order

| # | Session | Needs from the owner first | Done when |
|---|---|---|---|
| R1 | The look's details | His picks in a small Detail Lab | His picks built, checked, published |
| R2 | The desktop on the page (U2) | His word on vendoring the WebView2 SDK and WIL; a SimplySign session at the end | `crbn-rig.exe` shows the page over the native engine; signed, published, confirmed |
| R3 | Power, auto-off, squeal guard (U1) | Nothing new (D-RIG-008 (e): guard on by default) | Both builds; no false trips on real playing |
| R4 | The library (U3) | Nothing new | Both builds; a 5,000-file folder stays fast |
| R5 | Favourites on standby (U4) | Nothing new (ten, keys 1 to 0) | Switching is gapless and click-free in both builds |
| R6 | Rigs, variants and pedals (U5) | Nothing new | Pedals in series, hot-swapped while playing |
| R7 | MIDI (U6) | MIDI in the browser, yes or no; his MC8 backup file, if he has one | His MC8 drives Rig by drag and drop |
| R8 | TONE3000 in the library (U7) | His word on TONE3000's API terms, which the session brings him | Browse, favourite and play TONE3000 captures in the library |
| R9 | Release and store | A SimplySign session; his look at the new pictures | Signed release, web promoted, store refreshed |

R1 can be skipped or moved if the owner prefers to go straight to R2. It is first because he asked for it
("then I follow up on these details with the following session").

### R1. The look's details (the owner's follow-up)

His note in the Rig Lab (D-RIG-008 (f)): "I'm not happy with the stripe detail overlay/finish on the plate on the amp,
and the gradients and treatments on the buttons and knobs."

**Widened by the owner when R1 started (2026-11-11, SYNC:RIG-007):** not a small Detail Lab but a full range of
hardware kits for the amp's and the pedals' knobs, switches, lights and faceplates, so that he can pick the default and
offer the rest as players' choices. There are two families. **Classic** kits follow the gear players know (his
examples: Marshall, Fender, Peavey, Mesa/Boogie, Boss), never copying a maker's name, logo or panel. **New** kits put
the energy of the Hub's logo window inside the amp, behind faceplates with cutouts and meshes between. He reviews them
before anything is built. The lab is the **Hardware Lab**: https://claude.ai/artifact/WdqG3GWav3qnqffCQeVe4m (source
`docs/design/2026-11-11-hardware-lab/lab.html`). It holds 10 classic and 9 new kits, each an amp and a pedal with the
real controls. It also has a builder for the energy kits, Rig's page as a stage, and six questions. His picks go to its
db: `picks/<kit>` (keep, maybe or cut, and a note), `picks/default`, `picks/q-<id>`, `picks/builder` and
`picks/general`. The steps below still hold, scaled to the kits he keeps. Many kept kits may need R1 and an R1b; the
energy kits share one engine, a port of the Hub's `shell/logo-window` layers.

- **Lab first, as before:** a small **Detail Lab** artifact (the Rig Lab's pattern: three options per area, live on a
  mock of the real page in all four looks and three finishes, Pick and a note saved to its db). Areas: the faceplate's
  finish (today's brushed stripes; a smooth satin gradient; a fine grain, or anodised flat), the knobs (today's shine;
  matte; flat with a ring), the buttons (today's gradient primary; flat; outlined), the toggles. Read the picks with
  ArtifactData, ask anything unpicked in the picker, record them as a D-RIG row.
- **Build:** they are tokens already, `--plate-texture` and `--knob-shine` in `web/src/style.css`, plus `.btn.primary`
  and the toggle rules. The faceplate also draws the cab plate and the stripe drawing, so change all three together.
- **Check and ship:** `node web/check.mjs` (17 checks), headless shots of each look and finish, `node
  hosting/kit/publish.mjs --promote` (allowed on this PC), `node web/check.mjs --url=https://rig.carbonlinear.com`. Re-render
  the store pictures only if the faceplate changes how they look, and upload them with new names (the CDN keeps a name
  for a day).

### R2. The desktop on the page (U2): may take two sessions

The page becomes the desktop app's UI through iPlug2's WebView2 editor, over `web/engine/rig_engine.cpp` compiled into
the plug-in, so every later feature is built once (D-RIG-008 (e)). Upstream's IGraphics UI is not kept as a choice
(D-RIG-007 (a)).

- **Ask first: vendoring two Microsoft dependencies.** iPlug2's `IPlug/Extras/WebView` is vendored but includes
  `WebView2.h` (the Microsoft.Web.WebView2 SDK, BSD-style licence) and `wil/com.h` (Windows Implementation Library,
  MIT), which are not. Builds fetch nothing (D-CRBN-003), so both must be vendored as D-RIG-001 vendored iPlug2: at a
  pinned version, trimmed to the headers and the loader, licences kept, recorded in `vendor.json` and `UPSTREAM.md`.
  That needs the owner's word (a one-time download). The WebView2 **runtime** is part of Windows 10 and 11 (Box-C has
  157). The app says what to do if the runtime is missing.
- **R2a, the app on the page:**
  - The standalone's editor becomes `WebViewEditorDelegate`, loading the page's files from the app's folder. The Hub
    package carries them, from `web/src` plus the wasm-free engine glue.
  - The page's engine becomes two backends behind one interface in `web/src/engine.js`: today's AudioWorklet, and a
    native one through WebView messages (`window.chrome.webview`). The messages carry parameter changes, a capture's
    or IR's bytes or path, meters and clip at about 30 Hz, and status: device, sample rate, buffer, latency.
  - `rig_engine.cpp` replaces the plug-in's own DSP chain in `ProcessBlock`. The parity test (`node
    web/engine/test.mjs`) keeps the web and native engines equal sample for sample.
  - The standalone's audio and MIDI settings dialog opens from the page ("Audio settings…").
  - Settings live in the app's state, and the WebView's data folder sits under `%LOCALAPPDATA%\CRBNAmp`.
  - Desktop-only words follow the host: no "Play my guitar" permission flow, the device list from the driver, and
    "Desktop app" swaps for "Open the web version".
- **R2a's checks:**
  - A scripted run of `crbn-rig.exe` shows the page; take a screenshot (crbn-launcher `scripts/desktop-host/shot.ps1`).
  - A headless render switch, for example `--render in.wav out.wav --capture x.nam`, plays the example capture equal
    to `web/engine/test.mjs`'s reference.
  - Parameters round-trip, and the meters move.
- **R2b, ship it:**
  - Package with `pwsh packaging/windows/package.ps1`, signed in the owner's SimplySign session (`-Sign`).
  - Publish to dev and confirm (`packaging/hub/confirm.ps1`).
  - Retake the store's desktop screenshot and upload it under a new name.
  - Update `packaging/hub/README.md`.

### R3. Power, auto-off and the squeal guard (U1)

As P3-UX's U1, drawn as picked: power B (a pilot lamp and Power / Standby toggles on the faceplate) by default, with
the header pill (A) and the big button (C) in the look menu; Space as the key.

- **Engine (`rig_engine.cpp`, both builds):**
  - **Standby:** the output fades out in about 20 ms; the input stays open.
  - **Auto-off:** standby when the input device disappears (the browser's `devicechange` or the track's `ended`; the
    driver's device-removed on the desktop), and on the signature of a pulled jack (a full-scale spike, then mains hum
    at 50 or 60 Hz, or dead silence).
  - **The squeal guard,** on by default (D-RIG-008 (e)): it mutes when a narrow peak holds well above the rest of the
    spectrum for a few hundred milliseconds **and grows or sustains in the input too** (feedback loops back through
    the input; a held note does not keep rising). It says why, with the frequency, in words, never colour alone.
    Space, or one click, brings the output back.
- **Tests, the part that matters:**
  - Synthetic feedback (a growing sine fed back into the input) trips the guard within 300 ms.
  - A pulled-jack recording, or its synthetic spike and hum, trips auto-off.
  - **No false trips:** NAM Core's demo riff, long sustained notes with and without high gain, and a sine sweep never
    trip it.
  - Add these to `web/engine/test.mjs` so both builds run them.
  - `web/check.mjs` gains checks for the controls and the banner.

### R4. The library (U3)

As P3-UX's U3, drawn as picked: the list (A) by default, cards (B) and shelves (C) in the look menu. It replaces the
"Your captures" panel.

- **The folder:** the desktop reads it directly (a native folder dialog through the bridge). The browser asks once
  through `showDirectoryPicker` and keeps the handle in IndexedDB, or takes dropped files where that API is missing.
- **The index:**
  - Each `.nam` file's `metadata`: name, gear type, make and model, tone type, who captured it, sample rate.
  - Each `.wav` file's length and rate.
  - Kept in IndexedDB on the web and in the settings folder on the desktop; refreshed when the folder changes.
- **What a person does:** search as they type, filter chips (gear, tone, favourites), sort, a star on every row, and
  click to hear it.
- **Tests:** an index of NAM Core's examples; a generated 5,000-file folder indexes in under 10 s and searches in
  under 50 ms; favourites survive a reload.

### R5. Favourites on standby (U4)

As P3-UX's U4: ten pads on keys 1 to 0, footswitches (A) by default, keycaps (B) and setlist (C) in the look menu.
Arrows give next and previous.

- **Engine:** hold up to ten models loaded, play one, and crossfade over 20 to 50 ms on a switch. Measure memory and
  CPU in the browser with ten standard captures; if the browser cannot hold ten, say so and load ahead of time on hover
  or key-down instead.
- **Tests:** a switch has no gap, and no click above the crossfade (an offline render compared against a reference
  crossfade); keys work with the look menu shut and are ignored while typing in a field.

### R6. Rigs, variants and pedals (U5)

As P3-UX's U5. Stompboxes (B) by default, rows (A) and chain chips (C) in the look menu. Variants sit on Q, W and E.

- **Engine:** captures in series (pedal slots, then the amp, then the cabinet), hot-swapped with the same crossfade.
  The page shows the CPU load and refuses a chain the device cannot run in real time, with the reason.
- **Rigs:** saved locally, and exported or imported as a small JSON file (names and file references, never the
  captures themselves).
- **Tests:** a two-pedal chain renders equal to its stages run one after another; a swap while playing is click-free.

### R7. MIDI (U6)

As P3-UX's U6. **Ask first:** MIDI in the browser (a second Hub permission ask for Web MIDI in the tool view, as
D-RIG-003 did for the microphone; that change is the Hub lane's, briefed in goati-sync `proposals/`), or MIDI on the
desktop only. The desktop takes MIDI through iPlug2: `PLUG_DOES_MIDI_IN` goes to 1 in `config.h`.

- **Drag and drop:** drag any control (a knob, switch, pad, variant or the power switch) onto the MIDI dock, press the
  footswitch or move the pedal, and it is mapped. Program Change maps rigs and variants; CC maps switches (toggle or
  momentary) and knobs; an expression pedal maps to any knob, with its range drawn on the knob. A live monitor shows
  what arrives.
- **The MC8:** first find out the Morningstar MC8 editor's backup format and whether a bank can be imported. If it
  can, Rig exports one from its mappings so the controller needs no separate editing. Bring the findings to the owner
  before building the export. His own backup file is the best test.
- **Tests:** synthetic MIDI in both builds (a virtual port on the desktop); learn, map, round-trip, and the
  mappings saved.

### R8. TONE3000 in the library (U7)

As P3-UX's U7. **Ask first:** read TONE3000's API and its terms for API clients, and bring them to the owner with a
recommendation. Build only within those terms, crediting authors as the terms ask (D-CRBN-021 (e)).

- Sign in to TONE3000, browse and search inside Rig's library, favourite, and play, with captures cached locally
  without a person handling files.
- **Tests:** against TONE3000's sandbox or a recorded fixture, never hammering the live service from a test.

### R9. Release and store

- Run every check in both builds: `web/engine/test.mjs`, `web/check.mjs`, the desktop smoke, and the parity render.
- Make a signed desktop build in a SimplySign session, publish it to dev and confirm it.
- Run `publish.mjs --promote` for the web version, then check it live with `check.mjs --url`.
- **Store:** new screenshots of the new UI on the desktop and the web, new words where the features changed
  (`packaging/hub/words.json`), all uploaded under new names after the owner sees them.
- **Docs:** `docs/PLAN.md` (P3 done), `docs/P3-UX.md` (status), `packaging/hub/README.md`, a SYNC entry that names
  what is left (P4, production) for the owner.

## Rules every session keeps

- **Start** from crbn-launcher `CLAUDE.md`, goati-sync `SYNC.md` (Rig's last entry and its `NEXT KICKOFF`) and
  `docs/DECISIONS.md`. **End** with a `SYNC:RIG-NNN` entry whose `NEXT KICKOFF` names the next step here, and push
  every repo touched (D-CRBN-006).
- **Both builds from R2 on.** A feature is built once, in the engine and the page, and checked in both.
- **Tests:**
  - Engine changes keep `node web/engine/test.mjs` (wasm against MSVC, sample for sample) green.
  - Page changes keep `node web/check.mjs` green and add checks for what they add.
  - Headless screenshots in each look before anything ships.
- **Publishing:**
  - **Web:** this PC's Claude settings allow `node hosting/kit/publish.mjs` (the owner's word, 2026-11-11). Promote
    after a green check, then verify with `check.mjs --url` and record the rollback build.
  - **Desktop:** needs the owner's SimplySign session for signing. Batch it to the end of a session.
  - **Store pictures:** the owner sees them first. Upload changed ones under new names.
- **Decisions:** a choice that is the owner's goes to him in the picker, or in a lab where it is visual, and is
  recorded as the next `D-RIG-NNN`.
- **Upstream:** `iPlug2/`, `NeuralAmpModelerCore/`, `AudioDSPTools/` and `eigen/` are ours to fix, carefully: a fix is
  a reviewed commit named as such. Never re-vendor from upstream without the owner (CLAUDE.md).

## Open outside the sessions

- **The Hub lane:** the desktop Hub's tool view grants a web tool no microphone yet (D-RIG-003, goati-sync
  `proposals/2026-11-10-hub-tool-view-audio-input.md`), so Rig's web version in the desktop Hub cannot hear a guitar
  until that lands. R7 may add a Web MIDI ask.
- **The mark:** Audeze's US registration of CRBN for headphones (`docs/reviews/2026-11-10-mark-knockout-crbn-rig.md`)
  is with the owner's adviser, across the suite.
- **The Console lane:** Rig's web version is the first to write the `crbn-look` cookie (D-CRBN-024's web half).
  Livewire and Mixtape read it when they take D-CRBN-023.
