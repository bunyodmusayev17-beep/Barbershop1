using System.Net;
using Microsoft.Extensions.Options;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Booking;
using Telegram.Bot;
using Telegram.Bot.Types;
using User = Telegram.Bot.Types.User;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace NyBarber.Api.Features.Telegram;

/// <summary>Botga kelgan xabarlar (/start — bog'lash) va zapis tugmalari (keldi/kelmadi/bekor/qo'ng'iroq).</summary>
public class TelegramUpdateHandler(
    AppDbContext db,
    ITelegramBotClient bot,
    TelegramAccounts accounts,
    TelegramNotifications notifications,
    TelegramNotifier notifier,
    BusinessClock clock,
    IOptions<TelegramOptions> options,
    ILogger<TelegramUpdateHandler> logger)
{
    public Task HandleAsync(Update update, CancellationToken ct) => update switch
    {
        {CallbackQuery: { } q} => OnCallbackAsync(q, ct),
        {Message: {From: { } from, Chat.Type: ChatType.Private} m} => OnMessageAsync(m, from, ct),
        _ => Task.CompletedTask,
    };

    private async Task OnMessageAsync(Message m, User from, CancellationToken ct)
    {
        var staff = await accounts.FindOrBindAsync(from.Id, from.Username, ct);
        logger.LogInformation("Bot xabar: {TgId} @{Username} \"{Text}\" → {Who}",
            from.Id, from.Username ?? "-", Short(m.Text), staff is null ? "mijoz/notanish" : $"xodim {staff.Login}");
        string text;
        if (staff is not null)
        {
            var role = staff.Role == UserRole.Admin ? "admin" : $"usta ({WebUtility.HtmlEncode(staff.Barber?.Name)})";
            text = $"Salom! Siz <b>{staff.Login}</b> — {role} sifatida ulangansiz ✅\n\n"
                   + (staff.Role == UserRole.Admin
                       ? "Yangi zapislar va kechki hisobot shu yerga keladi."
                       : "Yangi zapislaringiz va 2 soat oldin eslatma shu yerga keladi.")
                   + "\nPanelni pastdagi <b>Ochish</b> tugmasi orqali ochasiz.";
        }
        else
        {
            text = "Assalomu alaykum! <b>New York Barbershop</b> 💈\n\nOnlayn zapis uchun pastdagi tugmani bosing."
                   + $"\n\n<i>Xodim bo'lsangiz, adminga Telegram ID'ingizni bering: <code>{from.Id}</code></i>";
        }

        var url = options.Value.MiniAppUrl;
        var keyboard = string.IsNullOrEmpty(url) ? null
            : new InlineKeyboardMarkup(InlineKeyboardButton.WithWebApp(staff is null ? "✂️ Zapis qilish" : "Ochish", new WebAppInfo(url)));
        await bot.SendMessage(m.Chat.Id, text, parseMode: ParseMode.Html, replyMarkup: keyboard, cancellationToken: ct);
    }

    private async Task OnCallbackAsync(CallbackQuery q, CancellationToken ct)
    {
        var result = await HandleCallbackAsync(q, ct);
        logger.LogInformation("Bot tugma: {TgId} @{Username} \"{Data}\" → {Result}", q.From.Id, q.From.Username ?? "-", q.Data, result);
    }

    /// <summary>Tugmani bajaradi va log uchun natijani qaytaradi.</summary>
    private async Task<string> HandleCallbackAsync(CallbackQuery q, CancellationToken ct)
    {
        var user = await accounts.FindOrBindAsync(q.From.Id, q.From.Username, ct);
        if (user is null || q.Message is not { } msg || !TelegramMessages.TryParseCallback(q.Data, out var id, out var action))
        {
            await Answer(q, "Ruxsat yo'q", ct);
            return user is null ? "rad etildi: xodim emas" : "rad etildi: noto'g'ri tugma";
        }

        var a = await notifications.LoadAsync(id, ct);
        if (a is null)
        {
            await Answer(q, "Zapis topilmadi", ct);
            return $"{user.Login}: #{id} topilmadi";
        }
        // Usta faqat o'z zapislarini boshqaradi
        if (user.Role != UserRole.Admin && a.BarberId != user.BarberId)
        {
            await Answer(q, "Bu zapis sizniki emas", ct);
            return $"{user.Login}: #{a.Id} rad etildi (boshqa ustaning zapisi)";
        }

        switch (action)
        {
            case TelegramMessages.Call:
                await bot.SendContact(msg.Chat.Id, a.ClientPhone, a.ClientName, cancellationToken: ct);
                await Answer(q, null, ct);
                return $"{user.Login}: #{a.Id} mijoz kontakti yuborildi";

            case TelegramMessages.Cancel when !TelegramMessages.IsFinal(a.Status):
                await bot.EditMessageReplyMarkup(msg.Chat.Id, msg.Id, TelegramMessages.CancelConfirmKeyboard(a.Id), cancellationToken: ct);
                await Answer(q, null, ct);
                return $"{user.Login}: #{a.Id} bekor qilish tasdig'i so'raldi";

            case TelegramMessages.CancelNo:
                await bot.EditMessageReplyMarkup(msg.Chat.Id, msg.Id, TelegramMessages.Keyboard(a.Id, a.Status), cancellationToken: ct);
                await Answer(q, null, ct);
                return $"{user.Login}: #{a.Id} bekor qilinmadi";
        }

        var target = action switch
        {
            TelegramMessages.Done => AppointmentStatus.Completed,
            TelegramMessages.NoShow => AppointmentStatus.NoShow,
            TelegramMessages.Cancel or TelegramMessages.CancelYes => AppointmentStatus.Cancelled,
            _ => (AppointmentStatus?)null,
        };
        if (target is null)
        {
            await Answer(q, null, ct);
            return $"{user.Login}: #{a.Id} noma'lum amal";
        }

        if (TelegramMessages.IsFinal(a.Status))
        {
            await Answer(q, $"Holati allaqachon: {TelegramMessages.StatusLabel(a.Status)}", ct, alert: true);
            await RefreshAsync(msg, a, null, ct);
            return $"{user.Login}: #{a.Id} holati allaqachon {a.Status}";
        }
        if (target != AppointmentStatus.Cancelled && a.StartUtc > clock.UtcNow)
        {
            await Answer(q, "Hali vaqti kelmagan — zapis boshlangandan keyin belgilang", ct, alert: true);
            return $"{user.Login}: #{a.Id} hali vaqti kelmagan";
        }

        a.Status = target.Value;
        await db.SaveChangesAsync(ct);
        if (target == AppointmentStatus.Cancelled) notifier.Publish(new BotEvent(BotEventKind.Cancelled, a.Id, user.Id));

        await RefreshAsync(msg, a, $"{user.Login}, {clock.ToLocal(clock.UtcNow):HH:mm}", ct);
        await Answer(q, TelegramMessages.StatusLabel(a.Status), ct);
        return $"{user.Login}: #{a.Id} → {a.Status}";
    }

    /// <summary>Log uchun matnni qisqartirish (uzun xabarlar logni to'ldirmasin).</summary>
    private static string Short(string? s) => s is null ? "" : s.Length <= 60 ? s : s[..60] + "…";

    private Task RefreshAsync(Message msg, Appointment a, string? footer, CancellationToken ct) =>
        bot.EditMessageText(msg.Chat.Id, msg.Id, TelegramMessages.Card(notifications.ToCard(a), CardKind.Updated, footer),
            parseMode: ParseMode.Html, replyMarkup: TelegramMessages.Keyboard(a.Id, a.Status), cancellationToken: ct);

    private Task Answer(CallbackQuery q, string? text, CancellationToken ct, bool alert = false) =>
        bot.AnswerCallbackQuery(q.Id, text, showAlert: alert, cancellationToken: ct);
}
