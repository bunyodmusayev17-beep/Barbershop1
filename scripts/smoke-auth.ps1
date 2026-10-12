# Auth tekshiruvi: user-secrets'dagi parollar bilan login qiladi va faqat natijalarni chiqaradi (parollarni emas).
param([string]$Api = 'http://localhost:5080')

$project = Join-Path $PSScriptRoot '..\backend\NyBarber.Api'
$secrets = @{}
dotnet user-secrets list --project $project | ForEach-Object {
    $i = $_.IndexOf(' = ')
    if ($i -gt 0) { $secrets[$_.Substring(0, $i)] = $_.Substring($i + 3) }
}

function Get-Status([scriptblock]$call) {
    try { & $call | Out-Null; 200 } catch { [int]$_.Exception.Response.StatusCode }
}

function Test-Login([string]$login, [string]$password) {
    $body = @{ login = $login; password = $password } | ConvertTo-Json
    $res = Invoke-RestMethod "$Api/api/auth/login" -Method Post -ContentType 'application/json' -Body $body
    $me = Invoke-RestMethod "$Api/api/auth/me" -Headers @{ Authorization = "Bearer $($res.token)" }
    "{0,-8} login OK  -> role={1}, barberId={2}, barber={3}" -f $login, $me.role, $me.barberId, $me.barberName
}

Test-Login 'admin' $secrets['Seed:AdminPassword']
Test-Login 'jasur' $secrets['Seed:BarberPassword']
Test-Login 'SARDOR' $secrets['Seed:BarberPassword']

$wrong = @{ login = 'admin'; password = 'wrong-password' } | ConvertTo-Json
"Noto'g'ri parol      -> HTTP {0} (kutilgan 401)" -f (Get-Status { Invoke-RestMethod "$Api/api/auth/login" -Method Post -ContentType 'application/json' -Body $wrong })
"Tokensiz /me         -> HTTP {0} (kutilgan 401)" -f (Get-Status { Invoke-RestMethod "$Api/api/auth/me" })
"Soxta token bilan /me -> HTTP {0} (kutilgan 401)" -f (Get-Status { Invoke-RestMethod "$Api/api/auth/me" -Headers @{ Authorization = 'Bearer abc.def.ghi' } })
