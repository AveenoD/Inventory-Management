# Run Flutter on Android emulator/device — uses C:\SM junction (no-space path)
$ErrorActionPreference = "Stop"
$FlutterBin = "C:\flutter\bin"
$ProjectDir = "C:\SM\apps\flutter"
$Sdk = "$env:LOCALAPPDATA\Android\sdk"
$env:Path = "$FlutterBin;$Sdk\platform-tools;$Sdk\emulator;$env:Path"

if (-not (Test-Path $ProjectDir)) {
    Write-Error "Junction C:\SM missing. Run: cmd /c mklink /J C:\SM `"D:\Office\SK MOBILE`""
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class PowerRequest {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
"@
[PowerRequest]::SetThreadExecutionState([UInt32]2147483649) | Out-Null

function Stop-BuildPowerRequest {
    [PowerRequest]::SetThreadExecutionState([UInt32]2147483648) | Out-Null
}

try {
    Push-Location $ProjectDir

    $device = $args -join " "
    if (-not $device) {
        $adbOut = adb devices 2>&1 | Out-String
        if ($adbOut -match "(emulator-\d+)") {
            $device = $Matches[1]
        } else {
            $device = ""
        }
    }

    if ($device) {
        Write-Host "Running on $device ..."
        flutter run -d $device @args
    } else {
        Write-Host "No Android device found. Starting Pixel_6 emulator ..."
        Start-Process -FilePath "$Sdk\emulator\emulator.exe" -ArgumentList "-avd","Pixel_6" -WindowStyle Normal
        $deadline = (Get-Date).AddMinutes(3)
        do {
            Start-Sleep -Seconds 5
            $adbOut = adb devices 2>&1 | Out-String
            if ($adbOut -match "(emulator-\d+)\s+device") { break }
        } while ((Get-Date) -lt $deadline)
        flutter run -d emulator-5554
    }
}
finally {
    Pop-Location
    Stop-BuildPowerRequest
}
