using System.Text.Json.Serialization;

namespace CarBid.Domain.Entities
{
    public class Auction
    {
        public Auction()
        {
            Bids = new List<Bid>();
        }

        public int Id { get; set; }
        public string Make { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public int Year { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal StartingPrice { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public decimal CurrentPrice { get; set; }
        public bool IsActive { get; set; }
        public string? ImageUrl { get; set; }
        
        [JsonIgnore]
        public virtual ICollection<Bid> Bids { get; set; }
    }
} 