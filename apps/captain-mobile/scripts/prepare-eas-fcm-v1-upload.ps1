# Stages Firebase Admin SDK JSON next to package.json so `eas credentials` often auto-detects it
# (avoid manual path typos such as cobraDownloads\ instead of cobra\Downloads\).
#
# Does NOT upload — run `npx eas credentials -p android` after this and choose FCM V1 push notifications.
#
# Usage (from apps/captain-mobile):
#   powershell -ExecutionPolicy Bypass -File ./scripts/prepare-eas-fcm-v1-upload.ps1
#   powershell ... -File ./scripts/prepare-eas-fcm-v1-upload.ps1 -ServiceAccountJsonPath 'C:\Users\YOU\Downloads\your-key.json'

param(
  [string]$ServiceAccountJsonPath = ""
)

$ErrorActionPreference = "Stop"
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$defaultCandidates = @(
  Join-Path $env:USERPROFILE "Downloads\alkam-8e1ed-firebase-adminsdk-fbsuc-6dd124a9ae.json"
  Join-Path $env:USERPROFILE "Downloads\alkam-8e1ed-firebase-adminsdk-fbsvc-6dd174e0ac.json"
)

$resolved = ""
if ($ServiceAccountJsonPath.Trim().Length -gt 0) {
  $resolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ServiceAccountJsonPath.Trim())
} else {
  foreach ($p in $defaultCandidates) {
    if ($p -and (Test-Path -LiteralPath $p)) {
      $resolved = $p
      break
    }
  }
}

if (-not $resolved -or -not (Test-Path -LiteralPath $resolved)) {
  Write-Error @"
Could not find a Firebase Admin JSON key.
- Pass explicitly: -ServiceAccountJsonPath 'C:\Users\<you>\Downloads\alkam-8e1ed-firebase-adminsdk-....json'

Common typo: C:\Users\cobraDownloads\...  (wrong — missing \cobra\ )
Correct:      C:\Users\cobra\Downloads\...
"@
}

$destName = ".eas-firebase-admin-staging.json"
$dest = Join-Path $mobileRoot $destName
Copy-Item -LiteralPath $resolved -Destination $dest -Force

Write-Host ""
Write-Host "Staged Firebase Admin key for Expo/EAS picker:" -ForegroundColor Green
Write-Host "  SOURCE: $resolved"
Write-Host "  STAGED (gitignored): $dest"
Write-Host ""
Write-Host "EAS profile to use:" -ForegroundColor Cyan
Write-Host '  Credentials > Android > production'
Write-Host ''
Write-Host "Menu (CLI):" -ForegroundColor Cyan
Write-Host '  Google Service Account'
Write-Host '  Manage your Google Service Account Key for Push Notifications (FCM V1)'
Write-Host '  NOT: Manage your Google Service Account (Play submissions)'
Write-Host ''
Write-Host "Next:"
Write-Host "  cd `"$mobileRoot`""
Write-Host "  npx eas credentials -p android"
Write-Host ""
Write-Host "When asked for path, paste the STAGED path above, or Press Y if the CLI offers the staged file automatically."
Write-Host ""
Write-Host 'Expo web: account > project slug "captain-mobile" ... credentials > Android > production.'
Write-Host "EAS extra.eas.projectId in app.json should match this Expo project."
Write-Host ""
