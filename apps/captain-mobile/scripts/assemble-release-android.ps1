# Local standalone release APK build (no Metro required).
# Uses JDK 17 in this session to avoid JAVA_HOME=Java8 failures.

$ErrorActionPreference = "Stop"

$jdk17Roots = @(
  "${env:ProgramFiles}\Eclipse Adoptium",
  "${env:ProgramFiles}\Microsoft"
)
$javaHome = $null
foreach ($root in $jdk17Roots) {
  if (Test-Path $root) {
    $dir = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^jdk-17\.' } |
      Sort-Object Name -Descending |
      Select-Object -First 1
    if ($dir -and (Test-Path (Join-Path $dir.FullName "bin\java.exe"))) {
      $javaHome = $dir.FullName
      break
    }
  }
}

if (-not $javaHome) {
  Write-Error "JDK 17 not found under Program Files. Install Temurin/Microsoft JDK 17 or set JAVA_HOME manually."
}

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"

$android = Join-Path $PSScriptRoot "..\android" | Resolve-Path
Set-Location $android

Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "Working directory=$android"

& .\gradlew.bat assembleRelease --no-daemon @args
