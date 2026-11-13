# CRBN Rig: the plan

The owner's goal (2026-11-10, D-CRBN-021): get crbn-amp "working, so that we can load this up in Pavillion, both the
web app and via the client as a download/install, complete with our own branding, and then we can refine the UX".
CRBN Rig stays in TONE3000's ecosystem and credits it, with a UX of our own.

## Phases

| Phase | What | State |
|---|---|---|
| **P1 Desktop on the Hub** | The rebrand (name, cherry, icon, About, links, `crbn-rig.exe`), the Hub folder, the store page, `pavillion-publish` to dev, confirmed byte for byte | done on dev (2026-11-10); the owner's Install and Play to see |
| **P2 Web on the Hub** | NAM's core in WebAssembly behind our own page in the suite's looks; guitar in through the browser; captures and IRs from disk; `rig.carbonlinear.com`; the record's `links.tool` | live on dev (2026-11-10): `rig.carbonlinear.com` serves it and the record's `links.tool` names it; in the desktop Hub's window the guitar input waits on the Hub lane's microphone grant |
| **P3 Our UX** | The order of sessions is `docs/BUILD_PLAN.md` (R1..R9). The owner's first pass (D-RIG-006), briefed in `docs/P3-UX.md`: the power switch and squeal guard, the page on the desktop (WebView2 over the same engine), the library, favourites on standby with QWERTY keys, rigs and variants with hot-swapped pedals, drag-and-drop MIDI (his Morningstar MC8), then TONE3000 in the library | R1 to R4 done and shipped (the kits, the Rig builder, the desktop on the page, power and the squeal guard, the library; desktop 0.9.3 signed); R5 next |
| P4 Plug-in formats | VST3 (and AU on macOS) for DAWs: the VST3 SDK, an install the Hub can place where hosts look. Upstream's Inno installer (`NeuralAmpModeler/installer/`, with its RTF readmes and the manual PDF) is not CRBN's route and still carries upstream's words; P4 rebrands it or replaces it, with an `AppId` of its own (it has none, so Inno keys it on `AppName` and it would meet an upstream install) | later |
| P5 Signing, review, public | Certum signing in a SimplySign session; a director's first-publish review; `display: public` | done on dev (2026-11-10, D-RIG-005): signed, reviewed, public |

## Open questions for the owner

- **TONE3000:** its API can let a person sign in and pick tones inside our page (P3's U7). Using it means TONE3000's
  terms for API clients.
- **The microphone in the desktop Hub's view:** the owner's word is audio only, asked once per app (D-RIG-003); the
  change is the Hub lane's (goati-sync `proposals/2026-11-10-hub-tool-view-audio-input.md`). Until it lands, "Play my
  guitar" there offers the installed app or the browser.
- **The marks:** `docs/reviews/2026-11-10-mark-knockout-crbn-rig.md` (D-RIG-004). Nothing found under "CRBN Rig"; the
  suite-wide finding is Audeze's live US registration of CRBN for headphones (Class 9), for the owner's adviser.

## Progress log

- 2026-11-14 (SYNC:RIG-030): R6 is finished in both builds (step 3; D-RIG-026). Rigs beside the pads, saved by name and
  exported or imported as a small JSON file of names and references; variants on Q, W and E keeping each pedal on or
  off and its knobs; a pedal moved along the board by its grip or arrows; a Tone on each pedal (a tilt about 800 Hz)
  with a switch that bypasses it, off by default; the board drawn as stompboxes, rows or chain chips. The engine's
  pedal knobs glide while heard. Engine 53/53, web 85/85, desktop 45/45; web build `20261113-1546-7c4360d-081f912e`
  live; the desktop unsigned until a SimplySign session. Next: R7, MIDI.

- 2026-11-13 (SYNC:RIG-024): R5 is built in both builds: favourites on standby (U4). Ten pads, the library's first ten
  favourite captures, held warm in the engine's slots and switched by keys 1 to 0, the arrows and the key left of 1:
  a 30 ms crossfade on the desktop, a dip in a browser. A load no longer stops the sound (R4's 0.1 s gap): the page
  reads a capture's JSON and the audio thread builds it in 2 ms. Engine test 40/40, web check 63/63, desktop check
  35/35. Shipped on the owner's word: web build `20261113-0409-12f896b-6798a825` (roll back with
  `--promote-only=20261112-0709-b07901a-0bb8a2c1`); desktop 0.9.4 signed on dev (manifest `89634c92…`, 71 of 71).
  `docs/BUILD_PLAN.md` "R5, as built".

- 2026-11-12 (SYNC:RIG-022): R4 shipped on the owner's word: web build `20261112-0709-b07901a-0bb8a2c1` (roll back with
  `--promote-only=20261111-1620-1e45d76-b2af5c94`); desktop 0.9.3 signed on dev (manifest `67e64025…`, 70 of 70).

