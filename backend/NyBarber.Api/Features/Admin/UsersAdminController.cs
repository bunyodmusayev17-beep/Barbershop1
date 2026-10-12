using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;
using NyBarber.Api.Features.Auth;

namespace NyBarber.Api.Features.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = Policies.Admin)]
public class UsersAdminController(AppDbContext db) : ControllerBase
{
    private static readonly PasswordHasher<User> Hasher = new();

    [HttpGet]
    public async Task<List<UserAdminDto>> List(CancellationToken ct) =>
        (await db.Users.AsNoTracking().Include(u => u.Barber).OrderBy(u => u.Role).ThenBy(u => u.Login).ToListAsync(ct))
        .Select(u => u.ToDto()).ToList();

    [HttpPost]
    public async Task<ActionResult<UserAdminDto>> Create(UserCreate input, CancellationToken ct)
    {
        var login = input.Login.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Login == login, ct)) return Conflict(new ProblemDetails {Title = "Bu login band"});
        var barberError = await ValidateBarber(input.Role, input.BarberId, ct);
        if (barberError is not null) return ValidationProblem(barberError);

        var user = new User
        {
            Login = login,
            Email = string.IsNullOrWhiteSpace(input.Email) ? null : input.Email.Trim(),
            Role = input.Role,
            BarberId = input.Role == UserRole.Barber ? input.BarberId : null,
        };
        user.PasswordHash = Hasher.HashPassword(user, input.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        await db.Entry(user).Reference(u => u.Barber).LoadAsync(ct);
        return StatusCode(StatusCodes.Status201Created, user.ToDto());
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserAdminDto>> Update(int id, UserUpdate input, CancellationToken ct)
    {
        var user = await db.Users.Include(u => u.Barber).FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        var barberError = await ValidateBarber(input.Role, input.BarberId, ct);
        if (barberError is not null) return ValidationProblem(barberError);

        // O'zini admin rolidan chiqarib yoki o'chirib qo'yib, tizimni adminsiz qoldirmaslik
        var isSelf = User.UserId() == id;
        if (isSelf && (input.Role != UserRole.Admin || !input.IsActive))
            return ValidationProblem("O'z akkauntingizni adminlikdan chiqarib yoki o'chirib bo'lmaydi");

        user.Email = string.IsNullOrWhiteSpace(input.Email) ? null : input.Email.Trim();
        user.Role = input.Role;
        user.BarberId = input.Role == UserRole.Barber ? input.BarberId : null;
        user.IsActive = input.IsActive;
        if (!string.IsNullOrEmpty(input.NewPassword)) user.PasswordHash = Hasher.HashPassword(user, input.NewPassword);
        await db.SaveChangesAsync(ct);
        await db.Entry(user).Reference(u => u.Barber).LoadAsync(ct);
        return user.ToDto();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (User.UserId() == id) return ValidationProblem("O'z akkauntingizni o'chirib bo'lmaydi");
        var user = await db.Users.FindAsync([id], ct);
        if (user is null) return NotFound();
        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<string?> ValidateBarber(UserRole role, int? barberId, CancellationToken ct)
    {
        if (role != UserRole.Barber) return null;
        if (barberId is null) return "Usta akkaunti uchun ustani tanlang";
        return await db.Barbers.AnyAsync(b => b.Id == barberId, ct) ? null : "Usta topilmadi";
    }
}
