# Admin va usta API'larini rollar bo'yicha tekshiradi. Parollar user-secrets'dan olinadi va ekranga chiqarilmaydi.
# Yaratilgan sinov ma'lumotlari oxirida o'chiriladi.
param([string]$Api = 'http://localhost:5080')

$project = Join-Path $PSScriptRoot '..\backend\NyBarber.Api'
$secrets = @{}
dotnet user-secrets list --project $project | ForEach-Object {
    $i = $_.IndexOf(' = ')
    if ($i -gt 0) { $secrets[$_.Substring(0, $i)] = $_.Substring($i + 3) }
}

function Login($login, $password) {
    $r = Invoke-RestMethod "$Api/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{ login = $login; password = $password } | ConvertTo-Json)
    @{ Authorization = "Bearer $($r.token)" }
}

function Call($method, $path, $headers, $body) {
    $args = @{ Uri = "$Api$path"; Method = $method; Headers = $headers; UseBasicParsing = $true }
    if ($null -ne $body) { $args.ContentType = 'application/json'; $args.Body = ($body | ConvertTo-Json -Depth 5) }
    try {
        $r = Invoke-WebRequest @args
        @{ Status = [int]$r.StatusCode; Body = $(if ($r.Content) { $r.Content | ConvertFrom-Json } else { $null }) }
    } catch {
        @{ Status = [int]$_.Exception.Response.StatusCode; Body = $null }
    }
}

$admin = Login 'admin' $secrets['Seed:AdminPassword']
$jasur = Login 'jasur' $secrets['Seed:BarberPassword']

$stats = Call GET '/api/admin/stats' $admin
"Admin  stats            -> {0} | bugun={1}, kutilmoqda={2}, 7 kun={3}" -f $stats.Status, $stats.Body.todayCount, $stats.Body.upcomingCount, $stats.Body.last7Days.Count
"Admin  services         -> {0} | {1} ta" -f (Call GET '/api/admin/services' $admin).Status, (Call GET '/api/admin/services' $admin).Body.Count
"Admin  barbers          -> {0} | {1} ta" -f (Call GET '/api/admin/barbers' $admin).Status, (Call GET '/api/admin/barbers' $admin).Body.Count
"Admin  users            -> {0}" -f (Call GET '/api/admin/users' $admin).Status
"Admin  settings         -> {0}" -f (Call GET '/api/admin/settings' $admin).Status
"Usta   stats            -> {0} (kutilgan 403)" -f (Call GET '/api/admin/stats' $jasur).Status
"Usta   services         -> {0} (kutilgan 403)" -f (Call GET '/api/admin/services' $jasur).Status
"Tokensiz appointments   -> {0} (kutilgan 401)" -f (Call GET '/api/admin/appointments' @{}).Status

# Qo'lda zapis: admin Sardor (2) ga, usta Jasur o'ziga
$date = (Get-Date).AddDays(3).ToString('yyyy-MM-dd')
$a1 = Call POST '/api/admin/appointments' $admin @{ serviceId = 1; barberId = 2; date = $date; time = '15:00'; clientName = 'Smoke Admin'; clientPhone = '900000201' }
"Admin  qo'lda zapis     -> {0} | #{1} {2} {3} status={4}" -f $a1.Status, $a1.Body.id, $a1.Body.barberName, $a1.Body.time, $a1.Body.status
$a2 = Call POST '/api/admin/appointments' $jasur @{ serviceId = 1; barberId = 1; date = $date; time = '15:00'; clientName = 'Smoke Admin'; clientPhone = '900000202' }
"Usta   o'ziga zapis     -> {0} | #{1} {2}" -f $a2.Status, $a2.Body.id, $a2.Body.barberName
"Usta   boshqaga zapis   -> {0} (kutilgan 403)" -f (Call POST '/api/admin/appointments' $jasur @{ serviceId = 1; barberId = 2; date = $date; time = '17:00'; clientName = 'Smoke Admin'; clientPhone = '900000203' }).Status
"Admin  ustma-ust zapis  -> {0} (kutilgan 409)" -f (Call POST '/api/admin/appointments' $admin @{ serviceId = 1; barberId = 2; date = $date; time = '15:15'; clientName = 'Smoke Admin'; clientPhone = '900000204' }).Status

$own = Call GET "/api/admin/appointments?from=$date&to=$date&barberId=2" $jasur
"Usta   ro'yxati         -> {0} | ustalar: {1} (kutilgan faqat Jasur)" -f $own.Status, (($own.Body | ForEach-Object { $_.barberName } | Sort-Object -Unique) -join ',')
"Usta   boshqaning statusi -> {0} (kutilgan 403)" -f (Call PATCH "/api/admin/appointments/$($a1.Body.id)/status" $jasur @{ status = 2 }).Status
$done = Call PATCH "/api/admin/appointments/$($a2.Body.id)/status" $jasur @{ status = 2 }
"Usta   o'z statusi      -> {0} | {1}" -f $done.Status, $done.Body.status

# Xizmat CRUD
$svc = Call POST '/api/admin/services' $admin @{ name = @{ uz = 'Smoke xizmat'; ru = 'Смоук'; en = 'Smoke' }; price = 10000; durationMinutes = 20; sortOrder = 99; isActive = $true; barberIds = @(1, 3) }
"Admin  xizmat yaratish  -> {0} | ustalar={1}" -f $svc.Status, ($svc.Body.barberIds -join ',')
"Admin  xizmat o'chirish -> {0}" -f (Call DELETE "/api/admin/services/$($svc.Body.id)" $admin).Status

# Tozalash
'DELETE FROM "Appointments" WHERE "ClientName" = ''Smoke Admin'';' | docker exec -i nybarber-db psql -U nybarber -d nybarber -qAt | Out-Null
"Sinov ma'lumotlari o'chirildi."
