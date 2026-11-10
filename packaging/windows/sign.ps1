<#
.SYNOPSIS
  Authenticode-sign files with signtool, using whichever signing material is configured.

.DESCRIPTION
  With -Certum (release builds, D-PHOTOLIVE-031): GOATi's Certum cloud certificate, which SimplySign
  Desktop mounts into Cert:\CurrentUser\My while the owner has a session open (an OTP from the
  SimplySign app, about two hours). With no session it stops and says so; it never leaves a release
  unsigned. -CheckOnly checks the session and signs nothing. WINDOWS_CERT_SHA1 overrides the thumbprint.

  Without -Certum, it tries, in order:
    1. A code-signing certificate file:   WINDOWS_CERTIFICATE (base64 .pfx), WINDOWS_CERTIFICATE_PASSWORD
    2. Azure Trusted Signing:             AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
                                          AZURE_SIGNING_ENDPOINT (e.g. https://eus.codesigning.azure.net),
                                          AZURE_SIGNING_ACCOUNT, AZURE_CERT_PROFILE
  With neither, it prints a warning and leaves the files unsigned (exit code 0), so test builds
  still produce installers.

  This is the one place to adapt when the signing setup changes (an HSM/cloud key, a different
  timestamp server, ...). Optional overrides: WINDOWS_TIMESTAMP_URL, SIGNTOOL (path to signtool.exe).

.EXAMPLE
  pwsh packaging/windows/sign.ps1 dist/hub/crbn-rig-0.8.0-windows-x64/crbn-rig.exe
  pwsh packaging/windows/sign.ps1 -Certum -CheckOnly
  pwsh packaging/windows/sign.ps1 -Certum dist/hub/crbn-rig-0.8.0-windows-x64/crbn-rig.exe
#>
param(
  [switch] $Certum,
  [switch] $CheckOnly,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Files
)
$ErrorActionPreference = 'Stop'

function Write-Warn([string] $Message) {
  if ($env:GITHUB_ACTIONS) { Write-Output "::warning::$Message" } else { Write-Warning $Message }
}

function Find-SignTool {
  if ($env:SIGNTOOL) { return $env:SIGNTOOL }
  $onPath = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  $kits = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
  $found = Get-ChildItem -Path $kits -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
    Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $found) { throw 'signtool.exe not found (install the Windows SDK)' }
  return $found.FullName
}

function Invoke-SignTool([string[]] $Arguments) {
  & $script:SignTool @Arguments
  if ($LASTEXITCODE -ne 0) { throw "signtool $($Arguments[0]) failed with exit code $LASTEXITCODE" }
}

# GOATi's code-signing certificate: Certum "Standard Code Signing in the Cloud" (OV), O=GOATi Entertainment Pty Ltd,
# valid to 2027-09-24; its public copy is pavillion_client certs/. A renewal changes the thumbprint: change it here.
$GoatiCertSha1 = '679D7EDC9596257DAF0FBDB1D80601DE0A0ED0E2'

if ($Certum) {
  $sha1 = (($(if ($env:WINDOWS_CERT_SHA1) { $env:WINDOWS_CERT_SHA1 } else { $GoatiCertSha1 })) -replace '[^0-9A-Fa-f]', '').ToUpper()
  $ask = 'ask the owner to open a SimplySign Desktop session (an OTP from the SimplySign app; it lasts about two hours), then run this again'
  $cert = Get-ChildItem Cert:\CurrentUser\My -ErrorAction SilentlyContinue | Where-Object Thumbprint -eq $sha1 | Select-Object -First 1
  if (-not $cert) { throw "no SimplySign session: certificate $sha1 is not in Cert:\CurrentUser\My; $ask" }
  if (-not $cert.HasPrivateKey) { throw "certificate $sha1 is there without its key (a public copy, not SimplySign's card); $ask" }
  $daysLeft = [int][Math]::Floor(($cert.NotAfter - (Get-Date)).TotalDays)
  if ($daysLeft -lt 0) { throw "certificate $sha1 expired on $($cert.NotAfter.ToString('yyyy-MM-dd')): renew it with Certum" }
  if ($daysLeft -le 60) { Write-Warn "the signing certificate expires in $daysLeft days ($($cert.NotAfter.ToString('yyyy-MM-dd'))): Certum's renewal takes 3-5 business days" }
  if ($CheckOnly) {
    Write-Output "SimplySign session open: $(($cert.Subject -split ',')[0]), $daysLeft days left on the certificate"
    exit 0
  }
}
if (-not $Files) { throw 'no files to sign' }

$Files = $Files | ForEach-Object { (Resolve-Path $_).Path }
$haveCert = [bool]$env:WINDOWS_CERTIFICATE
$azureVars = 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_SIGNING_ENDPOINT', 'AZURE_SIGNING_ACCOUNT', 'AZURE_CERT_PROFILE'
$haveAzure = -not ($azureVars | Where-Object { -not [Environment]::GetEnvironmentVariable($_) })

