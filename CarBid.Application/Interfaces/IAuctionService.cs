using CarBid.Application.DTOs;
using CarBid.Domain.Entities;

namespace CarBid.Application.Interfaces
{
    public interface IAuctionService
    {
        Task<Auction> CreateAuctionAsync(CreateAuctionDto auctionDto);
        Task<Auction?> GetAuctionByIdAsync(int id);
        Task<IEnumerable<Auction>> GetActiveAuctionsAsync();
        Task<Bid> PlaceBidAsync(PlaceBidDto bidDto);
        Task<decimal> GetCurrentHighestBidAsync(int auctionId);
        Task<bool> EndAuctionAsync(int auctionId);
    }
} 