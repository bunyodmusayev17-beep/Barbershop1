using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Features.Auth;

public record LoginRequest([Required, MaxLength(64)] string Login, [Required, MaxLength(128)] string Password);

public record UserDto(int Id, string Login, string Role, int? BarberId, string? BarberName);

public record LoginResponse(string Token, DateTimeOffset ExpiresAt, UserDto User);

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens) : ControllerBase
{
    private static readonly PasswordHasher<User> Hasher = new();

    [HttpPost("login")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req, CancellationToken ct)
    {
        var login = req.Login.Trim().ToLowerInvariant();
        var user = await db.Users.Include(u => u.Barber).FirstOrDefaultAsync(u => u.Login == login, ct);

        // Login topilmasa ham, parol noto'g'ri bo'lsa ham bir xil javob
        if (user is null || !user.IsActive)
            return Problem(title: "Login yoki parol noto'g'ri", statusCode: StatusCodes.Status401Unauthorized);

        var result = Hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
            return Problem(title: "Login yoki parol noto'g'ri", statusCode: StatusCodes.Status401Unauthorized);

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = Hasher.HashPassword(user, req.Password);
            await db.SaveChangesAsync(ct);
        }

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

    internal static UserDto ToDto(User u) => new(u.Id, u.Login, u.Role.ToString(), u.BarberId, u.Barber?.Name);
}
