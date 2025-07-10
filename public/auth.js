// Authentication JavaScript

// Global variables
let pendingUserId = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
});

// Check if user is already logged in
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    if (token) {
        // Redirect to main app if already logged in
        window.location.href = 'app.html';
    }
}

// API call helper
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`/api${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Request failed');
        }
        
        return result;
    } catch (error) {
        showAlert(error.message, 'danger');
        throw error;
    }
}

// Register function
async function register(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    // Show loading state
    button.classList.add('loading');
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    button.disabled = true;
    
    const formData = {
        name: document.getElementById('registerName').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value,
        phone: document.getElementById('registerPhone').value,
        location: document.getElementById('registerLocation').value
    };

    try {
        const result = await apiCall('/register', 'POST', formData);
        pendingUserId = result.userId;
        localStorage.setItem('pendingUserId', pendingUserId);
        
        showAlert('Registration successful! Please check your email for OTP.', 'success');
        showOTPForm();
        
        // Add success animation
        document.querySelector('.auth-card').classList.add('success-animation');
        
    } catch (error) {
        console.error('Registration failed:', error);
    } finally {
        // Reset button state
        button.classList.remove('loading');
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Login function
async function login(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    // Show loading state
    button.classList.add('loading');
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    button.disabled = true;
    
    const formData = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    };

    try {
        const result = await apiCall('/login', 'POST', formData);
        
        // Store auth token
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('currentUser', JSON.stringify(result.user));
        
        showAlert('Login successful! Redirecting...', 'success');
        
        // Add success animation
        document.querySelector('.auth-card').classList.add('success-animation');
        
        // Redirect to main app after short delay
        setTimeout(() => {
            window.location.href = 'app.html';
        }, 1500);
        
    } catch (error) {
        // Improved error handling for not verified and wrong password
        if (error.message === 'Please verify your email first') {
            showAlert('Your email is not verified. Please enter the OTP sent to your email.', 'warning');
            // Save pending userId for OTP
            // Fetch userId from backend (optional improvement)
            // Show OTP form
            showOTPForm();
        } else if (error.message === 'Invalid password') {
            showAlert('Incorrect password. Please try again.', 'danger');
        } else if (error.message === 'User not found') {
            showAlert('No account found with this email.', 'danger');
        } else {
            showAlert(error.message, 'danger');
        }
        console.error('Login failed:', error);
    } finally {
        // Reset button state
        button.classList.remove('loading');
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Verify OTP function
async function verifyOTP(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    // Show loading state
    button.classList.add('loading');
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    button.disabled = true;
    
    const userId = pendingUserId || localStorage.getItem('pendingUserId');
    const otp = document.getElementById('otpCode').value;

    try {
        await apiCall('/verify-otp', 'POST', { userId, otp });
        
        localStorage.removeItem('pendingUserId');
        showAlert('Email verified successfully! Redirecting to login...', 'success');
        
        // Add success animation
        document.querySelector('.auth-card').classList.add('success-animation');
        
        // Redirect to login after short delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        
    } catch (error) {
        console.error('OTP verification failed:', error);
    } finally {
        // Reset button state
        button.classList.remove('loading');
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Show OTP form
function showOTPForm() {
    document.getElementById('registerForm').classList.add('d-none');
    document.getElementById('loginForm')?.classList.add('d-none');
    document.getElementById('otpForm').classList.remove('d-none');
}

// Resend OTP function
async function resendOTP() {
    const userId = pendingUserId || localStorage.getItem('pendingUserId');
    if (!userId) {
        showAlert('Session expired. Please register again.', 'danger');
        return;
    }

    try {
        await apiCall('/resend-otp', 'POST', { userId });
        showAlert('OTP resent successfully!', 'success');
    } catch (error) {
        console.error('Failed to resend OTP:', error);
    }
}

// Show alert function
function showAlert(message, type = 'info') {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// OTP input formatting
document.addEventListener('DOMContentLoaded', function() {
    const otpInput = document.getElementById('otpCode');
    if (otpInput) {
        otpInput.addEventListener('input', function(e) {
            // Only allow numbers
            this.value = this.value.replace(/[^0-9]/g, '');
            
            // Auto-submit when 6 digits are entered
            if (this.value.length === 6) {
                const form = this.closest('form');
                if (form) {
                    setTimeout(() => form.dispatchEvent(new Event('submit')), 500);
                }
            }
        });
    }
});

// Form validation enhancements
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone.replace(/\s/g, ''));
}

function validatePassword(password) {
    return password.length >= 6;
}

// Add real-time validation
document.addEventListener('DOMContentLoaded', function() {
    const emailInputs = document.querySelectorAll('input[type="email"]');
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    
    emailInputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !validateEmail(this.value)) {
                this.style.borderColor = '#dc3545';
                showFieldError(this, 'Please enter a valid email address');
            } else {
                this.style.borderColor = '#28a745';
                hideFieldError(this);
            }
        });
    });
    
    phoneInputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !validatePhone(this.value)) {
                this.style.borderColor = '#dc3545';
                showFieldError(this, 'Please enter a valid phone number');
            } else {
                this.style.borderColor = '#28a745';
                hideFieldError(this);
            }
        });
    });
    
    passwordInputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !validatePassword(this.value)) {
                this.style.borderColor = '#dc3545';
                showFieldError(this, 'Password must be at least 6 characters');
            } else {
                this.style.borderColor = '#28a745';
                hideFieldError(this);
            }
        });
    });
});

function showFieldError(field, message) {
    hideFieldError(field);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.color = '#dc3545';
    errorDiv.style.fontSize = '0.875rem';
    errorDiv.style.marginTop = '5px';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function hideFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}