# Build release APK — use repo root script for Windows-safe path (C:\SM junction)
$ErrorActionPreference = "Stop"
$repoScript = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "scripts\build-flutter-apk.ps1"
& $repoScript
