using NyBarber.Api.Features.Booking;

namespace NyBarber.Tests;

public class PhoneNumberTests
{
    [Theory]
    [InlineData("+998 90 123 45 67", "+998901234567")]
    [InlineData("+998 (90) 123-45-67", "+998901234567")]
    [InlineData("998901234567", "+998901234567")]
    [InlineData("90 123 45 67", "+998901234567")]
    [InlineData("901234567", "+998901234567")]
    public void Valid_numbers_are_normalized(string input, string expected) =>
        Assert.Equal(expected, PhoneNumber.Normalize(input));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("+7 900 123 45 67")]
    [InlineData("+998 90 123 45 678")]
    [InlineData("abc")]
    public void Invalid_numbers_are_rejected(string? input) => Assert.Null(PhoneNumber.Normalize(input));
}
