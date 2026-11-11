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
  dropped from Rig (D-RIG-007 (a)); its new stompbox icon ships with its next build. (Later the same day, R2a built
  the app on Rig's page, D-RIG-017, and R2b shipped it as 0.9.0, signed, D-RIG-018.)
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
| R1 | Rig's hardware: the kits (built, SYNC:RIG-015) | Done: the Hardware Lab (D-RIG-009..015), the texture library (D-RIG-016) | The 20 kits on the page, CRBN the default, published |
| R1b | The Rig builder, RIG1 codes, players' own art | Nothing new (D-RIG-009 (c), D-RIG-010 (f)) | Players build, keep and share an energy kit, and bring their own knob and switch art |
| R1c | The store's skins: Salvage second and cycling, a skins section (D-RIG-018 (e)) | His look at the pictures and words before upload | The store shows CRBN, then Salvage cycling through its shuffles, and a section on choosing and customising skins |
| R2 | The desktop on the page (U2): built and shipped (SYNC:RIG-016, RIG-017; D-RIG-017, D-RIG-018) | Done: the WebView2 SDK alone (D-RIG-017); his SimplySign session (R2b) | `crbn-rig.exe` shows the page over the native engine; signed, published, confirmed |
| R3 | Power, auto-off, squeal guard (U1) | Nothing new (D-RIG-008 (e): guard on by default) | Both builds; no false trips on real playing |
| R4 | The library (U3) | Nothing new | Both builds; a 5,000-file folder stays fast |
| R5 | Favourites on standby (U4) | Nothing new (ten, keys 1 to 0) | Switching is gapless and click-free in both builds |
| R6 | Rigs, variants and pedals (U5) | Nothing new | Pedals in series, hot-swapped while playing |
| R7 | MIDI (U6) | MIDI in the browser, yes or no; his MC8 backup file, if he has one | His MC8 drives Rig by drag and drop |
| R8 | TONE3000 in the library (U7) | His word on TONE3000's API terms, which the session brings him | Browse, favourite and play TONE3000 captures in the library |
| R9 | Release and store | A SimplySign session; his look at the new pictures | Signed release, web promoted, store refreshed |

R1 can be skipped or moved if the owner prefers to go straight to R2. It is first because he asked for it
("then I follow up on these details with the following session"). After R1 he took R2 before R1b (D-RIG-017 (a)):
R1b only adds to the page, so it lands in both builds whenever it comes, and can fill a gap while R2b waits for a
SimplySign session.

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

**His picks and notes so far (D-RIG-009, D-RIG-010):** 18 kits are kept, and his own builder kit CRBN is the default.
Players get the Rig builder with share codes. Players can also bring their own art for knobs and switches: templates go
out, art comes in, and it is kept and shared with the kit. For that, every knob and switch is built as layered SVG.
Salvage is drawn from the texture library's photographs, with a crop for each piece. Pedal knobs show only their end
numbers. "CRBN Rig" stands straight on every head.
Salvage (D-RIG-011..015) is kept, with players' choices for the sheet, the grille (expanded metal, chicken wire,
woven wire, perforated sheet), the grille's metal, the glow and the words, plus Shuffle. His own setup is the Rust
and orange sheet, a perforated sheet in aged copper, valves behind it and the words on tags. He wants this Salvage
setup in the app's screenshots on Pavillion (R9).

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

### R1, as built (2026-11-11, SYNC:RIG-015, D-RIG-016)

- **The page:** the amp's drawing **b** is "Hardware": the kit picked under "Rig's hardware" in the look menu draws the
  amp and the cabinet. Islands and stripe stay as choices; the old CSS faceplate is gone. "Kit's own" is the default
  finish.
- **The code:** `web/src/hw/hw.js` holds the lab's kits, drawing, cutouts, Salvage and energy engine nearly
  verbatim (each part marked with its lab lines), then the page's side. That side binds every knob, fader and
  switch to Rig's settings, feeds the energy from the input level, and wires Power and Standby (page-level until
  R3). `hw.css` is the lab's CSS scoped under `.rig-hw`. The energy rests on a still frame after 30 s with
  nothing playing and nobody using the page (D-RIG-016 (e)).
- **Salvage:** its sheets come from the texture library (`web/src/hw/tex/`, D-RIG-016 (a)), with his setup the
  default and players' choices in the menu.
- **The checks:** `node web/check.mjs` has 30 checks, 13 of them for the hardware.
- **Not in R1:** pedals (R6) and the builder (R1b, below).

### R1b. The Rig builder, share codes and players' own art

