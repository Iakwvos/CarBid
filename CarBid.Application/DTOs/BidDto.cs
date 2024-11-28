namespace CarBid.Application.DTOs
{
    public class BidDto
    {
        public int Id { get; set; }
        public int AuctionId { get; set; }
        public decimal Amount { get; set; }
        public DateTime BidTime { get; set; }
        public string BidderId { get; set; } = string.Empty;
    }
} 