namespace NyBarber.Api.Features.Telegram;

public class TelegramOptions
{
    public const string Section = "Telegram";

    /// <summary>BotFather bergan token. Bo'sh bo'lsa bot o'chiq — sayt va API odatdagidek ishlaydi.</summary>
    public string BotToken { get; set; } = "";

    /// <summary>Mini App manzili (HTTPS). Bo'sh bo'lsa bot menyusida "Ochish" tugmasi qo'yilmaydi.</summary>
    public string MiniAppUrl { get; set; } = "";

    /// <summary>Ustaga eslatma zapisdan qancha oldin yuboriladi.</summary>
    public TimeSpan ReminderLead { get; set; } = TimeSpan.FromHours(2);

    /// <summary>Boshqa Bot API server (o'z Bot API serveri yoki test uchun soxta server). Bo'sh — api.telegram.org.</summary>
    public string? ApiBaseUrl { get; set; }

    public bool Enabled => !string.IsNullOrWhiteSpace(BotToken);
}
