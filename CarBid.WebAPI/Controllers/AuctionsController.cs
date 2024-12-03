using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using CarBid.Application.DTOs;
using CarBid.Application.Interfaces;
using CarBid.WebAPI.Hubs;
using System.Text;

namespace CarBid.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuctionsController : ControllerBase
    {
        private readonly IAuctionService _auctionService;
        private readonly IHubContext<AuctionHub> _hubContext;
        private readonly ILogger<AuctionsController> _logger;

        public AuctionsController(
            IAuctionService auctionService,
            IHubContext<AuctionHub> hubContext,
            ILogger<AuctionsController> logger)
        {
            _auctionService = auctionService;
            _hubContext = hubContext;
            _logger = logger;
        }

        [HttpPost]
        public async Task<ActionResult> CreateAuction([FromBody] CreateAuctionDto auctionDto)
        {
            try
            {
                var auction = await _auctionService.CreateAuctionAsync(auctionDto);
                return CreatedAtAction(nameof(GetAuction), new { id = auction.Id }, auction);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error creating auction: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("bid")]
        public async Task<ActionResult> PlaceBid([FromBody] PlaceBidDto bidDto)
        {
            try
            {
                if (bidDto == null)
                    return BadRequest("Invalid bid data");

                if (bidDto.Amount <= 0)
                    return BadRequest("Bid amount must be greater than zero");

                var bid = await _auctionService.PlaceBidAsync(bidDto);
                
                await _hubContext.Clients.Group($"auction_{bidDto.AuctionId}")
                    .SendAsync("BidPlaced", new
                    {
                        bid.AuctionId,
                        bid.Amount,
                        bid.BidderId,
                        bid.BidTime,
                        FormattedTime = bid.BidTime.ToString("HH:mm:ss")
                    });

                return Ok(new
                {
                    message = "Bid placed successfully",
                    bid = new
                    {
                        bid.Id,
                        bid.AuctionId,
                        bid.Amount,
                        bid.BidTime
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error placing bid: {ex.Message}");
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult> GetAuction(int id)
        {
            var auction = await _auctionService.GetAuctionByIdAsync(id);
            if (auction == null)
                return NotFound();
            
            return Ok(auction);
        }

        [HttpGet("active")]
        public async Task<ActionResult<IEnumerable<AuctionDto>>> GetActiveAuctions()
        {
            try
            {
                _logger.LogInformation("Getting active auctions");
                var auctions = await _auctionService.GetActiveAuctionsAsync();
                
                _logger.LogInformation($"Retrieved {auctions?.Count() ?? 0} auctions from service");
                
                if (auctions == null || !auctions.Any())
                {
                    _logger.LogInformation("No active auctions found");
                    return Ok(new List<AuctionDto>()); // Return empty list instead of NotFound
                }
                
                var auctionDtos = auctions.Select(a => new AuctionDto
                {
                    Id = a.Id,
                    CurrentPrice = a.CurrentPrice,
                    StartingPrice = a.StartingPrice,
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    IsActive = a.IsActive,
                    Make = a.Make,
                    Model = a.Model,
                    Year = a.Year,
                    Description = a.Description
                }).ToList();

                _logger.LogInformation($"Mapped {auctionDtos.Count} auction DTOs");
                
                return Ok(auctionDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting active auctions: {ex}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("test")]
        public async Task<ActionResult> CreateTestAuction()
        {
            try
            {
                var testAuction = new CreateAuctionDto
                {
                    Make = "Tesla",
                    Model = "Model S",
                    Year = 2023,
                    Description = "Luxury electric vehicle in excellent condition",
                    StartingPrice = 25000,
                    StartTime = DateTime.UtcNow.AddMinutes(-5), // Started 5 minutes ago
                    EndTime = DateTime.UtcNow.AddHours(1) // Ends in 1 hour
                };

                var auction = await _auctionService.CreateAuctionAsync(testAuction);
                return Ok(auction);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error creating test auction: {ex.Message}");
                return StatusCode(500, "Error creating test auction");
            }
        }

        [HttpGet("debug")]
        public async Task<ActionResult> DebugAuctions()
        {
            try
            {
                var activeAuctions = await _auctionService.GetActiveAuctionsAsync();
                var response = new
                {
                    TotalCount = activeAuctions.Count(),
                    CurrentTime = DateTime.UtcNow,
                    Auctions = activeAuctions.Select(a => new
                    {
                        a.Id,
                        a.Make,
                        a.Model,
                        a.Year,
                        a.Description,
                        a.StartTime,
                        a.EndTime,
                        a.CurrentPrice,
                        a.IsActive
                    })
                };
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Debug endpoint error: {ex}");
                return StatusCode(500, new { error = ex.Message, stack = ex.StackTrace });
            }
        }

        [HttpGet("past")]
        public async Task<ActionResult<IEnumerable<AuctionDto>>> GetPastAuctions()
        {
            try
            {
                var auctions = await _auctionService.GetPastAuctionsAsync();
                var auctionDtos = new List<AuctionDto>();

                foreach (var auction in auctions)
                {
                    var winningBid = await _auctionService.GetWinningBidAsync(auction.Id);
                    var bids = await _auctionService.GetAuctionBidsAsync(auction.Id);

                    auctionDtos.Add(new AuctionDto
                    {
                        Id = auction.Id,
                        CurrentPrice = auction.CurrentPrice,
                        StartingPrice = auction.CurrentPrice,
                        StartTime = auction.StartTime,
                        EndTime = auction.EndTime,
                        IsActive = auction.IsActive,
                        Make = auction.Make,
                        Model = auction.Model,
                        Year = auction.Year,
                        Description = auction.Description,
                        TotalBids = bids.Count(),
                        WinningBid = winningBid != null ? new BidDto
                        {
                            Id = winningBid.Id,
                            Amount = winningBid.Amount,
                            BidTime = winningBid.BidTime,
                            BidderId = winningBid.BidderId
                        } : null
                    });
                }

                return Ok(auctionDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting past auctions: {ex}");
                return StatusCode(500, "Error retrieving past auctions");
            }
        }

        [HttpGet("{id}/details")]
        public async Task<ActionResult<AuctionDetailDto>> GetAuctionDetails(int id)
        {
            try
            {
                var details = await _auctionService.GetAuctionDetailsAsync(id);
                return Ok(details);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting auction details: {ex}");
                return StatusCode(500, "Error retrieving auction details");
            }
        }

        [HttpGet("{id}/export")]
        public async Task<ActionResult> ExportAuctionData(int id)
        {
            try
            {
                var details = await _auctionService.GetAuctionDetailsAsync(id);
                
                var csv = new StringBuilder();
                csv.AppendLine("Time,Amount,Bidder");
                
                foreach (var bid in details.BidHistory)
                {
                    csv.AppendLine($"{bid.BidTime},{bid.Amount},{bid.BidderId}");
                }

                byte[] bytes = Encoding.UTF8.GetBytes(csv.ToString());
                return File(bytes, "text/csv", $"auction_{id}_bids.csv");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error exporting auction data: {ex}");
                return StatusCode(500, "Error exporting auction data");
            }
        }

        [HttpGet("stats")]
        public async Task<ActionResult<DashboardStatsDto>> GetDashboardStats()
        {
            try
            {
                var stats = await _auctionService.GetDashboardStatsAsync();
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting dashboard stats: {ex}");
                return StatusCode(500, new { 
                    error = "Error retrieving dashboard stats",
                    details = ex.Message
                });
            }
        }

        [HttpPost("test-data")]
        public async Task<ActionResult> CreateTestData()
        {
            try
            {
                // Create a test auction
                var auctionDto = new CreateAuctionDto
                {
                    Make = "Tesla",
                    Model = "Model S",
                    Year = 2023,
                    Description = "Luxury electric vehicle in excellent condition",
                    StartingPrice = 50000,
                    StartTime = DateTime.UtcNow,
                    EndTime = DateTime.UtcNow.AddHours(24)
                };

                var auction = await _auctionService.CreateAuctionAsync(auctionDto);
                _logger.LogInformation($"Created test auction with ID: {auction.Id}");

                return Ok(new { 
                    message = "Test data created successfully",
                    auctionId = auction.Id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error creating test data: {ex}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
} 