using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NyBarber.Api.Features.Auth;

namespace NyBarber.Api.Features.Booking;

public record SlotDto(string Time, List<int> BarberIds);

public record SlotsResponse(DateOnly Date, List<SlotDto> Slots);

public record CreateBookingRequest(
    [Required] int ServiceId,
    int? BarberId,
    [Required] DateOnly Date,
    [Required] TimeOnly Time,
    [Required, MaxLength(100)] string ClientName,
    [Required, MaxLength(32)] string ClientPhone,
    [MaxLength(500)] string? Comment,
    [MaxLength(2)] string? Language);

public record BookingConfirmation(
    int Id,
    int BarberId,
    string BarberName,
    int ServiceId,
    DateOnly Date,
    string Time,
    string EndTime,
    decimal Price,
    string ClientName,
    string ClientPhone);

[ApiController]
[Route("api/booking")]
public class BookingController(AvailabilityService availability, BookingService booking, BusinessClock clock) : ControllerBase
{
    /// <summary>Tanlangan kun uchun bo'sh vaqtlar (mahalliy vaqt) va har bir vaqtda bo'sh ustalar.</summary>
    [HttpGet("slots")]
    public async Task<SlotsResponse> Slots([FromQuery, Required] int serviceId, [FromQuery, Required] DateOnly date,
        [FromQuery] int? barberId, CancellationToken ct)
    {
        var perBarber = await availability.GetAsync(serviceId, date, barberId, ct);
        var slots = perBarber
            .SelectMany(b => b.StartsUtc.Select(s => (Start: s, b.BarberId)))
            .GroupBy(x => x.Start)
            .OrderBy(g => g.Key)
            .Select(g => new SlotDto(clock.ToLocal(g.Key).ToString("HH:mm"), g.Select(x => x.BarberId).ToList()))
            .ToList();
        return new SlotsResponse(date, slots);
    }

    [HttpPost]
    [EnableRateLimiting(RateLimits.Booking)]
    public async Task<IActionResult> Create(CreateBookingRequest req, CancellationToken ct)
    {
        try
        {
            var a = await booking.CreateAsync(new CreateBookingCommand(
                req.ServiceId, req.BarberId, req.Date, req.Time, req.ClientName, req.ClientPhone, req.Comment, req.Language ?? "uz"), ct);

            var start = clock.ToLocal(a.StartUtc);
            var end = clock.ToLocal(a.EndUtc);
            return StatusCode(StatusCodes.Status201Created, new BookingConfirmation(
                a.Id, a.BarberId, a.Barber.Name, a.ServiceId, DateOnly.FromDateTime(start.DateTime),
                start.ToString("HH:mm"), end.ToString("HH:mm"), a.Price, a.ClientName, a.ClientPhone));
        }
        catch (BookingException ex)
        {
            var problem = new ProblemDetails {Title = ex.Message, Status = ex.Status};
            problem.Extensions["code"] = ex.Code;
            return new ObjectResult(problem) {StatusCode = ex.Status};
        }
    }
}
