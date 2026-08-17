# Prints the signing-certificate fingerprints (SHA-1 / SHA-256) for:
#   1. The local release & debug keystores in android/app
#   2. Any APK or AAB you pass as an argument
#
# Usage (from the project root):
#   powershell -ExecutionPolicy Bypass -File scripts\signing_info.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\signing_info.ps1 path\to\app.apk
#   powershell -ExecutionPolicy Bypass -File scripts\signing_info.ps1 path\to\app.aab
#
# Why: Firebase Google Sign-In matches the installed app's signing certificate
# against the SHA-1/SHA-256 fingerprints registered in your Firebase project.
# This script tells you EXACTLY which fingerprint any given build was signed
# with, so you always register the right one.

$ErrorActionPreference = 'SilentlyContinue'

# Resolve the project root from wherever the script is invoked.
if ($PSScriptRoot) {
  $projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
} else {
  $projectRoot = (Get-Location).Path
}
Set-Location $projectRoot

function Find-Keytool {
  if ($env:JAVA_HOME) {
    $kt = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    if (Test-Path $kt) { return $kt }
  }
  foreach ($base in @('C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Java', 'C:\Program Files\Microsoft')) {
    if (Test-Path $base) {
      $found = Get-ChildItem $base -Recurse -Filter keytool.exe -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($found) { return $found.FullName }
    }
  }
  return (Get-Command keytool -ErrorAction SilentlyContinue).Source
}

function Find-ApksignerCandidates {
  $sdk = $env:ANDROID_HOME
  if (-not $sdk -and $env:LOCALAPPDATA) {
    $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  }
  $candidates = @()
  if (Test-Path $sdk) {
    $bts = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory | Sort-Object Name -Descending
    foreach ($bt in $bts) {
      $candidate = Join-Path $bt.FullName 'apksigner.bat'
      if (Test-Path $candidate) { $candidates += $candidate }
    }
  }
  return $candidates
}

# Normalizes "SHA1: 03:6F:F8:..." or a bare hex string to lowercase hex (no colons).
function Get-Sha1Hex {
  param([string]$Line)
  if (-not $Line) { return $null }
  $m = [regex]::Match($Line, 'SHA-?1[^:]*:\s*([0-9A-Fa-f:]+)')
  if ($m.Success) { return (($m.Groups[1].Value) -replace ':','').ToLowerInvariant() }
  return $null
}

# Reads the android OAuth client certificate hashes registered in google-services.json.
# Both repo copies are kept identical, so results are deduplicated by client_id.
function Get-RegisteredFingerprints {
  $result = @()
  $seen = @{}
  foreach ($rel in @('google-services.json', 'android\app\google-services.json')) {
    $p = Join-Path $projectRoot $rel
    if (-not (Test-Path $p)) { continue }
    try {
      $json = Get-Content $p -Raw | ConvertFrom-Json
    } catch { continue }
    foreach ($client in $json.client) {
      foreach ($oc in $client.oauth_client) {
        if ($oc.client_type -eq 1 -and $oc.android_info.certificate_hash) {
          $cid = [string]$oc.client_id
          if (-not $seen.ContainsKey($cid)) {
            $seen[$cid] = $true
            $result += [pscustomobject]@{
              Source   = $rel
              Package  = $oc.android_info.package_name
              ClientId = $cid
              Sha1     = $oc.android_info.certificate_hash.ToLowerInvariant()
            }
          }
        }
      }
    }
  }
  return $result
}

$keytool = Find-Keytool
$apksignerCandidates = @(Find-ApksignerCandidates)
if (-not $keytool) { Write-Host '! keytool not found - install a JDK or set JAVA_HOME' -ForegroundColor Red }

# Collect the SHA-1 of every cert we look at, keyed by a human label.
$actual = @()  # each entry: { Label; Sha1 }

