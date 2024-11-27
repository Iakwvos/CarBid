const AuctionApp = (() => {
    // State management
    let connection = null;
    let currentAuctions = [];

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
            await initializeSignalR();
            await loadAuctions();
            startTimeUpdates();
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
                            data-current-price="${auction.currentPrice}">
                        <i class="fas fa-gavel me-2"></i>Place Bid
                    </button>
                </div>
            </div>
        `;

        return col;
    }

    // Bidding Functions
    function handleBidButtonClick(e) {
        const bidButton = e.target.closest('.open-bid-modal');
        if (!bidButton) return;
        
        const auctionId = bidButton.dataset.auctionId;
        const currentPrice = bidButton.dataset.currentPrice;
        openBidModal(auctionId, currentPrice);
    }

    function openBidModal(auctionId, currentPrice) {
        const auction = currentAuctions.find(a => a.id === parseInt(auctionId));
        if (!auction) return;

        const modal = new bootstrap.Modal(DOM.bidModal);
        
        DOM.auctionId.value = auctionId;
        DOM.currentBid.textContent = `$${parseFloat(currentPrice).toLocaleString()}`;
        
        const minBid = parseFloat(currentPrice) + 100;
        DOM.bidAmount.min = minBid;
        DOM.bidAmount.value = minBid;
        
        const timeLeft = getTimeLeft(auction.endTime);
        DOM.timeLeft.textContent = formatTimeLeft(timeLeft);
        
        modal.show();
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
        updateAuctionPrice(bid.auctionId, bid.amount);
        showToast('New Bid', `New bid placed: $${bid.amount.toLocaleString()}`, 'info');
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
            priceElement.textContent = `$${newPrice.toLocaleString()}`;
            priceElement.classList.remove('price-update');
            void priceElement.offsetWidth; // Trigger reflow
            priceElement.classList.add('price-update');
        }
    }

    function getTimeLeft(endTime) {
        const end = new Date(endTime);
        const now = new Date();
        const diff = end - now;

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
        const toastHtml = `
            <div class="toast ${type}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <strong class="me-auto">${title}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
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