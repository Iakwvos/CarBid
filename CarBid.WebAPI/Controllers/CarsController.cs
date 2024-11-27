using Microsoft.AspNetCore.Mvc;
using CarBid.Domain.Entities;
using CarBid.Application.Interfaces;
using CarBid.Application.DTOs;

namespace CarBid.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CarsController : ControllerBase
    {
        private readonly ICarService _carService;

        public CarsController(ICarService carService)
        {
            _carService = carService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Car>>> GetCars()
        {
            var cars = await _carService.GetAvailableCarsAsync();
            return Ok(cars);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Car>> GetCar(int id)
        {
            var car = await _carService.GetCarByIdAsync(id);
            if (car == null)
                return NotFound();
            return Ok(car);
        }

        [HttpPost]
        public async Task<ActionResult<Car>> CreateCar([FromBody] CreateCarDto carDto)
        {
            try
            {
                var result = await _carService.AddCarAsync(carDto);
                return CreatedAtAction(nameof(GetCar), new { id = result.Id }, result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpGet("test")]
        public ActionResult<string> Test()
        {
            return Ok("API is working");
        }

        [HttpGet("dbtest")]
        public async Task<ActionResult<string>> TestDatabase()
        {
            try
            {
                await _carService.GetAvailableCarsAsync();
                return Ok("Database connection successful");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Database connection failed: {ex.Message}");
            }
        }
    }
} 