using Microsoft.EntityFrameworkCore;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Barber> Barbers => Set<Barber>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<BarberService> BarberServices => Set<BarberService>();
    public DbSet<WorkingHours> WorkingHours => Set<WorkingHours>();
    public DbSet<TimeOff> TimeOffs => Set<TimeOff>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<GalleryImage> GalleryImages => Set<GalleryImage>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // EXCLUDE cheklovi uchun (barber_id = ... ni gist indeksida ishlatish)
        modelBuilder.HasPostgresExtension("btree_gist");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
