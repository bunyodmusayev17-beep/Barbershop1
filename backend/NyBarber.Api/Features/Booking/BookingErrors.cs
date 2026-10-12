namespace NyBarber.Api.Features.Booking;

/// <summary>Frontend shu kodlar bo'yicha 3 tilda xabar ko'rsatadi.</summary>
public static class BookingErrors
{
    public const string ServiceNotFound = "service_not_found";
    public const string BarberNotFound = "barber_not_found";
    public const string PhoneInvalid = "phone_invalid";
    public const string NameInvalid = "name_invalid";
    public const string SlotUnavailable = "slot_unavailable";
    public const string SlotTaken = "slot_taken";
    public const string LimitReached = "limit_reached";
}

public class BookingException(string code, int status, string message) : Exception(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}
