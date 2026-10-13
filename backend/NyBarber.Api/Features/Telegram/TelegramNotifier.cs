using System.Threading.Channels;
using Microsoft.Extensions.Options;

namespace NyBarber.Api.Features.Telegram;

public enum BotEventKind { Created, Cancelled }

/// <param name="ActorUserId">Amalni bajargan xodim (unga xabar yuborilmaydi); mijoz saytdan qilgan bo'lsa — null.</param>
public record BotEvent(BotEventKind Kind, int AppointmentId, int? ActorUserId = null);

/// <summary>
/// Zapis hodisalari navbati. Publish darhol qaytadi — Telegram sekin ishlasa yoki xato bersa ham
/// zapis yaratish/bekor qilish so'rovi kutmaydi va buzilmaydi. Xabarlarni <see cref="TelegramWorker"/> yuboradi.
/// </summary>
public class TelegramNotifier(IOptions<TelegramOptions> options)
{
    private readonly Channel<BotEvent> _channel = Channel.CreateBounded<BotEvent>(
        new BoundedChannelOptions(1000) {FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true});

    public ChannelReader<BotEvent> Reader => _channel.Reader;

    public void Publish(BotEvent e)
    {
        if (options.Value.Enabled) _channel.Writer.TryWrite(e);
    }
}