- 2026-11-12 (SYNC:RIG-021): R4 is built in both builds: the library (U3). The folder's captures
  and IRs are listed with what each file says (read from its head and tail by one set of rules, `web/src/library.js`
  and `NeuralAmpModeler/RigLibrary.cpp`), searched as you type, filtered by chips, sorted, starred and played with a
  click: the list by default, cards and shelves in the look menu. A browser keeps the folder's handle; the desktop app
  has its own folder dialog, reads natively and watches the folder. 5,009 files index in 1.6 s on the desktop, and a
  search draws in under 40 ms in both. Checks: `web/check.mjs` 58, `packaging/windows/check.mjs` 33. The owner's real
  playing (R3) is still to try.

- 2026-11-12 (SYNC:RIG-020): R3 is built and shipped (crbn-launcher D-RIG-021): power, auto-off and the squeal guard
  (U1), in the engine both builds run (`web/engine/rig_guard.h`) and in the page. Standby is the engine's 20 ms fade.
  The guard asks before it trips: it dips its own output 4 dB for 50 ms and trips when the dip comes back through the
  input. Auto-off works on a pulled jack (a spike, then dead silence or 50/60 Hz hum) and on the input device going
  away. Power B is the default, with A and C in the look menu, and Space as the key. The banner says why. The desktop
  plays the guitar at open if it was playing at close. Checks: `web/engine/test.mjs` 25 guard cases in both builds,
  `web/check.mjs` 44, `packaging/windows/check.mjs` 26. Web build `20261111-1620-1e45d76-b2af5c94`; desktop 0.9.2
  signed on dev (manifest `2ba04875…`, 68 of 68). His real playing is the test still to come.

- 2026-11-11 (SYNC:RIG-018): the store's art shows the kits (crbn-launcher D-RIG-019). The hero and card show the
  CRBN amp and cabinet. The cover stacks CRBN, Salvage, Compact and Rack. The web shot and the four looks are retaken.
  All of it is from previews the owner picked (record version 24). His verdicts on eight Salvage amps, the fix for its
  soft crops, and his three reference textures are in `docs/BUILD_PLAN.md` R1c.