The lab's builder (`lab.html`: `B_OPTS`, `BUILDER`, the builder's controls, RIG1 codes, "Your own art") for players,
in the look menu or a panel beside it. `hw.js` already carries `B_OPTS` and `BUILDER`, and `kitOf` reads a `builder`
kit.

- **Build:** name and keep a kit locally, beside the twenty; copy and open RIG1 codes; templates of any knob or
  switch saved as SVG (every control is already drawn as layered SVG); art imported as SVG, PNG, WebP or JPEG up to
  2 MB, kept in IndexedDB, with a knob turning as one picture and a switch as two frames (D-RIG-010 (f)).
- **Sharing art** beyond the codes goes through the Hub, a store for the Hub lane to host: write it as a proposal in
  goati-sync `proposals/`.
- **Checks:** a code round-trips a kit; imported art draws and turns; the builder's kit survives a reload.

### R1c. The store's skins (D-RIG-018 (e))

The owner, at R2b: "Salvage looks really awesome, and so I want it to be prominant both in screenshots, and on the app
store page itself in a section about "Choosing and customing your own skins" section. I want the CRBN skin to be the
first one players see, and Salvage to be the second - And ideally the salvage one cycles, and is a bit random, to
really highlight how organic and customisable that skin is." It comes after R1b, because R1b's builder and players' own
art are the customising this section shows. It can be the end of R1b's session if there is room.

- **Already done (R2b):** CRBN is the store's first picture (`crbn-rig-shot-2-desktop-2.png`, the desktop app).
- **The second picture: Salvage, cycling.**
  - Capture several Salvage shuffles. Use `node packaging/hub/desktop-shot.mjs --kit=hammer` for the desktop. For
    the web, the page's own Shuffle, or a `seed`, gives a new crop on every piece. Include his setup (D-RIG-015 (b)).
  - Join the captures into one animated PNG that holds each look for a moment. The listing tool takes it as a
    `.png`, and the Hub's store shows uploaded pictures as plain images from the CDN (pavillion_client `hub/packages/
    blocks/src/legacy/storeToPage.ts`, `Picture.tsx`), so it should play there.
  - **Test it on the dev Hub before relying on it,** in the Hub's own Electron and in a browser. If the store shows
    only a still frame, or a resized copy, offer the owner the alternatives: a YouTube video (the store's
    `videos`), or two or three still Salvage pictures.
  - Its place in `pictures.json` `storeMedia` is second. Use new file names, since the CDN keeps a name for a day.
- **The section:** a `## Choosing and customising your own skins` section (or the owner's wording) in
  `packaging/hub/words.json` `page`. It covers:
  - the twenty kits, CRBN the default;
  - Salvage's choices and Shuffle;
  - the Rig builder, RIG1 share codes and players' own knob and switch art.

  Show the owner the words with the pictures before `hub-listing apply`.
- **Checks:** `hub-listing plan` shows the new names unserved, then `upload` and `apply` read back. The store shows
  CRBN first and Salvage second.

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

### R2a, as built (2026-11-11, SYNC:RIG-016, D-RIG-017)

