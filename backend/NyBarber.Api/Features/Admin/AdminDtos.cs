using System.ComponentModel.DataAnnotations;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Features.Admin;

// --- Zapislar ---
public record AppointmentDto(
    int Id, int BarberId, string BarberName, int ServiceId, LocalizedText ServiceName,
    string ClientName, string ClientPhone, string Date, string Time, string EndTime,
    string Status, decimal Price, string? Comment, string Language, DateTimeOffset CreatedAt);

public record StatusUpdate([Required] AppointmentStatus Status);

public record StaffBookingRequest(
    [Required] int ServiceId,
    [Required] int BarberId,
    [Required] DateOnly Date,
    [Required] TimeOnly Time,
    [Required, MaxLength(100)] string ClientName,
    [Required, MaxLength(32)] string ClientPhone,
    [MaxLength(500)] string? Comment);

// --- Statistika ---
public record DayStat(string Date, int Count, decimal Revenue);
public record BarberStat(int BarberId, string Name, int TodayCount, int WeekCount, decimal WeekRevenue);
public record StatsDto(
    int TodayCount, decimal TodayRevenue, int WeekCount, decimal WeekRevenue,
    int UpcomingCount, int NoShowWeek, List<DayStat> Last7Days, List<BarberStat> Barbers,
    List<AppointmentDto> NextUp);

// --- Xizmatlar ---
public record ServiceAdminDto(int Id, LocalizedText Name, LocalizedText Description, decimal Price, int DurationMinutes,
    int SortOrder, bool IsActive, List<int> BarberIds);

public record ServiceInput(
    [Required] LocalizedText Name,
    LocalizedText? Description,
    [Range(0, 100_000_000)] decimal Price,
    [Range(5, 600)] int DurationMinutes,
    int SortOrder,
    bool IsActive,
    List<int>? BarberIds);

// --- Ustalar ---
public record HoursDto(DayOfWeek Day, string Start, string End, bool IsDayOff);
public record TimeOffDto(int Id, string From, string To, string? Reason);

public record BarberAdminDto(int Id, string Name, LocalizedText Title, LocalizedText Bio, string? PhotoUrl, int SortOrder,
    bool IsActive, List<int> ServiceIds, List<HoursDto> Hours, List<TimeOffDto> TimeOffs);

public record BarberInput(
    [Required, MaxLength(100)] string Name,
    LocalizedText? Title,
    LocalizedText? Bio,
    int SortOrder,
    bool IsActive,
    List<int>? ServiceIds,
    List<HoursDto>? Hours);

/// <summary>From/To — mahalliy vaqt, "yyyy-MM-ddTHH:mm".</summary>
public record TimeOffInput([Required] DateTime From, [Required] DateTime To, [MaxLength(200)] string? Reason);

// --- Galereya, sharhlar ---
public record GalleryAdminDto(int Id, string Url, LocalizedText Caption, int SortOrder);
public record GalleryUpdate(LocalizedText? Caption, int SortOrder);

public record ReviewAdminDto(int Id, string AuthorName, int Rating, string Text, bool IsPublished, DateTimeOffset CreatedAt);
public record ReviewInput([Required, MaxLength(100)] string AuthorName, [Range(1, 5)] int Rating, [Required, MaxLength(1000)] string Text, bool IsPublished);

// --- Foydalanuvchilar ---
public record UserAdminDto(int Id, string Login, string? Email, string Role, int? BarberId, string? BarberName, bool IsActive, DateTimeOffset CreatedAt);
public record UserCreate(
    [Required, RegularExpression("^[a-zA-Z0-9_.-]{3,64}$")] string Login,
    [EmailAddress, MaxLength(256)] string? Email,
    [Required, MinLength(8), MaxLength(128)] string Password,
    [Required] UserRole Role,
    int? BarberId);
public record UserUpdate(
    [EmailAddress, MaxLength(256)] string? Email,
    [Required] UserRole Role,
    int? BarberId,
    bool IsActive,
    [MinLength(8), MaxLength(128)] string? NewPassword);

// --- Sozlamalar ---
public record SettingsDto(
    [Required, MaxLength(100)] string BusinessName,
    [Required] LocalizedText Address,
    [Required, MaxLength(32)] string Phone,
    [MaxLength(64)] string? Telegram,
    [MaxLength(64)] string? Instagram,
    [Range(-90, 90)] double Latitude,
    [Range(-180, 180)] double Longitude,
    [Range(0, 5)] double Rating,
    [Range(0, 1_000_000)] int RatingCount,
    [Range(5, 120)] int SlotStepMinutes,
    [Range(0, 1440)] int MinLeadMinutes,
    [Range(1, 90)] int BookingHorizonDays);
