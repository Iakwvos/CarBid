# CarBid - Real-Time Car Auction Platform

CarBid is a modern, real-time car auction platform built with .NET and JavaScript. It enables users to create car auctions and participate in live bidding with real-time updates.

## Features

- **Real-time Bidding**: Live updates using SignalR
- **Active Auctions**: Browse and bid on currently active auctions
- **Past Auctions**: View completed auctions with detailed bid history
- **Dashboard Statistics**: Real-time stats showing platform activity
- **Auction Management**: Create and manage car auctions
- **Bid History**: Detailed bid history with timestamps and winning bid indicators
- **Export Functionality**: Export auction data to CSV
- **Responsive Design**: Works on desktop and mobile devices

## Technical Stack

- **Backend**: .NET 6.0
- **Frontend**: Vanilla JavaScript, Bootstrap 5
- **Real-time Communication**: SignalR
- **Database**: Entity Framework Core
- **Architecture**: Clean Architecture pattern

## Project Structure

- `CarBid.Domain`: Core domain entities and business logic
- `CarBid.Application`: Application services and interfaces
- `CarBid.Infrastructure`: Data access and external services
- `CarBid.WebAPI`: API endpoints and SignalR hubs

## Getting Started

1. Clone the repository
2. Ensure you have .NET 6.0 SDK installed
3. Update the connection string in `appsettings.json`
4. Run database migrations:
   ```bash
   dotnet ef database update
   ```
5. Run the application:
   ```bash
   dotnet run
   ```

## Key Features

### Auction Management
- Create new auctions with car details
- Set auction duration and starting price
- Automatic auction closing

### Bidding System
- Real-time bid updates
- Minimum bid increment enforcement
- Bid history tracking
- Winner determination

### Dashboard
- Active auction count
- Total bids today
- Ending soon auctions
- Highest active bid

### Past Auctions
- Complete auction history
- Detailed bid history with timestamps
- Winner identification
- Exportable auction data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Contact

iakwvos99@gmail.com