- **The owner's word** (D-RIG-017 (b)): the WebView2 SDK alone, with Rig's own host instead of iPlug2's
  `IPlug/Extras/WebView`. That version loads from `file://` (the page's modules and fetches are refused there), cuts
  messages to the page at 1,024 characters, and needs WIL. `WebView2/` holds version 1.0.4314.35, four files byte for
  byte (`vendor.json`, `UPSTREAM.md`). Nothing in `iPlug2/` changed.
- **The app** (`NeuralAmpModeler/`):
  - `NeuralAmpModeler.cpp` is a thin host now. Its DSP is `rig_engine.cpp` through `RigDesktop.cpp`, and its window
    is the page through `RigWebView.cpp`. The message list heads `NeuralAmpModeler.cpp`.
  - Upstream's IGraphics UI and DSP chain are gone, with `NeuralAmpModelerControls.h`, `Colors.h`,
    `Unserialization.cpp` and the fonts and pictures in `main.rc`. The app builds with `NO_IGRAPHICS`.
  - The window is resizable and opens at 1280 x 800 (or nine tenths of the screen). The page is served from `web\`
    beside the exe as `https://crbn-rig.example/`, and its storage lives in `%LOCALAPPDATA%\CRBNAmp\WebView2`. With no
    WebView2 runtime, or no `web\` folder, the window says what to do and keeps the File menu.
  - `crbn-rig.exe --render <capture> <in.f32> <out.f32> <rate> [block]` renders as `web/engine/native_render.cpp` does,
    and exits with code 3 beside a running copy.
- **The engine:** a native build of `rig_engine.cpp` adds `rig_stage_model`, `rig_stage_clear_model` and
  `rig_collect`. The UI thread builds a capture, `rig_process` swaps it in, and the UI thread frees what it replaced.
  The wasm build leaves them out.
- **The page:**
  - `web/src/audio-web.js` (the web graph, moved out of `app.js` unchanged) and `audio-desktop.js` (messages) answer the
    same calls.
  - `index.html` marks the desktop app (`data-host="desktop"`) before the first paint. `[data-web]` and
    `[data-desktop]` words and buttons show by host: "Web version" for "Desktop app", and "Audio settings…" (iPlug2's
    driver dialog) for the input list. The status line and the "Audio device" field come from the driver.
  - Captures go as their JSON text. An IR and the demo riff are decoded by the page at their own rate, and the
    engine resamples and scales them as the desktop always did.
  - **Nothing plays until "Play my guitar"** (no permission to ask): until R3's squeal guard, a laptop's microphone
    and speakers must not feed back when the app opens.
- **R1's slip fixed:** `hw.js` called `$` for `$$` when fonts loaded late, which the desktop's first start showed.
- **The checks:**
  - `node packaging/windows/check.mjs`, 21 checks:
    - `--render` equals the parity harness, bit for bit (four cases);
    - the page from its folder in Rig's look, with the desktop's words;
    - the driver's status reaches the page;
    - the demo riff through the native engine, with both meters moving;
    - Output -40 to -30 dB measures +10.00 dB;
    - Standby silences the output while the input is still heard;
    - a unit-impulse IR measures -17.27 dB (-17.26 expected at 44.1 kHz);
    - real arrow keys and typing reach the page;
    - Audio settings opens the driver's dialog;
    - no page errors;
    - a clean exit.
  - It plays the riff quietly through the default device for about ten seconds, with a throwaway WebView2 profile in
    `dist/desktop-check`.
  - `node web/check.mjs` 30/30, and `node web/engine/test.mjs` all cases (most bit-identical).
- **Not yet:** R2b (signing, publishing, the store's desktop screenshot). The VST3, AAX and macOS projects still name
  the removed files (P4). The desktop page doesn't read the suite look file (D-CRBN-024's desktop half) yet.

### R2b, as built (2026-11-11, SYNC:RIG-017, D-RIG-018)

- **The version:** 0.9.0, in `config.h` and `main.rc` (the owner's word), for the first build on Rig's page.
- **Signed** in the owner's SimplySign session (`package.ps1 -Sign`): GOATi's Certum certificate, Certum's timestamp,
  `signtool verify` clean. `packaging/windows/check.mjs` 21/21 on the signed folder; `web/check.mjs` 30/30;
  `web/engine/test.mjs` all cases.
- **Published to dev:** manifest `e043f4dd9e25048f31838edfdcd08c041261b4f2`, 63 chunks, 2.0 MB sent. `confirm.ps1`:
  the CDN serves it, and PatcherCli installs 67 of 67 files byte-identical. The owner's Hub sees it after a restart.
- **The web version** published on his word: build `20261111-0839-fff8c4a-f802d8f4`, all 62 files live.
- **The store's desktop picture:** `packaging/hub/desktop-shot.mjs` (new) captures the real app from the Hub folder:
  - a throwaway profile, and Output at -12 dB;
  - the demo riff, captured at a loud moment;
  - the window's visible bounds only.

  `art.html` frames that capture. `pictures.mjs --only=desktop` renders the piece alone; `--desk=` and `--out=` are
  for previews. The owner picked CRBN over Salvage. The picture went up as `crbn-rig-shot-2-desktop-2.png`, first in
  `storeMedia`, and the record reads back at version 16. The hero still shows upstream's window as an inset, and the
  web pictures show the pre-R1 faceplate, until R1c and R9.
- **A pitfall on this box:** a fresh WebView2 profile on D: (a 2 TB hard disk, 5% free) kept the page from getting
  ready for 13 to over 30 seconds; on C: (an NVMe SSD) it takes about two. `desktop-shot.mjs` keeps its profile in
  the temp folder. `check.mjs` still keeps its profile in `dist/desktop-check` on D:; if it times out waiting for
  the page, move that profile too. The app's own profile is under `%LOCALAPPDATA%` (C:).

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
  (`packaging/hub/words.json`), all uploaded under new names after the owner sees them. At least one screenshot shows
  Salvage in his setup (D-RIG-015). Keep R1c's order: CRBN first, Salvage cycling second, and the skins section
  (D-RIG-018 (e)).
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
