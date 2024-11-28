using Microsoft.AspNetCore.Identity;

namespace CarBid.Domain.Entities
{
    public class ApplicationUser : IdentityUser
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Country { get; set; }
        public DateTime Created { get; set; }
        public bool IsActive { get; set; }
        public virtual ICollection<Bid> Bids { get; set; } = new List<Bid>();
        public virtual ICollection<Auction> CreatedAuctions { get; set; } = new List<Auction>();
    }
}