const AuctionApp = (() => {
    // State management
    let connection = null;
    let currentAuctions = [];
    let pastAuctions = [];

    // DOM Elements
    const DOM = {
        auctionsContainer: document.getElementById('auctionsContainer'),
        searchInput: document.getElementById('searchInput'),
        sortSelect: document.getElementById('sortSelect'),
        refreshButton: document.getElementById('refreshButton'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        bidModal: document.getElementById('bidModal'),
        placeBidBtn: document.getElementById('placeBidBtn'),
        bidAmount: document.getElementById('bidAmount'),
        currentBid: document.getElementById('currentBid'),
        timeLeft: document.getElementById('timeLeft'),
        auctionId: document.getElementById('auctionId')
    };

    // Initialize application
    async function initialize() {
        try {
            attachEventListeners();
            initializeCreateAuction();
            await initializeSignalR();
            await Promise.all([
                loadAuctions(),
                loadPastAuctions(),
                loadDashboardStats()
            ]);
            startTimeUpdates();
            
            // Refresh stats periodically
            setInterval(loadDashboardStats, 30000); // Refresh every 30 seconds
        } catch (error) {
            console.error('Initialization error:', error);
            showToast('Error', 'Failed to initialize application', 'error');
        }
    }

    // Event Listeners
    function attachEventListeners() {
        DOM.refreshButton.addEventListener('click', loadAuctions);
        DOM.placeBidBtn.addEventListener('click', handleBidSubmission);
        DOM.searchInput.addEventListener('input', debounce(filterAuctions, 300));
        DOM.sortSelect.addEventListener('change', filterAuctions);
        DOM.auctionsContainer.addEventListener('click', handleBidButtonClick);
        document.getElementById('pastSearchInput').addEventListener('input', debounce(filterPastAuctions, 300));
        document.getElementById('pastSortSelect').addEventListener('change', filterPastAuctions);
    }

    // SignalR Setup
    async function initializeSignalR() {
        try {
            connection = new signalR.HubConnectionBuilder()
                .withUrl("/auctionHub")
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            connection.on("BidPlaced", handleNewBid);
            await connection.start();
            console.log("SignalR Connected!");
        } catch (error) {
            console.error("SignalR initialization failed:", error);
            showToast('Error', 'Failed to initialize real-time updates', 'error');
        }
    }

    // Auction Loading and Display
    async function loadAuctions() {
        showLoading(true);
        try {
            const response = await fetch('/api/auctions/active');
            if (!response.ok) throw new Error('Failed to fetch auctions');
            
            currentAuctions = await response.json();
            filterAuctions(); // This will handle the display

            if (connection?.state === 'Connected') {
                currentAuctions.forEach(async (auction) => {
                    await connection.invoke("JoinAuction", auction.id);
                });
            }
        } catch (error) {
            console.error('Error loading auctions:', error);
            showToast('Error', 'Failed to load auctions', 'error');
        } finally {
            showLoading(false);
        }
    }

    async function loadPastAuctions() {
        showLoading(true);
        try {
            const response = await fetch('/api/auctions/past');
            if (!response.ok) throw new Error('Failed to fetch past auctions');
            
            pastAuctions = await response.json();
            filterPastAuctions();
        } catch (error) {
            console.error('Error loading past auctions:', error);
            showToast('Error', 'Failed to load past auctions', 'error');
        } finally {
            showLoading(false);
        }
    }

    function displayAuctions(auctions) {
        DOM.auctionsContainer.innerHTML = '';
        
        if (auctions.length === 0) {
            DOM.auctionsContainer.innerHTML = `
                <div class="col-12 text-center">
                    <p class="text-muted">No active auctions found</p>
                </div>`;
            return;
        }

        auctions.forEach(auction => {
            DOM.auctionsContainer.appendChild(createAuctionCard(auction));
        });
    }

    function createAuctionCard(auction) {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';
        
        const timeLeft = getTimeLeft(auction.endTime);
        const isEnded = timeLeft.total <= 0;
        const urgencyClass = getUrgencyClass(timeLeft);

        col.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">
                        <i class="fas fa-car me-2"></i>
                        ${auction.car.make} ${auction.car.model} (${auction.car.year})
                    </h5>
                    <div class="auction-stats mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Current Bid</div>
                            <div class="current-price" data-auction-id="${auction.id}">
                                $${auction.currentPrice.toLocaleString()}
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Time Left</div>
                            <div class="time-remaining ${urgencyClass}" data-end-time="${auction.endTime}">
                                ${formatTimeLeft(timeLeft)}
                            </div>
                        </div>
                    </div>
                    <p class="card-text">
                        <small class="text-muted">
                            <i class="fas fa-info-circle me-1"></i>
                            ${auction.car.description || 'No description available'}
                        </small>
                    </p>
                    <button class="btn btn-primary bid-button w-100 open-bid-modal" 
                            data-auction-id="${auction.id}" 
                            data-current-price="${auction.currentPrice}"
                            ${isEnded ? 'disabled' : ''}>
                        <i class="fas fa-gavel me-2"></i>${isEnded ? 'Auction Ended' : 'Place Bid'}
                    </button>
                </div>
            </div>
        `;

        return col;
    }

    function displayPastAuctions(auctions) {
        const container = document.getElementById('pastAuctionsContainer');
        container.innerHTML = '';

        auctions.forEach(auction => {
            const card = document.createElement('div');
            card.className = 'col-md-4 mb-4';
            card.innerHTML = `
                <div class="card auction-card" onclick="AuctionApp.showAuctionDetails(${auction.id})">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="card-title mb-0">
                                ${auction.car.make} ${auction.car.model} (${auction.car.year})
                            </h5>
                            <span class="status-badge ended">Ended</span>
                        </div>
                        <div class="auction-stats">
                            <div class="stat-item">
                                <div class="stat-label">Final Price</div>
                                <div class="stat-value">$${auction.currentPrice.toLocaleString()}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Total Bids</div>
                                <div class="stat-value">${auction.totalBids}</div>
                            </div>
                        </div>
                        <p class="card-text">
                            <small class="text-muted">
                                Ended ${new Date(auction.endTime).toLocaleDateString()}
                            </small>
                        </p>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Bidding Functions
    function handleBidButtonClick(e) {
        const bidButton = e.target.closest('.open-bid-modal');
        if (!bidButton || bidButton.disabled) return;
        
        const auctionId = bidButton.dataset.auctionId;
        const currentPrice = bidButton.dataset.currentPrice;
        openBidModal(auctionId, currentPrice);
    }

    function openBidModal(auctionId, currentPrice) {
        const auction = currentAuctions.find(a => a.id === parseInt(auctionId));
        if (!auction) return;
    
        const modal = new bootstrap.Modal(DOM.bidModal);
        
        DOM.auctionId.value = auctionId;
        updateCurrentBid(currentPrice);
        
        updateMinBidAmount(currentPrice);
        
        // Initial time update
        updateBidModalTimer(auction.endTime);
        
        // Start timer update interval
        const timerInterval = setInterval(() => {
            updateBidModalTimer(auction.endTime);
        }, 1000);
        
        // Join auction-specific SignalR group
        if (connection) {
            connection.invoke("JoinAuction", auctionId)
                .catch(err => console.error("Error joining auction group:", err));
        }
        
        // Clear interval and leave auction group when modal is closed
        DOM.bidModal.addEventListener('hidden.bs.modal', () => {
            clearInterval(timerInterval);
            if (connection) {
                connection.invoke("LeaveAuction", auctionId)
                    .catch(err => console.error("Error leaving auction group:", err));
            }
        }, { once: true });
        
        modal.show();
    }
    
    function updateCurrentBid(amount) {
        DOM.currentBid.textContent = `$${parseFloat(amount).toLocaleString()}`;
    }

    function updateMinBidAmount(currentPrice) {
        const minBid = parseFloat(currentPrice) + 100;
        DOM.bidAmount.min = minBid;
        DOM.bidAmount.value = minBid;
        
        // Update the minimum bid hint
        const minBidHint = document.getElementById('minBidHint');
        if (minBidHint) {
            minBidHint.textContent = `Minimum bid: $${minBid.toLocaleString()}`;
        }
    }
    
    function updateBidModalTimer(endTime) {
        const timeLeft = getTimeLeft(endTime);
        const timeLeftElement = document.getElementById('timeLeft');
        
        if (timeLeft.total <= 0) {
            timeLeftElement.textContent = 'Auction ended';
            timeLeftElement.classList.remove('text-success', 'text-warning');
            timeLeftElement.classList.add('text-danger');
        } else {
            timeLeftElement.textContent = formatTimeLeft(timeLeft);
            
            // Update color based on time remaining
            timeLeftElement.classList.remove('text-success', 'text-warning', 'text-danger');
            if (timeLeft.hours < 1) {
                timeLeftElement.classList.add('text-danger');
            } else if (timeLeft.hours < 4) {
                timeLeftElement.classList.add('text-warning');
            } else {
                timeLeftElement.classList.add('text-success');
            }
        }
    }

    async function handleBidSubmission() {
        const auctionId = DOM.auctionId.value;
        const bidAmount = DOM.bidAmount.value;
        const currentPrice = DOM.currentBid.textContent.replace('$', '').replace(',', '');

        try {
            validateBid(currentPrice, bidAmount);
            
            const response = await fetch('/api/auctions/bid', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    auctionId: parseInt(auctionId),
                    amount: parseFloat(bidAmount),
                    bidderId: "tempUser" // TODO: Replace with actual user ID
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to place bid');
            }

            const modal = bootstrap.Modal.getInstance(DOM.bidModal);
            modal.hide();
            showToast('Success', 'Bid placed successfully!', 'success');
            
            await loadAuctions(); // Refresh auctions
        } catch (error) {
            showToast('Error', error.message, 'error');
        }
    }

    function handleNewBid(bid) {
        // Update the auction card price
        updateAuctionPrice(bid.auctionId, bid.amount);
        
        // Find the auction details from our current auctions
        const auction = currentAuctions.find(a => a.id === bid.auctionId);
        if (!auction) return;

        // Create a detailed message for the toast
        const message = `
            <div class="bid-notification">
                <div class="bid-notification-header mb-2">
                    ${auction.car.make} ${auction.car.model} (${auction.car.year})
                </div>
                <div class="bid-notification-details">
                    <div class="mb-1">
                        <span class="text-muted">Previous:</span> 
                        <span class="previous-price">$${auction.currentPrice.toLocaleString()}</span>
                    </div>
                    <div class="new-price">
                        <span class="text-muted">New Bid:</span> 
                        <span class="fw-bold">$${bid.amount.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;

        // Update the modal if it's open and showing this auction
        const openModalAuctionId = document.getElementById('auctionId').value;
        if (openModalAuctionId && parseInt(openModalAuctionId) === bid.auctionId) {
            updateCurrentBid(bid.amount);
            updateMinBidAmount(bid.amount);
        }

        // Show toast with auction details
        showToast('New Bid Placed', message, 'info');
        
        // Update our local auction data
        auction.currentPrice = bid.amount;
    }

    // Utility Functions
    function validateBid(currentPrice, bidAmount) {
        if (!bidAmount || isNaN(bidAmount)) {
            throw new Error('Please enter a valid bid amount');
        }
        
        const minBid = parseFloat(currentPrice) + 100;
        if (parseFloat(bidAmount) < minBid) {
            throw new Error(`Minimum bid must be $${minBid.toLocaleString()}`);
        }
    }

    function updateAuctionPrice(auctionId, newPrice) {
        const priceElement = document.querySelector(`.current-price[data-auction-id="${auctionId}"]`);
        if (priceElement) {
            const oldPrice = priceElement.textContent.replace('$', '').replace(/,/g, '');
            priceElement.innerHTML = `
                <div class="price-update-container">
                    <div class="new-price">$${parseFloat(newPrice).toLocaleString()}</div>
                    <div class="old-price">was $${parseFloat(oldPrice).toLocaleString()}</div>
                </div>
            `;
            priceElement.classList.add('price-updated');
            setTimeout(() => {
                priceElement.classList.remove('price-updated');
                priceElement.textContent = `$${parseFloat(newPrice).toLocaleString()}`;
            }, 3000);
        }
    }

    function getTimeLeft(endTime) {
        const end = new Date(endTime);
        const now = new Date();
        const diff = end - now;

        if (diff <= 0) {
            return {
                hours: 0,
                minutes: 0,
                seconds: 0,
                total: 0
            };
        }

        return {
            hours: Math.floor(diff / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diff % (1000 * 60)) / 1000),
            total: diff
        };
    }

    function formatTimeLeft(timeLeft) {
        if (timeLeft.total <= 0) return 'Auction ended';
        return `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`;
    }

    function getUrgencyClass(timeLeft) {
        if (timeLeft.total <= 0) return 'text-danger';
        if (timeLeft.hours < 1) return 'text-danger';
        if (timeLeft.hours < 4) return 'text-warning';
        return 'text-success';
    }

    function showToast(title, message, type = 'info') {
        const toastContainer = document.querySelector('.toast-container');
        
        // Get icon based on type
        let icon;
        switch(type) {
            case 'success':
                icon = 'check-circle';
                break;
            case 'error':
                icon = 'exclamation-circle';
                break;
            case 'warning':
                icon = 'exclamation-triangle';
                break;
            default:
                icon = 'info-circle';
        }
        
        const toastHtml = `
            <div class="toast ${type}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <div class="toast-title">
                        <i class="fas fa-${icon} toast-icon" 
                           style="color: var(--${type === 'error' ? 'danger' : type}-color)"></i>
                        ${title}
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = toastContainer.lastElementChild;
        
        // Initialize Bootstrap toast
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000
        });
        
        // Add custom animations
        toastElement.addEventListener('show.bs.toast', () => {
            toastElement.classList.add('showing');
        });
        
        toastElement.addEventListener('hide.bs.toast', () => {
            toastElement.classList.add('hiding');
        });
        
        // Remove toast after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            setTimeout(() => {
                toastElement.remove();
            }, 300); // Match animation duration
        });
        
        toast.show();
    }

    function showLoading(show) {
        DOM.loadingOverlay.classList.toggle('d-none', !show);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Filtering and Sorting
    function filterAuctions() {
        const searchTerm = DOM.searchInput.value.toLowerCase();
        const sortBy = DOM.sortSelect.value;
        
        let filteredAuctions = currentAuctions.filter(auction => {
            const searchString = `${auction.car.make} ${auction.car.model} ${auction.car.year} ${auction.car.description}`.toLowerCase();
            return searchString.includes(searchTerm);
        });

        sortAuctions(filteredAuctions, sortBy);
        displayAuctions(filteredAuctions);
    }

    function sortAuctions(auctions, sortBy) {
        auctions.sort((a, b) => {
            switch(sortBy) {
                case 'endingSoon':
                    return new Date(a.endTime) - new Date(b.endTime);
                case 'priceLow':
                    return a.currentPrice - b.currentPrice;
                case 'priceHigh':
                    return b.currentPrice - a.currentPrice;
                case 'newest':
                    return new Date(b.startTime) - new Date(a.startTime);
                default:
                    return 0;
            }
        });
    }

    function filterPastAuctions() {
        const searchTerm = document.getElementById('pastSearchInput').value.toLowerCase();
        const sortBy = document.getElementById('pastSortSelect').value;
        
        let filtered = pastAuctions.filter(auction => {
            const searchString = `${auction.car.make} ${auction.car.model} ${auction.car.year}`.toLowerCase();
            return searchString.includes(searchTerm);
        });

        sortPastAuctions(filtered, sortBy);
        displayPastAuctions(filtered);
    }

    function sortPastAuctions(auctions, sortBy) {
        auctions.sort((a, b) => {
            switch(sortBy) {
                case 'endedRecent':
                    return new Date(b.endTime) - new Date(a.endTime);
                case 'highestPrice':
                    return b.currentPrice - a.currentPrice;
                case 'mostBids':
                    return b.totalBids - a.totalBids;
                default:
                    return 0;
            }
        });
    }

    // Time Updates
    function startTimeUpdates() {
        setInterval(updateAllTimers, 1000);
    }

    function updateAllTimers() {
        document.querySelectorAll('.time-remaining').forEach(element => {
            const endTime = element.dataset.endTime;
            const timeLeft = getTimeLeft(endTime);
            element.textContent = formatTimeLeft(timeLeft);
            element.className = `time-remaining ${getUrgencyClass(timeLeft)}`;
        });
    }

    function initializeCreateAuction() {
        // Set minimum end date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('endDate').min = tomorrow.toISOString().slice(0, 16);
        
        // Set default year to current year
        document.getElementById('carYear').value = new Date().getFullYear();
        
        // Add event listeners
        document.getElementById('createAuctionModalBtn').addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('createAuctionModal'));
            modal.show();
        });
        
        document.getElementById('createAuctionBtn').addEventListener('click', handleCreateAuction);
    }

    async function handleCreateAuction() {
        try {
            const startingPrice = parseFloat(document.getElementById('startingPrice').value);
            
            // Get form values
            const carData = {
                make: document.getElementById('carMake').value,
                model: document.getElementById('carModel').value,
                year: parseInt(document.getElementById('carYear').value),
                description: document.getElementById('carDescription').value,
                startingPrice: startingPrice
            };

            // Create car first
            const carResponse = await fetch('/api/cars', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(carData)
            });

            if (!carResponse.ok) throw new Error('Failed to create car');
            const car = await carResponse.json();

            // Convert end date to UTC
            const endDate = new Date(document.getElementById('endDate').value);
            
            // Create auction with the new car
            const auctionData = {
                carId: car.id,
                startTime: new Date().toISOString(),
                endTime: endDate.toISOString(),
                startingPrice: startingPrice
            };

            const auctionResponse = await fetch('/api/auctions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(auctionData)
            });

            if (!auctionResponse.ok) throw new Error('Failed to create auction');

            // Close modal and refresh auctions
            const modal = bootstrap.Modal.getInstance(document.getElementById('createAuctionModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('createAuctionForm').reset();
            
            // Show success message and refresh
            showToast('Success', 'Auction created successfully!', 'success');
            await loadAuctions();

        } catch (error) {
            console.error('Error creating auction:', error);
            showToast('Error', error.message, 'error');
        }
    }

    // Public API
    return {
        initialize,
        openBidModal
    };
})();

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', AuctionApp.initialize);

