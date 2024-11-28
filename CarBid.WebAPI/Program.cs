using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using CarBid.Infrastructure.Data;
using CarBid.Infrastructure.Repositories;
using CarBid.Application.Interfaces;
using CarBid.Application.Services;
using Microsoft.AspNetCore.SignalR;
using CarBid.WebAPI.Hubs;
using System.Text.Json.Serialization;
using Swashbuckle.AspNetCore.Swagger;
using CarBid.WebAPI.Services;

var builder = WebApplication.CreateBuilder(args);

// Add HTTPS configuration
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.AddServerHeader = false;
    serverOptions.ListenLocalhost(5193);
    serverOptions.ListenLocalhost(7193, listenOptions =>
    {
        listenOptions.UseHttps();
    });
});

// Add services to the container
builder.Services.AddSignalR();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
    {
        builder
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .SetIsOriginAllowed(_ => true);
    });
});

// Configure services
builder.Services.AddScoped<IAuctionService, AuctionService>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<ICarService, CarService>();

// Get connection string with null check
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddHostedService<AuctionEndingService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "CarBid API V1");
    });
}

// Use CORS
app.UseCors("AllowAll");

// Configure HTTPS redirection
app.UseHttpsRedirection();

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

// Map endpoints
app.MapHub<AuctionHub>("/auctionHub");
app.MapControllers();

// Default route
app.MapGet("/", context =>
{
    context.Response.Redirect("/index.html");
    return Task.CompletedTask;
});

app.Run();
