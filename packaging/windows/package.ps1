<#
.SYNOPSIS
  Builds CRBN Rig's Windows standalone and lays out the folder Pavillion Hub installs (crbn-launcher D-CRBN-021).
.DESCRIPTION
  The Hub installs a folder, not an installer (D-PHOTOLIVE-019 (b)); its patcher keeps it up to date. The folder is
    dist\hub\crbn-rig-<version>-windows-<arch>\
      crbn-rig.exe            the standalone (settings in %LOCALAPPDATA%\CRBNAmp, never beside the exe)
      WebView2Loader.dll      Microsoft's WebView2 loader (WebView2/, vendored and Microsoft-signed, D-RIG-017)
      web\                    Rig's page, the app's window (dist\web from web/build.mjs, less the WebAssembly engine
                              the desktop does not use), with this folder's notices in place of the web version's
      ThirdPartyNotices.txt   every notice (the WebView2 SDK's added), read from the page's About
      LICENSE.txt             upstream's MIT licence (Neural Amp Modeler, Steven Atkinson)
      NOTICE.txt              what CRBN Rig is and where its parts come from
      MODIFIED-FILES.txt      the change list since the fork (scripts/change-list.ps1, D-CRBN-007)
  The exe links the C runtime statically (/MT). The window is drawn by the WebView2 runtime that Windows 10 and 11
  carry; the app says what to do where it is missing.

  The build is the app project alone (the VST3 and AAX projects need SDKs this repo does not carry), Release, with
  the v145 toolset of Visual Studio 18 (upstream's projects name v143), then the page (node web/build.mjs, which needs
  the emscripten SDK for the web version's engine). Nothing is fetched (UPSTREAM.md).
.PARAMETER SkipBuild
  Package the exe and page already built (release builds take a minute or two; re-packaging to sign is a small Hub
  update).
.PARAMETER Sign
  Sign crbn-rig.exe with GOATi's Certum certificate (sign.ps1 -Certum); needs the owner's SimplySign session open,
  and is checked before anything is built. Dev builds stay unsigned (D-PHOTOLIVE-031).
.EXAMPLE
  pwsh packaging/windows/package.ps1
  pwsh packaging/windows/package.ps1 -SkipBuild -Sign
#>
param(
  [switch] $SkipBuild,
  [switch] $Sign,
  [string] $Arch = 'x64',
  [string] $Toolset = 'v145'
)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Plug = Join-Path $Root 'NeuralAmpModeler'

if ($Sign) { & (Join-Path $PSScriptRoot 'sign.ps1') -Certum -CheckOnly }

$config = Get-Content (Join-Path $Plug 'config.h') -Raw
if ($config -notmatch '#define PLUG_VERSION_STR "([0-9.]+)"') { throw 'config.h: no PLUG_VERSION_STR' }
$Version = $Matches[1]
$Exe = Join-Path $Plug "build-win\app\$Arch\Release\crbn-rig.exe"

if (-not $SkipBuild) {
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  $msbuild = & $vswhere -latest -products * -requires Microsoft.Component.MSBuild -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1
  if (-not $msbuild) { throw 'MSBuild not found (Visual Studio 18 with the C++ workload)' }
  # SolutionDir ends in a backslash and is passed unquoted: a quoted trailing backslash escapes the quote.
  & $msbuild (Join-Path $Plug 'projects\NeuralAmpModeler-app.vcxproj') /t:Build /p:Configuration=Release "/p:Platform=$Arch" `
    "/p:PlatformToolset=$Toolset" "/p:SolutionDir=$Plug\" /m /nologo /v:minimal
  if ($LASTEXITCODE -ne 0) { throw "MSBuild failed with exit code $LASTEXITCODE" }
  & node (Join-Path $Root 'web\build.mjs')
  if ($LASTEXITCODE -ne 0) { throw "web/build.mjs failed with exit code $LASTEXITCODE" }
}
if (-not (Test-Path $Exe)) { throw "$Exe is missing (run without -SkipBuild)" }
$Page = Join-Path $Root 'dist\web'
if (-not (Test-Path (Join-Path $Page 'index.html'))) { throw "$Page is missing (run without -SkipBuild)" }

$Name = "crbn-rig-$Version-windows-$Arch"
$Stage = Join-Path $Root "dist\hub\$Name"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force $Stage | Out-Null

Copy-Item $Exe (Join-Path $Stage 'crbn-rig.exe')
Copy-Item (Join-Path $Root 'WebView2\x64\WebView2Loader.dll') (Join-Path $Stage 'WebView2Loader.dll')
# The page: everything the web version serves but its WebAssembly engine (the desktop's engine is in the exe).
Copy-Item -Recurse $Page (Join-Path $Stage 'web')
Remove-Item (Join-Path $Stage 'web\rig-engine.wasm')
# The notices: upstream's, then the WebView2 SDK's (BSD 3-clause asks for its notice with a binary).
$notices = (Get-Content -Raw (Join-Path $Plug 'installer\ThirdPartyNotices.txt')).TrimEnd()
$wv2 = Join-Path $Root 'WebView2'
$title = 'Microsoft WebView2 SDK (WebView2Loader.dll and WebView2.h, version ' + ((Get-Content -Raw (Join-Path $Root 'vendor.json') | ConvertFrom-Json).libraries | Where-Object path -eq 'WebView2').version + ')'
$notices += "`n`n`n$title`n$('-' * $title.Length)`n`n" + (Get-Content -Raw (Join-Path $wv2 'LICENSE.txt')).Trim() + "`n`n" + (Get-Content -Raw (Join-Path $wv2 'NOTICE.txt')).Trim() + "`n"
$notices -replace "`r?`n", "`r`n" | Set-Content -NoNewline -Encoding utf8 (Join-Path $Stage 'ThirdPartyNotices.txt')
Copy-Item (Join-Path $Root 'LICENSE') (Join-Path $Stage 'LICENSE.txt')
$commit = (& git.exe -C $Root rev-parse HEAD).Trim()
@"
CRBN Rig $Version
Copyright 2026 GOATi Entertainment Pty Ltd. https://pavillionhub.com/app/crbn-rig

CRBN Rig is based on Neural Amp Modeler by Steven Atkinson, used under the MIT License (LICENSE.txt).
It plays captures (.nam) and impulse responses (.wav) made by others, such as those on TONE3000
(https://www.tone3000.com); they belong to their authors and are not part of CRBN Rig.
Its window is its own page (the web folder), drawn by Microsoft Edge WebView2 through WebView2Loader.dll. The demo
riff (web\demo\di.wav) and example capture (web\demo\example.nam) are from Neural Amp Modeler Core (MIT).

ThirdPartyNotices.txt carries the notices of everything the program contains; web\look\fonts\LICENSES.md and
web\hw\fonts\LICENSES.md the page's fonts'. MODIFIED-FILES.txt lists the files GOATi changed from the original.
Salvage's sheet metal is photographed (web\hw\tex\CREDITS.md): Peeling orange by PixCrafter
(https://www.pixcrafter.com/grunge-metal-with-peeling-paint-texture-background/), Scuffed red by Texturelabs
(https://texturelabs.org/textures/metal_294/), and the others from Total Textures.
Built from GOATi's commit $commit.
"@ -replace "`r?`n", "`r`n" | Set-Content -NoNewline -Encoding utf8 (Join-Path $Stage 'NOTICE.txt')
& (Join-Path $Root 'scripts\change-list.ps1') -Out (Join-Path $Stage 'MODIFIED-FILES.txt')
# The page's About links its notices beside it: in the app, the app's own.
foreach ($f in 'ThirdPartyNotices.txt', 'LICENSE.txt', 'NOTICE.txt', 'MODIFIED-FILES.txt') { Copy-Item -Force (Join-Path $Stage $f) (Join-Path $Stage "web\$f") }

if ($Sign) { & (Join-Path $PSScriptRoot 'sign.ps1') -Certum (Join-Path $Stage 'crbn-rig.exe') }

# No portable marker and nothing else: settings live in %LOCALAPPDATA%\CRBNAmp like an installed copy's.
Get-ChildItem $Stage | ForEach-Object { '{0,12:N0}  {1}' -f $(if ($_.PSIsContainer) { (Get-ChildItem -Recurse -File $_.FullName | Measure-Object Length -Sum).Sum } else { $_.Length }), $_.Name }
Write-Host "Hub folder: $Stage"
