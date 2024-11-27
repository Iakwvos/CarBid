namespace CarBid.Application.DTOs
{
    public class PlaceBidDto
    {
        public int AuctionId { get; set; }
        public decimal Amount { get; set; }
        public string BidderId { get; set; } = string.Empty;
    }
} 