using CarBid.Application.DTOs;
using CarBid.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CarBid.Application.Interfaces
{
    public interface ICarService
    {
        Task<IEnumerable<Car>> GetAvailableCarsAsync();
        Task<Car?> GetCarByIdAsync(int id);
        Task<Car> AddCarAsync(CreateCarDto carDto);
    }
} 