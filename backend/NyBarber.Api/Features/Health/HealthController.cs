using Microsoft.AspNetCore.Mvc;
using NyBarber.Api.Data;

namespace NyBarber.Api.Features.Health;

[ApiController]
[Route("api/health")]
public class HealthController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var dbOk = await db.Database.CanConnectAsync(ct);
        return Ok(new { status = "ok", database = dbOk ? "connected" : "unavailable", time = DateTimeOffset.UtcNow });
    }
}
