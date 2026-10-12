using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Features.Public;

public record PublicSettings(
    string BusinessName, LocalizedText Address, string Phone, string? Telegram, string? Instagram,
    double Latitude, double Longitude, double Rating, int RatingCount, int BookingHorizonDays,
    List<PublicHours> Hours);

public record PublicHours(DayOfWeek Day, string? Open, string? Close);

public record PublicService(int Id, LocalizedText Name, LocalizedText Description, decimal Price, int DurationMinutes, List<int> BarberIds);

public record PublicBarber(int Id, string Name, LocalizedText Title, LocalizedText Bio, string? PhotoUrl, List<int> ServiceIds, List<DayOfWeek> DaysOff);

public record PublicReview(int Id, string AuthorName, int Rating, string Text, DateTimeOffset CreatedAt);

public record PublicImage(int Id, string Url, LocalizedText Caption);

public record SiteResponse(PublicSettings Settings, List<PublicService> Services, List<PublicBarber> Barbers, List<PublicReview> Reviews, List<PublicImage> Gallery);

/// <summary>Saytning ommaviy qismi uchun barcha kontent — bitta so'rovda.</summary>
[ApiController]
[Route("api/public")]
public class PublicController(AppDbContext db) : ControllerBase
{
    [HttpGet("site")]
    public async Task<SiteResponse> Site(CancellationToken ct)
    {
        var s = await db.SiteSettings.AsNoTracking().OrderBy(x => x.Id).FirstAsync(ct);

        var barbers = await db.Barbers.AsNoTracking().Where(b => b.IsActive).OrderBy(b => b.SortOrder)
            .Select(b => new
            {
                b.Id, b.Name, b.Title, b.Bio, b.PhotoUrl,
                ServiceIds = b.Services.Where(x => x.Service.IsActive).Select(x => x.ServiceId).ToList(),
                Hours = b.WorkingHours.ToList(),
            })
            .ToListAsync(ct);
        var activeBarberIds = barbers.Select(b => b.Id).ToHashSet();

        var services = await db.Services.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder)
            .Select(x => new PublicService(x.Id, x.Name, x.Description, x.Price, x.DurationMinutes,
                x.Barbers.Where(b => b.Barber.IsActive).Select(b => b.BarberId).ToList()))
            .ToListAsync(ct);

        // Umumiy ish vaqti: har kuni ishlaydigan ustalarning eng erta ochilishi va eng kech yopilishi
        var hours = Enum.GetValues<DayOfWeek>().Select(day =>
        {
            var open = barbers.SelectMany(b => b.Hours).Where(h => h.DayOfWeek == day && !h.IsDayOff).ToList();
            return open.Count == 0
                ? new PublicHours(day, null, null)
                : new PublicHours(day, open.Min(h => h.Start).ToString("HH:mm"), open.Max(h => h.End).ToString("HH:mm"));
        }).ToList();

        var reviews = await db.Reviews.AsNoTracking().Where(r => r.IsPublished).OrderByDescending(r => r.CreatedAt)
            .Take(20).Select(r => new PublicReview(r.Id, r.AuthorName, r.Rating, r.Text, r.CreatedAt)).ToListAsync(ct);

        var gallery = await db.GalleryImages.AsNoTracking().OrderBy(g => g.SortOrder)
            .Select(g => new PublicImage(g.Id, g.Url, g.Caption)).ToListAsync(ct);

        return new SiteResponse(
            new PublicSettings(s.BusinessName, s.Address, s.Phone, s.Telegram, s.Instagram, s.Latitude, s.Longitude,
                s.Rating, s.RatingCount, s.BookingHorizonDays, hours),
            services,
            barbers.Select(b => new PublicBarber(b.Id, b.Name, b.Title, b.Bio, b.PhotoUrl, b.ServiceIds,
                b.Hours.Where(h => h.IsDayOff).Select(h => h.DayOfWeek).ToList())).ToList(),
            reviews,
            gallery);
    }
}
