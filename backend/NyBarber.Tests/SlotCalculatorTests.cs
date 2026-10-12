using NyBarber.Api.Features.Booking;

namespace NyBarber.Tests;

public class SlotCalculatorTests
{
    private static readonly TimeZoneInfo Tashkent = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tashkent");
    private static readonly DateOnly Day = new(2026, 10, 20);

    /// <summary>Toshkent vaqtini (UTC+5) UTC'ga o'girib beradi.</summary>
    private static DateTimeOffset Local(int hour, int minute = 0) =>
        new DateTimeOffset(2026, 10, 20, hour, minute, 0, TimeSpan.FromHours(5)).ToUniversalTime();

    private static List<string> Run(int duration = 45, int step = 15, WorkWindow? window = null,
        BusyRange[]? busy = null, DateTimeOffset? earliest = null)
    {
        var starts = SlotCalculator.FreeStarts(new SlotQuery(
            Day,
            window ?? new WorkWindow(new TimeOnly(11, 0), new TimeOnly(13, 0)),
            busy ?? [],
            duration,
            step,
            earliest ?? DateTimeOffset.MinValue,
            Tashkent));
        return starts.Select(s => TimeZoneInfo.ConvertTime(s, Tashkent).ToString("HH:mm")).ToList();
    }

    [Fact]
    public void Empty_day_fills_window_with_steps_and_service_fits_before_closing()
    {
        // 11:00–13:00, 45 daqiqa: oxirgi boshlanish 12:15 (12:15 + 45 = 13:00)
        Assert.Equal(["11:00", "11:15", "11:30", "11:45", "12:00", "12:15"], Run());
    }

    [Fact]
    public void Day_off_has_no_slots()
    {
        var starts = SlotCalculator.FreeStarts(new SlotQuery(Day, null, [], 45, 15, DateTimeOffset.MinValue, Tashkent));
        Assert.Empty(starts);
    }

    [Fact]
    public void Existing_appointment_blocks_every_overlapping_start()
    {
        // 11:30–12:15 band. 45 daqiqalik xizmat: 11:00 (11:45 gacha) kesishadi, 12:15 dan boshlab bo'sh.
        var result = Run(busy: [new BusyRange(Local(11, 30), Local(12, 15))]);
        Assert.Equal(["12:15"], result);
    }

    [Fact]
    public void Back_to_back_booking_is_allowed()
    {
        // 11:00–11:45 band -> 11:45 da boshlash mumkin (oraliqlar [start, end) — chegarada kesishmaydi)
        var result = Run(busy: [new BusyRange(Local(11, 0), Local(11, 45))]);
        Assert.Contains("11:45", result);
        Assert.DoesNotContain("11:30", result);
    }

    [Fact]
    public void Starts_before_earliest_allowed_time_are_skipped()
    {
        var result = Run(earliest: Local(11, 40));
        Assert.Equal(["11:45", "12:00", "12:15"], result);
    }

    [Fact]
    public void Time_off_blocks_like_an_appointment()
    {
        var result = Run(duration: 30, busy: [new BusyRange(Local(11, 0), Local(12, 30))]);
        Assert.Equal(["12:30"], result);
    }

    [Fact]
    public void Service_longer_than_window_gives_no_slots()
    {
        Assert.Empty(Run(duration: 180));
    }

    [Fact]
    public void Invalid_window_gives_no_slots()
    {
        Assert.Empty(Run(window: new WorkWindow(new TimeOnly(15, 0), new TimeOnly(11, 0))));
    }

    [Fact]
    public void Utc_conversion_uses_tashkent_offset()
    {
        var utc = SlotCalculator.ToUtc(Day, new TimeOnly(11, 0), Tashkent);
        Assert.Equal(new DateTimeOffset(2026, 10, 20, 6, 0, 0, TimeSpan.Zero), utc);
    }
}
