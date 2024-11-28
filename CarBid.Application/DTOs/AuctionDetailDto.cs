namespace CarBid.Application.DTOs
{
    public class AuctionDetailDto
    {
        public AuctionDto Auction { get; set; } = null!;
        public List<BidDto> BidHistory { get; set; } = new();
        public BidDto? WinningBid { get; set; }
    }
} 