const AuthService = {
    currentUser: null,
    loginModal: null,
    signupModal: null,

    init() {
        // Initialize modals
        const loginModalEl = document.getElementById('loginModal');
        const signupModalEl = document.getElementById('signupModal');
        
        if (loginModalEl) {
            this.loginModal = new bootstrap.Modal(loginModalEl, {
                keyboard: false,
                backdrop: 'static'
            });

            // Add login form submission handler
            const loginForm = document.getElementById('loginForm');
            loginForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const email = document.getElementById('loginEmail').value;
                    const password = document.getElementById('loginPassword').value;
                    await this.login(email, password);
                    showToast('Success', 'Logged in successfully!', 'success');
                } catch (error) {
                    showToast('Error', error.message || 'Login failed', 'error');
                }
            });
        }
        
        if (signupModalEl) {
            this.signupModal = new bootstrap.Modal(signupModalEl, {
                keyboard: false,
                backdrop: 'static'
            });

            // Add register form submission handler
            const registerForm = document.getElementById('registerForm');
            registerForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const userData = {
                        firstName: document.getElementById('firstName').value,
                        lastName: document.getElementById('lastName').value,
                        email: document.getElementById('registerEmail').value,
                        password: document.getElementById('registerPassword').value,
                        phoneNumber: document.getElementById('phoneNumber').value
                    };
                    
                    const confirmPassword = document.getElementById('confirmPassword').value;
                    if (userData.password !== confirmPassword) {
                        throw new Error('Passwords do not match');
                    }
                    
                    await this.signup(userData);
                    showToast('Success', 'Account created successfully!', 'success');
                } catch (error) {
                    showToast('Error', error.message || 'Registration failed', 'error');
                }
            });
        }

        // Add logout button handler
        const logoutBtn = document.getElementById('logoutBtn');
        logoutBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
            showToast('Success', 'Logged out successfully!', 'success');
        });

        // Check for stored token
        this.checkAuth();
    },

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (token && user) {
            this.currentUser = JSON.parse(user);
            this.updateUI(true);
        } else {
            this.updateUI(false);
        }
    },

    updateUI(isAuthenticated) {
        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');
        const userFullName = document.getElementById('userFullName');
        const watchlistBtn = document.getElementById('watchlistButton');
        const blurOverlay = document.getElementById('auctionsBlurOverlay');
        const createAuctionBtn = document.getElementById('createAuctionBtn');

        if (isAuthenticated && this.currentUser) {
            authButtons?.classList.add('d-none');
            userInfo?.classList.remove('d-none');
            watchlistBtn?.classList.remove('d-none');
            blurOverlay?.classList.add('d-none');
            createAuctionBtn?.classList.remove('d-none');
            
            if (userFullName) {
                const fullName = `${this.currentUser.firstName || ''} ${this.currentUser.lastName || ''}`.trim();
                userFullName.textContent = fullName || this.currentUser.email;
            }
        } else {
            authButtons?.classList.remove('d-none');
            userInfo?.classList.add('d-none');
            watchlistBtn?.classList.add('d-none');
            blurOverlay?.classList.remove('d-none');
            createAuctionBtn?.classList.add('d-none');
        }
    },

    async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            this.currentUser = data.user;
            this.updateUI(true);
            this.loginModal?.hide();
            return true;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async signup(userData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Registration failed');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            this.currentUser = data.user;
            this.updateUI(true);
            this.signupModal?.hide();
            return true;
        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    },

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUser = null;
        this.updateUI(false);
        window.location.reload();
    },

    showLoginModal() {
        this.signupModal?.hide();
        this.loginModal?.show();
    },

    showSignupModal() {
        this.loginModal?.hide();
        this.signupModal?.show();
    },

    getCurrentUser() {
        return this.currentUser;
    },

    getToken() {
        return localStorage.getItem('token');
    },

    isAuthenticated() {
        return !!this.currentUser && !!this.getToken();
    }
};

// Initialize auth service when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    AuthService.init();
});

// Toast notification function
function showToast(title, message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;
    
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
        <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header ${type}">
                <i class="fas fa-${icon} me-2"></i>
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