using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Telegram;
using Microsoft.Extensions.Options;

namespace NyBarber.Api.Features.Auth;

public record LoginRequest([Required, MaxLength(64)] string Login, [Required, MaxLength(128)] string Password);

public record UserDto(int Id, string Login, string Role, int? BarberId, string? BarberName);

public record LoginResponse(string Token, DateTimeOffset ExpiresAt, UserDto User);

public record TelegramLoginRequest([Required, MaxLength(4096)] string InitData);

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens, ILogger<AuthController> logger) : ControllerBase
{
    private static readonly PasswordHasher<User> Hasher = new();

    [HttpPost("login")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req, CancellationToken ct)
    {
        var login = req.Login.Trim().ToLowerInvariant();
        var user = await db.Users.Include(u => u.Barber).FirstOrDefaultAsync(u => u.Login == login, ct);

        // Login topilmasa ham, parol noto'g'ri bo'lsa ham bir xil javob (logda — sababi, parol hech qachon yozilmaydi)
        if (user is null || !user.IsActive)
        {
            logger.LogWarning("Kirish xato: \"{Login}\" ({Reason}), IP {Ip}", Short(login), user is null ? "login yo'q" : "bloklangan", Ip());
            return Problem(title: "Login yoki parol noto'g'ri", statusCode: StatusCodes.Status401Unauthorized);
        }

        var result = Hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            logger.LogWarning("Kirish xato: \"{Login}\" (parol noto'g'ri), IP {Ip}", user.Login, Ip());
            return Problem(title: "Login yoki parol noto'g'ri", statusCode: StatusCodes.Status401Unauthorized);
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = Hasher.HashPassword(user, req.Password);
            await db.SaveChangesAsync(ct);
        }

        logger.LogInformation("Kirish: {Login} ({Role}) parol bilan, IP {Ip}", user.Login, user.Role, Ip());
        var (token, expires) = tokens.Create(user);
        return new LoginResponse(token, expires, ToDto(user));
    }

    /// <summary>
    /// Mini App'dan parolsiz kirish: Telegram imzolagan initData tekshiriladi. Xodim bo'lsa — token,
    /// oddiy mijoz bo'lsa — 204 (sayt ommaviy rejimda qoladi).
    /// </summary>
    [HttpPost("telegram")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<LoginResponse>> TelegramLogin(TelegramLoginRequest req, [FromServices] IOptions<TelegramOptions> telegram,
        [FromServices] TelegramAccounts accounts, [FromServices] TimeProvider time, CancellationToken ct)
    {
        if (!telegram.Value.Enabled) return NoContent();
        var tg = TelegramInitData.Validate(req.InitData, telegram.Value.BotToken, time.GetUtcNow());
        if (tg is null)
        {
            logger.LogWarning("Mini App: yaroqsiz Telegram imzosi, IP {Ip}", Ip());
            return Problem(title: "Telegram ma'lumoti yaroqsiz", statusCode: StatusCodes.Status401Unauthorized);
        }

        var user = await accounts.FindOrBindAsync(tg.Id, tg.Username, ct);
        logger.LogInformation("Mini App ochildi: {TgId} @{Username} → {Who}", tg.Id, tg.Username ?? "-", user is null ? "mijoz" : $"xodim {user.Login}");
        if (user is null) return NoContent();
        var (token, expires) = tokens.Create(user);
        return new LoginResponse(token, expires, ToDto(user));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        if (User.UserId() is not { } id) return Unauthorized();
        var user = await db.Users.Include(u => u.Barber).FirstOrDefaultAsync(u => u.Id == id && u.IsActive, ct);
        return user is null ? Unauthorized() : ToDto(user);
    }

    private string Ip() => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "?";

    private static string Short(string s) => s.Length <= 30 ? s : s[..30] + "…";

    internal static UserDto ToDto(User u) => new(u.Id, u.Login, u.Role.ToString(), u.BarberId, u.Barber?.Name);
}
