using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Auth;
using NyBarber.Api.Features.Booking;

namespace NyBarber.Api.Features.Admin;

/// <summary>
/// Zapislar: admin hammasini ko'radi, usta — faqat o'zinikini (barber_id claim bo'yicha majburiy filtr).
/// </summary>
[ApiController]
[Route("api/admin/appointments")]
[Authorize(Policy = Policies.Staff)]
public class AppointmentsController(AppDbContext db, BusinessClock clock, BookingService booking) : ControllerBase
{
    [HttpGet]
    public async Task<List<AppointmentDto>> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] int? barberId,
        [FromQuery] AppointmentStatus? status, [FromQuery] string? search, CancellationToken ct)
    {
        var fromDate = from ?? clock.Today;
        var toDate = to ?? fromDate.AddDays(30);
        if (toDate < fromDate) (fromDate, toDate) = (toDate, fromDate);
        if (toDate.DayNumber - fromDate.DayNumber > 370) toDate = fromDate.AddDays(370);

        var (start, _) = clock.DayRangeUtc(fromDate);
        var (_, end) = clock.DayRangeUtc(toDate);

        var q = db.Appointments.AsNoTracking().Include(a => a.Barber).Include(a => a.Service)
            .Where(a => a.StartUtc >= start && a.StartUtc < end);

        var own = OwnBarberId();
        if (own is not null) q = q.Where(a => a.BarberId == own);
        else if (barberId is not null) q = q.Where(a => a.BarberId == barberId);

        if (status is not null) q = q.Where(a => a.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            var digits = new string(s.Where(char.IsDigit).ToArray());
            q = q.Where(a => EF.Functions.ILike(a.ClientName, $"%{s}%") || (digits.Length >= 3 && a.ClientPhone.Contains(digits)));
        }

        var list = await q.OrderBy(a => a.StartUtc).Take(1000).ToListAsync(ct);
        return list.Select(a => a.ToDto(clock)).ToList();
    }

    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<AppointmentDto>> SetStatus(int id, StatusUpdate body, CancellationToken ct)
    {
        var a = await db.Appointments.Include(x => x.Barber).Include(x => x.Service).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();
        if (OwnBarberId() is { } own && a.BarberId != own) return Forbid();

        a.Status = body.Status;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException {SqlState: PostgresErrorCodes.ExclusionViolation})
        {
            // Bekor qilingan zapisni qayta tiklashda vaqt allaqachon band bo'lishi mumkin
            return Conflict(new ProblemDetails {Title = "Bu vaqt allaqachon band", Extensions = {["code"] = BookingErrors.SlotTaken}});
        }
        return a.ToDto(clock);
    }

    [HttpPost]
    public async Task<IActionResult> Create(StaffBookingRequest req, CancellationToken ct)
    {
        if (OwnBarberId() is { } own && req.BarberId != own) return Forbid();
        try
        {
            var a = await booking.CreateByStaffAsync(req.ServiceId, req.BarberId, req.Date, req.Time, req.ClientName, req.ClientPhone, req.Comment, ct);
            return StatusCode(StatusCodes.Status201Created, a.ToDto(clock));
        }
        catch (BookingException ex)
        {
            return new ObjectResult(new ProblemDetails {Title = ex.Message, Status = ex.Status, Extensions = {["code"] = ex.Code}}) {StatusCode = ex.Status};
        }
    }

    /// <summary>Admin uchun null, usta uchun uning BarberId'si.</summary>
    private int? OwnBarberId() => User.IsAdmin() ? null : (User.BarberId() ?? -1);
}
