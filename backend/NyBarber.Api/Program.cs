using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NyBarber.Api.Data;
using NyBarber.Api.Features.Auth;
using NyBarber.Api.Features.Booking;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<BusinessClock>();
builder.Services.AddScoped<AvailabilityService>();
builder.Services.AddScoped<BookingService>();
builder.Services.AddSingleton<NyBarber.Api.Features.Admin.ImageStorage>();

// --- Auth ---
var jwt = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
if (System.Text.Encoding.UTF8.GetByteCount(jwt.Key) < 32)
    throw new InvalidOperationException("Jwt:Key sozlanmagan yoki juda qisqa (kamida 32 bayt). Dev uchun: scripts/dev-secrets.ps1");

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.Section));
builder.Services.AddSingleton<TokenService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = TokenService.SigningKey(jwt),
            NameClaimType = System.Security.Claims.ClaimTypes.Name,
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.Admin, p => p.RequireRole(nameof(NyBarber.Api.Domain.UserRole.Admin)))
    .AddPolicy(Policies.Staff, p => p.RequireRole(nameof(NyBarber.Api.Domain.UserRole.Admin), nameof(NyBarber.Api.Domain.UserRole.Barber)));

// --- Rate limiting ---
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(RateLimits.Login, ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions {PermitLimit = 10, Window = TimeSpan.FromMinutes(1)}));
    o.AddPolicy(RateLimits.Booking, ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions {PermitLimit = 5, Window = TimeSpan.FromMinutes(1)}));
});

builder.Services.AddProblemDetails();
builder.Services.AddControllers();
builder.Services.AddOpenApi();

const string FrontendCors = "frontend";
builder.Services.AddCors(options => options.AddPolicy(FrontendCors, policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
          .AllowAnyHeader()
          .AllowAnyMethod()));

var app = builder.Build();

// Parolni tiklash: dotnet run --project backend/NyBarber.Api -- reset-password admin
if (args is ["reset-password", var resetLogin, ..])
{
    await NyBarber.Api.Features.Auth.PasswordReset.RunAsync(app.Services, resetLogin);
    return;
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Dev: migratsiyalarni qo'llash va namunaviy ma'lumotlarni yozish
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await Seeder.SeedAsync(db, app.Configuration, app.Logger);
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseStaticFiles();
app.UseCors(FrontendCors);
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
