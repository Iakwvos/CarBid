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
                                    'info-circle'} me-2"></i>
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
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 3000
        });

        toast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
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
            // Simulated data for now - replace with actual API call
            currentAuctions = [
                {
                    id: 1,
                    make: 'Smart',
                    model: 'Brabus',
                    year: 2000,
                    description: 'Washing Machine',
                    currentBid: 1000,
                    startingPrice: 1000,
                    numberOfBids: 0,
                    endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
                    imageUrl: ''
                },
                {
                    id: 2,
                    make: 'Honda',
                    model: 'Civic',
                    year: 2006,
                    description: 'Reliable Car running on LPG',
                    currentBid: 5000,
                    startingPrice: 5000,
                    numberOfBids: 0,
                    endTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days from now
                    imageUrl: ''
                },
                {
                    id: 3,
                    make: 'Opel',
                    model: 'Corsa',
                    year: 2017,
                    description: "Dad's car",
                    currentBid: 15000,
                    startingPrice: 15000,
                    numberOfBids: 0,
                    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
                    imageUrl: ''
                }
            ];
            
            filterAndSortAuctions();
        } catch (error) {
            console.error('Error loading auctions:', error);
            showToast('Error', 'Failed to load auctions', 'error');
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
        
        // Add controls to card
        const imageContainer = card.querySelector('.auction-image');
        if (imageContainer) {
            imageContainer.appendChild(controlsContainer);
        }

        // Set image
        const img = card.querySelector('img');
        if (img) {
            img.src = auction.imageUrl || '';
            img.alt = `${auction.year} ${auction.make} ${auction.model}`;
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
        const currentBid = card.querySelector('.current-price .value');
        if (currentBid) {
            const price = auction.currentBid || auction.startingPrice || 0;
            currentBid.textContent = `$${price.toLocaleString()}`;
        }

        // Set bid count
        const bidCount = card.querySelector('.bid-count span');
        if (bidCount) {
            bidCount.textContent = auction.numberOfBids || 0;
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
        const timeLeft = end - now;

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
                    updateTimeLeft(auction, card);
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

        // Apply watchlist filter
        if (watchlistOnly) {
            filtered = filtered.filter(auction => watchlist.includes(auction.id));
        }

        // Apply urgency filter
        const now = new Date();
        if (urgencyFilter !== 'all') {
            filtered = filtered.filter(auction => {
                const endTime = new Date(auction.endTime);
                const timeLeft = endTime - now;
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
            const aTimeLeft = aEndTime - now;
            const bTimeLeft = bEndTime - now;
            
            // Check if auctions have ended
            const aEnded = aTimeLeft <= 0;
            const bEnded = bTimeLeft <= 0;
            
            switch (sortBy) {
                case 'endingSoon':
                    // Put ended auctions at the end
                    if (aEnded && !bEnded) return 1;
                    if (!aEnded && bEnded) return -1;
                    if (aEnded && bEnded) return bEndTime - aEndTime; // Most recently ended first
                    return aTimeLeft - bTimeLeft; // Sort by time remaining
                case 'mostBids':
                    return (b.numberOfBids || 0) - (a.numberOfBids || 0);
                case 'priceHighToLow':
                    return (b.currentBid || b.startingPrice || 0) - (a.currentBid || a.startingPrice || 0);
                case 'priceLowToHigh':
                    return (a.currentBid || a.startingPrice || 0) - (b.currentBid || b.startingPrice || 0);
                case 'newest':
                    return b.createdAt ? new Date(b.createdAt) - new Date(a.createdAt) : 0;
                default:
                    return 0;
            }
        });

        displayAuctions(filtered);
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