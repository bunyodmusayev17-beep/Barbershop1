using Microsoft.Extensions.Options;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace NyBarber.Api.Features.Telegram;

/// <summary>
/// Botning fon ishlari (faqat token sozlanganda ishga tushadi):
/// 1) long polling — xabar va tugmalarni qabul qilish (public URL kerak emas);
/// 2) zapis hodisalari navbatidan xabar yuborish;
/// 3) har daqiqada — ustalarga eslatma va kechki hisobot.
/// </summary>
public class TelegramWorker(
    ITelegramBotClient bot,
    TelegramNotifier notifier,
    IServiceScopeFactory scopes,
    IOptions<TelegramOptions> options,
    ILogger<TelegramWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await SetupAsync(ct);
        await Task.WhenAll(PollAsync(ct), SendEventsAsync(ct), ScheduleAsync(ct));
    }

    /// <summary>Bot buyruqlari va "Ochish" (Mini App) menyu tugmasi — BotFather'da qo'lda sozlash shart emas.</summary>
    private async Task SetupAsync(CancellationToken ct)
    {
        try
        {
            var me = await bot.GetMe(ct);
            await bot.DeleteWebhook(cancellationToken: ct);
            await bot.SetMyCommands([new BotCommand {Command = "start", Description = "Boshlash"}], cancellationToken: ct);
            if (!string.IsNullOrEmpty(options.Value.MiniAppUrl))
                await bot.SetChatMenuButton(menuButton: new MenuButtonWebApp {Text = "Ochish", WebApp = new WebAppInfo(options.Value.MiniAppUrl)}, cancellationToken: ct);
            logger.LogInformation("Telegram bot ishga tushdi: @{Username}", me.Username);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Telegram bot sozlanmadi (token to'g'rimi?)");
        }
    }

    private async Task PollAsync(CancellationToken ct)
    {
        int? offset = null;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var updates = await bot.GetUpdates(offset, timeout: 30,
                    allowedUpdates: [UpdateType.Message, UpdateType.CallbackQuery], cancellationToken: ct);
                foreach (var update in updates)
                {
                    offset = update.Id + 1;
                    await RunScopedAsync("update", (sp, t) => sp.GetRequiredService<TelegramUpdateHandler>().HandleAsync(update, t), ct);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogWarning("Telegram polling xatosi: {Error}", ex.Message);
                await Delay(TimeSpan.FromSeconds(5), ct);
            }
        }
    }

    private async Task SendEventsAsync(CancellationToken ct)
    {
        try
        {
            await foreach (var e in notifier.Reader.ReadAllAsync(ct))
                await RunScopedAsync("event", (sp, t) => sp.GetRequiredService<TelegramNotifications>().HandleEventAsync(e, t), ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
    }

    private async Task ScheduleAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            await RunScopedAsync("reminders", (sp, t) => sp.GetRequiredService<TelegramNotifications>().SendRemindersAsync(t), ct);
            await RunScopedAsync("report", (sp, t) => sp.GetRequiredService<TelegramNotifications>().SendDailyReportIfDueAsync(t), ct);
        } while (await Tick(timer, ct));
    }

    /// <summary>Har bir ish alohida DI scope'da (DbContext) — bittasining xatosi boshqalarini to'xtatmaydi.</summary>
    private async Task RunScopedAsync(string name, Func<IServiceProvider, CancellationToken, Task> work, CancellationToken ct)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            await work(scope.ServiceProvider, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Telegram: {Work} bajarilmadi", name);
        }
    }

    private static async Task<bool> Tick(PeriodicTimer timer, CancellationToken ct)
    {
        try { return await timer.WaitForNextTickAsync(ct); }
        catch (OperationCanceledException) { return false; }
    }

    private static async Task Delay(TimeSpan delay, CancellationToken ct)
    {
        try { await Task.Delay(delay, ct); }
        catch (OperationCanceledException) { }
    }
}
