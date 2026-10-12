# NyBarber — holat va rejalar (yangi sessiya uchun)

Batafsil texnik ma'lumot: [README.md](README.md), dastlabki reja: [PLAN.md](PLAN.md).

## Loyiha
New York Barbershop (Toshkent, Yunusobod 11-mavze 4, Telegram @hairman) uchun sayt + onlayn zapis + admin panel + usta kabineti.
Maqsad: egasiga demo ko'rsatish → 1 hafta bepul sinov → shartnoma yoki tizimni to'liq topshirish.
Egasi Telegramda 🔥 reaksiya bildirgan, sinov taklifiga hali javob bermagan.

## Foydalanuvchi
- C# / .NET 10 backend dasturchisi. O'zbekcha, norasmiy yozadi — o'zbekcha javob berish.
- Dizayn tanlovi: 1950-yillar Amerika interfeysi (krem #fbf6ec, gilos #d62e2e, navy #1f3d7a, barber-pole chiziqlari)
  + Art Deco shriftlar (Poiret One sarlavhalar, Josefin Sans matn; kirill uchun Jost).
- Telefonda tez ishlashi va animatsiyalar silliq bo'lishi muhim.

## Stek va ishga tushirish
- Backend: .NET 10 Web API (Controllers), EF Core 10 + PostgreSQL 17 (Docker, **5433-port**), JWT, rollar Admin/Barber.
- Frontend: Vite + React 19 + TS + Tailwind 4 + TanStack Query + i18next (uz/ru/en) + framer-motion + three.js (3D pole).
- `docker compose up -d` → `dotnet run --project backend/NyBarber.Api --launch-profile http` (:5080) → `cd frontend; npm run dev` (:5173).
- Tekshiruvlar: `dotnet test backend` (20 test), `npx tsc -b`, `npx eslint src`, `scripts/smoke-all.ps1`.

## Muhim qarorlar
- Ustma-ust zapis PostgreSQL `EXCLUDE USING gist` cheklovi bilan taqiqlangan (Status <> Cancelled).
- Zapisda narx saqlanadi (xizmat narxi keyin o'zgarsa ham eski zapis o'zgarmaydi).
- Bo'sh vaqtlar: `SlotCalculator` (sof funksiya, testlangan), vaqt zonasi Asia/Tashkent.
- Usta faqat o'z zapislari/ishlamaydigan vaqtlarini ko'radi — server tomonda `barber_id` claim bilan tekshiriladi.
- Ishlamaydigan vaqt (TimeOff): usta kabinetida "Bugun/Ertaga ishlamayman" — qizil/yashil almashtirgich;
  yopilganda o'sha vaqtdagi zapislar ro'yxati (telefonlari bilan) ko'rsatiladi, avtomatik bekor qilinmaydi.
- Sahifalar kodi oldindan yuklanadi (`src/lib/pages.ts`), global bosish effekti (`src/lib/pressFx.ts`),
  3D faqat kuchli qurilma + tez internetda, sahifa yuklangach (`components/fx/HeroPole.tsx`).
- Admin panel faqat o'zbekcha; ommaviy sayt 3 tilda.

## Diqqat (gotcha'lar)
- Claude'ning ichki shell'i sandboxda: `dotnet user-secrets` yozuvlari foydalanuvchi profiliga tushmaydi —
  maxfiy kalitlar `scripts/dev-secrets.ps1` orqali foydalanuvchi terminalida yaratiladi.
- Windows PowerShell 5.1: skriptlar UTF-8 **BOM** bilan saqlansin, faqat ASCII'ga yaqin belgilar; `RandomNumberGenerator.GetInt32/Fill` yo'q.
- `admin` parolini foydalanuvchi o'zi o'rnatgan (Claude bilmaydi). Tiklash:
  `dotnet run --project backend/NyBarber.Api --launch-profile http -- reset-password <login>` (API to'xtatilgan holda).
- Ishlab turgan API ustida `dotnet build` fayl band bo'lgani uchun xato beradi — avval API'ni to'xtatish.
- Demo ma'lumotlar: 117 ta to'qilgan zapis, 3 ta namunaviy sharh, ustalar/narxlar namunaviy — topshirishdan oldin almashtirish.
- **Vaqtinchalik akkauntlar bazada qolgan:** `video-admin`, `video-sardor` (video yozish uchun). Kerak bo'lmasa o'chirish:
  `docker exec nybarber-db psql -U nybarber -d nybarber -c "DELETE FROM \"Users\" WHERE \"Login\" IN ('video-admin','video-sardor');"`
- Git repo bor, lekin hali hech narsa commit qilinmagan (foydalanuvchi so'ramagan).

## Navbatdagi ishlar (foydalanuvchi bilan kelishib)
1. **Haqiqiy UI'dan promo video** (to'xtab qolgan): `D:\Hotels\hairman-promo\capture\capture.mjs` tayyor —
   headless Chrome saytni telefon/noutbuk o'lchamida bosib chiqib `public/ui/*.webm` kliplar yozadi
   (bosh sahifa+3D, zapis jarayoni+konfetti, admin kalendar, "Bugun ishlamayman" almashtirgichi).
   Keyin Remotion'da (`D:\Hotels\hairman-promo`, Remotion 4.0.534) telefon/noutbuk ramkalari, o'zbekcha yozuvlar va ovoz bilan yig'ish.
   Foydalanuvchi skriptni ishga tushirishni rad etgan edi — avval nima qilinishini tushuntirib, ruxsat so'rash.
   Zapis klipi bazaga haqiqiy zapis qo'shadi — yozib olgach o'chirish.
2. **Demo havola** (serverga chiqarmasdan): production build + `vite preview` (API proxy bilan) + Cloudflare quick tunnel
   (`cloudflared`, o'rnatish uchun ruxsat kerak). Egasi uchun alohida akkaunt, o'z admin parolini bermaslik.
3. Telegram bot: yangi zapis xabari, bir bosishda tasdiqlash, mijozga eslatma.
4. Serverga chiqarish (foydalanuvchi serveri: 8 GB RAM, 100 GB SSD — bitta barbershop uchun katta zaxira),
   rasmlarni yuklashda avtomatik siqish, ixtiyoriy yuklama testi.
5. Ko'p barbershopga sotish rejasi bo'lsa — multi-tenant arxitektura.