Write-Host ''
Write-Host '================ LOCAL KEYSTORES (dev builds) ================' -ForegroundColor Cyan
$release = Join-Path $projectRoot 'android\app\waybound-release.keystore'
$debug = Join-Path $projectRoot 'android\app\debug.keystore'
if ((Test-Path $release) -and $keytool) {
  Write-Host "release keystore: $release" -ForegroundColor Yellow
  $lines = & $keytool -list -v -keystore $release -storepass 'Waybound2026!' -alias waybound 2>&1
  $lines | Select-String -Pattern 'SHA1|SHA256' | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) -ForegroundColor Green }
  $h = Get-Sha1Hex (($lines | Select-String -Pattern 'SHA1:').Line)
  if ($h) { $actual += [pscustomobject]@{ Label = 'local release keystore (waybound-release.keystore)'; Sha1 = $h } }
}
if ((Test-Path $debug) -and $keytool) {
  Write-Host "debug keystore:   $debug" -ForegroundColor Yellow
  $lines = & $keytool -list -v -keystore $debug -storepass android -alias androiddebugkey 2>&1
  $lines | Select-String -Pattern 'SHA1|SHA256' | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) -ForegroundColor Green }
  $h = Get-Sha1Hex (($lines | Select-String -Pattern 'SHA1:').Line)
  if ($h) { $actual += [pscustomobject]@{ Label = 'local debug keystore (debug.keystore)'; Sha1 = $h } }
}

if ($args.Count -gt 0) {
  $file = $args[0]
  Write-Host ''
  Write-Host "================ CERTIFICATE OF: $file ================" -ForegroundColor Cyan
  if (-not (Test-Path $file)) {
    Write-Host '! File not found' -ForegroundColor Red
  } elseif ($file -like '*.apk') {
    $certLines = @()
    foreach ($cand in $apksignerCandidates) {
      $out = & $cand verify --print-certs $file 2>&1
      if ($out) { $certLines = @($out); break }
    }
    if (-not $certLines) {
      Write-Host '! Could not read the signing certificate (no working apksigner found).' -ForegroundColor Red
    } else {
      $certLines | Select-String -Pattern 'SHA-1|SHA-256' | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) -ForegroundColor Green }
      $h = Get-Sha1Hex (($certLines | Select-String -Pattern 'SHA-1 digest').Line)
      if ($h) { $actual += [pscustomobject]@{ Label = "APK: $file"; Sha1 = $h } }
    }
  } elseif ($file -like '*.aab') {
    if ($keytool) {
      $lines = & $keytool -printcert -jarfile $file 2>&1
      $lines | Select-String -Pattern 'SHA1|SHA256' | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) -ForegroundColor Green }
      $h = Get-Sha1Hex (($lines | Select-String -Pattern 'SHA1:').Line)
      if ($h) { $actual += [pscustomobject]@{ Label = "AAB: $file"; Sha1 = $h } }
    }
  } else {
    Write-Host '! Pass an .apk or .aab file' -ForegroundColor Red
  }
}

Write-Host ''
Write-Host '================ REGISTERED FINGERPRINTS (google-services.json) ================' -ForegroundColor Cyan
$registered = @(Get-RegisteredFingerprints)
if ($registered.Count -eq 0) {
  Write-Host '! No android OAuth client (client_type 1) found in google-services.json' -ForegroundColor Red
} else {
  foreach ($r in $registered) {
    Write-Host ("  {0}  package={1}  client_id={2}" -f $r.Sha1.ToUpperInvariant(), $r.Package, $r.ClientId) -ForegroundColor Green
  }
}

Write-Host ''
Write-Host '================ FINGERPRINT CHECK ================' -ForegroundColor Cyan
if ($actual.Count -gt 0 -and $registered.Count -gt 0) {
  foreach ($a in $actual) {
    $ok = $false
    foreach ($r in $registered) { if ($r.Package -and $r.Package -eq 'com.waybound.travel' -and $r.Sha1 -eq $a.Sha1) { $ok = $true; break } }
    if ($ok) {
      Write-Host ("  [OK]   {0}  ->  {1} IS registered" -f $a.Sha1, $a.Label) -ForegroundColor Green
    } else {
      Write-Host ("  [MISS] {0}  ->  {1} is NOT registered in Firebase!" -f $a.Sha1, $a.Label) -ForegroundColor Red
    }
  }
} else {
  Write-Host '  Pass an .apk/.aab (or run while keystores exist) to check fingerprints.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Use these values in Firebase Console -> Project settings -> com.waybound.travel -> Add fingerprint (keep ALL existing ones).' -ForegroundColor Cyan
Write-Host 'See docs/google-signin-fingerprint.md for the full "Continue with Google" browser-flow troubleshooting.' -ForegroundColor Cyan
