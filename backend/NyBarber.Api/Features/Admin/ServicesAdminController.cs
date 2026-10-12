using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Auth;

namespace NyBarber.Api.Features.Admin;

[ApiController]
[Route("api/admin/services")]
[Authorize(Policy = Policies.Admin)]
public class ServicesAdminController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<List<ServiceAdminDto>> List(CancellationToken ct) =>
        (await db.Services.AsNoTracking().Include(s => s.Barbers).OrderBy(s => s.SortOrder).ThenBy(s => s.Id).ToListAsync(ct))
        .Select(s => s.ToDto()).ToList();

    [HttpPost]
    public async Task<ActionResult<ServiceAdminDto>> Create(ServiceInput input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name.Uz)) return ValidationProblem("Nom (o'zbekcha) majburiy");
        var s = new Service();
        await Apply(s, input, ct);
        db.Services.Add(s);
        await db.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, s.ToDto());
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ServiceAdminDto>> Update(int id, ServiceInput input, CancellationToken ct)
    {
        var s = await db.Services.Include(x => x.Barbers).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null) return NotFound();
        if (string.IsNullOrWhiteSpace(input.Name.Uz)) return ValidationProblem("Nom (o'zbekcha) majburiy");
        await Apply(s, input, ct);
        await db.SaveChangesAsync(ct);
        return s.ToDto();
    }

    /// <summary>Zapislari bor xizmat o'chirilmaydi, faqat nofaol qilinadi (tarix saqlanishi uchun).</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var s = await db.Services.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null) return NotFound();
        if (await db.Appointments.AnyAsync(a => a.ServiceId == id, ct)) s.IsActive = false;
        else db.Services.Remove(s);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task Apply(Service s, ServiceInput input, CancellationToken ct)
    {
        s.Name = input.Name.Clean(100);
        s.Description = input.Description.Clean(500);
        s.Price = input.Price;
        s.DurationMinutes = input.DurationMinutes;
        s.SortOrder = input.SortOrder;
        s.IsActive = input.IsActive;

        var wanted = (input.BarberIds ?? []).Distinct().ToList();
        var valid = await db.Barbers.Where(b => wanted.Contains(b.Id)).Select(b => b.Id).ToListAsync(ct);
        s.Barbers.RemoveAll(b => !valid.Contains(b.BarberId));
        foreach (var id in valid.Where(id => s.Barbers.All(b => b.BarberId != id)))
            s.Barbers.Add(new BarberService {BarberId = id});
    }
}
