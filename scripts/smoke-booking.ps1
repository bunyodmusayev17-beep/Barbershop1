# Zapis jarayonini API orqali tekshiradi. Yaratilgan sinov zapislari oxirida bazadan o'chiriladi.
param([string]$Api = 'http://localhost:5080')

function Post-Booking($body) {
    try {
        $r = Invoke-WebRequest "$Api/api/booking" -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json) -UseBasicParsing
        @{ Status = [int]$r.StatusCode; Body = $r.Content | ConvertFrom-Json }
    } catch {
        $resp = $_.Exception.Response
        $text = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
        @{ Status = [int]$resp.StatusCode; Body = $text | ConvertFrom-Json }
    }
}

$site = Invoke-RestMethod "$Api/api/public/site"
"Sayt: {0} | xizmatlar={1} | ustalar={2} | sharhlar={3}" -f $site.settings.businessName, $site.services.Count, $site.barbers.Count, $site.reviews.Count

$date = (Get-Date).AddDays(2).ToString('yyyy-MM-dd')
$haircut = $site.services | Where-Object { $_.name.uz -eq 'Soch olish' }
$slots = Invoke-RestMethod "$Api/api/booking/slots?serviceId=$($haircut.id)&date=$date"
"Slotlar ($date, istalgan usta): {0} ta, birinchisi {1} (ustalar: {2})" -f $slots.slots.Count, $slots.slots[0].time, ($slots.slots[0].barberIds -join ',')

$slot = $slots.slots | Where-Object { $_.barberIds.Count -ge 1 } | Select-Object -Skip 4 -First 1
$barber = $slot.barberIds[0]

# 1) Oddiy zapis
$a = Post-Booking @{ serviceId = $haircut.id; barberId = $barber; date = $date; time = $slot.time; clientName = 'Smoke Test'; clientPhone = '90 000 00 01'; language = 'uz' }
"1) Zapis:            HTTP {0} -> #{1}, usta={2}, {3}-{4}, narx={5}, tel={6}" -f $a.Status, $a.Body.id, $a.Body.barberName, $a.Body.time, $a.Body.endTime, $a.Body.price, $a.Body.clientPhone

# 2) Xuddi shu vaqtga yana (kutilgan 409 slot_unavailable)
$b = Post-Booking @{ serviceId = $haircut.id; barberId = $barber; date = $date; time = $slot.time; clientName = 'Smoke Test'; clientPhone = '90 000 00 02' }
"2) Band vaqt:        HTTP {0} -> {1}" -f $b.Status, $b.Body.code

# 3) Noto'g'ri telefon (kutilgan 400 phone_invalid)
$c = Post-Booking @{ serviceId = $haircut.id; date = $date; time = $slot.time; clientName = 'Smoke Test'; clientPhone = '12345' }
"3) Noto'g'ri tel:    HTTP {0} -> {1}" -f $c.Status, $c.Body.code

# 4) Slotlar qayta: band vaqt ushbu usta uchun yo'qolgan bo'lishi kerak
$after = Invoke-RestMethod "$Api/api/booking/slots?serviceId=$($haircut.id)&date=$date&barberId=$barber"
"4) Usta {0} uchun {1} endi ro'yxatda: {2} (kutilgan False)" -f $barber, $slot.time, [bool]($after.slots | Where-Object { $_.time -eq $slot.time })

# 5) Poyga: ikki mijoz bir vaqtda (alohida jarayonlarda) bitta bo'sh vaqtga
$free = ($after.slots | Select-Object -Last 1).time
$jobs = 1..2 | ForEach-Object {
    $n = $_
    Start-Job -ArgumentList $Api, $haircut.id, $barber, $date, $free, $n -ScriptBlock {
        param($Api, $sid, $bid, $date, $time, $n)
        $body = @{ serviceId = $sid; barberId = $bid; date = $date; time = $time; clientName = "Race $n"; clientPhone = "90 000 00 1$n" } | ConvertTo-Json
        try { [int](Invoke-WebRequest "$Api/api/booking" -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing).StatusCode }
        catch { [int]$_.Exception.Response.StatusCode }
    }
}
$codes = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
"5) Poyga ($free):    HTTP {0} (kutilgan: bittasi 201, bittasi 409)" -f (($codes | Sort-Object) -join ' va ')

# SQL stdin orqali uzatiladi: PowerShell 5.1 argumentlardagi qo'shtirnoqlarni buzadi
'DELETE FROM "Appointments" WHERE "ClientName" = ''Smoke Test'' OR "ClientName" LIKE ''Race %'';' |
    docker exec -i nybarber-db psql -U nybarber -d nybarber -qAt | Out-Null
"Sinov zapislari o'chirildi."
