# NyBarber — holat va rejalar (yangi sessiya uchun)

Batafsil texnik ma'lumot: [README.md](README.md), dastlabki reja: [PLAN.md](PLAN.md).

## Loyiha
New York Barbershop (Toshkent, Yunusobod 11-mavze 4, Telegram @hairman) uchun sayt + onlayn zapis + admin panel + usta kabineti.
Maqsad: egasiga demo ko'rsatish → 1 hafta bepul sinov → shartnoma yoki tizimni to'liq topshirish.
Egasi taqdimot videosini ko'rdi, narx va tafsilot so'radi (ruscha yozadi). Foydalanuvchi narx taklifini va
ertaga salonga borib jonli ko'rsatish taklifini yubormoqda (ruschani yaxshi bilmaydi — ruscha matnlarni Claude tayyorlaydi, o'zbekcha tarjimasi bilan).
Narx (foydalanuvchi qarori): obuna 500 000 so'm/oy (server+domen+tuzatish+kichik qo'shimchalar ichida);
to'liq sotish 2 mln so'm (domen/server alohida, 3 oy bepul xizmat). Claude sotish narxini 5–6 mln ga ko'tarishni tavsiya qilgan.

## Foydalanuvchi
- C# / .NET 10 backend dasturchisi. O'zbekcha, norasmiy yozadi — o'zbekcha javob berish.
- Dizayn tanlovi: 1950-yillar Amerika interfeysi (krem #fbf6ec, gilos #d62e2e, navy #1f3d7a, barber-pole chiziqlari)
  + Art Deco shriftlar (Poiret One sarlavhalar, Josefin Sans matn; kirill uchun Jost).
- Telefonda tez ishlashi va animatsiyalar silliq bo'lishi muhim.

## Stek va ishga tushirish
- Backend: .NET 10 Web API (Controllers), EF Core 10 + PostgreSQL 17 (Docker, **5433-port**), JWT, rollar Admin/Barber.
- Frontend: Vite + React 19 + TS + Tailwind 4 + TanStack Query + i18next (uz/ru/en) + framer-motion + three.js (3D pole).
- `docker compose up -d` → `dotnet run --project backend/NyBarber.Api --launch-profile http` (:5080) → `cd frontend; npm run dev` (:5173).
- Tekshiruvlar: `dotnet test backend` (41 test), `npx tsc -b`, `npx eslint src`, `scripts/smoke-all.ps1`.

## Server (prod) — https://nybarber.bunyodmusayev.uz
- `ssh root@31.220.81.174` (Ubuntu 24.04, kalit bilan). Serverda boshqa saytlar ham bor: `bunyodmusayev.uz` (:8080),
  `technowolt.bunyodmusayev.uz` (:8081) — ularga tegilmaydi.
- `/opt/nybarber`: `src/` (kod), `uploads/` (rasmlar), `data/postgres/`, `backups/` (har kuni 03:30, 7 kun), `.env` (maxfiy, serverda yaratilgan).
- Compose: db + api + web (nginx, `127.0.0.1:8082`) → host nginx (`/etc/nginx/sites-available/nybarber`) + certbot.
- Yangilash: Git Bash'da `./deploy/deploy.sh` (kodni tar+ssh bilan yuboradi, `docker compose up -d --build`).
- Prod baza toza (demo yo'q, `Seed:SampleContent` faqat dev'da). Birinchi admin — foydalanuvchi o'zi:
  `ssh -t root@31.220.81.174 "cd /opt/nybarber && docker compose exec api dotnet NyBarber.Api.dll create-admin admin"`.

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
- Lokal (dev) bazada demo ma'lumotlar: 117 ta to'qilgan zapis, namunaviy ustalar/sharhlar. Prod baza toza.
- **Vaqtinchalik akkauntlar LOKAL bazada qolgan** (prod'da yo'q): `video-admin`, `video-sardor` (video yozish uchun). Kerak bo'lmasa o'chirish:
  `docker exec nybarber-db psql -U nybarber -d nybarber -c "DELETE FROM \"Users\" WHERE \"Login\" IN ('video-admin','video-sardor');"`
- Git repo bor, lekin hali hech narsa commit qilinmagan (foydalanuvchi so'ramagan).
- Lokal kompyuterda Docker Desktop yo'q — sinovlar serverda vaqtinchalik test stack'da (`/opt/nybarber-test`:
  demo ma'lumot + soxta Telegram API `fake_tg.py`, SSH tunnel `-L 8090:localhost:8090`), ish tugagach o'chiriladi.
- Bot tokeni serverda `/opt/nybarber/.env` (`TELEGRAM_BOT_TOKEN`) — foydalanuvchi o'zi qo'ygan. Claude token/parollarni
  hech qayerga o'zi kiritmaydi; kerak bo'lsa foydalanuvchiga yashirin `read -s` buyrug'ini beradi.
- Lokal UI'ni prod ma'lumotlari bilan ko'rish: `.claude/launch.json` → `web-prod-api` (Vite `API_TARGET`).

## Hozirgi holat (2026-10-13 kechqurun)
- Prod'da: bot ishlayapti (`@NewYorkBarber_bot`, profil rasmi — `branding/logo.jpg`), admin `bunyod` Telegram'ga ulangan.
  Prod bazada 9 usta (foydalanuvchi qolganini o'chirgan), 5 xizmat ("Soch olish" 35 000 — foydalanuvchi o'zgartirgan).
- Frontend: sahifalash (`components/Pager.tsx`) — bosh sahifa ustalar, zapisdagi usta qadami (+qidiruv), admin kalendar,
  ustalar, dashboard. Telefonda ixcham kartochkalar, hero'da pole "New York" ning o'ng tomonida. Prod'ga chiqarilgan.
- Taqdimot videosi tayyor: `video/NyBarber_Taqdimot.mp4` (gitignore'da). Manbasi: `D:\Hotels\hairman-promo\src\nybarber\`
  (alohida kirish nuqtasi `NyBarberVideo.tsx`), kliplar `capture/nybarber.mjs` (test stack'dan), musiqa `scripts/nyb-soundtrack.mjs`.
  Render: `npx remotion render src/nybarber/NyBarberVideo.tsx NyBarberShowcase out/NyBarber_Taqdimot.mp4` (~8 daqiqa).
  Mehmonxona (`src/hotel`, `hotel_soundtrack.wav`) fayllariga tegilmaydi.

## Loglar (2026-10-13, prod'da)
Bot va saytga kirishlar logga yoziladi (parol/token yozilmaydi). Ko'rish: `ssh root@31.220.81.174 "cd /opt/nybarber && docker compose logs api --since 1h"`.
- "Bot xabar: {TgId} @{user} "{matn}" → xodim/mijoz", "Bot tugma: ... → {natija}", "Telegram bog'landi: {login} ← {TgId}"
- "Bot yubordi: {yangi zapis #id | bekor qilindi #id | eslatma #id | kechki hisobot} → {n}/{jami} chat"
- "Kirish: {login} ({rol}) parol bilan, IP", "Kirish xato: "{login}" (sabab), IP", "Mini App ochildi: ... → xodim/mijoz"
- `202.79.184.62` — foydalanuvchining o'z IP'si (o'zining kirishlarini ajratish uchun).
- Ixtiyoriy (rozilik so'ralmagan hali): web nginx'da `.env`, `.php`, `wp-config` kabi skaner so'rovlariga darhol 404.

## Navbatdagi ishlar
1. (Bajarildi) Loglar — yuqoriga qarang. Navbatdagisi: foydalanuvchi bilan kelishib.
2. Egasi bilan uchrashuv/javob: ruscha matnlarni tayyorlash (o'zbekcha tarjimasi bilan), egasining ruscha javoblarini tarjima qilish.
3. Shartnoma bo'lsa: egasi uchun alohida domen (+ kerak bo'lsa server), egasiga alohida admin akkaunt (o'z parolini bermaslik).
4. Rasmlarni yuklashda avtomatik siqish; ixtiyoriy yuklama testi.
5. Ko'p barbershopga sotish rejasi bo'lsa — multi-tenant arxitektura.
