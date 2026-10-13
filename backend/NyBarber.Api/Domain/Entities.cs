namespace NyBarber.Api.Domain;

/// <summary>Bazada uch tilda saqlanadigan matn.</summary>
public class LocalizedText
{
    public string Uz { get; set; } = "";
    public string Ru { get; set; } = "";
    public string En { get; set; } = "";

    public LocalizedText() { }
    public LocalizedText(string uz, string ru, string en) => (Uz, Ru, En) = (uz, ru, en);
}

public enum UserRole
{
    Admin = 0,
    Barber = 1,
}

public enum AppointmentStatus
{
    Pending = 0,
    Confirmed = 1,
    Completed = 2,
    Cancelled = 3,
    NoShow = 4,
}

public class User
{
    public int Id { get; set; }
    public string Login { get; set; } = "";
    public string? Email { get; set; }
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; }
    public int? BarberId { get; set; }
    public Barber? Barber { get; set; }
    /// <summary>Admin kiritgan Telegram username (kichik harflarda, @ siz). Bot/Mini App orqali birinchi kirishda TelegramUserId bog'lanadi.</summary>
    public string? TelegramUsername { get; set; }
    /// <summary>Bog'langan Telegram akkaunt ID (shaxsiy chat ID ham shu).</summary>
    public long? TelegramUserId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Barber
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public LocalizedText Title { get; set; } = new();
    public LocalizedText Bio { get; set; } = new();
    public string? PhotoUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public List<BarberService> Services { get; set; } = [];
    public List<WorkingHours> WorkingHours { get; set; } = [];
    public List<TimeOff> TimeOffs { get; set; } = [];
}

public class Service
{
    public int Id { get; set; }
    public LocalizedText Name { get; set; } = new();
    public LocalizedText Description { get; set; } = new();
    public decimal Price { get; set; }
    public int DurationMinutes { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public List<BarberService> Barbers { get; set; } = [];
}

/// <summary>Qaysi usta qaysi xizmatni bajaradi.</summary>
public class BarberService
{
    public int BarberId { get; set; }
    public Barber Barber { get; set; } = null!;
    public int ServiceId { get; set; }
    public Service Service { get; set; } = null!;
}

/// <summary>Ustaning haftalik ish jadvali (mahalliy vaqt, Asia/Tashkent).</summary>
public class WorkingHours
{
    public int Id { get; set; }
    public int BarberId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly Start { get; set; }
    public TimeOnly End { get; set; }
    public bool IsDayOff { get; set; }
}

/// <summary>Ta'til, kasallik va boshqa ishlamaydigan vaqtlar.</summary>
public class TimeOff
{
    public int Id { get; set; }
    public int BarberId { get; set; }
    public DateTimeOffset FromUtc { get; set; }
    public DateTimeOffset ToUtc { get; set; }
    public string? Reason { get; set; }
}

public class Appointment
{
    public int Id { get; set; }
    public int BarberId { get; set; }
    public Barber Barber { get; set; } = null!;
    public int ServiceId { get; set; }
    public Service Service { get; set; } = null!;
    public string ClientName { get; set; } = "";
    public string ClientPhone { get; set; } = "";
    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset EndUtc { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Pending;
    /// <summary>Zapis paytidagi narx — keyin xizmat narxi o'zgarsa ham saqlanib qoladi.</summary>
    public decimal Price { get; set; }
    public string? Comment { get; set; }
    public string Language { get; set; } = "uz";
    /// <summary>Ustaga "2 soat qoldi" eslatmasi yuborilgan vaqt (takror yuborilmasligi uchun).</summary>
    public DateTimeOffset? ReminderSentAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class GalleryImage
{
    public int Id { get; set; }
    public string Url { get; set; } = "";
    public LocalizedText Caption { get; set; } = new();
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Review
{
    public int Id { get; set; }
    public string AuthorName { get; set; } = "";
    public int Rating { get; set; }
    public string Text { get; set; } = "";
    public bool IsPublished { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Sayt sozlamalari — bitta qator (Id = 1).</summary>
public class SiteSettings
{
    public int Id { get; set; } = 1;
    public string BusinessName { get; set; } = "";
    public LocalizedText Address { get; set; } = new();
    public string Phone { get; set; } = "";
    public string? Telegram { get; set; }
    public string? Instagram { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double Rating { get; set; }
    public int RatingCount { get; set; }
    /// <summary>Bo'sh vaqtlar qadami, daqiqa.</summary>
    public int SlotStepMinutes { get; set; } = 15;
    /// <summary>Hozirdan necha daqiqa keyingi vaqtga yozilish mumkin.</summary>
    public int MinLeadMinutes { get; set; } = 30;
    /// <summary>Necha kun oldinga yozilish mumkin.</summary>
    public int BookingHorizonDays { get; set; } = 14;
    /// <summary>Kechki hisobot oxirgi marta qaysi kun uchun yuborilgan (Telegram).</summary>
    public DateOnly? LastReportDate { get; set; }
}
