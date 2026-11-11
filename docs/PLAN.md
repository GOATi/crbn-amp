# CRBN Rig: the plan

The owner's goal (2026-11-10, D-CRBN-021): get crbn-amp "working, so that we can load this up in Pavillion, both the
web app and via the client as a download/install, complete with our own branding, and then we can refine the UX".
CRBN Rig stays in TONE3000's ecosystem and credits it, with a UX of our own.

## Phases

| Phase | What | State |
|---|---|---|
| **P1 Desktop on the Hub** | The rebrand (name, cherry, icon, About, links, `crbn-rig.exe`), the Hub folder, the store page, `pavillion-publish` to dev, confirmed byte for byte | done on dev (2026-11-10); the owner's Install and Play to see |
| **P2 Web on the Hub** | NAM's core in WebAssembly behind our own page in the suite's looks; guitar in through the browser; captures and IRs from disk; `rig.carbonlinear.com`; the record's `links.tool` | live on dev (2026-11-10): `rig.carbonlinear.com` serves it and the record's `links.tool` names it; in the desktop Hub's window the guitar input waits on the Hub lane's microphone grant |
| **P3 Our UX** | The order of sessions is `docs/BUILD_PLAN.md` (R1..R9). The owner's first pass (D-RIG-006), briefed in `docs/P3-UX.md`: the power switch and squeal guard, the page on the desktop (WebView2 over the same engine), the library, favourites on standby with QWERTY keys, rigs and variants with hot-swapped pedals, drag-and-drop MIDI (his Morningstar MC8), then TONE3000 in the library | next: `docs/P3-UX.md`'s open choices first |
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
