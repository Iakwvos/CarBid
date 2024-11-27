namespace CarBid.Application.DTOs
{
    public class CreateAuctionDto
    {
        public int CarId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public decimal StartingPrice { get; set; }
    }
} 