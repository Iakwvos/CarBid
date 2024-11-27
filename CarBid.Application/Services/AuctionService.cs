using Microsoft.Extensions.Logging;
using CarBid.Application.DTOs;
using CarBid.Application.Interfaces;
using CarBid.Domain.Entities;

namespace CarBid.Application.Services
{
    public class AuctionService : IAuctionService
    {
        private readonly IRepository<Auction> _auctionRepository;
        private readonly IRepository<Bid> _bidRepository;
        private readonly ILogger<AuctionService> _logger;

        public AuctionService(
            IRepository<Auction> auctionRepository,
            IRepository<Bid> bidRepository,
            ILogger<AuctionService> logger)
        {
            _auctionRepository = auctionRepository;
            _bidRepository = bidRepository;
            _logger = logger;
        }

        public async Task<Auction> CreateAuctionAsync(CreateAuctionDto auctionDto)
        {
            try
            {
                var auction = new Auction
                {
                    CarId = auctionDto.CarId,
                    StartTime = auctionDto.StartTime,
                    EndTime = auctionDto.EndTime,
                    CurrentPrice = auctionDto.StartingPrice,
                    IsActive = true
                };

                return await _auctionRepository.AddAsync(auction);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error creating auction: {ex}");
                throw;
            }
        }

        public async Task<Auction?> GetAuctionByIdAsync(int id)
        {
            try
            {
                _logger.LogInformation($"Getting auction with ID: {id}");
                return await _auctionRepository.GetByIdAsync(id);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error retrieving auction with ID {id}: {ex}");
                throw;
            }
        }

        public async Task<IEnumerable<Auction>> GetActiveAuctionsAsync()
        {
            try
            {
                _logger.LogInformation("Getting active auctions");
                var auctions = await _auctionRepository.GetAllWithIncludesAsync(a => a.Car);
                return auctions.Where(a => 
                    a.IsActive && 
                    a.EndTime > DateTime.UtcNow
                ).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting active auctions: {ex}");
                throw;
            }
        }

        public async Task<Bid> PlaceBidAsync(PlaceBidDto bidDto)
        {
            try
            {
                var auction = await _auctionRepository.GetByIdAsync(bidDto.AuctionId);
                if (auction == null)
                    throw new Exception("Auction not found");

                if (!auction.IsActive)
                    throw new Exception("Auction is not active");

                if (auction.CurrentPrice >= bidDto.Amount)
                    throw new Exception("Bid amount must be higher than current price");

                var bid = new Bid
                {
                    AuctionId = bidDto.AuctionId,
                    Amount = bidDto.Amount,
                    BidderId = bidDto.BidderId,
                    BidTime = DateTime.UtcNow
                };

                auction.CurrentPrice = bidDto.Amount;
                await _auctionRepository.UpdateAsync(auction);
                
                return await _bidRepository.AddAsync(bid);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error placing bid: {ex}");
                throw;
            }
        }

        public async Task<decimal> GetCurrentHighestBidAsync(int auctionId)
        {
            var auction = await _auctionRepository.GetByIdAsync(auctionId);
            if (auction == null)
                throw new Exception("Auction not found");

            return auction.CurrentPrice;
        }

        public async Task<bool> EndAuctionAsync(int auctionId)
        {
            var auction = await _auctionRepository.GetByIdAsync(auctionId);
            if (auction == null)
                throw new Exception("Auction not found");

            auction.IsActive = false;
            await _auctionRepository.UpdateAsync(auction);
            return true;
        }
    }
} 