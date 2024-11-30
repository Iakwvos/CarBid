document.addEventListener('DOMContentLoaded', () => {
    // Verify modal elements are present
    const modalCheck = {
        modal: !!document.getElementById('auctionDetailModal'),
        title: !!document.getElementById('auctionDetailTitle'),
        price: !!document.getElementById('auctionDetailCurrentPrice'),
        description: !!document.getElementById('auctionDetailDescription'),
        bidHistory: !!document.getElementById('bidHistoryBody')
    };
    
    console.log('Modal elements check on page load:', modalCheck);
    
    if (!Object.values(modalCheck).every(Boolean)) {
        console.error('Some modal elements are missing on page load!');
    }
});

const AuctionApp = (() => {
    // State management
    let connection = null;
    let currentAuctions = [];
    let pastAuctions = [];
    let DOM = {};

    async function initialize() {
        try {
            // Initialize DOM elements
            DOM = {
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
                auctionId: document.getElementById('auctionId'),
                blurOverlay: document.getElementById('auctionsBlurOverlay')
            };

            // Check authentication state
            const isAuthenticated = AuthService.getCurrentUser() !== null;
            
            if (isAuthenticated && DOM.blurOverlay) {
                DOM.blurOverlay.classList.add('d-none');
            }

            await initializeSignalR();
            attachEventListeners();
            
            // Load data based on auth state
            if (isAuthenticated) {
                await Promise.all([
                    loadAuctions(),
                    loadPastAuctions(),
                    loadDashboardStats()
                ]);
            } else {
                displayPlaceholderAuctions();
                await loadDashboardStats(); // Still load public stats
            }
            
            startTimeUpdates();
            setInterval(loadDashboardStats, 30000);
            showDebugInfo();
        } catch (error) {
            console.error('Initialization error:', error);
            showToast('Error', 'Failed to initialize application', 'error');
        }
    }

    // Event Listeners
    function attachEventListeners() {
        // Only attach event listeners if elements exist
        if (DOM.refreshButton) {
            DOM.refreshButton.addEventListener('click', loadAuctions);
        }
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener('input', debounce(filterAuctions, 300));
        }
        if (DOM.sortSelect) {
            DOM.sortSelect.addEventListener('change', filterAuctions);
        }
        if (DOM.auctionsContainer) {
            DOM.auctionsContainer.addEventListener('click', handleBidButtonClick);
        }

        // Optional elements
        document.getElementById('pastSearchInput')?.addEventListener('input', 
            debounce(filterPastAuctions, 300));
        document.getElementById('pastSortSelect')?.addEventListener('change', 
            filterPastAuctions);
        document.getElementById('createAuctionModalBtn')?.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('createAuctionModal'));
            modal?.show();
        });

        // Add bid button listener
        DOM.placeBidBtn?.addEventListener('click', handleBidSubmission);
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
        if (!AuthService.getCurrentUser()) {
            return;
        }
        showLoading(true);
        try {
            console.log('Loading auctions...');
            const response = await fetch('/api/auctions/active', {
                headers: getAuthHeaders()
            });

            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Received data:', data);

            if (!response.ok) {
                throw new Error('Failed to fetch auctions');
            }
            
            currentAuctions = data;
            console.log('Current auctions:', currentAuctions);

            displayAuctions(currentAuctions);

            if (connection?.state === 'Connected') {
                currentAuctions.forEach(async (auction) => {
                    await connection.invoke("JoinAuction", auction.id);
                });
            }
        } catch (error) {
            console.error('Error loading auctions:', error);
            showToast('Error', 'Failed to load auctions', 'error');
            if (DOM.auctionsContainer) {
                DOM.auctionsContainer.innerHTML = `
                    <div class="col-12">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            Error loading auctions: ${error.message}
                        </div>
                    </div>`;
            }
        } finally {
            showLoading(false);
        }
    }

    async function loadPastAuctions() {
        if (!AuthService.getCurrentUser()) {
            return;
        }
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
        console.log('Displaying auctions:', auctions);
        
        if (!DOM.auctionsContainer) {
            console.error('Auctions container not found');
            return;
        }
        
        DOM.auctionsContainer.innerHTML = '';
        
        if (!auctions || auctions.length === 0) {
            console.log('No auctions to display');
            DOM.auctionsContainer.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No active auctions found
                    </div>
                </div>`;
            return;
        }

        console.log(`Creating ${auctions.length} auction cards`);
        auctions.forEach(auction => {
            const card = createAuctionCard(auction);
            DOM.auctionsContainer.appendChild(card);
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
                        ${auction.car?.make} ${auction.car?.model} (${auction.car?.year})
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
                            ${auction.car?.description || 'No description available'}
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
        if (connection?.state === signalR.HubConnectionState.Connected) {
            connection.invoke("JoinAuction", parseInt(auctionId))
                .catch(err => {
                    console.error("Error joining auction group:", err);
                    showToast('Error', 'Failed to join auction group', 'error');
                });
        }
        
        // Clear interval and leave auction group when modal is closed
        DOM.bidModal.addEventListener('hidden.bs.modal', () => {
            clearInterval(timerInterval);
            if (connection?.state === signalR.HubConnectionState.Connected) {
                connection.invoke("LeaveAuction", parseInt(auctionId))
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
                headers: getAuthHeaders(),
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

    // Add this new function alongside other functions but before the return statement
    async function showAuctionDetails(auctionId) {
        try {
            const modalElements = {
                modal: document.getElementById('auctionDetailModal'),
                title: document.getElementById('auctionDetailTitle'),
                price: document.getElementById('auctionDetailCurrentPrice'),
                description: document.getElementById('auctionDetailDescription'),
                bidHistory: document.getElementById('bidHistoryBody'),
                winner: document.getElementById('auctionWinner'),
                totalBids: document.getElementById('totalBids')
            };

            const missingElements = Object.entries(modalElements)
                .filter(([key, element]) => !element)
                .map(([key]) => key);

            if (missingElements.length > 0) {
                throw new Error(`Missing modal elements: ${missingElements.join(', ')}`);
            }

            const response = await fetch(`/api/auctions/${auctionId}/details`);
            if (!response.ok) throw new Error('Failed to fetch auction details');
            
            const details = await response.json();
            
            const car = details?.auction?.car;
            const carTitle = car ? `${car.make} ${car.model} (${car.year})` : 'Car Details Not Available';
            const carDescription = car?.description || 'No description available';
            const currentPrice = details?.auction?.currentPrice || 0;
            const winnerName = details?.winningBid?.bidderId || 'No Winner';

            // Update modal content
            modalElements.title.textContent = carTitle;
            modalElements.description.textContent = carDescription;
            modalElements.price.textContent = `$${currentPrice.toLocaleString()}`;
            modalElements.winner.textContent = winnerName;
            
            if (Array.isArray(details.bidHistory)) {
                const sortedBids = details.bidHistory.sort((a, b) => 
                    new Date(b.bidTime) - new Date(a.bidTime)
                );

                modalElements.totalBids.textContent = `${sortedBids.length} Bids`;

                const bidHistoryHtml = sortedBids.length > 0 
                    ? sortedBids.map(bid => `
                        <tr class="bid-row">
                            <td>
                                <div class="d-flex align-items-center">
                                    <i class="bi bi-clock me-2 text-muted"></i>
                                    <div>
                                        <div class="fw-medium">${new Date(bid.bidTime).toLocaleDateString()}</div>
                                        <small class="text-muted">${new Date(bid.bidTime).toLocaleTimeString()}</small>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="bid-amount">$${bid.amount.toLocaleString()}</span>
                            </td>
                            <td>
                                <div class="d-flex align-items-center">
                                    <i class="bi bi-person-circle me-2"></i>
                                    <span class="fw-medium">${bid.bidderId}</span>
                                </div>
                            </td>
                            <td>
                                ${bid.id === details?.winningBid?.id 
                                    ? '<span class="badge bg-success"><i class="bi bi-trophy-fill me-1"></i>Winner</span>' 
                                    : '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Outbid</span>'
                                }
                            </td>
                        </tr>
                    `).join('')
                    : `<tr>
                        <td colspan="4" class="text-center py-5">
                            <div class="text-muted">
                                <i class="bi bi-inbox-fill h3 mb-3 d-block"></i>
                                <p class="mb-0">No bids have been placed on this auction</p>
                            </div>
                        </td>
                    </tr>`;

                modalElements.bidHistory.innerHTML = bidHistoryHtml;
            } else {
                modalElements.totalBids.textContent = '0 Bids';
                modalElements.bidHistory.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-4">
                            <i class="bi bi-exclamation-circle text-warning me-2"></i>
                            Bid history unavailable
                        </td>
                    </tr>
                `;
            }
            
            const modal = new bootstrap.Modal(modalElements.modal);
            modal.show();

        } catch (error) {
            showToast('Error', `Failed to load auction details: ${error.message}`, 'error');
        }
    }

    // Add new function to display placeholder content
    function displayPlaceholderAuctions() {
        if (DOM.auctionsContainer) {
            DOM.auctionsContainer.innerHTML = Array(6).fill(0).map(() => `
                <div class="col-md-4">
                    <div class="auction-card">
                        <div class="card-body">
                            <h5 class="card-title placeholder-glow">
                                <span class="placeholder col-6"></span>
                            </h5>
                            <p class="card-text placeholder-glow">
                                <span class="placeholder col-7"></span>
                                <span class="placeholder col-4"></span>
                                <span class="placeholder col-4"></span>
                                <span class="placeholder col-6"></span>
                                <span class="placeholder col-8"></span>
                            </p>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        if (DOM.blurOverlay) {
            DOM.blurOverlay.classList.remove('d-none');
        }
    }

    // In the return statement, add showAuctionDetails while keeping existing returns
    return {
        initialize,
        loadAuctions,
        loadPastAuctions,
        handleNewBid,
        showAuctionDetails,
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
    // Safely access car details with optional chaining and fallback values
    const car = details.auction?.car || {};
    const carTitle = car.make && car.model ? 
        `${car.make} ${car.model} ${car.year ? `(${car.year})` : ''}` : 
        'Car Details Unavailable';

    // Update basic information with null checks
    document.getElementById('detailCarTitle').textContent = carTitle;
    document.getElementById('detailCarDescription').textContent = car.description || 'No description available';
    document.getElementById('detailFinalPrice').textContent = 
        `$${(details.auction?.currentPrice || 0).toLocaleString()}`;
    
    // Create bid history table
    const bidHistoryContainer = document.getElementById('bidHistoryContainer');
    const bidHistory = details.bidHistory || [];
    const winningBid = details.winningBid;

    bidHistoryContainer.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Amount</th>
                        <th>Bidder</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${bidHistory
                        .sort((a, b) => new Date(b.bidTime) - new Date(a.bidTime))
                        .map(bid => `
                            <tr class="${bid.id === winningBid?.id ? 'table-success' : ''}">
                                <td>${new Date(bid.bidTime).toLocaleString()}</td>
                                <td>$${bid.amount.toLocaleString()}</td>
                                <td>${bid.bidderId}</td>
                                <td>${bid.id === winningBid?.id ? 
                                    '<span class="badge bg-success">Winner</span>' : 
                                    '<span class="badge bg-secondary">Bid</span>'}
                                </td>
                            </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="text-muted mt-2">
            <small><i class="fas fa-info-circle me-1"></i>Total Bids: ${bidHistory.length}</small>
        </div>
    `;
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

function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

function showDebugInfo() {
    const debugInfo = document.getElementById('debug-info');
    const debugContent = document.getElementById('debug-content');
    if (debugInfo && debugContent) {
        debugInfo.style.display = 'block';
        debugContent.innerHTML = `
            <pre>
Current Auctions: ${JSON.stringify(currentAuctions, null, 2)}
DOM Elements Present:
- auctionsContainer: ${!!DOM.auctionsContainer}
- searchInput: ${!!DOM.searchInput}
- sortSelect: ${!!DOM.sortSelect}
- loadingOverlay: ${!!DOM.loadingOverlay}
            </pre>
        `;
    }
}