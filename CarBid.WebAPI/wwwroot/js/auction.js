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
    let currentAuctions = [];
    let watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    let connection = null;
    let bidHistoryChart = null;
    let DOM = {};

    // Utility Functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function showToast(title, message, type = 'info') {
        const toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) return;

        const toastHtml = `
            <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${type}">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                    type === 'error' ? 'exclamation-circle' : 
                                    type === 'warning' ? 'exclamation-triangle' : 
                                    'info-circle'}"></i>
                    <strong class="me-auto">${title}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = toastContainer.lastElementChild;
        
        // Show toast
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000 // Increased to 5 seconds
        });
        toast.show();

        // Handle close animation
        toastElement.addEventListener('hide.bs.toast', () => {
            toastElement.classList.add('hiding');
        });

        // Remove toast after animation
        toastElement.addEventListener('hidden.bs.toast', () => {
            setTimeout(() => {
                toastElement.remove();
            }, 300); // Match animation duration
        });
    }

    // Initialize SignalR connection
    async function initializeSignalR() {
        try {
            connection = new signalR.HubConnectionBuilder()
                .withUrl("/auctionHub")
                .withAutomaticReconnect()
                .build();

            connection.on("BidPlaced", (bid) => {
                updateAuctionAfterBid(bid.auctionId, bid);
            });

            await connection.start();
            console.log("SignalR Connected");
        } catch (err) {
            console.error("SignalR Connection Error: ", err);
        }
    }

    // Initialize the application
    async function initialize() {
        try {
            // Initialize DOM elements
            DOM = {
                auctionsContainer: document.getElementById('auctionsContainer'),
                searchInput: document.getElementById('searchInput'),
                sortSelect: document.getElementById('sortSelect'),
                watchlistFilter: document.getElementById('watchlistFilter'),
                urgencyFilter: document.getElementById('urgencyFilter'),
                refreshButton: document.getElementById('refreshButton'),
                loadingOverlay: document.getElementById('loadingOverlay')
            };

            // Initialize features
            await initializeSignalR();
            attachEventListeners();
            await loadAuctions();
            startTimeUpdates();
        } catch (error) {
            console.error('Initialization error:', error);
            showToast('Error', 'Failed to initialize application', 'error');
        }
    }

    // Event Listeners
    function attachEventListeners() {
        DOM.searchInput?.addEventListener('input', debounce(filterAndSortAuctions, 300));
        DOM.sortSelect?.addEventListener('change', filterAndSortAuctions);
        DOM.watchlistFilter?.addEventListener('change', filterAndSortAuctions);
        DOM.urgencyFilter?.addEventListener('change', filterAndSortAuctions);
        DOM.refreshButton?.addEventListener('click', loadAuctions);
    }

    // Load auctions
    async function loadAuctions() {
        try {
            // Show loading state
            if (DOM.loadingOverlay) {
                DOM.loadingOverlay.classList.remove('d-none');
            }

            // Fetch active auctions from API
            const response = await fetch('/api/auctions/active');
            if (!response.ok) {
                throw new Error('Failed to load auctions');
            }

            const data = await response.json();
            console.log('Loaded auctions:', data);

            // Update current auctions with bid counts
            currentAuctions = await Promise.all(data.map(async (auction) => {
                try {
                    // Fetch bid history for each auction
                    const bidsResponse = await fetch(`/api/auctions/${auction.id}/bids`);
                    if (bidsResponse.ok) {
                        const bids = await bidsResponse.json();
                        return {
                            ...auction,
                            numberOfBids: bids.length,
                            currentPrice: auction.currentPrice || auction.startingPrice
                        };
                    }
                } catch (error) {
                    console.error(`Error fetching bids for auction ${auction.id}:`, error);
                }
                return auction;
            }));
            
            // Refresh the display
            filterAndSortAuctions();
        } catch (error) {
            console.error('Error loading auctions:', error);
            showToast('Error', 'Failed to load auctions', 'error');
        } finally {
            // Hide loading state
            if (DOM.loadingOverlay) {
                DOM.loadingOverlay.classList.add('d-none');
            }
        }
    }

    // Display auctions
    function displayAuctions(auctions) {
        if (!DOM.auctionsContainer) return;

        DOM.auctionsContainer.innerHTML = '';
        
        if (!auctions.length) {
            DOM.auctionsContainer.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No auctions found
                    </div>
                </div>`;
            return;
        }

        auctions.forEach(auction => {
            const card = createAuctionCard(auction);
            if (card) {
                DOM.auctionsContainer.appendChild(card);
            }
        });
    }

    // Create auction card
    function createAuctionCard(auction) {
        const template = document.getElementById('auctionCardTemplate');
        if (!template) {
            console.error('Auction card template not found');
            return null;
        }

        const card = template.content.cloneNode(true).firstElementChild;
        if (!card) {
            console.error('Failed to clone auction card template');
            return null;
        }

        // Set auction ID
        card.dataset.auctionId = auction.id;

        // Remove old controls if they exist
        const oldWatchlistBtn = card.querySelector('.watchlist-btn');
        const oldTimeLeft = card.querySelector('.auction-status');
        if (oldWatchlistBtn) oldWatchlistBtn.remove();
        if (oldTimeLeft) oldTimeLeft.remove();

        // Create controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'auction-controls';
        
        // Create time counter
        const timeLeft = document.createElement('div');
        timeLeft.className = 'time-left';
        
        // Create watchlist button
        const watchlistBtn = document.createElement('button');
        watchlistBtn.className = 'watchlist-btn';
        watchlistBtn.setAttribute('aria-label', 'Toggle watchlist');
        watchlistBtn.innerHTML = `<i class="${watchlist.includes(auction.id) ? 'fas' : 'far'} fa-heart"></i>`;
        
        // Add controls to container
        controlsContainer.appendChild(timeLeft);
        controlsContainer.appendChild(watchlistBtn);

        // Handle image and placeholder
        const imageContainer = card.querySelector('.auction-image');
        if (imageContainer) {
            imageContainer.appendChild(controlsContainer);
            
            // Add image or placeholder
            const img = card.querySelector('img');
            if (img) {
                if (auction.imageUrl && auction.imageUrl.trim()) {
                    img.src = auction.imageUrl;
                    img.alt = `${auction.year} ${auction.make} ${auction.model}`;
                    imageContainer.classList.remove('no-image');
                } else {
                    img.remove(); // Remove img element if no image
                    imageContainer.classList.add('no-image');
                }
            }
        }

        // Set title
        const title = card.querySelector('.auction-title');
        if (title) {
            title.textContent = `${auction.year} ${auction.make} ${auction.model}`;
        }

        // Set description
        const description = card.querySelector('.auction-description');
        if (description) {
            description.textContent = auction.description || 'No description available';
        }

        // Set current bid
        const currentBid = card.querySelector('.current-price');
        if (currentBid) {
            const priceValue = currentBid.querySelector('.value');
            const priceLabel = currentBid.querySelector('small');
            
            if (auction.currentPrice > auction.startingPrice) {
                if (priceValue) priceValue.textContent = `$${auction.currentPrice.toLocaleString()}`;
                if (priceLabel) priceLabel.textContent = 'Current bid';
            } else {
                if (priceValue) priceValue.textContent = `$${auction.startingPrice.toLocaleString()}`;
                if (priceLabel) priceLabel.textContent = 'Starting price';
            }
        }

        // Set bid count
        const bidCount = card.querySelector('.bid-count');
        if (bidCount) {
            const bidSpan = bidCount.querySelector('span');
            const bidsText = bidCount.lastChild;
            const numberOfBids = auction.numberOfBids || 0;
            
            if (bidSpan) {
                bidSpan.textContent = numberOfBids;
            }
            
            // Update the text to be grammatically correct
            if (bidsText) {
                bidsText.textContent = ` bid${numberOfBids !== 1 ? 's' : ''}`;
            }

            // Add color indication for bid activity
            if (numberOfBids > 0) {
                bidCount.classList.add('has-bids');
            } else {
                bidCount.classList.remove('has-bids');
            }
        }

        // Add watchlist button functionality
        watchlistBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isInWatchlist = watchlist.includes(auction.id);
            
            // Toggle watchlist state with animation
            const icon = watchlistBtn.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(0.5)';
                setTimeout(() => {
                    icon.className = isInWatchlist ? 'far fa-heart' : 'fas fa-heart';
                    icon.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        icon.style.transform = '';
                    }, 150);
                }, 150);
            }

            // Update watchlist
            if (isInWatchlist) {
                watchlist = watchlist.filter(id => id !== auction.id);
            } else {
                watchlist.push(auction.id);
            }
            
            // Save to localStorage
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            
            // Show feedback toast
            showToast(
                isInWatchlist ? 'Removed from Watchlist' : 'Added to Watchlist',
                `${auction.year} ${auction.make} ${auction.model} ${isInWatchlist ? 'removed from' : 'added to'} your watchlist`,
                'success'
            );
        });

        // Initialize time left
        updateTimeLeft(auction, card);

        return card;
    }

    // Update time left
    function updateTimeLeft(auction, card) {
        const timeLeftElement = card.querySelector('.time-left');
        if (!timeLeftElement) return;

        const now = new Date();
        const end = new Date(auction.endTime);
        const timeLeft = end.getTime() - now.getTime();

        if (timeLeft <= 0) {
            timeLeftElement.textContent = 'Ended';
            timeLeftElement.classList.add('ended');
            return;
        }

        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        let timeString;
        if (days > 0) {
            timeString = `${days}d ${hours}h`;
        } else if (hours > 0) {
            timeString = `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            timeString = `${minutes}m ${seconds}s`;
        } else {
            timeString = `${seconds}s`;
        }

        // Update classes first
        timeLeftElement.classList.remove('ending-soon', 'ending-very-soon', 'ended');
        
        if (timeLeft <= 3600000) { // Less than 1 hour
            timeLeftElement.classList.add('ending-very-soon');
        } else if (timeLeft <= 14400000) { // Less than 4 hours
            timeLeftElement.classList.add('ending-soon');
        }

        // Set the time text
        timeLeftElement.textContent = timeString;
    }

    // Start time updates
    function startTimeUpdates() {
        setInterval(() => {
            const cards = DOM.auctionsContainer?.querySelectorAll('.auction-card');
            cards?.forEach(card => {
                const auctionId = card.dataset.auctionId;
                const auction = currentAuctions.find(a => a.id === parseInt(auctionId));
                if (auction) {
                    // Check if auction has ended
                    const now = new Date();
                    const endTime = new Date(auction.endTime);
                    if (endTime.getTime() <= now.getTime() && auction.isActive) {
                        auction.isActive = false;
                        // Refresh display to show ended state
                        filterAndSortAuctions();
                    } else {
                        updateTimeLeft(auction, card);
                    }
                }
            });
        }, 1000);
    }

    // Filter and sort auctions
    function filterAndSortAuctions() {
        const searchTerm = DOM.searchInput?.value.toLowerCase() || '';
        const sortBy = DOM.sortSelect?.value || 'endingSoon';
        const watchlistOnly = DOM.watchlistFilter?.checked || false;
        const urgencyFilter = DOM.urgencyFilter?.value || 'all';

        let filtered = [...currentAuctions];

        // Filter out ended auctions that are not active
        filtered = filtered.filter(auction => {
            const endTime = new Date(auction.endTime);
            const now = new Date();
            return auction.isActive || endTime.getTime() > now.getTime();
        });

        // Apply watchlist filter
        if (watchlistOnly) {
            filtered = filtered.filter(auction => watchlist.includes(auction.id));
        }

        // Apply urgency filter
        const now = new Date();
        if (urgencyFilter !== 'all') {
            filtered = filtered.filter(auction => {
                const endTime = new Date(auction.endTime);
                const timeLeft = endTime.getTime() - now.getTime();
                const hoursLeft = timeLeft / (1000 * 60 * 60);
                
                // Only include active auctions (not ended)
                if (timeLeft <= 0) return false;
                
                switch (urgencyFilter) {
                    case 'ending1h':
                        return hoursLeft <= 1;
                    case 'ending4h':
                        return hoursLeft <= 4;
                    case 'ending24h':
                        return hoursLeft <= 24;
                    default:
                        return true;
                }
            });
        }

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(auction => 
                auction.make?.toLowerCase().includes(searchTerm) ||
                auction.model?.toLowerCase().includes(searchTerm) ||
                auction.description?.toLowerCase().includes(searchTerm) ||
                auction.year?.toString().includes(searchTerm)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            const aEndTime = new Date(a.endTime);
            const bEndTime = new Date(b.endTime);
            const aTimeLeft = aEndTime.getTime() - now.getTime();
            const bTimeLeft = bEndTime.getTime() - now.getTime();
            
            // Check if auctions have ended
            const aEnded = aTimeLeft <= 0;
            const bEnded = bTimeLeft <= 0;
            
            switch (sortBy) {
                case 'endingSoon':
                    // Put ended auctions at the end
                    if (aEnded && !bEnded) return 1;
                    if (!aEnded && bEnded) return -1;
                    if (aEnded && bEnded) return bEndTime.getTime() - aEndTime.getTime(); // Most recently ended first
                    return aTimeLeft - bTimeLeft; // Sort by time remaining
                case 'mostBids':
                    return (b.numberOfBids || 0) - (a.numberOfBids || 0);
                case 'priceHighToLow':
                    return (b.currentBid || b.startingPrice || 0) - (a.currentBid || a.startingPrice || 0);
                case 'priceLowToHigh':
                    return (a.currentBid || a.startingPrice || 0) - (b.currentBid || b.startingPrice || 0);
                case 'newest':
                    return b.createdAt ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : 0;
                default:
                    return 0;
            }
        });

        displayAuctions(filtered);
    }

    // Update auction after new bid
    function updateAuctionAfterBid(auctionId, bidData) {
        const auction = currentAuctions.find(a => a.id === auctionId);
        if (auction) {
            auction.currentPrice = bidData.amount;
            auction.numberOfBids = (auction.numberOfBids || 0) + 1;
            filterAndSortAuctions();
        }
    }

    // Return public methods
    return {
        initialize,
        filterAndSortAuctions,
        toggleWatchlist: (id) => {
            const index = watchlist.indexOf(id);
            if (index === -1) {
                watchlist.push(id);
            } else {
                watchlist.splice(index, 1);
            }
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            filterAndSortAuctions();
        },
        showBidModal: (auctionId) => {
            const auction = currentAuctions.find(a => a.id === parseInt(auctionId));
            if (!auction) {
                showToast('Error', 'Auction not found', 'error');
                return;
            }

            // Debug time information
            const now = new Date();
            const endTime = new Date(auction.endTime);
            console.log('Time Debug:', {
                now: now.toISOString(),
                endTime: auction.endTime,
                endTimeDate: endTime.toISOString(),
                timeLeft: endTime.getTime() - now.getTime(),
                hasEnded: endTime.getTime() <= now.getTime()
            });

            if (endTime.getTime() <= now.getTime()) {
                showToast('Error', 'This auction has ended', 'error');
                return;
            }

            // Get modal elements
            const bidModal = document.getElementById('bidModal');
            const modalTitle = bidModal.querySelector('#bidModalTitle');
            const currentBidElement = bidModal.querySelector('#currentBid');
            const bidAmountInput = bidModal.querySelector('#bidAmount');
            const bidModalDescription = bidModal.querySelector('#bidModalDescription');
            const placeBidBtn = bidModal.querySelector('#placeBidBtn');
            const auctionIdInput = bidModal.querySelector('#auctionId');

            // Set modal content
            modalTitle.textContent = `Place Bid - ${auction.year} ${auction.make} ${auction.model}`;
            const currentPrice = auction.currentBid || auction.startingPrice;
            currentBidElement.textContent = `$${currentPrice.toLocaleString()}`;
            bidAmountInput.value = '';
            bidAmountInput.min = currentPrice + 100;
            bidModalDescription.textContent = `Minimum bid increment: $100. Current bid: $${currentPrice.toLocaleString()}`;
            auctionIdInput.value = auction.id;

            // Handle quick bid buttons
            const quickBidButtons = bidModal.querySelectorAll('.quick-bid-btn');
            quickBidButtons.forEach(btn => {
                const increment = parseInt(btn.dataset.increment);
                const newBid = currentPrice + increment;
                btn.textContent = `+$${increment.toLocaleString()} ($${newBid.toLocaleString()})`;
                
                // Add click handler
                btn.onclick = () => {
                    bidAmountInput.value = newBid;
                };
            });

            // Handle place bid button
            placeBidBtn.onclick = async () => {
                const bidAmount = parseInt(bidAmountInput.value);
                if (!bidAmount || bidAmount <= currentPrice) {
                    showToast('Error', `Bid must be higher than current bid ($${currentPrice.toLocaleString()})`, 'error');
                    return;
                }

                // Check end time again before submitting
                const nowCheck = new Date();
                const endTimeCheck = new Date(auction.endTime);
                if (endTimeCheck.getTime() <= nowCheck.getTime()) {
                    showToast('Error', 'This auction has ended', 'error');
                    return;
                }

                try {
                    // Show loading state
                    placeBidBtn.disabled = true;
                    placeBidBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Placing Bid...';

                    // Get the current user ID (you'll need to implement this based on your auth system)
                    const bidderId = "user123"; // Replace with actual user ID

                    // Prepare the bid data
                    const bidData = {
                        auctionId: auction.id,
                        amount: bidAmount,
                        bidderId: bidderId
                    };

                    console.log('Placing bid with data:', bidData);

                    // Make API call to place bid
                    const response = await fetch('/api/auctions/bid', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(bidData)
                    });

                    const responseData = await response.json();
                    console.log('Bid response:', responseData);

                    if (!response.ok) {
                        throw new Error(responseData.message || responseData.error || 'Failed to place bid');
                    }
                    
                    // Close modal
                    const modal = bootstrap.Modal.getInstance(bidModal);
                    modal.hide();
                    
                    // Show success message
                    showToast('Success', `Bid of $${bidAmount.toLocaleString()} placed successfully!`, 'success');

                    // Update will come through SignalR
                } catch (error) {
                    console.error('Error placing bid:', error);
                    showToast('Error', error.message || 'Failed to place bid', 'error');
                } finally {
                    // Reset button state
                    placeBidBtn.disabled = false;
                    placeBidBtn.innerHTML = 'Place Bid';
                }
            };

            // Show modal
            const modal = new bootstrap.Modal(bidModal);
            modal.show();
        }
    };
})();

// Initialize when document is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AuctionApp.initialize);
} else {
    AuctionApp.initialize();
}

// Make AuctionApp available globally
window.AuctionApp = AuctionApp;