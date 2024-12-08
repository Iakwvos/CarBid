using Microsoft.Extensions.Logging;
using CarBid.Application.DTOs;
using CarBid.Application.Interfaces;
using CarBid.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.SignalR;

namespace CarBid.Application.Services
{
    public class AuctionService : IAuctionService
    {
        private readonly IRepository<Auction> _auctionRepository;
        private readonly IRepository<Bid> _bidRepository;
        private readonly ILogger<AuctionService> _logger;
        private readonly UserManager<ApplicationUser> _userManager;

        public AuctionService(
            IRepository<Auction> auctionRepository,
            IRepository<Bid> bidRepository,
            ILogger<AuctionService> logger,
            UserManager<ApplicationUser> userManager)
        {
            _auctionRepository = auctionRepository;
            _bidRepository = bidRepository;
            _logger = logger;
            _userManager = userManager;
        }

        public async Task<Auction> CreateAuctionAsync(CreateAuctionDto auctionDto)
        {
            try
            {
                var auction = new Auction
                {
                    Make = auctionDto.Make,
                    Model = auctionDto.Model,
                    Year = auctionDto.Year,
                    Description = auctionDto.Description,
                    StartingPrice = auctionDto.StartingPrice,
                    StartTime = auctionDto.StartTime,
                    EndTime = auctionDto.EndTime,
                    CurrentPrice = auctionDto.StartingPrice,
                    IsActive = true,
                    ImageUrl = auctionDto.ImageUrl
                };

                return await _auctionRepository.AddAsync(auction);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error creating auction: {ex.Message}");
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
                var activeAuctions = await _auctionRepository.GetAllAsync();
                return activeAuctions.Where(a => a.IsActive).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting active auctions: {ex.Message}");
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

        public async Task<IEnumerable<Auction>> GetPastAuctionsAsync()
        {
            try
            {
                _logger.LogInformation("Getting past auctions");
                var auctions = await _auctionRepository.GetAllAsync();
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
                {
                    throw new KeyNotFoundException("Auction not found");
                }

                var winningBid = auction.Bids.OrderByDescending(b => b.Amount).FirstOrDefault();
                var winningBidDto = winningBid != null ? new BidDto
                {
                    Id = winningBid.Id,
                    AuctionId = winningBid.AuctionId,
                    Amount = winningBid.Amount,
                    BidTime = winningBid.BidTime,
                    BidderId = winningBid.BidderId
                } : null;

                return new AuctionDetailDto
                {
                    Auction = new AuctionDto
                    {
                        Id = auction.Id,
                        Make = auction.Make,
                        Model = auction.Model,
                        Year = auction.Year,
                        Description = auction.Description,
                        StartingPrice = auction.StartingPrice,
                        CurrentPrice = auction.CurrentPrice,
                        StartTime = auction.StartTime,
                        EndTime = auction.EndTime,
                        IsActive = auction.IsActive,
                        TotalBids = auction.Bids.Count,
                        ImageUrls = auction.ImageUrl != null ? new List<string> { auction.ImageUrl } : new List<string>(),
                        WinningBid = winningBidDto
                    },
                    BidHistory = auction.Bids.Select(b => new BidDto
                    {
                        Id = b.Id,
                        AuctionId = b.AuctionId,
                        Amount = b.Amount,
                        BidTime = b.BidTime,
                        BidderId = b.BidderId
                    }).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting auction details: {ex.Message}");
                throw;
            }
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
                    
                    TotalValueActive = activeAuctionsList.Any() 
                        ? activeAuctionsList.Sum(a => a.CurrentPrice) 
                        : 0,
                    
                    HighestActiveBid = activeAuctionsList.Any() 
                        ? activeAuctionsList.Max(a => a.CurrentPrice) 
                        : 0
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