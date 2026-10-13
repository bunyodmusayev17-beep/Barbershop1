using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;

namespace NyBarber.Api.Features.Telegram;

public record TelegramWebAppUser(long Id, string? Username, string? FirstName);

/// <summary>
/// Mini App'dan kelgan initData imzosini tekshiradi (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
/// Imzo bot tokeni bilan HMAC-SHA256 — tokenni bilmasdan foydalanuvchi ID/username'ini soxtalashtirib bo'lmaydi.
/// </summary>
public static class TelegramInitData
{
    /// <summary>initData shu muddatdan eski bo'lsa qabul qilinmaydi (eski havolani qayta ishlatishga qarshi).</summary>
    public static readonly TimeSpan MaxAge = TimeSpan.FromDays(1);

    public static TelegramWebAppUser? Validate(string initData, string botToken, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(initData) || string.IsNullOrWhiteSpace(botToken)) return null;

        var fields = QueryHelpers.ParseQuery(initData);
        if (!fields.TryGetValue("hash", out var hash) || hash.Count != 1) return null;

        var dataCheck = string.Join('\n', fields
            .Where(f => f.Key != "hash")
            .OrderBy(f => f.Key, StringComparer.Ordinal)
            .Select(f => $"{f.Key}={f.Value}"));

        var expected = Sign(dataCheck, botToken);
        byte[] actual;
        try { actual = Convert.FromHexString(hash.ToString()); }
        catch (FormatException) { return null; }
        if (!CryptographicOperations.FixedTimeEquals(expected, actual)) return null;

        if (!fields.TryGetValue("auth_date", out var authDate) || !long.TryParse(authDate, out var unix)) return null;
        var age = now - DateTimeOffset.FromUnixTimeSeconds(unix);
        if (age > MaxAge || age < TimeSpan.FromMinutes(-5)) return null;

        if (!fields.TryGetValue("user", out var userJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(userJson.ToString());
            var root = doc.RootElement;
            return new TelegramWebAppUser(
                root.GetProperty("id").GetInt64(),
                root.TryGetProperty("username", out var u) ? u.GetString() : null,
                root.TryGetProperty("first_name", out var f) ? f.GetString() : null);
        }
        catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return null;
        }
    }

    /// <summary>secret = HMAC("WebAppData", token); hash = HMAC(secret, data_check_string).</summary>
    public static byte[] Sign(string dataCheckString, string botToken)
    {
        var secret = HMACSHA256.HashData("WebAppData"u8, Encoding.UTF8.GetBytes(botToken));
        return HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(dataCheckString));
    }
}
