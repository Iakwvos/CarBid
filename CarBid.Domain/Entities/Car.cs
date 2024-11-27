using System.Text.Json.Serialization;

namespace CarBid.Domain.Entities
{
    public class Car
    {
        public Car()
        {
            Auctions = new List<Auction>();
        }

        public int Id { get; set; }
        public string Make { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public int Year { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal StartingPrice { get; set; }
        
        [JsonIgnore]
        public virtual ICollection<Auction> Auctions { get; set; }
    }
} 