if (-not $Certum -and -not $haveCert -and -not $haveAzure) {
  Write-Warn "Windows signing secrets not set (WINDOWS_CERTIFICATE or AZURE_*): leaving unsigned: $($Files -join ', ')"
  exit 0
}

$script:SignTool = Find-SignTool
$common = @('sign', '/v', '/fd', 'SHA256', '/td', 'SHA256', '/d', 'CRBN Rig', '/du', 'https://pavillionhub.com/app/crbn-rig')
$tmp = Join-Path ([IO.Path]::GetTempPath()) "crbn-rig-sign-$PID"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
  if ($Certum) {
    Write-Output "Signing with GOATi's Certum certificate ($sha1) through SimplySign: $($Files -join ', ')"
    # Certum's timestamp server first, Sectigo's if it fails: any RFC 3161 server will do. signtool replaces a
    # signature rather than adding one, so signing again after a timestamp failure is safe.
    $servers = if ($env:WINDOWS_TIMESTAMP_URL) { @($env:WINDOWS_TIMESTAMP_URL) } else { @('http://time.certum.pl', 'http://timestamp.sectigo.com') }
    foreach ($ts in $servers) {
      $out = & $script:SignTool @($common + @('/tr', $ts, '/sha1', $sha1) + $Files) 2>&1
      if ($LASTEXITCODE -eq 0) { $out | Write-Output; break }
      $out | Write-Output
      if ($ts -eq $servers[-1] -or ($out | Out-String) -notmatch '(?i)timestamp|time stamp') { throw "signtool sign failed with exit code $LASTEXITCODE" }
      Write-Warn "timestamping against $ts failed; trying $($servers[$servers.IndexOf($ts) + 1])"
    }
    # What is on disk, not what signtool said: signed by this certificate, and countersigned, so the signature
    # outlives the certificate.
    foreach ($f in $Files) {
      $sig = Get-AuthenticodeSignature -LiteralPath $f
      if ($sig.SignerCertificate.Thumbprint -ne $sha1) { throw "$f is not signed by $sha1 ($($sig.Status))" }
      if (-not $sig.TimeStamperCertificate) { throw "$f has no timestamp" }
    }
  }
  elseif ($haveCert) {
    Write-Output "Signing with WINDOWS_CERTIFICATE: $($Files -join ', ')"
    $pfx = Join-Path $tmp 'cert.pfx'
    [IO.File]::WriteAllBytes($pfx, [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE))
    $ts = if ($env:WINDOWS_TIMESTAMP_URL) { $env:WINDOWS_TIMESTAMP_URL } else { 'http://timestamp.digicert.com' }
    $signArgs = $common + @('/tr', $ts, '/f', $pfx)
    if ($env:WINDOWS_CERTIFICATE_PASSWORD) { $signArgs += @('/p', $env:WINDOWS_CERTIFICATE_PASSWORD) }
    Invoke-SignTool ($signArgs + $Files)
  }
  else {
    Write-Output "Signing with Azure Trusted Signing ($env:AZURE_SIGNING_ACCOUNT / $env:AZURE_CERT_PROFILE): $($Files -join ', ')"
    # The dlib authenticates with DefaultAzureCredential, which reads AZURE_TENANT_ID,
    # AZURE_CLIENT_ID and AZURE_CLIENT_SECRET from the environment.
    $pkg = Join-Path $tmp 'trusted-signing.zip'
    Invoke-WebRequest -Uri 'https://www.nuget.org/api/v2/package/Microsoft.Trusted.Signing.Client' -OutFile $pkg
    Expand-Archive -Path $pkg -DestinationPath (Join-Path $tmp 'client') -Force
    $dlib = Get-ChildItem -Path (Join-Path $tmp 'client') -Recurse -Filter Azure.CodeSigning.Dlib.dll |
      Where-Object { $_.FullName -match '\\x64\\' } | Select-Object -First 1
    if (-not $dlib) { throw 'Azure.CodeSigning.Dlib.dll not found in Microsoft.Trusted.Signing.Client' }
    $metadata = Join-Path $tmp 'metadata.json'
    @{
      Endpoint               = $env:AZURE_SIGNING_ENDPOINT
      CodeSigningAccountName = $env:AZURE_SIGNING_ACCOUNT
      CertificateProfileName = $env:AZURE_CERT_PROFILE
    } | ConvertTo-Json | Set-Content -Path $metadata -Encoding utf8
    $ts = if ($env:WINDOWS_TIMESTAMP_URL) { $env:WINDOWS_TIMESTAMP_URL } else { 'http://timestamp.acs.microsoft.com' }
    Invoke-SignTool ($common + @('/tr', $ts, '/dlib', $dlib.FullName, '/dmdf', $metadata) + $Files)
  }
  Invoke-SignTool (@('verify', '/pa', '/v') + $Files)
}
finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
