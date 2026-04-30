# Local debug APK: run from repo root OR from captain-mobile folder.
# Fixes builds when JAVA_HOME points to JDK 8 (Gradle in this project needs JDK 11+; use 17).

$ErrorActionPreference = "Stop"
$jdk17Roots = @(
  "${env:ProgramFiles}\Eclipse Adoptium",
  "${env:ProgramFiles}\Microsoft"
)
$javaHome = $null
foreach ($root in $jdk17Roots) {
  if (Test-Path $root) {
    $dir = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^jdk-17\.' } | Sort-Object Name -Descending | Select-Object -First 1
    if ($dir -and (Test-Path (Join-Path $dir.FullName "bin\java.exe"))) {
      $javaHome = $dir.FullName
      break
    }
  }
}
if (-not $javaHome) {
  Write-Error "JDK 17 not found under Program Files (Eclipse Adoptium or Microsoft). Install Temurin 17 or set JAVA_HOME manually, then re-run."
}
$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"

$android = Join-Path $PSScriptRoot "..\android" | Resolve-Path
Set-Location $android
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "Working directory=$android"
& .\gradlew.bat assembleDebug --no-daemon @args
