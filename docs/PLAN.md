# CRBN Rig: the plan

The owner's goal (2026-11-10, D-CRBN-021): get crbn-amp "working, so that we can load this up in Pavillion, both the
web app and via the client as a download/install, complete with our own branding, and then we can refine the UX".
CRBN Rig stays in TONE3000's ecosystem and credits it, with a UX of our own.

## Phases

| Phase | What | State |
|---|---|---|
| **P1 Desktop on the Hub** | The rebrand (name, cherry, icon, About, links, `crbn-rig.exe`), the Hub folder, the store page, `pavillion-publish` to dev, confirmed byte for byte | done on dev (2026-11-10); the owner's Install and Play to see |
| **P2 Web on the Hub** | NAM's core in WebAssembly behind our own page in the suite's looks; guitar in through the browser; captures and IRs from disk; `rig.carbonlinear.com`; the record's `links.tool` | built and checked; waits on the R2 token and the Worker deploy (the owner's), then publish and `links.tool` |
| **P3 Our UX** | The owner's design pass on the web page: browsing and switching captures (TONE3000's library, favourites, a chain of pedal, amp and cab), presets, tuner, recording. Then the same page on the desktop through iPlug2's WebView2 editor, over the native engine and ASIO | next |
| P4 Plug-in formats | VST3 (and AU on macOS) for DAWs: the VST3 SDK, an install the Hub can place where hosts look. Upstream's Inno installer (`NeuralAmpModeler/installer/`, with its RTF readmes and the manual PDF) is not CRBN's route and still carries upstream's words; P4 rebrands it or replaces it, with an `AppId` of its own (it has none, so Inno keys it on `AppName` and it would meet an upstream install) | later |
| P5 Signing, review, public | Certum signing in a SimplySign session; a director's first-publish review; `display: public` | with the owner |

## Open questions for the owner

- **The submodules:** mirror iPlug2, NAM Core, AudioDSPTools and Eigen under GOATi, or vendor them into this repo
  (`UPSTREAM.md`)? Either lets a fix to them be committed and stops a fresh clone fetching from upstream.
- **TONE3000:** its API can let a person sign in and pick tones inside our page (P3). Using it means TONE3000's terms
  for API clients.
- **The microphone in the desktop Hub's view:** its tool view grants no audio input yet, so "Play my guitar" there
  offers the installed app or the browser instead (goati-sync `proposals/2026-11-10-hub-tool-view-audio-input.md`, a
  Hub lane change on the owner's word).
- **The accent in Holo and Daylight:** cherry is the accent in Capsule only (it sits near those looks' error reds), so
  there Rig's controls take the look's own pink while the strip and the name stay cherry. Keep it, or pick another
  accent for Rig in those looks.
- **The mark check** of "CRBN Rig" before it ships (Native Instruments' Guitar Rig is in the same category).

## Progress log

- 2026-11-10 (SYNC:RIG-001, RIG-002): the owner's picks (D-CRBN-021); spare Hub app `P2KLkFx6…` claimed as CRBN Rig;
  looks product `rig` (crbn-launcher `cdeed2e`); the desktop rebrand, icon, notices, change list and Hub folder; the
  store words and pictures on dev (record version 3); desktop 0.8.0 published to dev (manifest `3c4b2b2a…`) and
  confirmed with PatcherCli; the web version built (wasm engine bit-identical to MSVC on 7 of 10 cases, the rest within
  3.8e-6; the browser self-test 12/12), its bucket made, its host waiting on the owner's token and Worker deploy.
