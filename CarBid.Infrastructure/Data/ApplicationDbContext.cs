using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using CarBid.Domain.Entities;
using Npgsql;

namespace CarBid.Infrastructure.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                var connectionString = new NpgsqlConnectionStringBuilder
                {
                    Host = "database-1.cnwwiyo68evh.us-east-1.rds.amazonaws.com",
                    Database = "carbid",
                    Username = "postgres",
                    Password = "Kubajunki1!",
                    Port = 5432,
                    SslMode = SslMode.Require,
                    Pooling = true,
                    MinPoolSize = 1,
                    MaxPoolSize = 20
                }.ToString();

                optionsBuilder.UseNpgsql(connectionString);
            }
        }

        public DbSet<Car> Cars => Set<Car>();
        public DbSet<Auction> Auctions => Set<Auction>();
        public DbSet<Bid> Bids => Set<Bid>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.HasDefaultSchema("public");
        }
    }
} 