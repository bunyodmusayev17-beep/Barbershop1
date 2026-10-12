using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Features.Booking;

public record BarberSlots(int BarberId, List<DateTimeOffset> StartsUtc);

/// <summary>Bazadan ma'lumot olib, har bir usta uchun bo'sh vaqtlarni hisoblaydi.</summary>
public class AvailabilityService(AppDbContext db, BusinessClock clock)
{
    /// <param name="barberId">null — xizmatni bajaradigan barcha faol ustalar.</param>
    public async Task<List<BarberSlots>> GetAsync(int serviceId, DateOnly date, int? barberId, CancellationToken ct)
    {
        var settings = await db.SiteSettings.AsNoTracking().OrderBy(x => x.Id).FirstAsync(ct);
        if (date < clock.Today || date > clock.Today.AddDays(settings.BookingHorizonDays)) return [];

        var service = await db.Services.AsNoTracking().FirstOrDefaultAsync(s => s.Id == serviceId && s.IsActive, ct);
        if (service is null) return [];

        var barberIds = await db.BarberServices
            .Where(bs => bs.ServiceId == serviceId && bs.Barber.IsActive && (barberId == null || bs.BarberId == barberId))
            .OrderBy(bs => bs.Barber.SortOrder)
            .Select(bs => bs.BarberId)
            .ToListAsync(ct);
        if (barberIds.Count == 0) return [];

        var (dayStart, dayEnd) = clock.DayRangeUtc(date);
        var dow = date.DayOfWeek;

        var hours = await db.WorkingHours.AsNoTracking()
            .Where(w => barberIds.Contains(w.BarberId) && w.DayOfWeek == dow)
            .ToDictionaryAsync(w => w.BarberId, ct);

        var appointments = await db.Appointments.AsNoTracking()
            .Where(a => barberIds.Contains(a.BarberId) && a.Status != AppointmentStatus.Cancelled
                        && a.StartUtc < dayEnd && a.EndUtc > dayStart)
            .Select(a => new {a.BarberId, a.StartUtc, a.EndUtc})
            .ToListAsync(ct);

        var timeOffs = await db.TimeOffs.AsNoTracking()
            .Where(t => barberIds.Contains(t.BarberId) && t.FromUtc < dayEnd && t.ToUtc > dayStart)
            .Select(t => new {t.BarberId, t.FromUtc, t.ToUtc})
            .ToListAsync(ct);

        var earliest = clock.UtcNow.AddMinutes(settings.MinLeadMinutes);
        var result = new List<BarberSlots>();
        foreach (var id in barberIds)
        {
            WorkWindow? window = hours.TryGetValue(id, out var h) && !h.IsDayOff ? new WorkWindow(h.Start, h.End) : null;
            var busy = appointments.Where(a => a.BarberId == id).Select(a => new BusyRange(a.StartUtc, a.EndUtc))
                .Concat(timeOffs.Where(t => t.BarberId == id).Select(t => new BusyRange(t.FromUtc, t.ToUtc)))
                .ToList();

            var starts = SlotCalculator.FreeStarts(new SlotQuery(
                date, window, busy, service.DurationMinutes, settings.SlotStepMinutes, earliest, clock.Zone));
            result.Add(new BarberSlots(id, starts));
        }
        return result;
    }
}
