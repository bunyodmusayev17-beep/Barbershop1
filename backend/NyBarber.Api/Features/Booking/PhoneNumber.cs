using System.Text.RegularExpressions;

namespace NyBarber.Api.Features.Booking;

public static partial class PhoneNumber
{
    /// <summary>
    /// O'zbekiston raqamini +998XXXXXXXXX ko'rinishiga keltiradi.
    /// "90 123 45 67", "+998 (90) 123-45-67", "998901234567" — hammasi qabul qilinadi.
    /// </summary>
    public static string? Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var digits = NonDigits().Replace(input, "");
        if (digits.Length == 9) digits = "998" + digits;
        return digits.Length == 12 && digits.StartsWith("998") ? "+" + digits : null;
    }

    [GeneratedRegex(@"\D")]
    private static partial Regex NonDigits();
}