// Make openBidModal globally available if needed
window.openBidModal = AuctionApp.openBidModal;

async function showAuctionDetails(auctionId) {
    try {
        showLoading(true);
        const response = await fetch(`/api/auctions/${auctionId}/details`);
        if (!response.ok) throw new Error('Failed to fetch auction details');
        
        const details = await response.json();
        displayAuctionDetails(details);
        
        const modal = new bootstrap.Modal(document.getElementById('auctionDetailModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading auction details:', error);
        showToast('Error', 'Failed to load auction details', 'error');
    } finally {
        showLoading(false);
    }
}

function displayAuctionDetails(details) {
    // Update basic information
    document.getElementById('detailCarTitle').textContent = 
        `${details.auction.car.make} ${details.auction.car.model} (${details.auction.car.year})`;
    document.getElementById('detailCarDescription').textContent = details.auction.car.description;
    document.getElementById('detailFinalPrice').textContent = `$${details.auction.currentPrice.toLocaleString()}`;
    document.getElementById('detailStartingPrice').textContent = `$${details.auction.startingPrice.toLocaleString()}`;
    document.getElementById('detailTotalBids').textContent = details.auction.totalBids;

    // Create bid history chart
    createBidHistoryChart(details.bidHistory);
    
    // Populate bid history table
    const tableBody = document.getElementById('bidHistoryTable');
    tableBody.innerHTML = '';
    
    details.bidHistory.forEach(bid => {
        const row = document.createElement('tr');
        if (bid.id === details.auction.winningBid?.id) {
            row.classList.add('winning-bid');
        }
        
        row.innerHTML = `
            <td>${new Date(bid.bidTime).toLocaleString()}</td>
            <td>$${bid.amount.toLocaleString()}</td>
            <td>${bid.bidderId}</td>
        `;
        tableBody.appendChild(row);
    });
}

function createBidHistoryChart(bidHistory) {
    const ctx = document.getElementById('bidHistoryChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.bidChart) {
        window.bidChart.destroy();
    }

    const data = bidHistory.map(bid => ({
        x: new Date(bid.bidTime),
        y: bid.amount
    }));

    window.bidChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Bid Amount',
                data: data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `$${value.toLocaleString()}`
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context => `$${context.parsed.y.toLocaleString()}`
                    }
                }
            }
        }
    });
}

