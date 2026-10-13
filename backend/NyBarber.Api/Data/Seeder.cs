using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Data;

/// <summary>
/// Bo'sh bazaga boshlang'ich ma'lumotlarni yozadi. Sayt sozlamalari (nom, manzil, telefon) har doim yoziladi.
/// Namunaviy xizmatlar, ustalar, sharhlar va akkauntlar — faqat Seed:SampleContent = true bo'lsa (dev).
/// Prod'da baza toza qoladi, admin konsoldan yaratiladi: create-admin &lt;login&gt;.
/// Parollar konfiguratsiyadan olinadi (dev: dotnet user-secrets): Seed:AdminPassword, Seed:BarberPassword.
/// </summary>
public static class Seeder
{
    public static async Task SeedAsync(AppDbContext db, IConfiguration config, ILogger logger, CancellationToken ct = default)
    {
        if (!await db.SiteSettings.AnyAsync(ct))
        {
            db.SiteSettings.Add(new SiteSettings
            {
                BusinessName = "New York Barbershop",
                Address = new("Yunusobod tumani, 11-mavze, 4-uy", "Юнусабадский район, 11-квартал, дом 4", "Yunusabad district, 11th block, 4"),
                Phone = "+998 90 947 66 99",
                Telegram = "hairman",
                Latitude = 41.3686,
                Longitude = 69.2915,
                Rating = 5.0,
                RatingCount = 195,
            });
        }

        if (!config.GetValue<bool>("Seed:SampleContent"))
        {
            await db.SaveChangesAsync(ct);
            return;
        }

        if (!await db.Services.AnyAsync(ct))
        {
            db.Services.AddRange(
                Svc(1, "Soch olish", "Стрижка", "Haircut", "Klassik yoki zamonaviy soch turmagi, yuvish va ukladka bilan.", "Классическая или современная стрижка с мытьём и укладкой.", "Classic or modern haircut with wash and styling.", 80_000, 45),
                Svc(2, "Soqol dizayni", "Оформление бороды", "Beard trim", "Soqolga shakl berish, konturlash va parvarish.", "Моделирование, контур и уход за бородой.", "Shaping, line-up and beard care.", 50_000, 30),
                Svc(3, "Soch + soqol", "Стрижка + борода", "Haircut + beard", "To'liq obraz: soch olish va soqol dizayni.", "Полный образ: стрижка и оформление бороды.", "The full look: haircut and beard trim.", 120_000, 75),
                Svc(4, "Ustara bilan soqol olish", "Бритьё опасной бритвой", "Hot towel shave", "Issiq sochiq va ustara bilan klassik soqol olish.", "Классическое бритьё с горячим полотенцем.", "Classic straight-razor shave with a hot towel.", 70_000, 40),
                Svc(5, "Bolalar soch olishi", "Детская стрижка", "Kids haircut", "12 yoshgacha bo'lgan bolalar uchun.", "Для детей до 12 лет.", "For kids under 12.", 60_000, 30));
        }

        if (!await db.Barbers.AnyAsync(ct))
        {
            db.Barbers.AddRange(
                Brb(1, "Jasur", "Top-barber", "Топ-барбер", "Top barber", "8 yillik tajriba. Fade va klassik soch turmaklari ustasi.", "8 лет опыта. Мастер фейдов и классических стрижек.", "8 years of experience. Master of fades and classic cuts."),
                Brb(2, "Sardor", "Barber", "Барбер", "Barber", "Soqol dizayni va ustara bilan ishlash bo'yicha mutaxassis.", "Специалист по бороде и бритью опасной бритвой.", "Beard and straight-razor specialist."),
                Brb(3, "Bekzod", "Barber", "Барбер", "Barber", "Zamonaviy uslublar va bolalar soch olishi.", "Современные стрижки и детские стрижки.", "Modern styles and kids haircuts."));
            await db.SaveChangesAsync(ct);

            var barbers = await db.Barbers.OrderBy(b => b.SortOrder).ToListAsync(ct);
            var services = await db.Services.ToListAsync(ct);
            // Har bir usta har kuni 11:00–23:00, haftada bitta dam olish kuni (har xil)
            DayOfWeek[] daysOff = [DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday];
            for (var i = 0; i < barbers.Count; i++)
            {
                foreach (var s in services)
                {
                    // Bolalar soch olishini faqat Bekzod qiladi, ustarani faqat Jasur va Sardor
                    var kids = s.SortOrder == 5;
                    var razor = s.SortOrder == 4;
                    if ((kids && i != 2) || (razor && i == 2)) continue;
                    db.BarberServices.Add(new BarberService {BarberId = barbers[i].Id, ServiceId = s.Id});
                }
                foreach (var day in Enum.GetValues<DayOfWeek>())
                {
                    db.WorkingHours.Add(new WorkingHours
                    {
                        BarberId = barbers[i].Id,
                        DayOfWeek = day,
                        Start = new TimeOnly(11, 0),
                        End = new TimeOnly(23, 0),
                        IsDayOff = day == daysOff[i],
                    });
                }
            }
        }

        if (!await db.Reviews.AnyAsync(ct))
        {
            // NAMUNA sharhlar — real ishga tushirishdan oldin haqiqiy sharhlar bilan almashtirilsin
            db.Reviews.AddRange(
                new Review {AuthorName = "Aziz", Rating = 5, Text = "Juda zo'r usta, soch aynan men xohlagandek chiqdi. Albatta yana kelaman!"},
                new Review {AuthorName = "Тимур", Rating = 5, Text = "Отличный сервис, приятная атмосфера и мастера своего дела."},
                new Review {AuthorName = "Bobur", Rating = 5, Text = "Online yozilish juda qulay ekan, navbat kutmadim."});
        }

        await db.SaveChangesAsync(ct);
        await SeedUsersAsync(db, config, logger, ct);
        if (config.GetValue<bool>("Seed:DemoAppointments")) await SeedDemoAppointmentsAsync(db, logger, ct);
    }

