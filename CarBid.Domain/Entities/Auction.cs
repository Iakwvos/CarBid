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
        public int CarId { get; set; }
        public virtual Car Car { get; set; } = null!;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public decimal CurrentPrice { get; set; }
        public bool IsActive { get; set; }
        
        [JsonIgnore]
        public virtual ICollection<Bid> Bids { get; set; }
    }
} 