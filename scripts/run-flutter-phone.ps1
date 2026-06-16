# Run Flutter on physical phone (wireless/USB) with live hot reload.
# Uses C:\SM junction — required because spaces in D:\Office\SK MOBILE break Gradle/APK paths.
$ErrorActionPreference = "Stop"
$FlutterBin = "C:\flutter\bin"
$ProjectDir = "C:\SM\apps\flutter"
$Sdk = "$env:LOCALAPPDATA\Android\sdk"
$env:Path = "$FlutterBin;$Sdk\platform-tools;$env:Path"

if (-not (Test-Path $ProjectDir)) {
    Write-Error "Junction C:\SM missing. Run: cmd /c mklink /J C:\SM `"D:\Office\SK MOBILE`""
}

Push-Location $ProjectDir
try {
    $adbOut = adb devices 2>&1 | Out-String
    $lines = ($adbOut -split "`n") | Where-Object { $_ -match '\sdevice(\s|$)' -and $_ -notmatch 'List of devices' }
    $physical = $lines | Where-Object { $_ -notmatch 'emulator-' } | Select-Object -First 1
    if (-not $physical -or $physical -notmatch '^(\S+)') {
        Write-Error "No physical phone found. Connect via USB or Wireless debugging, then run: adb devices"
    }
    $device = $Matches[1]
    Write-Host "Phone: $device"

    $apk = "android\app\build\outputs\flutter-apk\app-debug.apk"
    $flutterApkDir = "build\app\outputs\flutter-apk"
    $flutterApk = "$flutterApkDir\app-debug.apk"

    if (-not (Test-Path $apk)) {
        Write-Host "Building debug APK (first time may take 5-8 min)..."
        Push-Location android
        .\gradlew.bat assembleDebug
        Pop-Location
    }

    if (-not (Test-Path $apk)) {
        Write-Error "APK not found at $apk"
    }

    New-Item -ItemType Directory -Force -Path $flutterApkDir | Out-Null
    Copy-Item -Force $apk $flutterApk

    Write-Host "Installing on phone..."
    adb -s $device install -r $apk | Out-Host

    Write-Host "Starting app + live debug (r = hot reload, R = restart, q = quit)..."
    adb -s $device shell am start -n com.skmobile.shop/.MainActivity | Out-Null
    flutter attach -d $device
}
finally {
    Pop-Location
}
