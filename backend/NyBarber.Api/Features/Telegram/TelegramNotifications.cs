using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Booking;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace NyBarber.Api.Features.Telegram;

/// <summary>Bot yuboradigan xabarlar: yangi/bekor qilingan zapis, ustaga eslatma, kechki hisobot.</summary>
public class TelegramNotifications(
    AppDbContext db,
    ITelegramBotClient bot,
    TelegramAccounts accounts,
    BusinessClock clock,
    IOptions<TelegramOptions> options,
    ILogger<TelegramNotifications> logger)
{
    public async Task HandleEventAsync(BotEvent e, CancellationToken ct)
    {
        var a = await LoadAsync(e.AppointmentId, ct);
        if (a is null) return;

        var created = e.Kind == BotEventKind.Created;
        // Yangi zapis — adminlar va usta; bekor qilish — faqat usta (admin o'zi bekor qilgan bo'ladi yoki panelda ko'radi)
        var chats = await accounts.ChatIdsAsync(a.BarberId, includeAdmins: created, e.ActorUserId, ct);
        var text = TelegramMessages.Card(ToCard(a), created ? CardKind.New : CardKind.Cancelled);
        await SendAsync(created ? $"yangi zapis #{a.Id}" : $"bekor qilindi #{a.Id}", chats, text, TelegramMessages.Keyboard(a.Id, a.Status), ct);
    }

    /// <summary>Zapisga 2 soat qolganda ustaga. Shu oyna ichida yaratilgan zapisga yuborilmaydi — yangi zapis xabari yetarli.</summary>
    public async Task SendRemindersAsync(CancellationToken ct)
    {
        var lead = options.Value.ReminderLead;
        var now = clock.UtcNow;
        var until = now + lead;
        var due = await db.Appointments.Include(a => a.Barber).Include(a => a.Service)
            .Where(a => a.ReminderSentAt == null && a.StartUtc > now && a.StartUtc <= until
                        && (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed))
            .ToListAsync(ct);
        if (due.Count == 0) return;

        foreach (var a in due)
        {
            a.ReminderSentAt = now;
            if (a.CreatedAt > a.StartUtc - lead) continue;
            var chats = await accounts.ChatIdsAsync(a.BarberId, includeAdmins: false, exceptUserId: null, ct);
            await SendAsync($"eslatma #{a.Id}", chats, TelegramMessages.Card(ToCard(a), CardKind.Reminder), TelegramMessages.Keyboard(a.Id, a.Status), ct);
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Kechki hisobot — kunning eng kech ish tugash vaqtidan 30 daqiqa keyin, kuniga bir marta.
    /// Kecha ham tekshiriladi: ish yarim tundan keyin tugasa hisobot ertasi kuni yuboriladi.
    /// </summary>
    public async Task SendDailyReportIfDueAsync(CancellationToken ct)
    {
        var settings = await db.SiteSettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (settings is null) return;

        var today = clock.Today;
        var nowLocal = clock.ToLocal(clock.UtcNow).DateTime;
        // Birinchi ishga tushishda o'tgan kunlar uchun hisobot yuborilmaydi
        var last = settings.LastReportDate ?? today.AddDays(-1);

        foreach (var date in new[] {today.AddDays(-1), today})
        {
            if (date <= last) continue;
            var hours = await db.Barbers.Where(b => b.IsActive)
                .SelectMany(b => b.WorkingHours)
                .Where(h => h.DayOfWeek == date.DayOfWeek)
                .Select(h => new {h.End, h.IsDayOff})
                .ToListAsync(ct);
            var at = TelegramMessages.ReportTime(date, hours.Select(h => (h.End, h.IsDayOff)));
            if (at is null || nowLocal < at) continue;

            var (start, end) = clock.DayRangeUtc(date);
            var rows = await db.Appointments.Where(a => a.StartUtc >= start && a.StartUtc < end)
                .Select(a => new ReportRow(a.Barber.Name, a.Status, a.Price))
                .ToListAsync(ct);
            await SendAsync($"kechki hisobot {date:dd.MM}", await accounts.AdminChatIdsAsync(ct), TelegramMessages.DailyReport(date, rows), null, ct);

            settings.LastReportDate = date;
            last = date;
            await db.SaveChangesAsync(ct);
        }
    }

    public Task<Appointment?> LoadAsync(int id, CancellationToken ct) =>
        db.Appointments.Include(a => a.Barber).Include(a => a.Service).FirstOrDefaultAsync(a => a.Id == id, ct);

    public AppointmentCard ToCard(Appointment a) => new(
        a.Id, a.ClientName, a.ClientPhone, a.Service.Name.Uz, a.Barber.Name,
        clock.ToLocal(a.StartUtc).DateTime, clock.ToLocal(a.EndUtc).DateTime, a.Price, a.Comment, a.Status);

    private async Task SendAsync(string what, IReadOnlyCollection<long> chats, string text, InlineKeyboardMarkup? keyboard, CancellationToken ct)
    {
        var sent = 0;
        foreach (var chat in chats)
        {
            try
            {
                await bot.SendMessage(chat, text, parseMode: ParseMode.Html, replyMarkup: keyboard, cancellationToken: ct);
                sent++;
            }
            catch (RequestException ex)
            {
                // Xodim botni bloklagan yoki tarmoq xatosi — boshqalarga yuborish davom etadi
                logger.LogWarning("Telegram: {Chat} ga yuborilmadi: {Error}", chat, ex.Message);
            }
        }
        logger.LogInformation("Bot yubordi: {What} → {Sent}/{Total} chat", what, sent, chats.Count);
    }
}
