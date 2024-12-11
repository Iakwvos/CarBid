using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using CarBid.Infrastructure.Data;
using CarBid.Infrastructure.Repositories;
using CarBid.Application.Interfaces;
using CarBid.Application.Services;
using CarBid.WebAPI.Hubs;
using System.Text.Json.Serialization;
using CarBid.WebAPI.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using CarBid.Domain.Entities;
using CarBid.Application.DTOs.Auth;
using Amazon.S3;
using Amazon.Runtime;
using dotenv.net;

var builder = WebApplication.CreateBuilder(args);

// Load .env file only in Development
if (builder.Environment.IsDevelopment())
{
    try 
    {
        var envFilePath = Path.Combine(Directory.GetCurrentDirectory(), "..", ".env");
        if (File.Exists(envFilePath))
        {
            DotEnv.Load(new DotEnvOptions(envFilePaths: new[] { envFilePath }));
            Console.WriteLine("Successfully loaded .env file for development");
        }
        else
        {
            Console.WriteLine("Warning: .env file not found for development");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Warning: Error loading .env file: {ex.Message}");
    }
}

// Configure AWS
var awsAccessKey = Environment.GetEnvironmentVariable("AWS__AccessKey");
var awsSecretKey = Environment.GetEnvironmentVariable("AWS__SecretKey");

if (!string.IsNullOrEmpty(awsAccessKey) && !string.IsNullOrEmpty(awsSecretKey))
{
    var credentials = new BasicAWSCredentials(awsAccessKey, awsSecretKey);
    builder.Services.AddSingleton<IAmazonS3>(new AmazonS3Client(credentials, Amazon.RegionEndpoint.USEast1));
}
else
{
    Console.WriteLine("Warning: AWS credentials not found. S3 functionality will be limited.");
}

builder.Services.AddScoped<IImageService, S3ImageService>();

// Add services to the container
builder.Services.AddSignalR();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "CarBid API", Version = "v1" });
});

// Add CORS with environment-specific origins
var corsOrigins = builder.Environment.IsDevelopment() 
    ? new[] { "http://localhost:5193", "https://localhost:7193" }
    : new[] { "https://carbid-production.up.railway.app" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
        builder.WithOrigins(corsOrigins)
               .AllowAnyMethod()
               .AllowAnyHeader()
               .AllowCredentials());
});

// Configure services
builder.Services.AddScoped<IAuctionService, AuctionService>()
    .AddScoped(typeof(IRepository<>), typeof(Repository<>))
    .AddScoped<IAuthService, AuthService>();

// Database configuration
string connectionString;

if (builder.Environment.IsDevelopment())
{
    // Use the full connection string from environment variables in development
    connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
        ?? throw new InvalidOperationException("Development connection string not found");
}
else
{
    // In production (Railway), construct the connection string from individual environment variables
    var host = Environment.GetEnvironmentVariable("PGHOST");
    var database = Environment.GetEnvironmentVariable("PGDATABASE");
    var username = Environment.GetEnvironmentVariable("PGUSER");
    var password = Environment.GetEnvironmentVariable("PGPASSWORD");
    var port = Environment.GetEnvironmentVariable("PGPORT");

    connectionString = $"Host={host};Database={database};Username={username};Password={password};Port={port};SSL Mode=Require;Trust Server Certificate=true";
}

Console.WriteLine($"Environment: {builder.Environment.EnvironmentName}");
Console.WriteLine("Database connection configured");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// JWT Configuration
var jwtKey = Environment.GetEnvironmentVariable("JWT__Key");
var jwtIssuer = Environment.GetEnvironmentVariable("JWT__Issuer");
var jwtAudience = Environment.GetEnvironmentVariable("JWT__Audience");

// Set default values for development
if (builder.Environment.IsDevelopment())
{
    jwtKey ??= "your-super-secret-key-with-at-least-32-characters";
    jwtIssuer ??= "https://localhost:7193";
    jwtAudience ??= "https://localhost:7193";
}
else if (string.IsNullOrEmpty(jwtKey))
{
    throw new InvalidOperationException("JWT Key not found in production environment");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

builder.Services.AddHostedService<AuctionEndingService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "CarBid API V1"));
}

app.UseCors("AllowAll");
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<AuctionHub>("/auctionHub");
app.MapGet("/", context =>
{
    context.Response.Redirect("/index.html");
    return Task.CompletedTask;
});

app.Run();
