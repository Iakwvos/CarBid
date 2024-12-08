using Amazon.S3;
using Amazon.S3.Model;
using CarBid.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;

namespace CarBid.WebAPI.Services
{
    public class S3ImageService : IImageService
    {
        private readonly IAmazonS3 _s3Client;
        private readonly string _bucketName;

        public S3ImageService(IAmazonS3 s3Client, IConfiguration configuration)
        {
            _s3Client = s3Client;
            _bucketName = configuration["AWS:BucketName"] ?? throw new InvalidOperationException("AWS BucketName not configured");
        }

        public async Task<string> UploadImageAsync(IFormFile file)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File is empty", nameof(file));

            // Generate a unique file name
            var fileExtension = Path.GetExtension(file.FileName);
            var fileName = $"{Guid.NewGuid()}{fileExtension}";

            // Prepare the upload request
            var request = new PutObjectRequest
            {
                BucketName = _bucketName,
                Key = fileName,
                InputStream = file.OpenReadStream(),
                ContentType = file.ContentType
            };

            // Upload to S3
            await _s3Client.PutObjectAsync(request);

            // Return the URL of the uploaded image
            return $"https://{_bucketName}.s3.amazonaws.com/{fileName}";
        }

        public async Task DeleteImageAsync(string imageUrl)
        {
            if (string.IsNullOrEmpty(imageUrl))
                return;

            try
            {
                var fileName = Path.GetFileName(new Uri(imageUrl).LocalPath);
                var deleteRequest = new DeleteObjectRequest
                {
                    BucketName = _bucketName,
                    Key = fileName
                };

                await _s3Client.DeleteObjectAsync(deleteRequest);
            }
            catch (Exception)
            {
                // Log the error but don't throw - we don't want to break the application if image deletion fails
            }
        }
    }
} 