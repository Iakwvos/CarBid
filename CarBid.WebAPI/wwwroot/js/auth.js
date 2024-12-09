const AuthService = {
    currentUser: null,
    loginModal: null,
    registerModal: null,

    init() {
        // Initialize modals
        const loginModalEl = document.getElementById('loginModal');
        const registerModalEl = document.getElementById('registerModal');
        
        if (loginModalEl) {
            this.loginModal = new bootstrap.Modal(loginModalEl);

            // Add login form submission handler
            const loginForm = document.getElementById('loginForm');
            loginForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                try {
                    const email = document.getElementById('loginEmail').value;
                    const password = document.getElementById('loginPassword').value;
                    await this.login(email, password);
                    showToast('Success', 'Logged in successfully!', 'success');
                    window.location.reload();
                } catch (error) {
                    showToast('Login Failed', error.message || 'Invalid email or password. Please try again.', 'error');
                } finally {
                    submitBtn.disabled = false;
                }
            });
        }
        
        if (registerModalEl) {
            this.registerModal = new bootstrap.Modal(registerModalEl);

            // Add register form submission handler
            const registerForm = document.getElementById('registerForm');
            registerForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
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
                        throw new Error('Passwords do not match. Please try again.');
                    }
                    
                    await this.signup(userData);
                    showToast('Success', 'Account created successfully! You are now logged in.', 'success');
                    window.location.reload();
                } catch (error) {
                    showToast('Registration Failed', error.message || 'Registration failed. Please try again.', 'error');
                } finally {
                    submitBtn.disabled = false;
                }
            });
        }

        // Add logout button handler
        const logoutBtn = document.getElementById('logoutBtn');
        logoutBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Add click handler for the blur overlay
        const blurOverlay = document.getElementById('auctionsBlurOverlay');
        blurOverlay?.addEventListener('click', () => {
            this.showLoginModal();
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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Invalid email or password. Please try again.');
            }

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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed. Please try again.');
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            this.currentUser = data.user;
            this.updateUI(true);
            this.registerModal?.hide();
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
        showToast('Success', 'Logged out successfully!', 'success');
        window.location.reload();
    },

    showLoginModal() {
        this.registerModal?.hide();
        this.loginModal?.show();
    },

    showRegisterModal() {
        this.loginModal?.hide();
        this.registerModal?.show();
    },

    getToken() {
        return localStorage.getItem('token');
    }
};

// Toast notification function
function showToast(title, message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        console.error('Toast container not found');
        return;
    }
    
    const toastHtml = `
        <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-${type}">
                <strong class="me-auto text-white">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = toastContainer.lastElementChild;
    
    const bsToast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000
    });
    
    bsToast.show();
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Initialize auth service when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    AuthService.init();
});