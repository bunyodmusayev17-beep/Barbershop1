using Microsoft.EntityFrameworkCore;
using Npgsql;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Telegram;

namespace NyBarber.Api.Features.Booking;

public record CreateBookingCommand(
    int ServiceId,
    int? BarberId,
    DateOnly Date,
    TimeOnly Time,
    string ClientName,
    string ClientPhone,
    string? Comment,
    string Language);

public class BookingService(AppDbContext db, AvailabilityService availability, BusinessClock clock, TelegramNotifier notifier, ILogger<BookingService> logger)
{
    /// <summary>Bitta telefon raqamdan bir vaqtda nechta faol (kelajakdagi) zapis bo'lishi mumkin.</summary>
    public const int MaxActivePerPhone = 3;

    public async Task<Appointment> CreateAsync(CreateBookingCommand cmd, CancellationToken ct)
    {
        var name = cmd.ClientName.Trim();
        if (name.Length is < 2 or > 100)
            throw new BookingException(BookingErrors.NameInvalid, 400, "Ism 2–100 belgi bo'lishi kerak");

        var phone = PhoneNumber.Normalize(cmd.ClientPhone)
            ?? throw new BookingException(BookingErrors.PhoneInvalid, 400, "Telefon raqam noto'g'ri");

        var service = await db.Services.FirstOrDefaultAsync(s => s.Id == cmd.ServiceId && s.IsActive, ct)
            ?? throw new BookingException(BookingErrors.ServiceNotFound, 404, "Xizmat topilmadi");

        if (cmd.BarberId is { } requested && !await db.BarberServices.AnyAsync(
                bs => bs.BarberId == requested && bs.ServiceId == service.Id && bs.Barber.IsActive, ct))
            throw new BookingException(BookingErrors.BarberNotFound, 404, "Usta topilmadi yoki bu xizmatni bajarmaydi");

        var now = clock.UtcNow;
        var activeCount = await db.Appointments.CountAsync(a => a.ClientPhone == phone && a.StartUtc > now
            && a.Status != AppointmentStatus.Cancelled && a.Status != AppointmentStatus.NoShow, ct);
        if (activeCount >= MaxActivePerPhone)
            throw new BookingException(BookingErrors.LimitReached, 409, "Bu raqamdan juda ko'p faol zapis bor");

        var startUtc = SlotCalculator.ToUtc(cmd.Date, cmd.Time, clock.Zone);
        var slots = await availability.GetAsync(service.Id, cmd.Date, cmd.BarberId, ct);
        var candidates = slots.Where(s => s.StartsUtc.Contains(startUtc)).Select(s => s.BarberId).ToList();
        if (candidates.Count == 0)
            throw new BookingException(BookingErrors.SlotUnavailable, 409, "Bu vaqt bo'sh emas");

        var barberId = cmd.BarberId ?? await PickLeastBusyAsync(candidates, cmd.Date, ct);

        var appointment = new Appointment
        {
            BarberId = barberId,
            ServiceId = service.Id,
            ClientName = name,
            ClientPhone = phone,
            StartUtc = startUtc,
            EndUtc = startUtc.AddMinutes(service.DurationMinutes),
            Price = service.Price,
            Comment = string.IsNullOrWhiteSpace(cmd.Comment) ? null : cmd.Comment.Trim()[..Math.Min(500, cmd.Comment.Trim().Length)],
            Language = cmd.Language is "ru" or "en" ? cmd.Language : "uz",
            // Avtomatik tasdiq — admin/usta Telegram'da xabar oladi, kerak bo'lsa bekor qiladi
            Status = AppointmentStatus.Confirmed,
            CreatedAt = now,
        };
        db.Appointments.Add(appointment);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException {SqlState: PostgresErrorCodes.ExclusionViolation})
        {
            // Tekshiruv va yozish orasida kimdir shu vaqtni olib qo'ydi — baza buni to'xtatdi.
            logger.LogInformation("Zapis to'qnashuvi: usta {BarberId}, {Start}", barberId, startUtc);
            throw new BookingException(BookingErrors.SlotTaken, 409, "Bu vaqtni hozirgina boshqa mijoz band qildi");
        }

        await db.Entry(appointment).Reference(a => a.Barber).LoadAsync(ct);
        appointment.Service = service;
        notifier.Publish(new BotEvent(BotEventKind.Created, appointment.Id));
        return appointment;
    }

    /// <summary>
    /// Xodim tomonidan qo'lda zapis (telefon orqali yoki to'g'ridan-to'g'ri kelgan mijoz).
    /// Ish vaqti, minimal oldindan yozilish va telefon limiti tekshirilmaydi — faqat ustma-ust tushmasligi (baza darajasida).
    /// </summary>
    public async Task<Appointment> CreateByStaffAsync(int serviceId, int barberId, DateOnly date, TimeOnly time,
        string clientName, string clientPhone, string? comment, int? actorUserId, CancellationToken ct)
    {
        var name = clientName.Trim();
        if (name.Length is < 2 or > 100)
            throw new BookingException(BookingErrors.NameInvalid, 400, "Ism 2–100 belgi bo'lishi kerak");
        var phone = PhoneNumber.Normalize(clientPhone)
            ?? throw new BookingException(BookingErrors.PhoneInvalid, 400, "Telefon raqam noto'g'ri");
        var service = await db.Services.FirstOrDefaultAsync(s => s.Id == serviceId, ct)
            ?? throw new BookingException(BookingErrors.ServiceNotFound, 404, "Xizmat topilmadi");
        var barber = await db.Barbers.FirstOrDefaultAsync(b => b.Id == barberId, ct)
            ?? throw new BookingException(BookingErrors.BarberNotFound, 404, "Usta topilmadi");

        var startUtc = SlotCalculator.ToUtc(date, time, clock.Zone);
        var appointment = new Appointment
        {
            BarberId = barber.Id,
            ServiceId = service.Id,
            ClientName = name,
            ClientPhone = phone,
            StartUtc = startUtc,
            EndUtc = startUtc.AddMinutes(service.DurationMinutes),
            Price = service.Price,
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            Status = AppointmentStatus.Confirmed,
            CreatedAt = clock.UtcNow,
        };
        db.Appointments.Add(appointment);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException {SqlState: PostgresErrorCodes.ExclusionViolation})
        {
            db.Entry(appointment).State = EntityState.Detached;
            throw new BookingException(BookingErrors.SlotTaken, 409, "Bu vaqtda ustada boshqa zapis bor");
        }
        appointment.Barber = barber;
        appointment.Service = service;
        notifier.Publish(new BotEvent(BotEventKind.Created, appointment.Id, actorUserId));
        return appointment;
    }

    /// <summary>"Istalgan usta" tanlanganda — o'sha kuni eng kam zapisi bor usta.</summary>
    private async Task<int> PickLeastBusyAsync(List<int> candidates, DateOnly date, CancellationToken ct)
    {
        var (dayStart, dayEnd) = clock.DayRangeUtc(date);
        var load = await db.Appointments
            .Where(a => candidates.Contains(a.BarberId) && a.Status != AppointmentStatus.Cancelled
                        && a.StartUtc >= dayStart && a.StartUtc < dayEnd)
            .GroupBy(a => a.BarberId)
            .Select(g => new {BarberId = g.Key, Count = g.Count()})
            .ToDictionaryAsync(x => x.BarberId, x => x.Count, ct);

        // candidates allaqachon SortOrder bo'yicha tartiblangan — teng bo'lsa birinchisi tanlanadi
        return candidates.OrderBy(id => load.GetValueOrDefault(id)).First();
    }
}