- 2026-11-11 (SYNC:RIG-017): R2b shipped (crbn-launcher D-RIG-018). Desktop 0.9.0 on Rig's page is signed and
  published to dev (manifest `e043f4dd…`, PatcherCli 67 of 67 files byte-identical). `check.mjs` passes 21/21 on the
  signed folder. The web version is live as build `20261111-0839-fff8c4a-f802d8f4`. The store's new desktop picture
  shows the CRBN kit and comes first. The owner's wish for Salvage, second and cycling, with a skins section on the
  store page, is `docs/BUILD_PLAN.md` R1c. Its open question is answered (RIG-017's ADDENDUM): an animated PNG
  plays in the Hub's store. It was tested with the owner for a few minutes, then the record went back.
- 2026-11-11 (SYNC:RIG-016): R2a is built (crbn-launcher D-RIG-017). `crbn-rig.exe` draws Rig's page in WebView2, over
  `rig_engine.cpp` compiled in, with Rig's own host and the WebView2 SDK alone (version 1.0.4314.35, vendored as
  `WebView2/`). Upstream's IGraphics UI and DSP chain are gone. The page has two audio backends, one per build.
  `packaging/windows/check.mjs` passes 21/21 (the exe's engine bit-identical to the parity harness), `web/check.mjs`
  30/30, and `web/engine/test.mjs` all cases. R2b (signing, publishing, the store's desktop screenshot) needs a
  SimplySign session.
- 2026-11-11 (SYNC:RIG-015): R1 is built and published (crbn-launcher D-RIG-016). All twenty hardware kits draw the
  web version's amp and cabinet as its Hardware drawing, with CRBN the default. Every control is bound to the
  settings, and the energy kits answer the input level. Salvage's sheets come from GOATi's texture library, Power
  and Standby are wired at the page until R3, and "Kit's own" is the default finish. The Rig builder, share codes
  and players' own art are R1b.
- 2026-11-11 (SYNC:RIG-014): the Hardware Lab is closed (crbn-launcher D-RIG-015). Salvage's words have four
  styles for players, with On tags the default, and his Salvage setup is recorded. Salvage goes in the store's
  screenshots (R9). R1's build is next, in a fresh session.

- 2026-11-11 (SYNC:RIG-013): the owner's Salvage notes recorded as crbn-launcher D-RIG-014, and the lab's seventh
  version answers them. The bat toggles are drawn, with a worn version for Salvage. The plate's letters are metal.
  Salvage's words are sharper and pick dark or light by contrast, with five styles to try. The pedal names are 30%
  larger.

- 2026-11-11 (SYNC:RIG-012): the owner's Salvage choices (perforated old steel, valves) and notes recorded as
  crbn-launcher D-RIG-013, and the lab's sixth version answers them. Four grilles remain, all sitting darker behind the
  faceplate. The grille opening is recessed, with a cut edge, a cast shadow and a bolted frame. The plate has no white,
  its letters' inner shadow is halved, and its bolts are old.

- 2026-11-11 (SYNC:RIG-011): the owner's notes on Salvage recorded as crbn-launcher D-RIG-012, and the lab's
  fifth version answers them. Salvage has six grilles (chicken wire among them), each in the same scrap or in old bare
  metal (old steel, galvanised, rusted iron, aged copper), and five glows. Players get these choices, with Shuffle.
  Every word on Salvage is stamped into the metal.

- 2026-11-11 (SYNC:RIG-010): the owner's notes on the Hardware Lab's third version recorded as crbn-launcher
  D-RIG-011, and the lab's fourth version answers them. Salvage is kept, a close call against CRBN for the default. Its
  name is on a riveted scrap plate (a sprayed stencil, a punched SALVAGE, the capture's name on label tape), over
  expanded metal and a warm glow. Every amp's state words sit closer to their switches, still on one line. Rack's
  handles are polished bars, and its vents glow.

- 2026-11-11 (SYNC:RIG-009): the owner's notes on the Hardware Lab's second version recorded as crbn-launcher D-RIG-010,
  and the lab's third version answers them. Salvage is made from photographed textures, with a crop for each piece (the
  build will use the texture library). CRBN stands straight at the script's height. Every amp has one line of words.
  Pedal knobs show only their end numbers (0 or 1 to 10). The stomp switch is redrawn. In the Rig builder, players can
  save any knob or switch as a template and import their own art.

- 2026-11-11 (SYNC:RIG-008): the owner's Hardware Lab picks recorded as crbn-launcher D-RIG-009. He kept 18 kits and
  made his own builder kit "CRBN" the default; players get the builder with share codes; "CRBN Rig" goes on every head.
  The lab's second version answers his notes for his look before the build: the Obsidian and Spinner knobs, the
  energy's light on the controls, the pilot lights, Jet's turbine, and Hammertone redone as Salvage.

- 2026-11-11 (SYNC:RIG-007): R1 begun, widened at the owner's ask. The Hardware Lab
  (https://claude.ai/artifact/WdqG3GWav3qnqffCQeVe4m, source `docs/design/2026-11-11-hardware-lab/lab.html`) has 19
  hardware kits for the amp and pedals. Ten are classic. Nine are new: the Hub's logo-window energy behind cut
  faceplates and meshes, plus Valve and Ferro. It also has a builder, Rig's page as a stage and six questions. Nothing
  is built until he picks.

- 2026-11-11 (SYNC:RIG-006): the new look live on the web (build `20261110-1452-36ad4b0`, the owner's publish); the store
  pictures with the stompbox icon uploaded (record version 10); `docs/BUILD_PLAN.md` written: R1 the look's details, R2
  the desktop on the page, R3..R8 U1 and U3..U7, R9 release and store.

- 2026-11-11 (SYNC:RIG-005): the owner's lab picks (D-RIG-008), built in the web version: the stompbox mark and its
  app icon (`packaging/icons/icon.svg`, rendered into the .ico and the web icons); the Amp front layout, the faceplate
  and LED meters by default, the other drawings in the look menu; the finishes (the look's own, cherry, gold, rose gold
  `#f29077`, Custom with a colour wheel); Livewire's look menu with fonts, accent, density and the suite switch
  (D-CRBN-024's `crbn-look` cookie). `web/check.mjs` 17/17. Next: U2, the desktop on this page.

- 2026-11-11 (SYNC:RIG-004): the logo and UI pass (D-RIG-007). The Rig Lab
  (https://claude.ai/artifact/4fhxsEhpxxczgnWoAYR89v, source `docs/design/2026-11-10-rig-lab/lab.html`): three marks,
  the finishes (cherry, gold, rose gold) and how far they reach, and seven areas of Rig's own page around P3's features,
  mocked live from the owner's picks. Upstream's drawing is in none of it, at the owner's word. The build waits on his
  picks.

- 2026-11-10 (SYNC:RIG-003): the owner's picks D-RIG-001..006. The libraries vendored exactly (1913 files, every blob
  upstream's); Rig's accent tweed gold in Holo and Daylight (looks `42b1a2c`), live on the web version; the desktop
  build signed (manifest `5735d60d…`), submitted, approved by the owner and public on dev; the knock-out search; the
  P3 brief.

- 2026-11-10 (SYNC:RIG-001, RIG-002): the owner's picks (D-CRBN-021); spare Hub app `P2KLkFx6…` claimed as CRBN Rig;
  looks product `rig` (crbn-launcher `cdeed2e`); the desktop rebrand, icon, notices, change list and Hub folder; the
  store words and pictures on dev (record version 3); desktop 0.8.0 published to dev (manifest `3c4b2b2a…`) and
  confirmed with PatcherCli; the web version built (wasm engine bit-identical to MSVC on 7 of 10 cases, the rest within
  3.8e-6; the browser self-test 12/12), its bucket made, its host waiting on the owner's token and Worker deploy.
