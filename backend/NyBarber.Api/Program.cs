using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NyBarber.Api.Data;
using NyBarber.Api.Features.Auth;
using NyBarber.Api.Features.Booking;
using NyBarber.Api.Features.Telegram;
using Telegram.Bot;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<BusinessClock>();
builder.Services.AddScoped<AvailabilityService>();
builder.Services.AddScoped<BookingService>();
builder.Services.AddSingleton<NyBarber.Api.Features.Admin.ImageStorage>();

// --- Telegram bot (token bo'lmasa o'chiq: hodisalar navbatga tushmaydi, fon xizmati ishga tushmaydi) ---
var telegram = builder.Configuration.GetSection(TelegramOptions.Section).Get<TelegramOptions>() ?? new TelegramOptions();
builder.Services.Configure<TelegramOptions>(builder.Configuration.GetSection(TelegramOptions.Section));
builder.Services.AddSingleton<TelegramNotifier>();
builder.Services.AddScoped<TelegramAccounts>();
if (telegram.Enabled)
{
    builder.Services.AddSingleton<ITelegramBotClient>(_ => new TelegramBotClient(new TelegramBotClientOptions(telegram.BotToken, telegram.ApiBaseUrl)));
    builder.Services.AddScoped<TelegramNotifications>();
    builder.Services.AddScoped<TelegramUpdateHandler>();
    builder.Services.AddHostedService<TelegramWorker>();
}

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
// Birinchi admin (prod, toza baza):            ... -- create-admin admin
if (args is [var command and ("reset-password" or "create-admin"), var cliLogin, ..])
{
    await NyBarber.Api.Features.Auth.PasswordReset.RunAsync(app.Services, cliLogin, createAdmin: command == "create-admin");
    return;
}

// Xodimning Telegram'i (birinchi admin uchun): ... -- set-telegram admin @username   (yoki raqamli ID)
if (args is ["set-telegram", var tgLogin, var tgHandle, ..])
{
    await using var cli = app.Services.CreateAsyncScope();
    var cliDb = cli.ServiceProvider.GetRequiredService<AppDbContext>();
    var cliUser = await cliDb.Users.FirstOrDefaultAsync(u => u.Login == tgLogin.Trim().ToLowerInvariant());
    var error = cliUser is null ? $"'{tgLogin}' topilmadi"
        : await cli.ServiceProvider.GetRequiredService<TelegramAccounts>().ApplyAsync(cliUser, tgHandle, default);
    if (error is null) await cliDb.SaveChangesAsync();
    Console.WriteLine(error ?? $"Tayyor: {cliUser!.Login} → {TelegramAccounts.Display(cliUser)}. Endi u botga /start yozsin.");
    return;
}

if (app.Environment.IsDevelopment()) app.MapOpenApi();

// Migratsiyalar va boshlang'ich ma'lumotlar (prod'da faqat sayt sozlamalari — Seed:SampleContent o'chiq)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await Seeder.SeedAsync(db, app.Configuration, app.Logger);
}

// Prod: API faqat nginx ortida — mijozning haqiqiy IP'si X-Forwarded-For dan olinadi (rate limiting uchun).
// nginx bu sarlavhani o'zi qayta yozadi, shuning uchun mijoz uni soxtalashtira olmaydi.
if (app.Configuration.GetValue<bool>("ReverseProxy:TrustForwardedHeaders"))
{
    var forwarded = new ForwardedHeadersOptions {ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto};
    forwarded.KnownIPNetworks.Clear();
    forwarded.KnownProxies.Clear();
    app.UseForwardedHeaders(forwarded);
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
