# Lokal ishlab chiqish uchun maxfiy sozlamalarni (user-secrets) yaratadi:
#   Seed:AdminPassword, Seed:BarberPassword - birinchi ishga tushishda yaratiladigan akkauntlar paroli
#   Jwt:Key - tokenlarni imzolash kaliti
# Mavjud qiymatlar qayta yozilmaydi. Parollar faqat shu terminalda bir marta ko'rsatiladi.
$project = Join-Path $PSScriptRoot '..\backend\NyBarber.Api'

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

function Get-RandomBytes([int]$count) {
    $bytes = New-Object byte[] $count
    $rng.GetBytes($bytes)
    $bytes
}

function New-Secret([int]$length) {
    $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    -join (Get-RandomBytes $length | ForEach-Object { $chars[$_ % $chars.Length] })
}

$existing = dotnet user-secrets list --project $project 2>$null
function Test-Key([string]$key) { [bool]($existing | Where-Object { $_ -like "$key = *" }) }

if (-not (Test-Key 'Jwt:Key')) {
    $key = [Convert]::ToBase64String([byte[]](Get-RandomBytes 48))
    dotnet user-secrets set 'Jwt:Key' $key --project $project | Out-Null
    Write-Host 'Jwt:Key yaratildi.'
}

foreach ($key in 'Seed:AdminPassword', 'Seed:BarberPassword') {
    if (Test-Key $key) { Write-Host "$key allaqachon bor - o'zgartirilmadi."; continue }
    $value = New-Secret 14
    dotnet user-secrets set $key $value --project $project | Out-Null
    Write-Host "$key = $value" -ForegroundColor Yellow
}

Write-Host ''
Write-Host "Loginlar: admin (admin), jasur / sardor / bekzod (ustalar)."
Write-Host "Parollarni keyin ko'rish: dotnet user-secrets list --project backend/NyBarber.Api"
