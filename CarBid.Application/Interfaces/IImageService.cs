using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace CarBid.Application.Interfaces
{
    public interface IImageService
    {
        Task<string> UploadImageAsync(IFormFile file);
        Task DeleteImageAsync(string imageUrl);
    }
} 