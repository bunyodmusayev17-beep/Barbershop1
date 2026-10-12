using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Auth;

namespace NyBarber.Api.Features.Admin;

[ApiController]
[Route("api/admin/gallery")]
[Authorize(Policy = Policies.Admin)]
public class GalleryAdminController(AppDbContext db, ImageStorage images) : ControllerBase
{
    [HttpGet]
    public async Task<List<GalleryAdminDto>> List(CancellationToken ct) =>
        await db.GalleryImages.AsNoTracking().OrderBy(g => g.SortOrder).ThenBy(g => g.Id)
            .Select(g => new GalleryAdminDto(g.Id, g.Url, g.Caption, g.SortOrder)).ToListAsync(ct);

    /// <summary>Bir nechta rasmni bir vaqtda yuklash.</summary>
    [HttpPost]
    [RequestSizeLimit(10 * (ImageStorage.MaxBytes + 64 * 1024))]
    public async Task<ActionResult<List<GalleryAdminDto>>> Upload([FromForm] List<IFormFile> files, CancellationToken ct)
    {
        if (files.Count is 0 or > 10) return ValidationProblem("1 dan 10 tagacha rasm tanlang");
        var order = (await db.GalleryImages.MaxAsync(g => (int?)g.SortOrder, ct) ?? 0) + 1;
        var added = new List<GalleryImage>();
        try
        {
            foreach (var f in files)
            {
                var url = await images.SaveAsync(f, ct);
                var img = new GalleryImage {Url = url, SortOrder = order++};
                added.Add(img);
                db.GalleryImages.Add(img);
            }
        }
        catch (InvalidDataException ex)
        {
            foreach (var a in added) images.Delete(a.Url);
            return ValidationProblem(ex.Message);
        }
        await db.SaveChangesAsync(ct);
        return added.Select(g => new GalleryAdminDto(g.Id, g.Url, g.Caption, g.SortOrder)).ToList();
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, GalleryUpdate input, CancellationToken ct)
    {
        var g = await db.GalleryImages.FindAsync([id], ct);
        if (g is null) return NotFound();
        g.Caption = input.Caption.Clean(200);
        g.SortOrder = input.SortOrder;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var g = await db.GalleryImages.FindAsync([id], ct);
        if (g is null) return NotFound();
        db.GalleryImages.Remove(g);
        await db.SaveChangesAsync(ct);
        images.Delete(g.Url);
        return NoContent();
    }
}

[ApiController]
[Route("api/admin/reviews")]
[Authorize(Policy = Policies.Admin)]
public class ReviewsAdminController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<List<ReviewAdminDto>> List(CancellationToken ct) =>
        await db.Reviews.AsNoTracking().OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewAdminDto(r.Id, r.AuthorName, r.Rating, r.Text, r.IsPublished, r.CreatedAt)).ToListAsync(ct);

    [HttpPost]
    public async Task<ActionResult<ReviewAdminDto>> Create(ReviewInput input, CancellationToken ct)
    {
        var r = new Review {AuthorName = input.AuthorName.Trim(), Rating = input.Rating, Text = input.Text.Trim(), IsPublished = input.IsPublished};
        db.Reviews.Add(r);
        await db.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, new ReviewAdminDto(r.Id, r.AuthorName, r.Rating, r.Text, r.IsPublished, r.CreatedAt));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ReviewInput input, CancellationToken ct)
    {
        var r = await db.Reviews.FindAsync([id], ct);
        if (r is null) return NotFound();
        r.AuthorName = input.AuthorName.Trim();
        r.Rating = input.Rating;
        r.Text = input.Text.Trim();
        r.IsPublished = input.IsPublished;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var r = await db.Reviews.FindAsync([id], ct);
        if (r is null) return NotFound();
        db.Reviews.Remove(r);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/admin/settings")]
[Authorize(Policy = Policies.Admin)]
public class SettingsAdminController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<SettingsDto> Get(CancellationToken ct)
    {
        var s = await db.SiteSettings.AsNoTracking().OrderBy(x => x.Id).FirstAsync(ct);
        return new SettingsDto(s.BusinessName, s.Address, s.Phone, s.Telegram, s.Instagram, s.Latitude, s.Longitude,
            s.Rating, s.RatingCount, s.SlotStepMinutes, s.MinLeadMinutes, s.BookingHorizonDays);
    }

    [HttpPut]
    public async Task<IActionResult> Update(SettingsDto input, CancellationToken ct)
    {
        var s = await db.SiteSettings.OrderBy(x => x.Id).FirstAsync(ct);
        s.BusinessName = input.BusinessName.Trim();
        s.Address = input.Address.Clean(200);
        s.Phone = input.Phone.Trim();
        s.Telegram = CleanHandle(input.Telegram);
        s.Instagram = CleanHandle(input.Instagram);
        s.Latitude = input.Latitude;
        s.Longitude = input.Longitude;
        s.Rating = Math.Round(input.Rating, 1);
        s.RatingCount = input.RatingCount;
        s.SlotStepMinutes = input.SlotStepMinutes;
        s.MinLeadMinutes = input.MinLeadMinutes;
        s.BookingHorizonDays = input.BookingHorizonDays;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>"@hairman", "https://t.me/hairman" → "hairman"</summary>
    private static string? CleanHandle(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return null;
        var s = v.Trim().TrimEnd('/');
        var slash = s.LastIndexOf('/');
        if (slash >= 0) s = s[(slash + 1)..];
        return s.TrimStart('@');
    }
}
