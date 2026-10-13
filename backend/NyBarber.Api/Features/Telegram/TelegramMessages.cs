using System.Globalization;
using System.Net;
using System.Text;
using NyBarber.Api.Domain;
using Telegram.Bot.Types.ReplyMarkups;

namespace NyBarber.Api.Features.Telegram;

public enum CardKind { New, Reminder, Cancelled, Updated }

/// <summary>Xabarda ko'rsatiladigan zapis ma'lumoti (mahalliy vaqtda).</summary>
public record AppointmentCard(
    int Id,
    string ClientName,
    string ClientPhone,
    string ServiceName,
    string BarberName,
    DateTime Start,
    DateTime End,
    decimal Price,
    string? Comment,
    AppointmentStatus Status);

public record ReportRow(string BarberName, AppointmentStatus Status, decimal Price);

/// <summary>Bot xabarlari matni va tugmalari — sof funksiyalar, Telegram'ga bog'liq emas (testlanadi).</summary>
public static class TelegramMessages
{
    private static readonly string[] WeekDays = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

    // --- Callback ma'lumotlari: "a:{id}:{amal}" (Telegram cheklovi — 64 bayt) ---
    public const string Done = "done", NoShow = "noshow", Cancel = "cancel", CancelYes = "cancel_yes", CancelNo = "cancel_no", Call = "call";

    public static string CallbackData(int appointmentId, string action) => $"a:{appointmentId}:{action}";

    public static bool TryParseCallback(string? data, out int appointmentId, out string action)
    {
        appointmentId = 0;
        action = "";
        var parts = data?.Split(':');
        if (parts is not ["a", var id, var act] || !int.TryParse(id, out appointmentId)) return false;
        action = act;
        return true;
    }

    public static bool IsFinal(AppointmentStatus s) => s is AppointmentStatus.Completed or AppointmentStatus.NoShow or AppointmentStatus.Cancelled;

    public static string Card(AppointmentCard a, CardKind kind, string? footer = null)
    {
        var sb = new StringBuilder();
        sb.Append(kind switch
        {
            CardKind.New => "🆕 <b>Yangi zapis</b>",
            CardKind.Reminder => $"⏰ <b>Eslatma: soat {a.Start:HH:mm} da mijoz keladi</b>",
            CardKind.Cancelled => "❌ <b>Zapis bekor qilindi</b>",
            _ => "💈 <b>Zapis</b>",
        });
        sb.Append("\n\n");
        sb.Append("👤 ").Append(H(a.ClientName)).Append('\n');
        sb.Append("📞 ").Append(FormatPhone(a.ClientPhone)).Append('\n');
        sb.Append("✂️ ").Append(H(a.ServiceName)).Append('\n');
        sb.Append("💈 ").Append(H(a.BarberName)).Append('\n');
        sb.Append("🗓 ").Append(FormatDay(a.Start)).Append(" · <b>")
            .Append(a.Start.ToString("HH:mm")).Append('–').Append(a.End.ToString("HH:mm")).Append("</b>\n");
        sb.Append("💵 ").Append(Money(a.Price));
        if (!string.IsNullOrWhiteSpace(a.Comment)) sb.Append("\n💬 ").Append(H(a.Comment));
        if (IsFinal(a.Status) && kind != CardKind.Cancelled) sb.Append("\n\n<b>").Append(StatusLabel(a.Status)).Append("</b>");
        if (footer is not null) sb.Append(IsFinal(a.Status) && kind != CardKind.Cancelled ? " · " : "\n\n").Append(H(footer));
        return sb.ToString();
    }

    /// <summary>Faol zapis — 4 ta tugma; yakunlangan — faqat qo'ng'iroq.</summary>
    public static InlineKeyboardMarkup Keyboard(int id, AppointmentStatus status)
    {
        var call = InlineKeyboardButton.WithCallbackData("📞 Qo'ng'iroq", CallbackData(id, Call));
        if (IsFinal(status)) return new InlineKeyboardMarkup(call);
        return new InlineKeyboardMarkup([
            [InlineKeyboardButton.WithCallbackData("✅ Keldi", CallbackData(id, Done)), InlineKeyboardButton.WithCallbackData("🚫 Kelmadi", CallbackData(id, NoShow))],
            [InlineKeyboardButton.WithCallbackData("❌ Bekor qilish", CallbackData(id, Cancel)), call],
        ]);
    }

