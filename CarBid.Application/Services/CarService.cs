using Microsoft.Extensions.Logging;
using CarBid.Domain.Entities;
using CarBid.Application.Interfaces;
using System.Collections.Generic;
using System.Threading.Tasks;
using CarBid.Application.DTOs;

namespace CarBid.Application.Services
{
    public class CarService : ICarService
    {
        private readonly IRepository<Car> _carRepository;
        private readonly ILogger<CarService> _logger;

        public CarService(IRepository<Car> carRepository, ILogger<CarService> logger)
        {
            _carRepository = carRepository;
            _logger = logger;
        }

        public async Task<IEnumerable<Car>> GetAvailableCarsAsync()
        {
            return await _carRepository.GetAllAsync();
        }

        public async Task<Car?> GetCarByIdAsync(int id)
        {
            try
            {
                _logger.LogInformation($"Getting car with ID: {id}");
                return await _carRepository.GetByIdAsync(id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving car with ID: {id}");
                throw;
            }
        }

        public async Task<Car> AddCarAsync(CreateCarDto carDto)
        {
            try
            {
                _logger.LogInformation($"Adding new car: {carDto.Make} {carDto.Model}");
                
                var car = new Car
                {
                    Make = carDto.Make,
                    Model = carDto.Model,
                    Year = carDto.Year,
                    Description = carDto.Description,
                    StartingPrice = carDto.StartingPrice
                };

                var result = await _carRepository.AddAsync(car);
                _logger.LogInformation($"Successfully added car with ID: {result.Id}");
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error adding car: {ex.Message}");
                throw;
            }
        }
    }
} 