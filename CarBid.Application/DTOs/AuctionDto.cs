using CarBid.Application.DTOs;

namespace CarBid.Application.DTOs
{
    public class AuctionDto
    {
        public int Id { get; set; }
        public decimal CurrentPrice { get; set; }
        public decimal StartingPrice { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public bool IsActive { get; set; }
        public int TotalBids { get; set; }
        public BidDto? WinningBid { get; set; }
        public CarDto? Car { get; set; }
    }

    public class CarDto
    {
        public int Id { get; set; }
        public string Make { get; init; } = string.Empty;
        public string Model { get; init; } = string.Empty;
        public int Year { get; set; }
        public string Description { get; init; } = string.Empty;
    }
} 