    /// <summary>
    /// Demo uchun namunaviy zapislar: oxirgi 6 kun (bajarilgan/kelmagan) va keyingi 3 kun (kutilmoqda/tasdiqlangan).
    /// Faqat zapislar jadvali bo'sh bo'lsa ishlaydi. Tasodifiylik qat'iy (seed=42) — har safar bir xil natija.
    /// </summary>
    private static async Task SeedDemoAppointmentsAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        if (await db.Appointments.AnyAsync(ct)) return;

        var zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tashkent");
        var nowUtc = DateTimeOffset.UtcNow;
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(nowUtc, zone).DateTime);
        var rnd = new Random(42);
        string[] names = ["Aziz", "Bobur", "Sherzod", "Javohir", "Timur", "Rustam", "Diyor", "Otabek", "Sanjar", "Islom", "Akmal", "Farrux", "Kamron", "Ulug'bek", "Alisher"];

        var barbers = await db.Barbers.Include(b => b.WorkingHours).Include(b => b.Services).ThenInclude(s => s.Service).ToListAsync(ct);
        var list = new List<Appointment>();
        for (var offset = -6; offset <= 3; offset++)
        {
            var date = today.AddDays(offset);
            foreach (var b in barbers)
            {
                var hours = b.WorkingHours.FirstOrDefault(h => h.DayOfWeek == date.DayOfWeek);
                if (hours is null || hours.IsDayOff || b.Services.Count == 0) continue;

                var cursor = hours.Start.AddMinutes(rnd.Next(0, 4) * 30);
                var count = offset > 0 ? rnd.Next(2, 5) : rnd.Next(4, 8);
                for (var i = 0; i < count; i++)
                {
                    var service = b.Services[rnd.Next(b.Services.Count)].Service;
                    var end = cursor.AddMinutes(service.DurationMinutes);
                    if (end > hours.End || end < cursor) break;

                    var local = date.ToDateTime(cursor);
                    var startUtc = new DateTimeOffset(local, zone.GetUtcOffset(local)).ToUniversalTime();
                    var past = startUtc < nowUtc;
                    list.Add(new Appointment
                    {
                        BarberId = b.Id,
                        ServiceId = service.Id,
                        ClientName = names[rnd.Next(names.Length)],
                        ClientPhone = $"+99890{rnd.Next(1000000, 9999999)}",
                        StartUtc = startUtc,
                        EndUtc = startUtc.AddMinutes(service.DurationMinutes),
                        Price = service.Price,
                        Status = past
                            ? (rnd.Next(10) == 0 ? AppointmentStatus.NoShow : AppointmentStatus.Completed)
                            : (rnd.Next(3) == 0 ? AppointmentStatus.Pending : AppointmentStatus.Confirmed),
                        CreatedAt = startUtc.AddDays(-1),
                    });
                    // Keyingi zapis: oraliq 0–60 daqiqa, 15 daqiqaga yaxlitlangan
                    cursor = end.AddMinutes(rnd.Next(0, 5) * 15);
                }
            }
        }
        db.Appointments.AddRange(list);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seed: {Count} ta demo zapis yaratildi.", list.Count);
    }

    private static async Task SeedUsersAsync(AppDbContext db, IConfiguration config, ILogger logger, CancellationToken ct)
    {
        if (await db.Users.AnyAsync(ct)) return;

        var adminPassword = config["Seed:AdminPassword"];
        var barberPassword = config["Seed:BarberPassword"];
        if (string.IsNullOrWhiteSpace(adminPassword) || string.IsNullOrWhiteSpace(barberPassword))
        {
            logger.LogWarning("Foydalanuvchilar yaratilmadi: Seed:AdminPassword va Seed:BarberPassword sozlanmagan (dotnet user-secrets set ...).");
            return;
        }

        var hasher = new PasswordHasher<User>();
        var admin = new User {Login = "admin", Role = UserRole.Admin};
        admin.PasswordHash = hasher.HashPassword(admin, adminPassword);
        db.Users.Add(admin);

        foreach (var barber in await db.Barbers.OrderBy(b => b.SortOrder).ToListAsync(ct))
        {
            var user = new User {Login = barber.Name.ToLowerInvariant(), Role = UserRole.Barber, BarberId = barber.Id};
            user.PasswordHash = hasher.HashPassword(user, barberPassword);
            db.Users.Add(user);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seed: admin va usta akkauntlari yaratildi.");
    }

    private static Service Svc(int order, string uz, string ru, string en, string dUz, string dRu, string dEn, decimal price, int minutes) => new()
    {
        Name = new(uz, ru, en),
        Description = new(dUz, dRu, dEn),
        Price = price,
        DurationMinutes = minutes,
        SortOrder = order,
    };

    private static Barber Brb(int order, string name, string tUz, string tRu, string tEn, string bUz, string bRu, string bEn) => new()
    {
        Name = name,
        Title = new(tUz, tRu, tEn),
        Bio = new(bUz, bRu, bEn),
        SortOrder = order,
    };
}
