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
    let currentUser = null;

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

    // Show toast notification
    function showToast(title, message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '1050';
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toastHtml = `
            <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${type}">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                    type === 'error' ? 'exclamation-circle' : 
                                    type === 'warning' ? 'exclamation-triangle' : 
                                    'gavel'} me-2"></i>
                    <strong class="me-auto">${title}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;

        // Add toast to container
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = toastContainer.lastElementChild;

        // Initialize Bootstrap toast
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000
        });

        // Add animation classes
        toastElement.classList.add('toast-animation');

        // Show toast
        toast.show();

        // Remove toast after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            setTimeout(() => {
                toastElement.remove();
            }, 300);
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
                console.log('Received bid:', bid);
                const auction = currentAuctions.find(a => a.id === bid.auctionId);
                if (auction) {
                    const oldPrice = auction.currentPrice;
                    updateAuctionAfterBid(bid.auctionId, bid);
                    
                    // Show toast for price change
                    const priceChange = bid.amount - oldPrice;
                    const percentageChange = ((priceChange / oldPrice) * 100).toFixed(1);
                    
                    // Only show toast for other users' bids
                    if (bid.applicationUserId !== currentUser?.id) {
                        showToast(
                            'New Bid Placed', 
                            `<div class="bid-update">
                                <div class="auction-info">${auction.year} ${auction.make} ${auction.model}</div>
                                <div class="price-change">
                                    <span class="old-price">$${oldPrice.toLocaleString()}</span>
                                    <i class="fas fa-arrow-right mx-2"></i>
                                    <span class="new-price">$${bid.amount.toLocaleString()}</span>
                                </div>
                                <div class="change-stats">
                                    <span class="increase">+$${priceChange.toLocaleString()} (+${percentageChange}%)</span>
                                </div>
                                <div class="bidder-info">
                                    <i class="fas fa-user me-1"></i> ${bid.bidderId}
                                </div>
                            </div>`,
                            'info'
                        );
                    }
                }
            });

            await connection.start();
            console.log("SignalR Connected");

            // Join auction groups for all current auctions
            currentAuctions.forEach(async (auction) => {
                try {
                    await connection.invoke("JoinAuction", auction.id);
                    console.log(`Joined auction group: ${auction.id}`);
                } catch (err) {
                    console.error(`Error joining auction group ${auction.id}:`, err);
                }
            });

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
                loadingOverlay: document.getElementById('loadingOverlay'),
                createAuctionBtn: document.getElementById('createAuctionBtn')
            };

            // Get current user info
            await getCurrentUser();

            // Show/hide create auction button based on authentication
            if (currentUser?.id) {
                DOM.createAuctionBtn?.classList.remove('d-none');
            } else {
                DOM.createAuctionBtn?.classList.add('d-none');
            }

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

    // Get current user information
    async function getCurrentUser() {
        try {
            // Get user info from localStorage
            const userJson = localStorage.getItem('user');
            if (!userJson) {
                console.log('No user found in localStorage');
                return null;
            }

            const user = JSON.parse(userJson);
            currentUser = {
                id: user.id,
                email: user.email,
                fullName: `${user.firstName} ${user.lastName}`.trim()
            };
            
            console.log('Current user:', currentUser);
            return currentUser;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }

    // Event Listeners
    function attachEventListeners() {
        DOM.searchInput?.addEventListener('input', debounce(filterAndSortAuctions, 300));
        DOM.sortSelect?.addEventListener('change', filterAndSortAuctions);
        DOM.watchlistFilter?.addEventListener('change', filterAndSortAuctions);
        DOM.urgencyFilter?.addEventListener('change', filterAndSortAuctions);
        DOM.refreshButton?.addEventListener('click', loadAuctions);

        // Add create auction button listener
        const createAuctionBtn = document.getElementById('createAuctionBtn');
        createAuctionBtn?.addEventListener('click', () => {
            showCreateAuctionModal();
        });
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
            
            // Join auction groups for all loaded auctions
            if (connection && connection.state === signalR.HubConnectionState.Connected) {
                currentAuctions.forEach(async (auction) => {
                    try {
                        await connection.invoke("JoinAuction", auction.id);
                        console.log(`Joined auction group: ${auction.id}`);
                    } catch (err) {
                        console.error(`Error joining auction group ${auction.id}:`, err);
                    }
                });
            }

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
            
            // Clear existing carousel content
            const carousel = card.querySelector('.carousel-inner');
            if (carousel) {
                carousel.innerHTML = '';
                
                if (auction.imageUrls && auction.imageUrls.length > 0) {
                    auction.imageUrls.forEach((imageUrl, index) => {
                        const carouselItem = document.createElement('div');
                        carouselItem.className = `carousel-item ${index === 0 ? 'active' : ''}`;
                        carouselItem.innerHTML = `
                            <img src="${imageUrl}" class="d-block w-100" alt="${auction.year} ${auction.make} ${auction.model}">
                        `;
                        carousel.appendChild(carouselItem);
                    });
                    imageContainer.classList.remove('no-image');
                } else {
                    // Add placeholder for no images
                    const placeholderItem = document.createElement('div');
                    placeholderItem.className = 'carousel-item active no-image';
                    placeholderItem.innerHTML = `
                        <div class="placeholder-content">
                            <i class="fas fa-car fa-3x mb-3"></i>
                            <p>No image available</p>
                        </div>
                    `;
                    carousel.appendChild(placeholderItem);
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

        // Set bid count with click handler
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
                // Make clickable only if there are bids
                bidCount.style.cursor = 'pointer';
                bidCount.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await showBidHistory(auction.id);
                };
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

            // Update UI elements
            const card = document.querySelector(`[data-auction-id="${auctionId}"]`);
            if (card) {
                // Update current price
                const priceValue = card.querySelector('.current-price .value');
                const priceLabel = card.querySelector('.current-price small');
                if (priceValue) priceValue.textContent = `$${bidData.amount.toLocaleString()}`;
                if (priceLabel) priceLabel.textContent = 'Current bid';

                // Update bid count
                const bidCount = card.querySelector('.bid-count');
                if (bidCount) {
                    const bidSpan = bidCount.querySelector('span');
                    const bidsText = bidCount.lastChild;
                    if (bidSpan) bidSpan.textContent = auction.numberOfBids;
                    if (bidsText) bidsText.textContent = ` bid${auction.numberOfBids !== 1 ? 's' : ''}`;
                    
                    // Add has-bids class and click handler if first bid
                    if (auction.numberOfBids === 1) {
                        bidCount.classList.add('has-bids');
                        bidCount.style.cursor = 'pointer';
                        bidCount.onclick = async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await showBidHistory(auction.id);
                        };
                    }
                }
            }

            // Update sort if needed
            filterAndSortAuctions();
        }
    }

    // Show bid history modal
    async function showBidHistory(auctionId) {
        try {
            // Show loading state
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.remove('d-none');
            }

            // Fetch bid history
            const response = await fetch(`/api/auctions/${auctionId}/bids`);
            if (!response.ok) {
                throw new Error('Failed to fetch bid history');
            }

            const bids = await response.json();
            console.log('Bid history:', bids);

            // Get modal elements
            const modal = document.getElementById('bidHistoryModal');
            const modalTitle = modal.querySelector('.modal-title');
            const chartCanvas = modal.querySelector('#bidHistoryChart');
            const bidHistoryList = modal.querySelector('#bidHistoryList');

            // Set modal title
            const auction = currentAuctions.find(a => a.id === auctionId);
            if (auction) {
                modalTitle.textContent = `Bid History - ${auction.year} ${auction.make} ${auction.model}`;
            }

            // Create bid history list
            if (bidHistoryList) {
                bidHistoryList.innerHTML = bids.length ? `
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Bidder</th>
                                    <th class="text-end">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bids.map(bid => `
                                    <tr>
                                        <td>${new Date(bid.bidTime).toLocaleString()}</td>
                                        <td>${bid.bidderId || 'Anonymous'}</td>
                                        <td class="text-end">$${bid.amount.toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-center text-muted">No bids yet</p>';
            }

            // Create chart
            if (chartCanvas) {
                // Destroy existing chart if it exists
                if (bidHistoryChart) {
                    bidHistoryChart.destroy();
                }

                // Prepare chart data
                const chartData = bids.map(bid => ({
                    x: new Date(bid.bidTime),
                    y: bid.amount
                })).sort((a, b) => a.x - b.x);

                // Create new chart
                bidHistoryChart = new Chart(chartCanvas, {
                    type: 'line',
                    data: {
                        datasets: [{
                            label: 'Bid Amount',
                            data: chartData,
                            borderColor: '#3B82F6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderWidth: 2,
                            pointRadius: 4,
                            pointBackgroundColor: '#3B82F6',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return `$${context.parsed.y.toLocaleString()}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    unit: 'minute',
                                    displayFormats: {
                                        minute: 'MMM d, h:mm a'
                                    }
                                },
                                title: {
                                    display: true,
                                    text: 'Time'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Bid Amount ($)'
                                },
                                ticks: {
                                    callback: function(value) {
                                        return '$' + value.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // Show modal
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();

        } catch (error) {
            console.error('Error showing bid history:', error);
            showToast('Error', 'Failed to load bid history', 'error');
        } finally {
            // Hide loading state
            if (loadingOverlay) {
                loadingOverlay.classList.add('d-none');
            }
        }
    }

    // Show bid modal
    function showBidModal(auctionId) {
        const auction = currentAuctions.find(a => a.id === parseInt(auctionId));
        if (!auction) {
            showToast('Error', 'Auction not found', 'error');
            return;
        }

        // Check if user is authenticated
        if (!currentUser?.id) {
            showToast('Error', 'Please sign in to place bids', 'error');
            return;
        }

        const now = new Date();
        const endTime = new Date(auction.endTime);
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
        const currentPrice = auction.currentPrice || auction.startingPrice;
        const minimumBid = currentPrice + 100;
        currentBidElement.textContent = `$${currentPrice.toLocaleString()}`;
        bidAmountInput.value = minimumBid;
        bidAmountInput.min = minimumBid;
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

            // Check if user is still authenticated
            if (!currentUser?.id) {
                showToast('Error', 'Please sign in to place bids', 'error');
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

                // Prepare the bid data
                const bidData = {
                    auctionId: auction.id,
                    amount: bidAmount,
                    bidderId: currentUser.fullName,
                    applicationUserId: currentUser.id
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

    // Show create auction modal
    function showCreateAuctionModal() {
        // Check if user is authenticated
        if (!currentUser?.id) {
            showToast('Error', 'Please sign in to create an auction', 'error');
            return;
        }

        // Get modal elements
        const modal = document.getElementById('createAuctionModal');

        if (!modal) {
            console.error('Create auction modal not found');
            return;
        }

        // Get form elements
        const form = document.querySelector('#createAuctionForm');
        const submitBtn = modal.querySelector('button[type="submit"]');
        const startTimeInput = document.querySelector('#startTime');
        const endTimeInput = document.querySelector('#endTime');
        const imageUploadArea = document.getElementById('imageUpload');
        const imageInput = document.getElementById('carImage');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');

        if (!form || !submitBtn || !startTimeInput || !endTimeInput || !imageUploadArea || !imageInput) {
            console.error('Required form elements not found');
            return;
        }

        // Reset form and image preview
        form.reset();
        imagePreviewContainer.innerHTML = '';

        // Handle image upload area click
        imageUploadArea.addEventListener('click', () => {
            imageInput.click();
        });

        // Handle drag and drop
        imageUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUploadArea.classList.add('dragover');
        });

        imageUploadArea.addEventListener('dragleave', () => {
            imageUploadArea.classList.remove('dragover');
        });

        imageUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                imageInput.files = e.dataTransfer.files;
                handleImagePreview();
            }
        });

        // Handle image selection
        imageInput.addEventListener('change', handleImagePreview);

        function handleImagePreview() {
            imagePreviewContainer.innerHTML = '';
            const files = imageInput.files;

            if (files.length > 5) {
                showToast('Error', 'Maximum 5 images allowed', 'error');
                imageInput.value = '';
                return;
            }

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > 5 * 1024 * 1024) {
                    showToast('Error', 'Image size should not exceed 5MB', 'error');
                    imageInput.value = '';
                    imagePreviewContainer.innerHTML = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewDiv = document.createElement('div');
                    previewDiv.className = 'col-4';
                    previewDiv.innerHTML = `
                        <div class="image-preview">
                            <img src="${e.target.result}" alt="Preview" class="img-fluid rounded">
                            <button type="button" class="btn-remove" data-index="${i}">×</button>
                        </div>
                    `;
                    imagePreviewContainer.appendChild(previewDiv);

                    // Add remove button handler
                    previewDiv.querySelector('.btn-remove').addEventListener('click', function() {
                        const index = this.getAttribute('data-index');
                        const dt = new DataTransfer();
                        const { files } = imageInput;
                        
                        for (let i = 0; i < files.length; i++) {
                            if (i !== parseInt(index)) {
                                dt.items.add(files[i]);
                            }
                        }
                        
                        imageInput.files = dt.files;
                        handleImagePreview();
                    });
                };
                reader.readAsDataURL(file);
            }
        }

        // Set minimum dates
        const now = new Date();
        const minStartTime = new Date(now.getTime() + 15 * 60000); // 15 minutes from now
        const minEndTime = new Date(now.getTime() + 60 * 60000); // 1 hour from now

        // Format dates for datetime-local input
        const formatDate = (date) => {
            return date.toISOString().slice(0, 16);
        };

        // Add custom start time checkbox
        let customStartTimeCheckbox = modal.querySelector('#customStartTime');
        let customStartTimeContainer = startTimeInput.parentElement;
        
        if (!customStartTimeCheckbox) {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'form-check mb-3';
            checkboxDiv.innerHTML = `
                <input class="form-check-input" type="checkbox" id="customStartTime">
                <label class="form-check-label" for="customStartTime">
                    Set custom start time
                </label>
            `;
            customStartTimeContainer.parentElement.insertBefore(checkboxDiv, customStartTimeContainer);
            customStartTimeCheckbox = checkboxDiv.querySelector('#customStartTime');
        }

        // Handle start time visibility
        customStartTimeContainer.style.display = 'none';
        customStartTimeContainer.style.marginTop = '1rem';
        startTimeInput.required = false;

        customStartTimeCheckbox.onchange = (e) => {
            customStartTimeContainer.style.display = e.target.checked ? 'block' : 'none';
            startTimeInput.required = e.target.checked;
            if (!e.target.checked) {
                startTimeInput.value = formatDate(minStartTime);
            }
        };

        // Set initial values
        startTimeInput.value = formatDate(minStartTime);
        endTimeInput.value = formatDate(minEndTime);
        startTimeInput.min = formatDate(minStartTime);
        endTimeInput.min = formatDate(minEndTime);

        // Handle form submission
        form.onsubmit = async (e) => {
            e.preventDefault();
            let auctionData = null;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';

                // First, validate all form data
                const formData = {
                    make: document.getElementById('carMake').value,
                    model: document.getElementById('carModel').value,
                    year: parseInt(document.getElementById('carYear').value),
                    description: document.getElementById('carDescription').value,
                    startingPrice: parseFloat(document.getElementById('startingPrice').value),
                    startTime: customStartTimeCheckbox.checked ? new Date(startTimeInput.value).toISOString() : minStartTime.toISOString(),
                    endTime: new Date(endTimeInput.value).toISOString()
                };

                // Validate required fields
                if (!formData.make || !formData.model || !formData.year || !formData.description || !formData.startingPrice) {
                    throw new Error('Please fill in all required fields');
                }

                // Validate auction duration
                const startTime = new Date(formData.startTime);
                const endTime = new Date(formData.endTime);
                const timeDiff = endTime.getTime() - startTime.getTime();
                const minDuration = 45 * 60 * 1000; // 45 minutes in milliseconds
                
                if (timeDiff < minDuration) {
                    throw new Error('Auction duration must be at least 45 minutes');
                }

                // Handle image upload if present
                const imageInput = document.getElementById('carImage');
                let imageUrl = null;
                
                if (imageInput.files.length > 0) {
                    const formData = new FormData();
                    formData.append('image', imageInput.files[0]);
                    
                    const token = localStorage.getItem('token');
                    if (!token) {
                        throw new Error('Please log in to upload images');
                    }

                    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading image...';

                    const imageResponse = await fetch('/api/images/upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });

                    let responseData;
                    const responseText = await imageResponse.text();
                    try {
                        responseData = JSON.parse(responseText);
                    } catch (e) {
                        console.error('Failed to parse response:', responseText);
                        throw new Error('Failed to upload image: Invalid response format');
                    }
                    
                    if (!imageResponse.ok) {
                        throw new Error(responseData.message || 'Failed to upload image');
                    }
                    
                    imageUrl = responseData.url;
                    console.log('Image uploaded successfully:', imageUrl);
                }

                // Create auction data with image URL if present
                auctionData = {
                    ...formData,
                    imageUrl
                };

                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating auction...';

                console.log('Creating auction with data:', auctionData);

                const response = await fetch('/api/auctions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(auctionData)
                });

                const responseData = await response.json();

                if (!response.ok) {
                    throw new Error(responseData.title || responseData.message || responseData.error || 'Failed to create auction');
                }

                const modalInstance = bootstrap.Modal.getInstance(modal);
                modalInstance.hide();
                showToast('Success', 'Auction created successfully!', 'success');
                await loadAuctions();

            } catch (error) {
                showToast('Error', error.message || 'Failed to create auction', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Create Auction';
            }
        };

        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
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
        showBidModal,
        showWatchlist: () => {
            const watchlistFilter = document.getElementById('watchlistFilter');
            if (watchlistFilter) {
                watchlistFilter.checked = true;
                filterAndSortAuctions();
            }
        },
        showCreateAuctionModal
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