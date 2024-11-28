using Microsoft.AspNetCore.SignalR;
using CarBid.Domain.Entities;

namespace CarBid.WebAPI.Hubs
{
    public class AuctionHub : Hub
    {
        private readonly ILogger<AuctionHub> _logger;

        public AuctionHub(ILogger<AuctionHub> logger)
        {
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                _logger.LogInformation($"Client connected: {Context.ConnectionId}");
                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error in OnConnectedAsync: {ex.Message}");
                throw;
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                _logger.LogInformation($"Client disconnected: {Context.ConnectionId}. Exception: {exception?.Message}");
                await base.OnDisconnectedAsync(exception);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error in OnDisconnectedAsync: {ex.Message}");
                throw;
            }
        }

        public async Task JoinAuction(int auctionId)
        {
            try
            {
                _logger.LogInformation($"Client {Context.ConnectionId} joining auction {auctionId}");
                await Groups.AddToGroupAsync(Context.ConnectionId, $"auction_{auctionId}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error joining auction: {ex.Message}");
                throw;
            }
        }

        public async Task LeaveAuction(int auctionId)
        {
            _logger.LogInformation($"Client {Context.ConnectionId} leaving auction {auctionId}");
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"auction_{auctionId}");
        }

        public async Task NotifyNewBid(Bid bid)
        {
            await Clients.Group($"auction_{bid.AuctionId}")
                .SendAsync("BidPlaced", new
                {
                    bid.AuctionId,
                    bid.Amount,
                    bid.BidderId,
                    bid.BidTime,
                    FormattedTime = bid.BidTime.ToString("HH:mm:ss")
                });
        }
    }
} 