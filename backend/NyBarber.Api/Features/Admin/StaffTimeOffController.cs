using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Auth;
using NyBarber.Api.Features.Booking;

namespace NyBarber.Api.Features.Admin;

public record StaffTimeOffDto(int Id, int BarberId, string BarberName, string From, string To, string? Reason);

/// <summary>From/To — mahalliy vaqt. BarberId — faqat admin uchun (usta har doim o'zi uchun).</summary>
public record StaffTimeOffInput(int? BarberId, [Required] DateTime From, [Required] DateTime To, [MaxLength(200)] string? Reason);

/// <summary>Yaratilgan ishlamaydigan vaqt + shu vaqtga to'g'ri kelib qolgan mavjud zapislar (mijozlarga xabar berish uchun).</summary>
public record StaffTimeOffResult(StaffTimeOffDto TimeOff, List<AppointmentDto> Conflicts);

/// <summary>
/// Ishlamaydigan vaqtlar (kasallik, shaxsiy ish, ta'til). Usta — faqat o'zi uchun, admin — istalgan usta uchun.
/// Bu vaqtlarga onlayn zapis darhol yopiladi (AvailabilityService TimeOff'larni hisobga oladi).
/// </summary>
[ApiController]
[Route("api/staff/timeoffs")]
[Authorize(Policy = Policies.Staff)]
public class StaffTimeOffController(AppDbContext db, BusinessClock clock) : ControllerBase
{
    private const int MaxDays = 60;

    [HttpGet]
    public async Task<List<StaffTimeOffDto>> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] int? barberId, CancellationToken ct)
    {
        var (start, _) = clock.DayRangeUtc(from ?? clock.Today);
        var (_, end) = clock.DayRangeUtc(to ?? (from ?? clock.Today).AddDays(90));

        var q = db.TimeOffs.AsNoTracking().Where(t => t.ToUtc > start && t.FromUtc < end);
        var own = OwnBarberId();
        if (own is not null) q = q.Where(t => t.BarberId == own);
        else if (barberId is not null) q = q.Where(t => t.BarberId == barberId);

        var items = await q.OrderBy(t => t.FromUtc).ToListAsync(ct);
        var names = await db.Barbers.AsNoTracking().ToDictionaryAsync(b => b.Id, b => b.Name, ct);
        return items.Select(t => ToDto(t, names.GetValueOrDefault(t.BarberId, ""))).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<StaffTimeOffResult>> Create(StaffTimeOffInput input, CancellationToken ct)
    {
        var barberId = OwnBarberId() ?? input.BarberId;
        if (barberId is null) return ValidationProblem("Ustani tanlang");
        var barber = await db.Barbers.FirstOrDefaultAsync(b => b.Id == barberId, ct);
        if (barber is null) return NotFound();

        if (input.To <= input.From) return ValidationProblem("Tugash vaqti boshlanishdan keyin bo'lishi kerak");
        if ((input.To - input.From).TotalDays > MaxDays) return ValidationProblem($"Bir martada {MaxDays} kundan oshmasin");

        var fromUtc = SlotCalculator.ToUtc(DateOnly.FromDateTime(input.From), TimeOnly.FromDateTime(input.From), clock.Zone);
        var toUtc = SlotCalculator.ToUtc(DateOnly.FromDateTime(input.To), TimeOnly.FromDateTime(input.To), clock.Zone);
        if (toUtc <= clock.UtcNow) return ValidationProblem("O'tib ketgan vaqtni belgilab bo'lmaydi");

        var timeOff = new TimeOff
        {
            BarberId = barber.Id,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            Reason = string.IsNullOrWhiteSpace(input.Reason) ? null : input.Reason.Trim(),
        };
        db.TimeOffs.Add(timeOff);
        await db.SaveChangesAsync(ct);

        // Shu oraliqqa tushib qolgan faol zapislar — usta/admin mijozlarga xabar berishi kerak
        var conflicts = await db.Appointments.AsNoTracking().Include(a => a.Barber).Include(a => a.Service)
            .Where(a => a.BarberId == barber.Id && a.StartUtc < toUtc && a.EndUtc > fromUtc
                        && (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed))
            .OrderBy(a => a.StartUtc)
            .ToListAsync(ct);

        return StatusCode(StatusCodes.Status201Created,
            new StaffTimeOffResult(ToDto(timeOff, barber.Name), conflicts.Select(a => a.ToDto(clock)).ToList()));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var t = await db.TimeOffs.FindAsync([id], ct);
        if (t is null) return NotFound();
        if (OwnBarberId() is { } own && t.BarberId != own) return Forbid();
        db.TimeOffs.Remove(t);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private StaffTimeOffDto ToDto(TimeOff t, string barberName) =>
        new(t.Id, t.BarberId, barberName, clock.ToLocal(t.FromUtc).ToString("yyyy-MM-ddTHH:mm"), clock.ToLocal(t.ToUtc).ToString("yyyy-MM-ddTHH:mm"), t.Reason);

    private int? OwnBarberId() => User.IsAdmin() ? null : (User.BarberId() ?? -1);
}
