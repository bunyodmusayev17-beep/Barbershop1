using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Telegram;

namespace NyBarber.Tests;

public class TelegramInitDataTests
{
    private const string Token = "123456:TEST-token";
    private static readonly DateTimeOffset Now = new(2026, 10, 13, 10, 0, 0, TimeSpan.Zero);

    /// <summary>Telegram qanday imzolasa, shunday imzolangan initData yasaydi.</summary>
    private static string Build(Dictionary<string, string> fields, string token = Token)
    {
        var check = string.Join('\n', fields.OrderBy(f => f.Key, StringComparer.Ordinal).Select(f => $"{f.Key}={f.Value}"));
        var hash = Convert.ToHexStringLower(TelegramInitData.Sign(check, token));
        return QueryHelpers.AddQueryString("", fields.Append(new("hash", hash))!).TrimStart('?');
    }

    private static Dictionary<string, string> Fields(DateTimeOffset authDate) => new()
    {
        ["auth_date"] = authDate.ToUnixTimeSeconds().ToString(),
        ["query_id"] = "AAH",
        ["user"] = """{"id":42,"first_name":"Sardor","username":"Sardor_Barber"}""",
    };

    [Fact]
    public void Valid_signature_returns_user()
    {
        var user = TelegramInitData.Validate(Build(Fields(Now.AddMinutes(-1))), Token, Now);
        Assert.NotNull(user);
        Assert.Equal(42, user.Id);
        Assert.Equal("Sardor_Barber", user.Username);
    }

    [Fact]
    public void Tampered_user_is_rejected()
    {
        var data = Build(Fields(Now)).Replace("%22id%22%3A42", "%22id%22%3A43");
        Assert.Null(TelegramInitData.Validate(data, Token, Now));
    }

    [Fact]
    public void Other_bot_token_is_rejected() =>
        Assert.Null(TelegramInitData.Validate(Build(Fields(Now), "999:other"), Token, Now));

    [Fact]
    public void Old_init_data_is_rejected() =>
        Assert.Null(TelegramInitData.Validate(Build(Fields(Now.AddDays(-2))), Token, Now));

    [Theory]
    [InlineData("")]
    [InlineData("user=1")]
    [InlineData("hash=zz&user=1")]
    public void Garbage_is_rejected(string data) => Assert.Null(TelegramInitData.Validate(data, Token, Now));
}

public class TelegramMessagesTests
{
    private static AppointmentCard Card(AppointmentStatus status = AppointmentStatus.Confirmed, string? comment = null) => new(
        7, "Aziz <script>", "+998901234567", "Soch olish", "Sardor",
        new DateTime(2026, 10, 13, 14, 0, 0), new DateTime(2026, 10, 13, 14, 45, 0), 80_000, comment, status);

    [Fact]
    public void Card_contains_details_and_escapes_html()
    {
        var text = TelegramMessages.Card(Card(comment: "Tez"), CardKind.New);
        Assert.Contains("Yangi zapis", text);
        Assert.Contains("Aziz &lt;script&gt;", text);
        Assert.Contains("+998 90 123 45 67", text);
        Assert.Contains("13.10 (Seshanba)", text);
        Assert.Contains("14:00–14:45", text);
        Assert.Contains("80 000 so'm", text);
        Assert.Contains("Tez", text);
    }

    [Fact]
    public void Final_card_shows_status_and_footer()
    {
        var text = TelegramMessages.Card(Card(AppointmentStatus.Completed), CardKind.Updated, "sardor, 14:50");
        Assert.Contains("✅ Keldi", text);
        Assert.Contains("sardor, 14:50", text);
    }

    [Fact]
    public void Active_appointment_has_four_buttons_final_has_only_call()
    {
        Assert.Equal(4, TelegramMessages.Keyboard(7, AppointmentStatus.Confirmed).InlineKeyboard.SelectMany(r => r).Count());
        var final = TelegramMessages.Keyboard(7, AppointmentStatus.Cancelled).InlineKeyboard.SelectMany(r => r).ToList();
        Assert.Single(final);
        Assert.Equal("a:7:call", final[0].CallbackData);
    }

    [Theory]
    [InlineData("a:15:done", true, 15, "done")]
    [InlineData("a:3:cancel_yes", true, 3, "cancel_yes")]
    [InlineData("b:3:done", false, 0, "")]
    [InlineData("a:x:done", false, 0, "")]
    [InlineData(null, false, 0, "")]
    public void Callback_data_is_parsed(string? data, bool ok, int id, string action)
    {
        Assert.Equal(ok, TelegramMessages.TryParseCallback(data, out var parsedId, out var parsedAction));
        Assert.Equal(id, parsedId);
        Assert.Equal(action, parsedAction);
    }

    [Fact]
    public void All_callback_data_fits_telegram_limit() =>
        Assert.True(Encoding.UTF8.GetByteCount(TelegramMessages.CallbackData(int.MaxValue, TelegramMessages.CancelYes)) <= 64);

    [Fact]
    public void Report_time_is_latest_end_plus_30_minutes()
    {
        var date = new DateOnly(2026, 10, 13);
        var at = TelegramMessages.ReportTime(date, [(new TimeOnly(21, 0), false), (new TimeOnly(23, 0), false), (new TimeOnly(23, 59), true)]);
        Assert.Equal(new DateTime(2026, 10, 13, 23, 30, 0), at);
    }

    [Fact]
    public void Report_time_crosses_midnight()
    {
        var at = TelegramMessages.ReportTime(new DateOnly(2026, 10, 13), [(new TimeOnly(23, 45), false)]);
        Assert.Equal(new DateTime(2026, 10, 14, 0, 15, 0), at);
    }

    [Fact]
    public void No_report_when_nobody_works() =>
        Assert.Null(TelegramMessages.ReportTime(new DateOnly(2026, 10, 13), [(new TimeOnly(23, 0), true)]));

    [Fact]
    public void Daily_report_counts_and_revenue()
    {
        ReportRow[] rows =
        [
            new("Jasur", AppointmentStatus.Completed, 80_000),
            new("Jasur", AppointmentStatus.Completed, 120_000),
            new("Sardor", AppointmentStatus.Completed, 50_000),
            new("Sardor", AppointmentStatus.NoShow, 50_000),
            new("Sardor", AppointmentStatus.Cancelled, 80_000),
            new("Bekzod", AppointmentStatus.Confirmed, 60_000),
        ];
        var text = TelegramMessages.DailyReport(new DateOnly(2026, 10, 13), rows);
        Assert.Contains("Jami zapis: <b>6</b>", text);
        Assert.Contains("✅ Keldi: 3", text);
        Assert.Contains("🚫 Kelmadi: 1", text);
        Assert.Contains("❌ Bekor: 1", text);
        Assert.Contains("⏳ Belgilanmagan: 1", text);
        Assert.Contains("Tushum: <b>250 000 so'm</b>", text);
        Assert.Contains("Jasur — 2 ta, 200 000 so'm", text);
        Assert.True(text.IndexOf("Jasur", StringComparison.Ordinal) < text.IndexOf("Sardor —", StringComparison.Ordinal));
    }

    [Fact]
    public void Empty_day_report() =>
        Assert.Contains("zapis bo'lmadi", TelegramMessages.DailyReport(new DateOnly(2026, 10, 13), []));
}
