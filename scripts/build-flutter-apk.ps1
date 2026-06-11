# SK Mobile Flutter APK — Windows-safe build (no-space path via C:\SM junction)
$ErrorActionPreference = "Stop"
$FlutterBin = "C:\flutter\bin"
$ProjectDir = "C:\SM\apps\flutter"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutApk = Join-Path $RepoRoot "build\android\sk-mobile-flutter.apk"

if (-not (Test-Path $ProjectDir)) {
    Write-Error "Junction C:\SM missing. Run: cmd /c mklink /J C:\SM `"D:\Office\SK MOBILE`""
}

# Keep system awake while building (screen off is OK, sleep is not)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class PowerRequest {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
"@
# ES_CONTINUOUS (2147483648) | ES_SYSTEM_REQUIRED (1) — screen off OK, sleep blocked
[PowerRequest]::SetThreadExecutionState([UInt32]2147483649) | Out-Null

function Stop-BuildPowerRequest {
    [PowerRequest]::SetThreadExecutionState([UInt32]2147483648) | Out-Null
}

try {
    $env:Path = "$FlutterBin;$env:Path"

    # Stop stale Gradle daemons
    Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Push-Location (Join-Path $ProjectDir "android")
    & .\gradlew.bat --stop 2>$null
    Pop-Location

    Push-Location $ProjectDir
    Write-Host "Cleaning previous build artifacts..."
    flutter clean
    flutter pub get

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host "Building release APK from $ProjectDir ..."
    flutter build apk --release
    $sw.Stop()
    Write-Host "Gradle/Flutter build took $([math]::Round($sw.Elapsed.TotalMinutes, 1)) min"
    Pop-Location

    # Flutter expects this path; on Windows+spaces Gradle may leave APK under android/app/build
    $flutterApk = Join-Path $ProjectDir "build\app\outputs\flutter-apk\app-release.apk"
    $gradleApk = Join-Path $ProjectDir "android\app\build\outputs\flutter-apk\app-release.apk"

    if (-not (Test-Path $flutterApk)) {
        if (Test-Path $gradleApk) {
            Write-Host "Flutter output path missing; copying from Gradle output..."
            New-Item -ItemType Directory -Force -Path (Split-Path $flutterApk) | Out-Null
            Copy-Item $gradleApk $flutterApk -Force
        } else {
            throw "APK not found at:`n  $flutterApk`n  $gradleApk"
        }
    }

    New-Item -ItemType Directory -Force -Path (Split-Path $OutApk) | Out-Null
    Copy-Item $flutterApk $OutApk -Force
    Write-Host "APK ready: $OutApk"
    Write-Host "Size: $((Get-Item $OutApk).Length) bytes"
}
finally {
    Stop-BuildPowerRequest
}
