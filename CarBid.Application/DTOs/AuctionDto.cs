public class AuctionDto
{
    public int Id { get; set; }
    public decimal CurrentPrice { get; set; }
    public DateTime EndTime { get; set; }
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