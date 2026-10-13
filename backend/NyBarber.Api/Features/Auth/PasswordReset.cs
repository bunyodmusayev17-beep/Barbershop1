using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Data;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Features.Auth;

/// <summary>
/// Konsoldan parol o'rnatish (parol unutilganda yoki birinchi sozlashda).
/// Parol yashirin kiritiladi (ekranda * ko'rinadi), akkaunt faollashtiriladi.
/// </summary>
public static class PasswordReset
{
    /// <param name="createAdmin">true bo'lsa va login topilmasa — yangi admin akkaunti yaratiladi (prod'da birinchi admin).</param>
    public static async Task RunAsync(IServiceProvider services, string login, bool createAdmin = false)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        login = login.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
        if (user is null && createAdmin)
        {
            if (login.Length is < 3 or > 50) { Console.WriteLine("Login 3–50 belgi bo'lishi kerak."); return; }
            user = new User {Login = login, Role = UserRole.Admin};
            db.Users.Add(user);
            Console.WriteLine($"Yangi admin akkaunti: '{login}'.");
        }
        if (user is null)
        {
            Console.WriteLine($"'{login}' loginli foydalanuvchi topilmadi. Mavjudlari: {string.Join(", ", await db.Users.Select(u => u.Login).ToListAsync())}");
            return;
        }

        Console.Write($"'{user.Login}' uchun yangi parol (kamida 8 belgi): ");
        var first = ReadHidden();
        Console.Write("Parolni qayta kiriting: ");
        var second = ReadHidden();

        if (first.Length < 8) { Console.WriteLine("Parol juda qisqa — o'zgartirilmadi."); return; }
        if (first != second) { Console.WriteLine("Parollar mos kelmadi — o'zgartirilmadi."); return; }

        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, first);
        user.IsActive = true;
        await db.SaveChangesAsync();
        Console.WriteLine($"Tayyor: '{user.Login}' paroli yangilandi. Endi shu parol bilan kirishingiz mumkin.");
    }

    private static string ReadHidden()
    {
        var sb = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace)
            {
                if (sb.Length == 0) continue;
                sb.Length--;
                Console.Write("\b \b");
            }
            else if (!char.IsControl(key.KeyChar))
            {
                sb.Append(key.KeyChar);
                Console.Write('*');
            }
        }
        Console.WriteLine();
        return sb.ToString();
    }
}
