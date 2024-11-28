namespace CarBid.Application.DTOs
{
    public class DashboardStatsDto
    {
        public int ActiveAuctionsCount { get; set; }
        public int TotalBidsToday { get; set; }
        public int EndingSoonCount { get; set; }
        public int CompletedTodayCount { get; set; }
        public decimal TotalValueActive { get; set; }
        public decimal HighestActiveBid { get; set; }
    }
}