// Add event listener for export button
document.getElementById('exportAuctionData').addEventListener('click', async () => {
    const auctionId = document.getElementById('auctionId').value;
    try {
        const response = await fetch(`/api/auctions/${auctionId}/export`);
        if (!response.ok) throw new Error('Failed to export auction data');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auction_${auctionId}_bids.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        showToast('Success', 'Auction data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting auction data:', error);
        showToast('Error', 'Failed to export auction data', 'error');
    }
});

async function loadDashboardStats() {
    try {
        const response = await fetch('/api/auctions/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const stats = await response.json();
        
        // Update stats with animation
        animateNumber('activeAuctionsCount', stats.activeAuctionsCount);
        animateNumber('totalBidsToday', stats.totalBidsToday);
        animateNumber('endingSoonCount', stats.endingSoonCount);
        animateNumber('highestActiveBid', stats.highestActiveBid, true);
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showToast('Error', 'Failed to load dashboard statistics', 'error');
    }
}

function animateNumber(elementId, finalValue, isCurrency = false) {
    const element = document.getElementById(elementId);
    const duration = 1000; // Animation duration in milliseconds
    const steps = 60; // Number of steps in animation
    const stepDuration = duration / steps;
    
    const initialValue = 0;
    const stepValue = (finalValue - initialValue) / steps;
    
    let currentStep = 0;
    let currentValue = initialValue;
    
    const formatValue = (value) => {
        if (isCurrency) {
            return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return value.toLocaleString();
    };
    
    const animation = setInterval(() => {
        currentStep++;
        currentValue += stepValue;
        
        if (currentStep >= steps) {
            clearInterval(animation);
            currentValue = finalValue;
        }
        
        element.textContent = formatValue(Math.round(currentValue));
    }, stepDuration);
}