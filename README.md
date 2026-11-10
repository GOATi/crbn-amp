# CRBN Rig

Play your guitar through captures of real gear: pedals, amp heads and whole rigs, with cabinet impulse responses.
CRBN Rig plays Neural Amp Modeler captures (`.nam`), such as the thousands shared on
[TONE3000](https://www.tone3000.com), and `.wav` IRs.

CRBN Rig is part of the CRBN suite by GOATi Entertainment, installed and updated through
[Pavillion Hub](https://pavillionhub.com/app/crbn-rig), with a web version you can open in a browser.

Based on [Neural Amp Modeler](https://github.com/sdatkinson/NeuralAmpModelerPlugin) by Steven Atkinson (MIT License).

## Building

| What | How |
|---|---|
| The Windows app and its Hub folder | `pwsh packaging/windows/package.ps1` (Visual Studio 18 with the C++ workload) |
| The web version | `node web/build.mjs`, then `node web/check.mjs` (emscripten SDK 6.0.13) |
| The placeholder icon | `node packaging/icons/render.mjs` |

The libraries (iPlug2, NeuralAmpModelerCore, AudioDSPTools, Eigen) are git submodules; see `UPSTREAM.md`. Contributors
and sessions start at `CLAUDE.md`.

## Rough edges, from upstream

- **The standalone's audio settings** (File > Preferences) are plainer than a DAW's. For complex routing, a plug-in
  host is still the most reliable option (plug-in formats are a later phase).
- **Graphics:** if the app closes before its window appears on a PC with two GPUs, set it to use the dedicated GPU in
  Windows' graphics settings.
