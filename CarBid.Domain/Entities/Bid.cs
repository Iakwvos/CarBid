using System.Text.Json.Serialization;

namespace CarBid.Domain.Entities
{
    public class Bid
    {
        public int Id { get; set; }
        public int AuctionId { get; set; }
        public decimal Amount { get; set; }
        public DateTime BidTime { get; set; }
        public string BidderId { get; set; } = string.Empty;
        public string? ApplicationUserId { get; set; }
        
        // Navigation properties
        [JsonIgnore]
        public virtual Auction? Auction { get; set; }
        [JsonIgnore]
        public virtual ApplicationUser? ApplicationUser { get; set; }
    }
} 