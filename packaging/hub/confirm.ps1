<#
.SYNOPSIS
  Confirms a desktop publish of CRBN Rig to Pavillion Hub, as crbn-photo's release script does (Step-Confirm).
.DESCRIPTION
  1. The CDN's GOATi.xml for the app hashes (SHA-1) to the manifest pavillion-publish printed.
  2. A copy of the installed Hub's PatcherCli.exe installs that build into an empty scratch folder, and every file is
     byte-identical to the Hub folder that was sent.
  PatcherCli closes the process it is given before patching, so it is given a name nothing runs. Its temp folder goes
  at ..\temp from where it runs, so it runs from a copy in the scratch folder. The scratch folder is removed after.
.EXAMPLE
  pwsh packaging/hub/confirm.ps1 -ManifestSha1 <sha1> -HubDir dist\hub\crbn-rig-0.8.0-windows-x64
#>
param(
  [Parameter(Mandatory)] [string] $ManifestSha1,
  [Parameter(Mandatory)] [string] $HubDir,
  [string] $App = 'P2KLkFx6f5JQwaQKLCngoKLERMM25Fv2KLJmntLBKjXKbi1',
  [string] $Api = 'https://dev-api.carbonlinear.com/api'
)
$ErrorActionPreference = 'Stop'
$HubDir = (Resolve-Path $HubDir).Path
$scratch = Join-Path ([IO.Path]::GetTempPath()) "crbn-rig-confirm-$PID"
New-Item -ItemType Directory -Force $scratch | Out-Null
try {
  $cdn = "$Api/cdn/$App/"
  $served = Join-Path $scratch 'GOATi-served.xml'
  Invoke-WebRequest -Uri "${cdn}GOATi.xml?time=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -OutFile $served -UseBasicParsing
  $got = (Get-FileHash -Algorithm SHA1 $served).Hash.ToLowerInvariant()
  if ($got -ne $ManifestSha1.ToLowerInvariant()) { throw "the CDN serves manifest $got, not $ManifestSha1" }
  Write-Host "served: GOATi.xml is $got"

  $patcher = Join-Path $env:ProgramFiles 'Pavillion\components\PatcherCli.exe'
  if (-not (Test-Path $patcher)) { Write-Host 'installed: not tried (no Pavillion Hub on this box)'; return }
  $bin = Join-Path $scratch 'bin'; $app = Join-Path $scratch 'app'
  New-Item -ItemType Directory -Force -Path $bin, $app | Out-Null
  Copy-Item $patcher $bin
  # The trailing space keeps the quoted path's last backslash from escaping its quote (as the Hub's AppLibrary does).
  $p = Start-Process -FilePath (Join-Path $bin 'PatcherCli.exe') -ArgumentList @("`"$app `"", $cdn, 'GOATi.xml', '""', 'crbn-rig-release-check') `
    -WorkingDirectory $bin -PassThru -Wait -NoNewWindow -RedirectStandardOutput (Join-Path $scratch 'install.log')
  if ($p.ExitCode -ne 0) { throw "PatcherCli exited $($p.ExitCode): $(Get-Content (Join-Path $scratch 'install.log') -Tail 5 | Out-String)" }
  $want = @(Get-ChildItem -Recurse -File $HubDir)
  $diff = @()
  foreach ($f in $want) {
    $rel = [IO.Path]::GetRelativePath($HubDir, $f.FullName)
    $mine = Join-Path $app $rel
    if (-not (Test-Path $mine)) { $diff += "$rel missing"; continue }
    if ((Get-FileHash $mine).Hash -ne (Get-FileHash $f.FullName).Hash) { $diff += "$rel differs" }
  }
  if ($diff.Count) { throw "PatcherCli's install differs from the Hub folder: $($diff -join '; ')" }
  $extra = @(Get-ChildItem -Recurse -File $app).Count - $want.Count
  Write-Host "installed: $($want.Count) of $($want.Count) files byte-identical$(if ($extra -gt 0) { " ($extra more are PatcherCli's own)" })"
} finally {
  Remove-Item -Recurse -Force $scratch -ErrorAction SilentlyContinue
}
