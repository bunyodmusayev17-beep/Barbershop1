using NyBarber.Api.Domain;
using NyBarber.Api.Features.Booking;

namespace NyBarber.Api.Features.Admin;

public static class Mapping
{
    public static AppointmentDto ToDto(this Appointment a, BusinessClock clock)
    {
        var start = clock.ToLocal(a.StartUtc);
        var end = clock.ToLocal(a.EndUtc);
        return new AppointmentDto(a.Id, a.BarberId, a.Barber?.Name ?? "", a.ServiceId, a.Service?.Name ?? new LocalizedText(),
            a.ClientName, a.ClientPhone, start.ToString("yyyy-MM-dd"), start.ToString("HH:mm"), end.ToString("HH:mm"),
            a.Status.ToString(), a.Price, a.Comment, a.Language, a.CreatedAt);
    }

    public static ServiceAdminDto ToDto(this Service s) =>
        new(s.Id, s.Name, s.Description, s.Price, s.DurationMinutes, s.SortOrder, s.IsActive,
            s.Barbers.Select(b => b.BarberId).OrderBy(x => x).ToList());

    public static BarberAdminDto ToDto(this Barber b, BusinessClock clock) =>
        new(b.Id, b.Name, b.Title, b.Bio, b.PhotoUrl, b.SortOrder, b.IsActive,
            b.Services.Select(s => s.ServiceId).OrderBy(x => x).ToList(),
            b.WorkingHours.OrderBy(h => ((int)h.DayOfWeek + 6) % 7)
                .Select(h => new HoursDto(h.DayOfWeek, h.Start.ToString("HH:mm"), h.End.ToString("HH:mm"), h.IsDayOff)).ToList(),
            b.TimeOffs.OrderBy(t => t.FromUtc)
                .Select(t => new TimeOffDto(t.Id, clock.ToLocal(t.FromUtc).ToString("yyyy-MM-ddTHH:mm"),
                    clock.ToLocal(t.ToUtc).ToString("yyyy-MM-ddTHH:mm"), t.Reason)).ToList());

    public static UserAdminDto ToDto(this User u) =>
        new(u.Id, u.Login, u.Email, u.Role.ToString(), u.BarberId, u.Barber?.Name, u.IsActive, u.CreatedAt);

    public static LocalizedText Clean(this LocalizedText? t, int max = 2000) => t is null
        ? new LocalizedText()
        : new LocalizedText(Trim(t.Uz, max), Trim(t.Ru, max), Trim(t.En, max));

    private static string Trim(string? s, int max) => (s ?? "").Trim() is var v && v.Length > max ? v[..max] : (s ?? "").Trim();
}
