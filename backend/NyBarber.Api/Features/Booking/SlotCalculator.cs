namespace NyBarber.Api.Features.Booking;

/// <summary>Band vaqt oralig'i (UTC), [Start, End).</summary>
public readonly record struct BusyRange(DateTimeOffset Start, DateTimeOffset End);

/// <summary>Bir ustaning bir kundagi ish oynasi (mahalliy vaqt).</summary>
public readonly record struct WorkWindow(TimeOnly Start, TimeOnly End);

public record SlotQuery(
    DateOnly Date,
    WorkWindow? Window,
    IReadOnlyList<BusyRange> Busy,
    int DurationMinutes,
    int StepMinutes,
    DateTimeOffset EarliestStartUtc,
    TimeZoneInfo Zone);

/// <summary>
/// Bo'sh vaqtlarni hisoblovchi sof funksiya (bazaga bog'liq emas, shuning uchun test qilish oson).
/// Natija: xizmat to'liq sig'adigan va hech qanday band oraliq bilan kesishmaydigan boshlanish vaqtlari (UTC).
/// </summary>
public static class SlotCalculator
{
    public static List<DateTimeOffset> FreeStarts(SlotQuery q)
    {
        var result = new List<DateTimeOffset>();
        if (q.Window is not { } window || q.DurationMinutes <= 0 || q.StepMinutes <= 0) return result;
        if (window.End <= window.Start) return result;

        var dayStartUtc = ToUtc(q.Date, window.Start, q.Zone);
        var dayEndUtc = ToUtc(q.Date, window.End, q.Zone);
        var duration = TimeSpan.FromMinutes(q.DurationMinutes);
        var step = TimeSpan.FromMinutes(q.StepMinutes);

        for (var start = dayStartUtc; start + duration <= dayEndUtc; start += step)
        {
            if (start < q.EarliestStartUtc) continue;
            var end = start + duration;
            if (!Overlaps(start, end, q.Busy)) result.Add(start);
        }
        return result;
    }

    public static bool Overlaps(DateTimeOffset start, DateTimeOffset end, IReadOnlyList<BusyRange> busy)
    {
        foreach (var b in busy)
            if (start < b.End && b.Start < end) return true;
        return false;
    }

    public static DateTimeOffset ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo zone)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, zone.GetUtcOffset(local)).ToUniversalTime();
    }
}
