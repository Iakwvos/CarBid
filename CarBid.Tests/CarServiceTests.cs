namespace CarBid.Tests
{
    public class CarServiceTests
    {
        [Fact]
        public async Task AddCar_ShouldReturnAddedCar()
        {
            // Arrange
            var car = new Car
            {
                Make = "Toyota",
                Model = "Camry",
                Year = 2022,
                Description = "Well maintained",
                StartingPrice = 25000
            };

            var mockRepository = new Mock<IRepository<Car>>();
            mockRepository.Setup(repo => repo.AddAsync(It.IsAny<Car>()))
                .ReturnsAsync(car);

            var carService = new CarService(mockRepository.Object);

            // Act
            var result = await carService.AddCarAsync(car);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Toyota", result.Make);
            Assert.Equal("Camry", result.Model);
        }
    }
} 