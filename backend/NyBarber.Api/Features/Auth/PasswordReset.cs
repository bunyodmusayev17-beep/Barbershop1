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
    public static async Task RunAsync(IServiceProvider services, string login)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login.Trim().ToLowerInvariant());
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
