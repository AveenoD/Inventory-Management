# Install latest debug APK on connected phone (USB or wireless).
$ErrorActionPreference = "Stop"
$Sdk = "$env:LOCALAPPDATA\Android\sdk\platform-tools"
$env:Path = "C:\flutter\bin;$Sdk;$env:Path"

$ProjectDir = "C:\SM\apps\flutter"
$apk = "$ProjectDir\android\app\build\outputs\flutter-apk\app-debug.apk"
if (-not (Test-Path $apk)) {
    Write-Host "APK missing — building via Gradle..."
    Push-Location "$ProjectDir\android"
    .\gradlew.bat assembleDebug
    Pop-Location
}

Write-Host "Waiting for phone (enable USB debugging + Install via USB on Xiaomi)..."
$deadline = (Get-Date).AddMinutes(2)
$device = $null
do {
    $out = adb devices 2>&1 | Out-String
    $lines = ($out -split "`n") | Where-Object { $_ -match '\sdevice(\s|$)' -and $_ -notmatch 'List of devices' }
    $physical = $lines | Where-Object { $_ -notmatch 'emulator-' } | Select-Object -First 1
    if ($physical -match '^(\S+)') {
        $device = $Matches[1]
        break
    }
    Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)

if (-not $device) {
    Write-Host ""
    Write-Host "No phone found. Manual install:"
    Write-Host "  1. Copy to phone: D:\Office\SK MOBILE\sk-mobile-debug.apk"
    Write-Host "  2. Open file on phone -> Install"
    exit 1
}

Write-Host "Installing on $device ..."
$result = adb -s $device install -r $apk 2>&1 | Out-String
Write-Host $result

if ($result -notmatch "Success") {
    Write-Host "ADB install blocked — pushing to Downloads folder..."
    adb -s $device push $apk /sdcard/Download/sk-mobile-debug.apk
    Write-Host "Open Files app -> Downloads -> sk-mobile-debug.apk -> Install"
    exit 1
}

Write-Host "Launching app..."
adb -s $device shell am start -n com.skmobile.shop/.MainActivity
Write-Host "Done. Login -> Dashboard (center tab) -> More -> Reports"
