# New York Barbershop — sayt, onlayn zapis va admin panel

Toshkentdagi New York Barbershop uchun to'liq tizim:

- **Ommaviy sayt** (o'zbek / rus / ingliz): xizmatlar va narxlar, ustalar, sharhlar, galereya, xarita.
- **Onlayn zapis**: xizmat → usta (yoki "istalgan usta") → sana va vaqt → ism va telefon.
  Bir ustaga bir vaqtda ikki zapis tushishi **baza darajasida** taqiqlangan (PostgreSQL `EXCLUDE` cheklovi).
- **Admin panel**: statistika, zapislar, kalendar, xizmatlar, ustalar (rasm, ish jadvali, ta'til), galereya, sharhlar, foydalanuvchilar, sozlamalar.
- **Usta kabineti**: usta faqat o'z zapislarini ko'radi va holatini belgilaydi.

| Qism | Texnologiya |
|---|---|
| Backend | .NET 10, ASP.NET Core Web API, EF Core 10, PostgreSQL 17, JWT |
| Frontend | Vite, React 19, TypeScript, Tailwind CSS 4, TanStack Query, i18next, Framer Motion |
| Testlar | xUnit (bo'sh vaqtlarni hisoblash, telefon formati) |

## Lokal ishga tushirish

Kerak: .NET 10 SDK, Node.js 20+, Docker Desktop.

```powershell
# 1. Baza (5433-port — kompyuterdagi PostgreSQL 5432 bilan to'qnashmaydi)
docker compose up -d

# 2. Maxfiy sozlamalar: JWT kaliti va birinchi akkauntlar paroli (bir marta)
.\scripts\dev-secrets.ps1

# 3. Backend — http://localhost:5080 (migratsiya va namunaviy ma'lumotlar avtomatik)
dotnet run --project backend/NyBarber.Api --launch-profile http

# 4. Frontend — http://localhost:5173
cd frontend; npm install; npm run dev
```

**Kirish:** http://localhost:5173/login

| Login | Rol |
|---|---|
| `admin` | Admin — hamma narsa |
| `jasur`, `sardor`, `bekzod` | Usta — faqat o'z zapislari |

Boshlang'ich parollar: `dotnet user-secrets list --project backend/NyBarber.Api` (faqat birinchi ishga tushishda ishlatiladi).

**Parolni o'zingiz o'rnatish / unutilganda tiklash** (API to'xtatilgan bo'lishi kerak):

```powershell
dotnet run --project backend/NyBarber.Api --launch-profile http -- reset-password admin
```

Parol yashirin kiritiladi va ikki marta so'raladi. Istalgan login uchun ishlaydi (`jasur`, `sardor`, ...).

Development rejimida namunaviy zapislar ham yaratiladi (`Seed:DemoAppointments` — `appsettings.Development.json`).
Bazani tozalab qayta boshlash: `docker compose down -v`, so'ng 1–3-qadamlar.

## Tekshiruvlar

```powershell
dotnet test backend                    # unit testlar
cd frontend; npx tsc -b; npx eslint src # tiplar va lint
.\scripts\smoke-booking.ps1            # zapis jarayoni API orqali (API ishlab turgan bo'lishi kerak)
.\scripts\smoke-admin.ps1              # rollar va admin API
.\scripts\smoke-auth.ps1               # login, JWT
```

## Tuzilma

```
backend/NyBarber.Api/
  Data/        DbContext, EF konfiguratsiyalar, migratsiyalar, seed
  Domain/      entity'lar
  Features/
    Auth/      login, JWT, rollar, rate limiting
    Booking/   bo'sh vaqtlar (SlotCalculator — sof funksiya), zapis yaratish
    Public/    saytning ommaviy kontenti (bitta so'rovda)
    Admin/     admin va usta API'lari, rasm yuklash
backend/NyBarber.Tests/   xUnit
frontend/src/
  pages/public/   bosh sahifa, onlayn zapis
  pages/admin/    admin panel sahifalari (usta kabineti ham shu komponentlardan)
  components/     dizayn tizimi (ui.tsx), admin komponentlari (admin/kit.tsx)
  i18n/           uz / ru / en matnlari
scripts/          dev-secrets va smoke-test skriptlari
```

## Xavfsizlik

- Parollar `PasswordHasher` (PBKDF2) bilan saqlanadi; maxfiy kalitlar kodda emas — `user-secrets` (prod: muhit o'zgaruvchilari).
- Login: IP bo'yicha daqiqasiga 10 urinish; onlayn zapis: daqiqasiga 5 ta; bitta telefondan 3 tagacha faol zapis.
- Usta faqat o'z zapislarini ko'radi/o'zgartiradi — tekshiruv serverda (`barber_id` claim).
- Rasm yuklash: fayl turi ichidagi baytlarga qarab aniqlanadi (JPG/PNG/WEBP), 5 MB gacha, nom — tasodifiy GUID.

## Keyingi bosqich

- Telegram bot: yangi zapis haqida xabar, bir bosishda tasdiqlash, mijozga eslatma.
- Internetga chiqarish (hosting, domen, HTTPS), production sozlamalari.
- Namunaviy sharhlar, narxlar va ustalarni barbershopning haqiqiy ma'lumotlari bilan almashtirish.
