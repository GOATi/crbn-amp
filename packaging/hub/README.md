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
# the desktop capture: dist/shots/desktop.png (the app enlarged with its corner resizer; see SYNC:RIG's entry)
node packaging/hub/pictures.mjs                                            # -> dist/hub-listing/
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