    public static InlineKeyboardMarkup CancelConfirmKeyboard(int id) => new([
        [InlineKeyboardButton.WithCallbackData("Ha, bekor qilinsin", CallbackData(id, CancelYes)), InlineKeyboardButton.WithCallbackData("Yo'q", CallbackData(id, CancelNo))],
    ]);

    public static string StatusLabel(AppointmentStatus s) => s switch
    {
        AppointmentStatus.Completed => "✅ Keldi",
        AppointmentStatus.NoShow => "🚫 Kelmadi",
        AppointmentStatus.Cancelled => "❌ Bekor qilingan",
        AppointmentStatus.Confirmed => "Tasdiqlangan",
        _ => "Kutilmoqda",
    };

    /// <summary>
    /// Kechki hisobot vaqti: o'sha kuni ishlaydigan ustalarning eng kech tugash vaqti + 30 daqiqa.
    /// Hech kim ishlamasa — null (hisobot yuborilmaydi).
    /// </summary>
    public static DateTime? ReportTime(DateOnly date, IEnumerable<(TimeOnly End, bool IsDayOff)> hours)
    {
        var ends = hours.Where(h => !h.IsDayOff).Select(h => h.End).ToList();
        return ends.Count == 0 ? null : date.ToDateTime(ends.Max()).AddMinutes(30);
    }

    public static string DailyReport(DateOnly date, IReadOnlyCollection<ReportRow> rows)
    {
        int Count(AppointmentStatus s) => rows.Count(r => r.Status == s);
        var revenue = rows.Where(r => r.Status == AppointmentStatus.Completed).Sum(r => r.Price);
        var unmarked = rows.Count(r => !IsFinal(r.Status));

        var sb = new StringBuilder();
        sb.Append("📊 <b>Kunlik hisobot — ").Append(FormatDay(date.ToDateTime(TimeOnly.MinValue))).Append("</b>\n\n");
        if (rows.Count == 0) return sb.Append("Bugun zapis bo'lmadi.").ToString();

        sb.Append("Jami zapis: <b>").Append(rows.Count).Append("</b>\n");
        sb.Append("✅ Keldi: ").Append(Count(AppointmentStatus.Completed)).Append('\n');
        sb.Append("🚫 Kelmadi: ").Append(Count(AppointmentStatus.NoShow)).Append('\n');
        sb.Append("❌ Bekor: ").Append(Count(AppointmentStatus.Cancelled)).Append('\n');
        if (unmarked > 0) sb.Append("⏳ Belgilanmagan: ").Append(unmarked).Append('\n');
        sb.Append("💵 Tushum: <b>").Append(Money(revenue)).Append("</b>\n");

        var perBarber = rows.Where(r => r.Status == AppointmentStatus.Completed)
            .GroupBy(r => r.BarberName)
            .Select(g => (Name: g.Key, Count: g.Count(), Sum: g.Sum(r => r.Price)))
            .OrderByDescending(x => x.Sum)
            .ToList();
        if (perBarber.Count > 0)
        {
            sb.Append("\n<b>Ustalar:</b>\n");
            foreach (var b in perBarber) sb.Append("💈 ").Append(H(b.Name)).Append(" — ").Append(b.Count).Append(" ta, ").Append(Money(b.Sum)).Append('\n');
        }
        if (unmarked > 0) sb.Append("\n<i>Belgilanmagan zapislar tushumga kirmagan.</i>");
        return sb.ToString().TrimEnd();
    }

    public static string Money(decimal amount) =>
        amount.ToString("#,0", new NumberFormatInfo {NumberGroupSeparator = " "}) + " so'm";

    /// <summary>+998901234567 → +998 90 123 45 67 (boshqa ko'rinishdagi raqam o'zgarishsiz).</summary>
    public static string FormatPhone(string phone) =>
        phone.Length == 13 && phone.StartsWith("+998")
            ? $"+998 {phone[4..6]} {phone[6..9]} {phone[9..11]} {phone[11..13]}"
            : H(phone);

    public static string FormatDay(DateTime local) => $"{local:dd.MM} ({WeekDays[(int)local.DayOfWeek]})";

    private static string H(string s) => WebUtility.HtmlEncode(s);
}
