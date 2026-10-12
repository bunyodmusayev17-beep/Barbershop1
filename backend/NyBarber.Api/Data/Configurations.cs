using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NyBarber.Api.Domain;

namespace NyBarber.Api.Data;

public class UserConfig : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.Property(x => x.Login).HasMaxLength(64);
        b.HasIndex(x => x.Login).IsUnique();
        b.Property(x => x.Email).HasMaxLength(256);
        b.HasOne(x => x.Barber).WithMany().HasForeignKey(x => x.BarberId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class BarberConfig : IEntityTypeConfiguration<Barber>
{
    public void Configure(EntityTypeBuilder<Barber> b)
    {
        b.Property(x => x.Name).HasMaxLength(100);
        b.ComplexProperty(x => x.Title);
        b.ComplexProperty(x => x.Bio);
        b.HasMany(x => x.WorkingHours).WithOne().HasForeignKey(x => x.BarberId);
        b.HasMany(x => x.TimeOffs).WithOne().HasForeignKey(x => x.BarberId);
    }
}

public class ServiceConfig : IEntityTypeConfiguration<Service>
{
    public void Configure(EntityTypeBuilder<Service> b)
    {
        b.ComplexProperty(x => x.Name);
        b.ComplexProperty(x => x.Description);
        b.Property(x => x.Price).HasPrecision(12, 0);
    }
}

public class BarberServiceConfig : IEntityTypeConfiguration<BarberService>
{
    public void Configure(EntityTypeBuilder<BarberService> b)
    {
        b.HasKey(x => new {x.BarberId, x.ServiceId});
        b.HasOne(x => x.Barber).WithMany(x => x.Services).HasForeignKey(x => x.BarberId);
        b.HasOne(x => x.Service).WithMany(x => x.Barbers).HasForeignKey(x => x.ServiceId);
    }
}

public class WorkingHoursConfig : IEntityTypeConfiguration<WorkingHours>
{
    public void Configure(EntityTypeBuilder<WorkingHours> b)
    {
        b.HasIndex(x => new {x.BarberId, x.DayOfWeek}).IsUnique();
    }
}

public class AppointmentConfig : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> b)
    {
        b.Property(x => x.ClientName).HasMaxLength(100);
        b.Property(x => x.ClientPhone).HasMaxLength(20);
        b.Property(x => x.Comment).HasMaxLength(500);
        b.Property(x => x.Language).HasMaxLength(2);
        b.Property(x => x.Price).HasPrecision(12, 0);
        b.HasIndex(x => new {x.BarberId, x.StartUtc});
        b.HasIndex(x => x.ClientPhone);
        b.HasOne(x => x.Service).WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Barber).WithMany().HasForeignKey(x => x.BarberId).OnDelete(DeleteBehavior.Restrict);
        b.ToTable(t => t.HasCheckConstraint("CK_Appointment_Range", "\"EndUtc\" > \"StartUtc\""));
        // Ikki zapis bir ustada vaqt bo'yicha kesishmasligi — migratsiyada EXCLUDE cheklovi qo'shiladi.
    }
}

public class GalleryImageConfig : IEntityTypeConfiguration<GalleryImage>
{
    public void Configure(EntityTypeBuilder<GalleryImage> b) => b.ComplexProperty(x => x.Caption);
}

public class ReviewConfig : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> b)
    {
        b.Property(x => x.AuthorName).HasMaxLength(100);
        b.Property(x => x.Text).HasMaxLength(1000);
        b.ToTable(t => t.HasCheckConstraint("CK_Review_Rating", "\"Rating\" BETWEEN 1 AND 5"));
    }
}

public class SiteSettingsConfig : IEntityTypeConfiguration<SiteSettings>
{
    public void Configure(EntityTypeBuilder<SiteSettings> b)
    {
        b.Property(x => x.Id).ValueGeneratedNever();
        b.ComplexProperty(x => x.Address);
    }
}
