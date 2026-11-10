<#
.SYNOPSIS
  Builds CRBN Rig's Windows standalone and lays out the folder Pavillion Hub installs (crbn-launcher D-CRBN-021).
.DESCRIPTION
  The Hub installs a folder, not an installer (D-PHOTOLIVE-019 (b)); its patcher keeps it up to date. The folder is
    dist\hub\crbn-rig-<version>-windows-<arch>\
      crbn-rig.exe            the standalone (settings in %LOCALAPPDATA%\CRBNAmp, never beside the exe)
      ThirdPartyNotices.txt   every notice, read by About > Third party notices beside the exe
      LICENSE.txt             upstream's MIT licence (Neural Amp Modeler, Steven Atkinson)
      NOTICE.txt              what CRBN Rig is and where its parts come from
      MODIFIED-FILES.txt      the change list since the fork (scripts/change-list.ps1, D-CRBN-007)
  The exe embeds its fonts, pictures and icons, and links the C runtime statically (/MT), so nothing else ships.

  The build is the app project alone (the VST3 and AAX projects need SDKs this repo does not carry), Release, with
  the v145 toolset of Visual Studio 18 (upstream's projects name v143). Nothing is fetched: the submodules are already
  checked out (UPSTREAM.md).
.PARAMETER SkipBuild
  Package the exe already built (release builds take a minute or two; re-packaging to sign is a small Hub update).
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
}
if (-not (Test-Path $Exe)) { throw "$Exe is missing (run without -SkipBuild)" }

$Name = "crbn-rig-$Version-windows-$Arch"
$Stage = Join-Path $Root "dist\hub\$Name"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force $Stage | Out-Null

Copy-Item $Exe (Join-Path $Stage 'crbn-rig.exe')
Copy-Item (Join-Path $Plug 'installer\ThirdPartyNotices.txt') (Join-Path $Stage 'ThirdPartyNotices.txt')
Copy-Item (Join-Path $Root 'LICENSE') (Join-Path $Stage 'LICENSE.txt')
$commit = (& git.exe -C $Root rev-parse HEAD).Trim()
@"
CRBN Rig $Version
Copyright 2026 GOATi Entertainment Pty Ltd. https://pavillionhub.com/app/crbn-rig

CRBN Rig is based on Neural Amp Modeler by Steven Atkinson, used under the MIT License (LICENSE.txt).
It plays captures (.nam) and impulse responses (.wav) made by others, such as those on TONE3000
(https://www.tone3000.com); they belong to their authors and are not part of CRBN Rig.

ThirdPartyNotices.txt carries the notices of everything the program contains. MODIFIED-FILES.txt lists the files
GOATi changed from the original. Built from GOATi's commit $commit.
"@ -replace "`r?`n", "`r`n" | Set-Content -NoNewline -Encoding utf8 (Join-Path $Stage 'NOTICE.txt')
& (Join-Path $Root 'scripts\change-list.ps1') -Out (Join-Path $Stage 'MODIFIED-FILES.txt')

if ($Sign) { & (Join-Path $PSScriptRoot 'sign.ps1') -Certum (Join-Path $Stage 'crbn-rig.exe') }

# No portable marker and nothing else: settings live in %LOCALAPPDATA%\CRBNAmp like an installed copy's.
Get-ChildItem $Stage | ForEach-Object { '{0,12:N0}  {1}' -f $_.Length, $_.Name }
Write-Host "Hub folder: $Stage"
