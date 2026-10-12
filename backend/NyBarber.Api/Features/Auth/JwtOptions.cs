namespace NyBarber.Api.Features.Auth;

public class JwtOptions
{
    public const string Section = "Jwt";

    public string Issuer { get; set; } = "nybarber";
    public string Audience { get; set; } = "nybarber";
    /// <summary>Kamida 32 bayt (base64). Dev: user-secrets, prod: muhit o'zgaruvchisi.</summary>
    public string Key { get; set; } = "";
    public int ExpiresMinutes { get; set; } = 720;
}

public static class Policies
{
    /// <summary>Faqat admin.</summary>
    public const string Admin = "Admin";
    /// <summary>Admin yoki usta.</summary>
    public const string Staff = "Staff";
}

public static class AppClaims
{
    public const string BarberId = "barber_id";
}
