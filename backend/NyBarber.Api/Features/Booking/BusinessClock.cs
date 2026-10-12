namespace NyBarber.Api.Features.Booking;

/// <summary>Barbershop vaqt zonasi (Asia/Tashkent) va "hozir".</summary>
public class BusinessClock(TimeProvider time)
{
    public TimeZoneInfo Zone { get; } = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tashkent");

    public DateTimeOffset UtcNow => time.GetUtcNow();

    public DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(UtcNow, Zone).DateTime);

    public DateTimeOffset ToLocal(DateTimeOffset utc) => TimeZoneInfo.ConvertTime(utc, Zone);

    /// <summary>Mahalliy kun chegaralari UTC'da: [boshlanish, keyingi kun boshlanishi).</summary>
    public (DateTimeOffset Start, DateTimeOffset End) DayRangeUtc(DateOnly date) =>
        (SlotCalculator.ToUtc(date, TimeOnly.MinValue, Zone), SlotCalculator.ToUtc(date.AddDays(1), TimeOnly.MinValue, Zone));
}
