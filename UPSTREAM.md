# Upstream: Neural Amp Modeler

CRBN Rig (this repo, `GOATi/crbn-amp`, private) is GOATi Entertainment's fork of **NeuralAmpModelerPlugin** by Steven
Atkinson, <https://github.com/sdatkinson/NeuralAmpModelerPlugin>, under the **MIT License** (`LICENSE`). Unlike the
rest of the CRBN suite it is not an ArtCraft fork, so "storytold" in the suite's rules means sdatkinson here
(crbn-launcher `docs/DECISIONS.md` D-CRBN-021 (e)).

## The baseline

| What | Where it came from | Commit |
|---|---|---|
| The plug-in (this repo's own tree) | sdatkinson/NeuralAmpModelerPlugin `main` | `fee982a86096ea17e7a6b004577207ab7c460e0c` (2026-11-03, "Update pull request template to simplify checklist") |
| `iPlug2/` (vendored) | sdatkinson/iPlug2, Steven Atkinson's fork of iPlug2 | `de5a4fb14fd964247f0c70f2c90b32876a3bfc7c` (2026-08-09) |
| `NeuralAmpModelerCore/` (vendored) | sdatkinson/NeuralAmpModelerCore, v0.6.0 | `0b3d3c97b0859a3a8c92a8628c4dd89a25eb5842` (2026-09-18) |
| `AudioDSPTools/` (vendored) | sdatkinson/AudioDSPTools, v0.1.2 | `e19ef4b5b3bf2171c431847563acde29eedf85c0` (2026-08-09) |
| `eigen/` (vendored) | gitlab.com/libeigen/eigen, 5.0.1 | `bc3b39870ecb690a623a3f49149a358b95c5781d` (2025-11-08) |
| `NeuralAmpModelerCore/Dependencies/` | its own submodules (AudioDSPTools v0.1.1, Eigen 5.0.1) left out, the top-level copies used; nlohmann/json kept from its tree | - |
| `WebView2/` (vendored, D-RIG-017) | Microsoft's WebView2 SDK, the NuGet package `Microsoft.Web.WebView2` (BSD 3-clause) | version `1.0.4314.35` (2026-10-23), package SHA-512 in `vendor.json` |

The four libraries were git submodules until 2026-11-10, then **vendored** (D-RIG-001): each at the commit above,
trimmed to what builds, and every kept file entered from upstream's own objects, so each blob id and file mode is
upstream's (`vendor.json` lists what was kept and left out). Their own histories are not in this repo.

The WebView2 SDK came later (D-RIG-017, 2026-11-11, build plan R2): downloaded once from nuget.org on the owner's word,
checked against the catalog's SHA-512, and trimmed to four files kept byte for byte (`.gitattributes`): `WebView2.h`, the
x64 `WebView2Loader.dll` (Microsoft-signed; the app loads it at run time and ships it beside `crbn-rig.exe`), and the
package's `LICENSE.txt` and `NOTICE.txt`. The desktop app's page is hosted by Rig's own `NeuralAmpModeler/RigWebView.cpp`,
so iPlug2's `IPlug/Extras/WebView` and the Windows Implementation Library it needs are not used.

The repo was forked with upstream's whole history, so `git log fee982a` is upstream's log. GOATi's commits start after it.
There is no baseline tag yet (sessions never push tags, D-CRBN-006); `scripts/change-list.ps1` names the commit.

## The rules (D-CRBN-001, with sdatkinson in storytold's place)

- **Upstream is frozen.** `main` never merges upstream. Nothing is pushed to, opened on, or asked of sdatkinson's repos.
  An upstream change reaches `main` only by a reviewed cherry-pick (a security or crash fix, say) or a deliberate
  re-fork from a newer point, on the owner's word. This clone has no `upstream` remote.
- **The libraries are this repo's own files now** (D-RIG-001): a clone never reaches upstream, and a fix to iPlug2,
  NAM Core, AudioDSPTools or Eigen is an ordinary reviewed commit here, which `MODIFIED-FILES.txt` then lists under
  "Changed in the vendored libraries". Taking a newer upstream is a deliberate re-vendor on the owner's word, recorded
  in `vendor.json` and here. (The single-instance fix in `NeuralAmpModeler.cpp` predates this and works around
  iPlug2's `WinMain` rather than editing it.)
- **Licence.** Everything here is MIT (the plug-in, NAM Core, AudioDSPTools, iPlug2, WDL's zlib-style terms) or
  MPL-2.0 shipped unmodified (Eigen), with the third-party notices upstream keeps in
  `NeuralAmpModeler/installer/ThirdPartyNotices.txt` (CRBN Rig adds its header and the embedded fonts' licences). Every
  build ships `LICENSE.txt`, `ThirdPartyNotices.txt`, `NOTICE.txt` and `MODIFIED-FILES.txt`, the change list since the
  baseline (D-CRBN-007's practice; MIT does not ask for it).
- **Credit.** About keeps one plain-text credit: "Based on Neural Amp Modeler by Steven Atkinson". The app says it plays
  captures from TONE3000 and links there for them; TONE3000's name is used only to say so.

## What is upstream's in name only

The C++ class `NeuralAmpModeler`, the projects (`NeuralAmpModeler-app.vcxproj` and the rest), the source file names and
the saved-state header `###NeuralAmpModeler###` keep upstream's names (D-CRBN-002 (e)); every word a person reads says
CRBN Rig. Since R2a (D-RIG-017) the class is a thin host for Rig's page and engine, and upstream's IGraphics drawing,
DSP chain and saved state are gone. The header comes back with the state when P4 brings the plug-in formats.
