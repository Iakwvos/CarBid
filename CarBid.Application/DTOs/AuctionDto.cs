using CarBid.Application.DTOs;

namespace CarBid.Application.DTOs
{
    public class AuctionDto
    {
        public int Id { get; set; }
        public string Make { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public int Year { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal StartingPrice { get; set; }
        public decimal CurrentPrice { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public bool IsActive { get; set; }
        public int TotalBids { get; set; }
        public BidDto? WinningBid { get; set; }
    }
} 