using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Features.Telegram;

/// <summary>
/// Xodim akkauntini Telegram bilan bog'lash. Admin username (yoki raqamli ID) kiritadi;
/// xodim botga birinchi marta yozganda / Mini App'ni ochganda Telegram ID doimiy bog'lanadi.
/// </summary>
public partial class TelegramAccounts(AppDbContext db, ILogger<TelegramAccounts> logger)
{
    /// <summary>Telegram ID bo'yicha faol xodimni topadi; topilmasa — username bo'yicha topib ID'ni bog'laydi.</summary>
    public async Task<User?> FindOrBindAsync(long telegramId, string? username, CancellationToken ct)
    {
        var user = await db.Users.Include(u => u.Barber).FirstOrDefaultAsync(u => u.TelegramUserId == telegramId, ct);
        if (user is null && !string.IsNullOrEmpty(username))
        {
            var name = username.ToLowerInvariant();
            user = await db.Users.Include(u => u.Barber)
                .FirstOrDefaultAsync(u => u.TelegramUsername == name && u.TelegramUserId == null, ct);
            if (user is not null)
            {
                user.TelegramUserId = telegramId;
                logger.LogInformation("Telegram bog'landi: {Login} ← {TgId} (@{Username})", user.Login, telegramId, name);
                await db.SaveChangesAsync(ct);
            }
        }
        return user is {IsActive: true} ? user : null;
    }

    /// <summary>Zapis haqida xabar oladigan chatlar: o'sha usta (+ adminlar), amalni bajargan odamdan tashqari.</summary>
    public Task<List<long>> ChatIdsAsync(int barberId, bool includeAdmins, int? exceptUserId, CancellationToken ct) =>
        db.Users.Where(u => u.IsActive && u.TelegramUserId != null && u.Id != exceptUserId
                            && ((u.Role == UserRole.Barber && u.BarberId == barberId) || (includeAdmins && u.Role == UserRole.Admin)))
            .Select(u => u.TelegramUserId!.Value)
            .Distinct()
            .ToListAsync(ct);

    public Task<List<long>> AdminChatIdsAsync(CancellationToken ct) =>
        db.Users.Where(u => u.IsActive && u.TelegramUserId != null && u.Role == UserRole.Admin)
            .Select(u => u.TelegramUserId!.Value)
            .ToListAsync(ct);

    /// <summary>
    /// Admin kiritgan qiymatni foydalanuvchiga yozadi: "@username", "username" yoki raqamli ID; bo'sh — uzish.
    /// Username o'zgarsa eski bog'lanish o'chadi (yangi odam qayta Start bosadi). Xato bo'lsa — matni qaytadi.
    /// </summary>
    public async Task<string?> ApplyAsync(User user, string? input, CancellationToken ct)
    {
        var value = input?.Trim().TrimStart('@').ToLowerInvariant() ?? "";
        if (value.Length == 0)
        {
            user.TelegramUsername = null;
            user.TelegramUserId = null;
            return null;
        }

        if (long.TryParse(value, out var id) && id > 0)
        {
            if (user.TelegramUserId == id) return null;
            if (await db.Users.AnyAsync(u => u.Id != user.Id && u.TelegramUserId == id, ct)) return "Bu Telegram ID boshqa akkauntga bog'langan";
            user.TelegramUserId = id;
            user.TelegramUsername = null;
            return null;
        }

        if (!UsernameRegex().IsMatch(value)) return "Telegram username noto'g'ri: 5–32 belgi (lotin harf, raqam, _) yoki raqamli ID";
        if (user.TelegramUsername == value) return null;
        if (await db.Users.AnyAsync(u => u.Id != user.Id && u.TelegramUsername == value, ct)) return "Bu Telegram username boshqa akkauntda bor";
        user.TelegramUsername = value;
        user.TelegramUserId = null;
        return null;
    }

    /// <summary>Panelda ko'rsatish uchun: "@username" yoki ID.</summary>
    public static string? Display(User u) => u.TelegramUsername is { } n ? "@" + n : u.TelegramUserId?.ToString();

    [GeneratedRegex("^[a-z][a-z0-9_]{4,31}$")]
    private static partial Regex UsernameRegex();
}
