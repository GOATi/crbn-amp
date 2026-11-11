# CRBN Rig on Pavillion Hub

How CRBN Rig reaches Pavillion Hub (crbn-launcher D-CRBN-021): both ways, as CRBN Mixtape and CRBN Press do
(D-CRBN-017). The desktop app is installed and updated by the Hub's patcher; the web version at
`https://rig.carbonlinear.com` (`hosting/README.md`) is the app's web version, which the Hub opens top-level as "Open the
web version" once the record's `links.tool` names it.

| Thing | Value |
|---|---|
| App on the dev Hub | `P2KLkFx6f5JQwaQKLCngoKLERMM25Fv2KLJmntLBKjXKbi1` (owner `crbn`; a spare the owner made, claimed 2026-11-10, SYNC:RIG-001) |
| App id (its own identity) | `com.pavillionhub.crbn.amp` (pavillion_client D-237); never the Hub id above |
| Hub address | `pavillionhub.com/app/crbn-rig` |
| Main process | `crbn-rig` (`crbn-rig.exe`, D-CRBN-021 (c)) |
| Type | `tool`, with `links.tool` = `https://rig.carbonlinear.com/` once that host serves |
| Publisher | the `crbn` account's token, `%USERPROFILE%\.crbn\pavillion-publish-token.json` on GOATi-Box-C, never in a repo |
| Store words | `words.json` here (the record's fields and the page) |
| Store pictures | `pictures.json` names them; `pictures.mjs` renders them from `art/art.html` into `dist/hub-listing/` (gitignored), never committed |

## Publish a desktop build

From a clean `main` on GOATi-Box-C:

```powershell
pwsh packaging/windows/package.ps1                  # -Sign with the owner's SimplySign session open (D-PHOTOLIVE-031)
#   -> dist\hub\crbn-rig-<version>-windows-x64\     (crbn-rig.exe and its notices; settings live in %LOCALAPPDATA%\CRBNAmp)
node "$env:LOCALAPPDATA\CRBN\pavillion-publish\2216857eb4e1\hub\packages\publish\bin\pavillion-publish.mjs" `
  --app P2KLkFx6f5JQwaQKLCngoKLERMM25Fv2KLJmntLBKjXKbi1 --source dist\hub\crbn-rig-<version>-windows-x64 `
  --api dev --branch default --token-file "$env:USERPROFILE\.crbn\pavillion-publish-token.json" --json --quiet
pwsh packaging/hub/confirm.ps1 -ManifestSha1 <the manifestSha1 printed> -HubDir dist\hub\crbn-rig-<version>-windows-x64
```

Exit 0 is published, 3 is "run again" (it resumes), 4 is a refused token. `confirm.ps1` checks that the CDN's `GOATi.xml`
is that manifest and that a copied `PatcherCli.exe` installs it into an empty folder with every file byte-identical. The
owner's Hub sees a new build only after it restarts.

## The store listing

`crbn-launcher/scripts/hub-listing/` sends the words and pictures as the `crbn` account (the saved credential,
D-PHOTOLIVE-024 (c)):

```powershell
node web/build.mjs; node web/shots.mjs; node packaging/icons/render.mjs   # the web screenshots and icons
node packaging/hub/desktop-shot.mjs        # the desktop capture, dist/shots/desktop.png: the packaged app playing the
                                           # demo riff (about three seconds, Output -12 dB); --kit=hammer for Salvage
node packaging/hub/gear-shots.mjs          # the gear for the hero, card and cover, dist/shots/gear-*.png: the CRBN amp
                                           # and cabinet, and the cover's stack (CRBN, Salvage, Compact, Rack), at 3x
                                           # with the riff lit; --salvage= for another Salvage (docs/BUILD_PLAN.md R1c)
node packaging/hub/salvage-frames.mjs      # the store's second picture: Salvage cycling through the owner's five good
                                           # amps, one animated PNG into dist/hub-listing/ (R1c); look at its frames in
                                           # dist/shots/salvage-frame-*.png first
node packaging/hub/pictures.mjs                                            # -> dist/hub-listing/
#   --only=desktop renders that piece alone and leaves the rest as uploaded; a changed picture needs a new name;
#   --only=hero-shots,cover-close --out=dist/hub-preview renders the earlier hero and cover, to compare
$H = 'D:\Projects\crbn-launcher\scripts\hub-listing\hub-listing.ps1'; $L = 'D:\Projects\crbn-amp\dist\hub-listing'
powershell -ExecutionPolicy Bypass -File $H plan   --app P2KLkFx6f5JQwaQKLCngoKLERMM25Fv2KLJmntLBKjXKbi1 --listing $L
powershell -ExecutionPolicy Bypass -File $H upload --app P2KLkFx6f5JQwaQKLCngoKLERMM25Fv2KLJmntLBKjXKbi1 --listing $L
powershell -ExecutionPolicy Bypass -File $H apply  --app P2KLkFx6f5JQwaQKLCngoKLERMM25Fv2KLJmntLBKjXKbi1 --listing $L
```

`links.tool` goes into `words.json` only when `node web/check.mjs --url=https://rig.carbonlinear.com` passes, so the
Hub never offers a web version that does not answer. `display: public` waits for a director's first-publish review.

## Record

| Date | What |
|---|---|
| 2026-11-10 | Store words and pictures applied (record version 1 -> 3, 18 of 18 fields read back). Desktop 0.8.0 from `e45dc24` published: manifest `3c4b2b2ab168a9df55cb2be9c817c15adda45c9a`, 8 chunks, 1.8 MB sent; confirmed (CDN serves it; PatcherCli 5 of 5 files byte-identical). Unsigned (dev) |
| 2026-11-10 | The web version live at `https://rig.carbonlinear.com`: build `20261110-0832-b65358a-0b49ab75`, then `20261110-0855-e386b16-e2b3bf59` (the layout fix at laptop widths); `web/check.mjs --url` 45 of 45 files byte-identical. Roll back with `--promote-only=20261110-0832-b65358a-0b49ab75`. `links.tool` applied (record version 3 -> 5, 19 of 19 fields read back) |
| 2026-11-10 | **Signed** in the owner's SimplySign session (`package.ps1 -SkipBuild -Sign`: GOATi's Certum certificate, Certum's timestamp) and republished: manifest `5735d60de50257194c00c8bc7f0e0b9015110ef7`, 4 of 8 chunks sent; confirmed (PatcherCli 5 of 5 byte-identical). **Submitted for review** (`hub-listing submit`), approved by the owner, then **`display: public`** (record version 6). The four-looks picture renamed `-looks-2` for Rig's tweed (version 8) |
| 2026-11-11 | The owner's lab picks (D-RIG-008): the web version live as build `20261110-1452-36ad4b0-b3adb8e3` (the owner's publish; all 46 files match). New store pictures with the stompbox icon, approved by the owner: hero, card, cover, logo, the web shot and the four looks renamed `-2` / `-looks-3` (the CDN keeps a name for a day), uploaded and served 200; `apply` read back 19 of 19 fields. The desktop shot is unchanged and still shows upstream's drawing until U2 (`docs/BUILD_PLAN.md`) |
| 2026-11-11 | **Desktop 0.9.0 on Rig's page** (R2a, D-RIG-017; R2b, D-RIG-018) from `fff8c4a`, **signed** (`package.ps1 -Sign`), `check.mjs` 21/21: manifest `e043f4dd9e25048f31838edfdcd08c041261b4f2`, 63 chunks, 2.0 MB sent; confirmed (the CDN serves it; PatcherCli 67 of 67 files byte-identical). The web version live as build `20261111-0839-fff8c4a-f802d8f4` (62 of 62 files match; roll back with `--promote-only=20261111-0647-48b3c29-5b758257`) |
| 2026-11-11 | The new desktop picture, the owner's pick (CRBN): `crbn-rig-shot-2-desktop-2.png`, from `desktop-shot.mjs` and `pictures.mjs --only=desktop`, put first in `storeMedia` so CRBN is the first kit players see. The six other pictures are byte-identical to the CDN's. Uploaded and served 200; `apply` read back with nothing differing (record version 16) |
| 2026-11-11 | **R1c's animated-PNG test** (`docs/BUILD_PLAN.md` R1c), with the owner's OK. `crbn-rig-test-salvage-cycle-1.png` (six Salvage frames, 1800 ms each, 3.4 MB) uploaded and put second in `storeMedia` (version 18). The CDN served it byte-identical (sha1 `27baea9d…`), Edge animated it, and the owner saw it cycle in his Hub. The record then went back to this folder's listing, with the three approved pictures (version 20, 19 of 19 fields matched). The test file stays on the CDN, unreferenced |
| 2026-11-11 | **The store's art shows the kits** (D-RIG-019, SYNC:RIG-018), the owner's picks from previews. The hero `crbn-rig-hero-3.png` and the card `-card-3` show the CRBN amp and cabinet, from `gear-shots.mjs`. The cover `-cover-4` stacks four amps: CRBN, Salvage (his setup, seed 258637), Compact and Rack. The web shot `-shot-1-web-3` and the four looks `-looks-4` are retaken. Uploaded and served 200; `apply` read back 19 of 19 fields (version 22, then 24 for the cover); every picture's CDN bytes match the listing folder. The close-up cover `-cover-3` was live between versions 22 and 24, and stays on the CDN unreferenced |
