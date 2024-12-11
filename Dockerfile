# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY ["CarBid.WebAPI/CarBid.WebAPI.csproj", "CarBid.WebAPI/"]
COPY ["CarBid.Application/CarBid.Application.csproj", "CarBid.Application/"]
COPY ["CarBid.Domain/CarBid.Domain.csproj", "CarBid.Domain/"]
COPY ["CarBid.Infrastructure/CarBid.Infrastructure.csproj", "CarBid.Infrastructure/"]

# Restore NuGet packages
RUN dotnet restore "CarBid.WebAPI/CarBid.WebAPI.csproj"

# Copy the rest of the code
COPY . .

# Build and publish
RUN dotnet publish "CarBid.WebAPI/CarBid.WebAPI.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copy published files
COPY --from=build /app/publish .

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV TZ=UTC

# Create non-root user for security
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

# Expose port 8080 (Railway default)
EXPOSE 8080

ENTRYPOINT ["dotnet", "CarBid.WebAPI.dll"] 