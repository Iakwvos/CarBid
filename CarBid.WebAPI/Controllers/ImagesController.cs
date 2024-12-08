using Microsoft.AspNetCore.Mvc;
using CarBid.Application.Interfaces;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Linq;
using Microsoft.AspNetCore.Http;

namespace CarBid.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ImagesController : ControllerBase
    {
        private readonly IImageService _imageService;

        public ImagesController(IImageService imageService)
        {
            _imageService = imageService;
        }

        [HttpPost("upload")]
        [Authorize]
        public async Task<IActionResult> Upload([FromForm] IFormFile image)
        {
            if (image == null || image.Length == 0)
                return BadRequest("No image file provided");

            if (image.Length > 5 * 1024 * 1024) // 5MB limit
                return BadRequest("File size exceeds 5MB limit");

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif" };
            if (!allowedTypes.Contains(image.ContentType))
                return BadRequest("Invalid file type. Only JPEG, PNG, and GIF are allowed");

            try
            {
                var imageUrl = await _imageService.UploadImageAsync(image);
                return Ok(new { url = imageUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Failed to upload image: " + ex.Message);
            }
        }
    }
} 