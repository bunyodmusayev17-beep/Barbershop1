namespace NyBarber.Api.Features.Admin;

/// <summary>
/// Rasmlarni wwwroot/uploads ga saqlaydi. Fayl turi kengaytmaga emas, ichidagi baytlarga (magic bytes) qarab aniqlanadi,
/// nom tasodifiy GUID bo'ladi — foydalanuvchi bergan nom ishlatilmaydi.
/// </summary>
public class ImageStorage(IWebHostEnvironment env)
{
    public const long MaxBytes = 5 * 1024 * 1024;

    public async Task<string> SaveAsync(IFormFile file, CancellationToken ct)
    {
        if (file.Length is 0 or > MaxBytes) throw new InvalidDataException("Rasm hajmi 5 MB dan oshmasligi kerak");

        var header = new byte[12];
        await using (var peek = file.OpenReadStream())
            _ = await peek.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);

        var ext = Detect(header) ?? throw new InvalidDataException("Faqat JPG, PNG yoki WEBP rasm yuklash mumkin");
        var dir = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), "uploads");
        Directory.CreateDirectory(dir);
        var name = $"{Guid.NewGuid():N}{ext}";

        await using var target = File.Create(Path.Combine(dir, name));
        await using var source = file.OpenReadStream();
        await source.CopyToAsync(target, ct);
        return $"/uploads/{name}";
    }

    public void Delete(string? url)
    {
        if (string.IsNullOrEmpty(url) || !url.StartsWith("/uploads/")) return;
        var name = Path.GetFileName(url);
        var path = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), "uploads", name);
        if (File.Exists(path)) File.Delete(path);
    }

    private static string? Detect(byte[] h)
    {
        if (h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return ".jpg";
        if (h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47) return ".png";
        if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return ".webp";
        return null;
    }
}
