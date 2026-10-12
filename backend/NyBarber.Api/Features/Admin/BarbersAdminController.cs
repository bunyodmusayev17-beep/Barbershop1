using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Auth;
using NyBarber.Api.Features.Booking;

namespace NyBarber.Api.Features.Admin;

[ApiController]
[Route("api/admin/barbers")]
[Authorize(Policy = Policies.Admin)]
public class BarbersAdminController(AppDbContext db, BusinessClock clock, ImageStorage images) : ControllerBase
{
    private IQueryable<Barber> Full => db.Barbers.Include(b => b.Services).Include(b => b.WorkingHours).Include(b => b.TimeOffs);

    [HttpGet]
    public async Task<List<BarberAdminDto>> List(CancellationToken ct) =>
        (await Full.AsNoTracking().OrderBy(b => b.SortOrder).ThenBy(b => b.Id).ToListAsync(ct)).Select(b => b.ToDto(clock)).ToList();

    [HttpPost]
    public async Task<ActionResult<BarberAdminDto>> Create(BarberInput input, CancellationToken ct)
    {
        var b = new Barber();
        var error = await Apply(b, input, ct);
        if (error is not null) return ValidationProblem(error);
        // Yangi usta uchun standart jadval: har kuni 11:00–23:00, agar berilmagan bo'lsa
        if (b.WorkingHours.Count == 0)
            foreach (var d in Enum.GetValues<DayOfWeek>())
                b.WorkingHours.Add(new WorkingHours {DayOfWeek = d, Start = new TimeOnly(11, 0), End = new TimeOnly(23, 0)});
        db.Barbers.Add(b);
        await db.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, b.ToDto(clock));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<BarberAdminDto>> Update(int id, BarberInput input, CancellationToken ct)
    {
        var b = await Full.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return NotFound();
        var error = await Apply(b, input, ct);
        if (error is not null) return ValidationProblem(error);
        await db.SaveChangesAsync(ct);
        return b.ToDto(clock);
    }

    /// <summary>Zapislari bor usta o'chirilmaydi — nofaol qilinadi.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var b = await Full.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return NotFound();
        if (await db.Appointments.AnyAsync(a => a.BarberId == id, ct)) b.IsActive = false;
        else
        {
            images.Delete(b.PhotoUrl);
            db.Barbers.Remove(b);
        }
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:int}/photo")]
    [RequestSizeLimit(ImageStorage.MaxBytes + 64 * 1024)]
    public async Task<ActionResult<BarberAdminDto>> UploadPhoto(int id, IFormFile file, CancellationToken ct)
    {
        var b = await Full.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return NotFound();
        try
        {
            var url = await images.SaveAsync(file, ct);
            images.Delete(b.PhotoUrl);
            b.PhotoUrl = url;
        }
        catch (InvalidDataException ex)
        {
            return ValidationProblem(ex.Message);
        }
        await db.SaveChangesAsync(ct);
        return b.ToDto(clock);
    }

    [HttpDelete("{id:int}/photo")]
    public async Task<ActionResult<BarberAdminDto>> DeletePhoto(int id, CancellationToken ct)
    {
        var b = await Full.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return NotFound();
        images.Delete(b.PhotoUrl);
        b.PhotoUrl = null;
        await db.SaveChangesAsync(ct);
        return b.ToDto(clock);
    }

    [HttpPost("{id:int}/timeoffs")]
    public async Task<ActionResult<BarberAdminDto>> AddTimeOff(int id, TimeOffInput input, CancellationToken ct)
    {
        var b = await Full.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return NotFound();
        if (input.To <= input.From) return ValidationProblem("Tugash vaqti boshlanishdan keyin bo'lishi kerak");

        b.TimeOffs.Add(new TimeOff
        {
            FromUtc = SlotCalculator.ToUtc(DateOnly.FromDateTime(input.From), TimeOnly.FromDateTime(input.From), clock.Zone),
            ToUtc = SlotCalculator.ToUtc(DateOnly.FromDateTime(input.To), TimeOnly.FromDateTime(input.To), clock.Zone),
            Reason = string.IsNullOrWhiteSpace(input.Reason) ? null : input.Reason.Trim(),
        });
        await db.SaveChangesAsync(ct);
        return b.ToDto(clock);
    }

    [HttpDelete("{id:int}/timeoffs/{timeOffId:int}")]
    public async Task<ActionResult<BarberAdminDto>> DeleteTimeOff(int id, int timeOffId, CancellationToken ct)
    {
        var b = await Full.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return NotFound();
        b.TimeOffs.RemoveAll(t => t.Id == timeOffId);
        await db.SaveChangesAsync(ct);
        return b.ToDto(clock);
    }

    private async Task<string?> Apply(Barber b, BarberInput input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) return "Ism majburiy";
        b.Name = input.Name.Trim();
        b.Title = input.Title.Clean(100);
        b.Bio = input.Bio.Clean(1000);
        b.SortOrder = input.SortOrder;
        b.IsActive = input.IsActive;

        if (input.ServiceIds is not null)
        {
            var wanted = input.ServiceIds.Distinct().ToList();
            var valid = await db.Services.Where(s => wanted.Contains(s.Id)).Select(s => s.Id).ToListAsync(ct);
            b.Services.RemoveAll(s => !valid.Contains(s.ServiceId));
            foreach (var sid in valid.Where(sid => b.Services.All(s => s.ServiceId != sid)))
                b.Services.Add(new BarberService {ServiceId = sid});
        }

        if (input.Hours is not null)
        {
            foreach (var h in input.Hours)
            {
                if (!TimeOnly.TryParseExact(h.Start, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) ||
                    !TimeOnly.TryParseExact(h.End, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end))
                    return "Vaqt formati HH:mm bo'lishi kerak";
                if (!h.IsDayOff && end <= start) return "Ish tugash vaqti boshlanishdan keyin bo'lishi kerak";

                var row = b.WorkingHours.FirstOrDefault(w => w.DayOfWeek == h.Day);
                if (row is null) b.WorkingHours.Add(row = new WorkingHours {DayOfWeek = h.Day});
                row.Start = start;
                row.End = end;
                row.IsDayOff = h.IsDayOff;
            }
        }
        return null;
    }
}
