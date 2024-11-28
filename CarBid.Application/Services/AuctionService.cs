using Microsoft.Extensions.Logging;
using CarBid.Application.DTOs;
using CarBid.Application.Interfaces;
using CarBid.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
                    StartTime = DateTime.SpecifyKind(auctionDto.StartTime, DateTimeKind.Utc),
                    EndTime = DateTime.SpecifyKind(auctionDto.EndTime, DateTimeKind.Utc),
                    CurrentPrice = auctionDto.StartingPrice,
                    StartingPrice = auctionDto.StartingPrice,
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

                if (DateTime.UtcNow >= auction.EndTime)
                {
                    if (auction.IsActive)
                    {
                        auction.IsActive = false;
                        await _auctionRepository.UpdateAsync(auction);
                    }
                    throw new Exception("This auction has ended");
                }

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

        public async Task<IEnumerable<Auction>> GetPastAuctionsAsync()
        {
            try
            {
                _logger.LogInformation("Getting past auctions");
                var auctions = await _auctionRepository.GetAllWithIncludesAsync(a => a.Car);
                return auctions.Where(a => !a.IsActive && a.EndTime <= DateTime.UtcNow).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting past auctions: {ex}");
                throw;
            }
        }

        public async Task<AuctionDetailDto> GetAuctionDetailsAsync(int id)
        {
            try
            {
                var auction = await _auctionRepository.GetByIdAsync(id);
                if (auction == null)
                    throw new Exception("Auction not found");

                var bids = await GetAuctionBidsAsync(id);
                var winningBid = await GetWinningBidAsync(id);

                return new AuctionDetailDto
                {
                    Auction = new AuctionDto
                    {
                        Id = auction.Id,
                        CurrentPrice = auction.CurrentPrice,
                        EndTime = auction.EndTime,
                        Car = auction.Car != null ? new CarDto
                        {
                            Id = auction.Car.Id,
                            Make = auction.Car.Make,
                            Model = auction.Car.Model,
                            Year = auction.Car.Year,
                            Description = auction.Car.Description
                        } : null
                    },
                    BidHistory = bids.Select(b => new BidDto
                    {
                        Id = b.Id,
                        AuctionId = b.AuctionId,
                        Amount = b.Amount,
                        BidTime = b.BidTime,
                        BidderId = b.BidderId
                    }).ToList(),
                    WinningBid = winningBid != null ? new BidDto
                    {
                        Id = winningBid.Id,
                        AuctionId = winningBid.AuctionId,
                        Amount = winningBid.Amount,
                        BidTime = winningBid.BidTime,
                        BidderId = winningBid.BidderId
                    } : null
                };
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting auction details: {ex}");
                throw;
            }
        }

        public async Task<Bid?> GetWinningBidAsync(int auctionId)
        {
            try
            {
                var bids = await _bidRepository.GetAllAsync();
                return bids.Where(b => b.AuctionId == auctionId).OrderByDescending(b => b.Amount).FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting winning bid: {ex}");
                throw;
            }
        }

        public async Task<IEnumerable<Bid>> GetAuctionBidsAsync(int auctionId)
        {
            try
            {
                var bids = await _bidRepository.GetAllAsync();
                return bids.Where(b => b.AuctionId == auctionId).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting auction bids: {ex}");
                throw;
            }
        }

        public async Task<DashboardStatsDto> GetDashboardStatsAsync()
        {
            try
            {
                var now = DateTime.UtcNow;
                var today = DateTime.UtcNow.Date;
                var endingSoonThreshold = now.AddHours(4); // Auctions ending in next 4 hours

                var activeAuctions = await _auctionRepository.GetAllWithIncludesAsync(a => a.Bids);
                var activeAuctionsList = activeAuctions.Where(a => a.IsActive && a.EndTime > now).ToList();
                
                var stats = new DashboardStatsDto
                {
                    ActiveAuctionsCount = activeAuctionsList.Count,
                    
                    EndingSoonCount = activeAuctionsList.Count(a => 
                        a.EndTime <= endingSoonThreshold),
                    
                    CompletedTodayCount = activeAuctions.Count(a => 
                        !a.IsActive && 
                        a.EndTime.Date == today),
                    
                    TotalBidsToday = (await _bidRepository.GetAllAsync())
                        .Count(b => b.BidTime.Date == today),
                    
                    TotalValueActive = activeAuctionsList
                        .Sum(a => a.CurrentPrice),
                    
                    HighestActiveBid = activeAuctionsList
                        .Max(a => a.CurrentPrice)
                };

                return stats;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting dashboard stats: {ex}");
                throw;
            }
        }
    }
} 