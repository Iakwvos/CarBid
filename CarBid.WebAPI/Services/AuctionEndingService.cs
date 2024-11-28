using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CarBid.Application.Interfaces;

namespace CarBid.WebAPI.Services
{
    public class AuctionEndingService : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<AuctionEndingService> _logger;

        public AuctionEndingService(
            IServiceProvider services,
            ILogger<AuctionEndingService> logger)
        {
            _services = services;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _services.CreateScope())
                    {
                        var auctionService = scope.ServiceProvider.GetRequiredService<IAuctionService>();
                        var activeAuctions = await auctionService.GetActiveAuctionsAsync();
                        
                        foreach (var auction in activeAuctions)
                        {
                            if (DateTime.UtcNow >= auction.EndTime)
                            {
                                _logger.LogInformation($"Ending auction {auction.Id}");
                                await auctionService.EndAuctionAsync(auction.Id);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error in AuctionEndingService: {ex}");
                }

                // Check every minute
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }
    }
}