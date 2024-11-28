using CarBid.Application.DTOs.Auth;

namespace CarBid.Application.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterDto model);
        Task<AuthResponseDto> LoginAsync(LoginDto model);
        Task<AuthResponseDto> RefreshTokenAsync(string token, string refreshToken);
        Task<bool> LogoutAsync(string userId);
        Task<UserDto?> GetUserByIdAsync(string userId);
        Task<bool> ChangePasswordAsync(string userId, string currentPassword, string newPassword);
        Task<bool> UpdateUserProfileAsync(string userId, UserDto updatedProfile);
    }
}