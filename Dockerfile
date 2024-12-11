# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files and restore dependencies
COPY ["CarBid.WebAPI/CarBid.WebAPI.csproj", "CarBid.WebAPI/"]
COPY ["CarBid.Application/CarBid.Application.csproj", "CarBid.Application/"]
COPY ["CarBid.Domain/CarBid.Domain.csproj", "CarBid.Domain/"]
COPY ["CarBid.Infrastructure/CarBid.Infrastructure.csproj", "CarBid.Infrastructure/"]
RUN dotnet restore "CarBid.WebAPI/CarBid.WebAPI.csproj"

# Copy the rest of the code
COPY . .

# Build the application
RUN dotnet build "CarBid.WebAPI/CarBid.WebAPI.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "CarBid.WebAPI/CarBid.WebAPI.csproj" -c Release -o /app/publish

# Final stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Explicitly copy wwwroot
COPY ["CarBid.WebAPI/wwwroot", "/app/wwwroot/"]

# Expose port 8080
EXPOSE 8080

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "CarBid.WebAPI.dll"] 