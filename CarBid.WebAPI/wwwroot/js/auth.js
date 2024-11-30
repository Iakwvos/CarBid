const AuthService = (() => {
    // State
    let currentUser = JSON.parse(localStorage.getItem('user')) || null;
    let authToken = localStorage.getItem('authToken');

    // DOM Elements
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));

    // Initialize
    function initialize() {
        attachEventListeners();
        checkAuthStatus();
    }

    function attachEventListeners() {
        // Login form submission
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleLogin();
        });

        // Register form submission
        document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleRegister();
        });

        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

        // Switch between login and register modals
        document.getElementById('switchToRegister')?.addEventListener('click', () => {
            loginModal.hide();
            registerModal.show();
        });

        document.getElementById('switchToLogin')?.addEventListener('click', () => {
            registerModal.hide();
            loginModal.show();
        });
    }

    async function handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, rememberMe })
            });

            const data = await response.json();

            if (response.ok) {
                handleAuthSuccess(data);
                loginModal.hide();
                showToast('Success', 'Logged in successfully!', 'success');
            } else {
                showToast('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Error', 'An error occurred during login', 'error');
        }
    }

    async function handleRegister() {
        const formData = {
            email: document.getElementById('registerEmail').value,
            password: document.getElementById('registerPassword').value,
            confirmPassword: document.getElementById('confirmPassword').value,
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phoneNumber: document.getElementById('phoneNumber').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            country: document.getElementById('country').value
        };

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                handleAuthSuccess(data);
                registerModal.hide();
                showToast('Success', 'Registration successful!', 'success');
            } else {
                showToast('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showToast('Error', 'An error occurred during registration', 'error');
        }
    }

    function handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        currentUser = null;
        authToken = null;
        
        const blurOverlay = document.getElementById('auctionsBlurOverlay');
        if (blurOverlay) {
            blurOverlay.classList.remove('d-none');
        }
        
        updateUIForAuth();
        AuctionApp.initialize(); // Reload with placeholder content
        showToast('Success', 'Logged out successfully', 'success');
    }

    function handleAuthSuccess(data) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        authToken = data.token;
        
        const blurOverlay = document.getElementById('auctionsBlurOverlay');
        if (blurOverlay) {
            blurOverlay.classList.add('d-none');
        }
        
        updateUIForAuth();
        AuctionApp.initialize(); // Reload auctions after login
    }

    function checkAuthStatus() {
        const user = localStorage.getItem('user');
        if (user) {
            currentUser = JSON.parse(user);
            authToken = localStorage.getItem('authToken');
            updateUIForAuth();
            
            const blurOverlay = document.getElementById('auctionsBlurOverlay');
            if (blurOverlay) {
                blurOverlay.classList.add('d-none');
            }
        }
    }

    function updateUIForAuth() {
        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');
        const createAuctionBtn = document.getElementById('createAuctionModalBtn');

        if (currentUser) {
            authButtons.classList.add('d-none');
            userInfo.classList.remove('d-none');
            document.getElementById('userFullName').textContent = 
                `${currentUser.firstName} ${currentUser.lastName}`;
            createAuctionBtn?.classList.remove('d-none');
        } else {
            authButtons.classList.remove('d-none');
            userInfo.classList.add('d-none');
            createAuctionBtn?.classList.add('d-none');
        }
    }

    // Public methods
    return {
        initialize,
        getCurrentUser: () => currentUser,
        getAuthToken: () => authToken,
        showLoginModal: () => loginModal.show(),
        showRegisterModal: () => registerModal.show()
    };
})();

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', AuthService.initialize);