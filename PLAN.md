# New York Barbershop â€” veb-tizim rejasi (1-bosqich)

## Maqsad
Barbershop egasiga yuboriladigan **haqiqiy ishlaydigan demo**: klient saytda o'zi zapis qiladi,
admin va ustalar hammasini paneldan boshqaradi. Telegram bot â€” 2-bosqichda.

## Qarorlar
| Mavzu | Tanlov |
|---|---|
| Backend | C#, **.NET 10**, ASP.NET Core Web API (Controllers) |
| Baza | **PostgreSQL** (Docker), EF Core + Npgsql, migratsiyalar |
| Frontend | **Vite + React + TypeScript + Tailwind**, Framer Motion, i18next, TanStack Query, React Router |
| Arxitektura | Oddiy monolit, feature papkalar bo'yicha |
| Auth | Login/email + parol, **JWT**, rollar: `Admin`, `Barber` |
| Tillar | O'zbek, rus, ingliz (UI matnlari + bazadagi kontent 3 tilda) |
| Dizayn | 11-variant interfeysi (1950-yillar Amerika: krem, qizil, ko'k, barber-pole) + 5-variant shrifti (Poiret One sarlavhalar, Josefin Sans matn) |
| Kontent | Namunaviy ma'lumotlar (seed); hammasi admin paneldan o'zgartiriladi |
| Hosting | Hozircha lokal (keyin bulutga) |
| Vaqt zonasi | Asia/Tashkent (UTC+5), bazada UTC |

## Papkalar
```
nybarber/
â”œâ”€ docker-compose.yml          # postgres:17
â”œâ”€ backend/
â”‚  â””â”€ NyBarber.Api/
â”‚     â”œâ”€ Program.cs
â”‚     â”œâ”€ Data/                 # AppDbContext, konfiguratsiyalar, Seed
â”‚     â”œâ”€ Domain/               # entity'lar, enum'lar
â”‚     â”œâ”€ Features/
â”‚     â”‚  â”œâ”€ Auth/              # login, JWT, me
â”‚     â”‚  â”œâ”€ Services/          # xizmatlar CRUD
â”‚     â”‚  â”œâ”€ Barbers/           # ustalar CRUD + ish jadvali + dam olish
â”‚     â”‚  â”œâ”€ Booking/           # bo'sh vaqtlar, zapis yaratish, statuslar
â”‚     â”‚  â”œâ”€ Gallery/           # rasm yuklash
â”‚     â”‚  â”œâ”€ Reviews/           # sharhlar
â”‚     â”‚  â”œâ”€ Settings/          # manzil, telefon, ish vaqti, ijtimoiy tarmoqlar
â”‚     â”‚  â”œâ”€ Users/             # admin/usta akkauntlari
â”‚     â”‚  â””â”€ Stats/             # dashboard statistikasi
â”‚     â””â”€ wwwroot/uploads/      # yuklangan rasmlar
â””â”€ frontend/
   â””â”€ src/
      â”œâ”€ pages/public/         # Home, Services, Barbers, Gallery, Booking, Contacts
      â”œâ”€ pages/admin/          # Dashboard, Appointments, Calendar, Services, Barbers, Gallery, Reviews, Users, Settings
      â”œâ”€ pages/barber/         # Usta kabineti
      â”œâ”€ components/           # BarberPole, Button, Card, StepIndicator, LangSwitch...
      â”œâ”€ i18n/                 # uz.json, ru.json, en.json
      â””â”€ api/                  # API klient, tiplar
```

## Ma'lumotlar modeli
- **User**: Id, Login, Email, PasswordHash, Role (Admin | Barber), BarberId?, IsActive
- **Barber**: Id, Name, Title{uz,ru,en}, Bio{uz,ru,en}, PhotoUrl, SortOrder, IsActive
- **Service**: Id, Name{uz,ru,en}, Description{uz,ru,en}, Price, DurationMinutes, SortOrder, IsActive
- **BarberService**: qaysi usta qaysi xizmatni qiladi (ko'p-ko'p)
- **WorkingHours**: BarberId, DayOfWeek, Start, End, IsDayOff
- **TimeOff**: BarberId, From, To, Reason (ta'til, kasal)
- **Appointment**: Id, BarberId, ServiceId, ClientName, ClientPhone, StartUtc, EndUtc,
  Status (Pending | Confirmed | Completed | Cancelled | NoShow), Price (o'sha paytdagi), Comment, CreatedAt
- **GalleryImage**: Url, Caption, SortOrder
- **Review**: AuthorName, Rating, Text, IsPublished
- **SiteSettings**: nom, manzil, telefon, Telegram/Instagram, xarita koordinatalari, slot qadami, zapis oldidan minimal vaqt

## Zapis qoidalari (eng muhim qism)
1. Bo'sh vaqtlar: ustaning ish jadvali âˆ’ dam olishlari âˆ’ mavjud zapislar âˆ’ o'tgan vaqt.
   Qadam: 15 daqiqa (sozlamadan), davomiylik = xizmat davomiyligi.
2. **Ikki kishi bir vaqtga yozila olmaydi**: PostgreSQL `EXCLUDE USING gist (barber_id WITH =, tstzrange(start,end) WITH &&)`
   (faqat bekor qilinmagan zapislar uchun) + tranzaksiya. Poyga holatida ham bazaning o'zi to'xtatadi.
3. Telefon raqam formati: +998 XX XXX XX XX (validatsiya).
4. "Istalgan usta" varianti: birinchi bo'sh usta avtomatik tanlanadi.
5. Spamga qarshi: bitta telefondan bir kunda cheklangan miqdordagi zapis + rate limiting.

## Sahifalar
**Ommaviy sayt** (3 til): Bosh sahifa (hero, reyting, xizmatlar qisqa, ustalar, galereya, sharhlar, xarita) Â·
Xizmatlar va narxlar Â· Ustalar Â· Galereya Â· Onlayn zapis (4 qadam: xizmat â†’ usta â†’ sana/vaqt â†’ ism/telefon â†’ tasdiq) Â· Aloqa.

**Admin panel** (`Admin` roli): Dashboard (bugungi zapislar, daromad, eng band usta, haftalik grafik) Â·
Zapislar (ro'yxat + filtrlar + status o'zgartirish + qo'lda zapis qo'shish) Â· Kalendar (ustalar bo'yicha kunlik ko'rinish) Â·
Xizmatlar CRUD Â· Ustalar CRUD + ish jadvali + dam olish kunlari + rasm Â· Galereya Â· Sharhlar Â· Foydalanuvchilar (admin/usta akkauntlari) Â· Sozlamalar.

**Usta kabineti** (`Barber` roli): o'z zapislari (bugun/hafta), status belgilash (keldi/kelmadi), o'z ish jadvalini ko'rish.

## Ish tartibi (bosqichlar) — holat
1. ✅ Skelet: docker-compose, .NET loyiha, Vite loyiha, ishga tushadi.
2. ✅ Baza modeli + migratsiya + seed (namunaviy xizmatlar, 3 usta, admin akkaunti, demo zapislar).
3. ✅ Auth (JWT, rollar, rate limiting).
4. ✅ Zapis logikasi + testlar (bo'sh vaqtlar, to'qnashuv — EXCLUDE cheklovi).
5. ✅ Ommaviy sayt sahifalari + dizayn tizimi, 3 til.
6. ✅ Admin panel.
7. ✅ Usta kabineti.
8. ✅ Yakuniy tekshiruv: telefon o'lchamida, 3 tilda, butun zapis jarayoni, rollar.

## 2-bosqich (keyin)
Telegram bot (yangi zapis xabari, tasdiqlash, klientga eslatma), internetga chiqarish, SMS.

