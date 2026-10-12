# Barcha smoke-testlarni ketma-ket ishga tushiradi (API http://localhost:5080 da ishlab turishi kerak).
# Rate limit oynalari (daqiqasiga) to'qnashmasligi uchun orasida kutiladi.
$ErrorActionPreference = 'Stop'
Write-Host '=== AUTH ===' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'smoke-auth.ps1')
Write-Host ''
Write-Host '=== BOOKING ===' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'smoke-booking.ps1')
Write-Host ''
Write-Host '=== ADMIN (login limiti tiklanishi uchun 60 s kutiladi) ===' -ForegroundColor Cyan
Start-Sleep -Seconds 60
& (Join-Path $PSScriptRoot 'smoke-admin.ps1')
