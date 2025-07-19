// Global variables
let currentUser = null;
let authToken = null;
let socket = null;
let currentChatUser = null;
let currentPostId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    loadPlatformStats();
    loadFarmingTips();
});

// Authentication functions
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    if (token) {
        authToken = token;
        fetchUserProfile();
        showApp();
        initializeSocket();
    } else {
        showAuth();
    }
}

function showAuth() {
    document.getElementById('authSection').classList.remove('d-none');
    document.getElementById('appSection').classList.add('d-none');
    hideNavItems();
}

function showApp() {
    document.getElementById('authSection').classList.add('d-none');
    document.getElementById('appSection').classList.remove('d-none');
    showNavItems();
    showHome();
    loadPosts();
}

function showNavItems() {
    document.getElementById('navHome').classList.remove('d-none');
    document.getElementById('navMessages').classList.remove('d-none');
    document.getElementById('navWishlist').classList.remove('d-none');
    document.getElementById('navProfile').classList.remove('d-none');
    document.getElementById('navLogout').classList.remove('d-none');
    document.getElementById('navReports').classList.remove('d-none');
    document.getElementById('bottomNav').style.display = 'flex';
}

function hideNavItems() {
    document.getElementById('navHome').classList.add('d-none');
    document.getElementById('navMessages').classList.add('d-none');
    document.getElementById('navWishlist').classList.add('d-none');
    document.getElementById('navProfile').classList.add('d-none');
    document.getElementById('navLogout').classList.add('d-none');
    document.getElementById('navReports').classList.add('d-none');
    document.getElementById('bottomNav').style.display = 'none';
}

function showLogin() {
    document.getElementById('loginForm').classList.remove('d-none');
    document.getElementById('registerForm').classList.add('d-none');
    document.getElementById('otpForm').classList.add('d-none');
}

function showRegister() {
    document.getElementById('loginForm').classList.add('d-none');
    document.getElementById('registerForm').classList.remove('d-none');
    document.getElementById('otpForm').classList.add('d-none');
}

function showOTPForm() {
    document.getElementById('loginForm').classList.add('d-none');
    document.getElementById('registerForm').classList.add('d-none');
    document.getElementById('otpForm').classList.remove('d-none');
}

// API functions
async function apiCall(endpoint, method = 'GET', data = null, isFormData = false) {
    const options = {
        method,
        headers: {}
    };

    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
        if (isFormData) {
            options.body = data;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
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

// Authentication handlers
async function register(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('registerName').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value,
        phone: document.getElementById('registerPhone').value,
        location: document.getElementById('registerLocation').value
    };

    try {
        const result = await apiCall('/register', 'POST', formData);
        localStorage.setItem('pendingUserId', result.userId);
        showAlert('Registration successful! Please check your email for OTP.', 'success');
        showOTPForm();
    } catch (error) {
        console.error('Registration failed:', error);
    }
}

async function verifyOTP(event) {
    event.preventDefault();
    
    const userId = localStorage.getItem('pendingUserId');
    const otp = document.getElementById('otpCode').value;

    try {
        await apiCall('/verify-otp', 'POST', { userId, otp });
        localStorage.removeItem('pendingUserId');
        showAlert('Email verified successfully! Please login.', 'success');
        showLogin();
    } catch (error) {
        console.error('OTP verification failed:', error);
    }
}

async function login(event) {
    event.preventDefault();
    
    const formData = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    };

    try {
        const result = await apiCall('/login', 'POST', formData);
        authToken = result.token;
        currentUser = result.user;
        localStorage.setItem('authToken', authToken);
        showApp();
        await fetchUserProfile(); // Ensure profile is loaded
        updateNavbarProfileImage(currentUser.profile_image); // Update navbar image
        loadPlatformStats();
        loadPosts();
        initializeSocket();
    } catch (error) {
        console.error('Login failed:', error);
    }
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    if (socket) {
        socket.disconnect();
    }
    showAuth();
}

// Navigation functions
function showHome() {
    hideAllSections();
    document.getElementById('homeSection').classList.remove('d-none');
    loadPosts();
}

function showMessages() {
    hideAllSections();
    document.getElementById('messagesSection').classList.remove('d-none');
    loadConversations();
}

function showWishlist() {
    hideAllSections();
    document.getElementById('wishlistSection').classList.remove('d-none');
    loadWishlist();
}

function showProfile() {
    hideAllSections();
    document.getElementById('profileSection').classList.remove('d-none');
    loadProfile();
}

function showReports() {
    hideAllSections();
    document.getElementById('reportsSection').classList.remove('d-none');
    loadUserReports();
}

async function loadUserReports() {
    try {
        const reports = await apiCall('/reports');
        displayUserReports(reports);
    } catch (error) {
        document.getElementById('userReportsContainer').innerHTML = '<div class="alert alert-danger">Failed to load reports.</div>';
    }
}

function displayUserReports(reports) {
    const container = document.getElementById('userReportsContainer');
    container.innerHTML = '';
    if (!reports || reports.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">No reports submitted yet.</div>';
        return;
    }
    const statusMap = {
        'pending': 'Pending',
        'Pending': 'Pending',
        'resolved': 'Resolved',
        'Resolved': 'Resolved',
        'rejected': 'Rejected',
        'Rejected': 'Rejected',
        'reviewed': 'Reviewed',
        'Reviewed': 'Reviewed'
    };
    const table = document.createElement('table');
    table.className = 'table table-bordered table-hover';
    table.innerHTML = `
        <thead class="table-success">
            <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Reply</th>
                <th>Date</th>
            </tr>
        </thead>
        <tbody>
            ${reports.map(r => `
                <tr>
                    <td>${r.id}</td>
                    <td>${r.type}</td>
                    <td>${r.description}</td>
                    <td>${statusMap[r.status] !== undefined ? statusMap[r.status] : (r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '')}</td>
                    <td>${r.reply || ''}</td>
                    <td>${r.created_at ? formatDate(r.created_at) : ''}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    container.appendChild(table);
}

function hideAllSections() {
    document.getElementById('homeSection').classList.add('d-none');
    document.getElementById('messagesSection').classList.add('d-none');
    document.getElementById('wishlistSection').classList.add('d-none');
    document.getElementById('profileSection').classList.add('d-none');
    document.getElementById('reportsSection').classList.add('d-none');
}

// Posts functions
async function loadPosts() {
    try {
        const posts = await apiCall('/posts');
        displayPosts(posts);
    } catch (error) {
        console.error('Failed to load posts:', error);
    }
}

function displayPosts(posts) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';

    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'card mb-4 border-0 shadow-sm post-card';
    const isOwner = currentUser && post.user_id == currentUser.id;
    const statusLabel = post.sold ? '<span class="badge bg-danger ms-2">Sold</span>' : '<span class="badge bg-success ms-2">Available</span>';
    const statusButton = isOwner ? `<button class="btn btn-sm btn-outline-${post.sold ? 'success' : 'danger'} ms-2" onclick="toggleSoldStatus(${post.id}, ${!post.sold})">Mark as ${post.sold ? 'Available' : 'Sold'}</button>` : '';
    const imageHtml = post.image ? 
        `<img src="/uploads/${post.image}" class="post-image w-100" alt="Crop image">` : '';
    div.innerHTML = `
        <div class="card-body">
            <div class="d-flex align-items-center mb-3">
                <img src="${post.user_image ? post.user_image : 'https://via.placeholder.com/40'}"
                     class="profile-img me-3" alt="Profile">
                <div>
                    <h6 class="mb-0">${post.user_name}</h6>
                    <small class="text-muted">${formatDate(post.created_at)}</small>
                </div>
                <div class="ms-auto">
                    <button class="btn btn-sm btn-outline-danger" onclick="showReportModal(${post.id}, ${post.user_id})">
                        <i class="fas fa-flag"></i>
                    </button>
                </div>
            </div>
            ${imageHtml}
            <h5 class="text-success mt-3">${post.crop_name} ${statusLabel} ${statusButton}</h5>
            <div class="crop-info">
                <span class="crop-info-item">
                    <i class="fas fa-map-marker-alt me-1"></i>${post.area} acres
                </span>
                <span class="crop-info-item">
                    <i class="fas fa-phone me-1"></i>${post.phone}
                </span>
                ${post.location ? `<span class="crop-info-item">
                    <i class="fas fa-location-dot me-1"></i>${post.location}
                </span>` : ''}
                ${post.price ? `<span class="crop-info-item">
                    <i class="fas fa-dollar-sign me-1"></i>₹${post.price}
                </span>` : ''}
                ${post.quantity ? `<span class="crop-info-item">
                    <i class="fas fa-weight me-1"></i>${post.quantity}
                </span>` : ''}
            </div>
            ${post.description ? `<p class="text-muted mt-2">${post.description}</p>` : ''}
            <div class="post-actions">
                <button class="action-btn like-btn" onclick="toggleLike(${post.id}, this)">
                    <i class="fas fa-thumbs-up me-1"></i>
                    <span>${post.likes_count || 0}</span>
                </button>
                <button class="action-btn" onclick="showComments(${post.id})">
                    <i class="fas fa-comment me-1"></i>
                    <span>${post.comments_count || 0}</span>
                </button>
                <button class="action-btn wishlist-btn" onclick="toggleWishlist(${post.id}, this)">
                    <i class="fas fa-heart me-1"></i>
                    Wishlist
                </button>
                <button class="action-btn" onclick="startChat(${post.user_id})">
                    <i class="fas fa-message me-1"></i>
                    Message
                </button>
            </div>
        </div>
    `;
    return div;
}

window.toggleSoldStatus = async function(postId, sold) {
    try {
        await apiCall(`/posts/${postId}/sold`, 'PUT', { sold });
        showAlert('Status updated!', 'success');
        loadPosts();
    } catch (e) {
        showAlert('Failed to update status', 'danger');
    }
};

async function createPost(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('crop_name', document.getElementById('cropName').value);
    formData.append('area', document.getElementById('cropArea').value);
    formData.append('phone', document.getElementById('cropPhone').value);
    formData.append('location', document.getElementById('cropLocation').value);
    formData.append('price', document.getElementById('cropPrice').value);
    formData.append('quantity', document.getElementById('cropQuantity').value);
    formData.append('description', document.getElementById('cropDescription').value);
    
    const imageFile = document.getElementById('cropImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        await apiCall('/posts', 'POST', formData, true);
        showAlert('Post created successfully!', 'success');
        event.target.reset();
        await loadPosts();
        await loadPlatformStats();
    } catch (error) {
        console.error('Failed to create post:', error);
    }
}

async function toggleLike(postId, button) {
    try {
        const result = await apiCall(`/posts/${postId}/like`, 'POST');
        const icon = button.querySelector('i');
        const span = button.querySelector('span');
        
        if (result.liked) {
            button.classList.add('active');
            button.classList.add('like-btn');
            icon.className = 'fas fa-thumbs-up me-1';
        } else {
            button.classList.remove('active');
            icon.className = 'far fa-thumbs-up me-1';
        }
        
        // Update count (simplified - in real app, you'd fetch updated count)
        const currentCount = parseInt(span.textContent);
        span.textContent = result.liked ? currentCount + 1 : currentCount - 1;
        
    } catch (error) {
        console.error('Failed to toggle like:', error);
    }
}

async function toggleWishlist(postId, button) {
    try {
        const result = await apiCall(`/wishlist/${postId}`, 'POST');
        const icon = button.querySelector('i');
        
        if (result.inWishlist) {
            button.classList.add('active');
            button.classList.add('wishlist-btn');
            icon.className = 'fas fa-heart me-1';
        } else {
            button.classList.remove('active');
            icon.className = 'far fa-heart me-1';
        }
        
        showAlert(result.message, 'success');
    } catch (error) {
        console.error('Failed to toggle wishlist:', error);
    }
}

//delete option for blog

// ... existing code ...

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'card mb-4 border-0 shadow-sm post-card';
    const isOwner = currentUser && post.user_id == currentUser.id;
    const statusLabel = post.sold ? '<span class="badge bg-danger ms-2">Sold</span>' : '<span class="badge bg-success ms-2">Available</span>';
    const statusButton = isOwner ? `<button class="btn btn-sm btn-outline-${post.sold ? 'success' : 'danger'} ms-2" onclick="toggleSoldStatus(${post.id}, ${!post.sold})">Mark as ${post.sold ? 'Available' : 'Sold'}</button>` : '';
    const deleteButton = isOwner ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="deletePost(${post.id})" title="Delete Post">
        <i class="fas fa-trash"></i>
    </button>` : '';
    const imageHtml = post.image ? 
        `<img src="/uploads/${post.image}" class="post-image w-100" alt="Crop image">` : '';
    div.innerHTML = `
        <div class="card-body">
            <div class="d-flex align-items-center mb-3">
                <img src="${post.user_image ? post.user_image : 'https://via.placeholder.com/40'}"
                     class="profile-img me-3" alt="Profile">
                <div>
                    <h6 class="mb-0">${post.user_name}</h6>
                    <small class="text-muted">${formatDate(post.created_at)}</small>
                </div>
                <div class="ms-auto">
                    ${deleteButton}
                    <button class="btn btn-sm btn-outline-danger" onclick="showReportModal(${post.id}, ${post.user_id})">
                        <i class="fas fa-flag"></i>
                    </button>
                </div>
            </div>
            ${imageHtml}
            <h5 class="text-success mt-3">${post.crop_name} ${statusLabel} ${statusButton}</h5>
            <div class="crop-info">
                <span class="crop-info-item">
                    <i class="fas fa-map-marker-alt me-1"></i>${post.area} acres
                </span>
                <span class="crop-info-item">
                    <i class="fas fa-phone me-1"></i>${post.phone}
                </span>
                ${post.location ? `<span class="crop-info-item">
                    <i class="fas fa-location-dot me-1"></i>${post.location}
                </span>` : ''}
                ${post.price ? `<span class="crop-info-item">
                    <i class="fas fa-dollar-sign me-1"></i>₹${post.price}
                </span>` : ''}
                ${post.quantity ? `<span class="crop-info-item">
                    <i class="fas fa-weight me-1"></i>${post.quantity}
                </span>` : ''}
            </div>
            ${post.description ? `<p class="text-muted mt-2">${post.description}</p>` : ''}
            <div class="post-actions">
                <button class="action-btn like-btn" onclick="toggleLike(${post.id}, this)">
                    <i class="fas fa-thumbs-up me-1"></i>
                    <span>${post.likes_count || 0}</span>
                </button>
                <button class="action-btn" onclick="showComments(${post.id})">
                    <i class="fas fa-comment me-1"></i>
                    <span>${post.comments_count || 0}</span>
                </button>
                <button class="action-btn wishlist-btn" onclick="toggleWishlist(${post.id}, this)">
                    <i class="fas fa-heart me-1"></i>
                    Wishlist
                </button>
                <button class="action-btn" onclick="startChat(${post.user_id})">
                    <i class="fas fa-message me-1"></i>
                    Message
                </button>
            </div>
        </div>
    `;
    return div;
}

// ... existing code ...

// Add the delete post function (add this after the createPost function)
async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }

    try {
        await apiCall(`/posts/${postId}`, 'DELETE');
        showAlert('Post deleted successfully!', 'success');
        loadPosts(); // Reload posts to update the display
    } catch (error) {
        console.error('Failed to delete post:', error);
        showAlert('Failed to delete post. Please try again.', 'danger');
    }
}

// ... existing code ...
//delete option for blog end


// Comments functions
async function showComments(postId) {
    currentPostId = postId;
    try {
        const comments = await apiCall(`/posts/${postId}/comments`);
        displayComments(comments);
        new bootstrap.Modal(document.getElementById('commentsModal')).show();
    } catch (error) {
        console.error('Failed to load comments:', error);
    }
}

function displayComments(comments) {
    const container = document.getElementById('commentsContainer');
    container.innerHTML = '';

    if (comments.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No comments yet.</p>';
        return;
    }

    comments.forEach(comment => {
        const div = document.createElement('div');
        div.className = 'mb-3 p-3 bg-light rounded';
        div.innerHTML = `
            <div class="d-flex align-items-center mb-2">
                <img src="${comment.user_image ? '/uploads/' + comment.user_image : 'https://via.placeholder.com/30'}" 
                     class="rounded-circle me-2" width="30" height="30" alt="Profile">
                <strong>${comment.user_name}</strong>
                <small class="text-muted ms-auto">${formatDate(comment.created_at)}</small>
            </div>
            <p class="mb-0">${comment.comment}</p>
        `;
        container.appendChild(div);
    });
}

async function addComment(event) {
    event.preventDefault();
    
    const comment = document.getElementById('commentInput').value.trim();
    if (!comment) return;

    try {
        await apiCall(`/posts/${currentPostId}/comments`, 'POST', { comment });
        document.getElementById('commentInput').value = '';
        showComments(currentPostId); // Reload comments
        showAlert('Comment added successfully!', 'success');
    } catch (error) {
        console.error('Failed to add comment:', error);
    }
}

// Wishlist functions
async function loadWishlist() {
    try {
        const wishlist = await apiCall('/wishlist');
        displayWishlist(wishlist);
    } catch (error) {
        console.error('Failed to load wishlist:', error);
    }
}

function displayWishlist(wishlist) {
    const container = document.getElementById('wishlistContainer');
    container.innerHTML = '';

    if (wishlist.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-heart fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">Your wishlist is empty</h5>
                <p class="text-muted">Save posts you're interested in to see them here</p>
            </div>
        `;
        return;
    }

    const row = document.createElement('div');
    row.className = 'row';

    wishlist.forEach(post => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-4';
        
        const imageHtml = post.image ? 
            `<img src="/uploads/${post.image}" class="card-img-top post-image" alt="Crop image">` : '';
        
        col.innerHTML = `
            <div class="card border-0 shadow-sm">
                ${imageHtml}
                <div class="card-body">
                    <h5 class="card-title text-success">${post.crop_name}</h5>
                    <div class="crop-info mb-2">
                        <span class="crop-info-item">
                            <i class="fas fa-map-marker-alt me-1"></i>${post.area} acres
                        </span>
                        <span class="crop-info-item">
                            <i class="fas fa-phone me-1"></i>${post.phone}
                        </span>
                    </div>
                    <p class="text-muted small">By ${post.user_name}</p>
                    <div class="d-flex gap-2">
                        <button class="btn btn-success btn-sm" onclick="startChat(${post.user_id})">
                            <i class="fas fa-message me-1"></i>Message
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="toggleWishlist(${post.id}, this)">
                            <i class="fas fa-heart me-1"></i>Remove
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        row.appendChild(col);
    });

    container.appendChild(row);
}

// Profile functions
async function fetchUserProfile() {
    try {
        const profile = await apiCall('/profile');
        currentUser = { ...currentUser, ...profile };
        updateNavbarProfileImage(currentUser.profile_image);
        // Also update profile section if visible
        if (document.getElementById('profileSection') && !document.getElementById('profileSection').classList.contains('d-none')) {
            loadProfile();
        }
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
    }
}

async function loadProfile() {
    try {
        const profile = await apiCall('/profile');
        
        document.getElementById('profileName').value = profile.name || '';
        document.getElementById('profileEmail').value = profile.email || '';
        document.getElementById('profilePhone').value = profile.phone || '';
        document.getElementById('profileLocation').value = profile.location || '';
        
        document.getElementById('currentProfileName').textContent = profile.name || 'User Name';
        document.getElementById('currentProfileEmail').textContent = profile.email || 'user@email.com';
        
        if (profile.profile_image) {
            document.getElementById('currentProfileImage').src = `/uploads/${profile.profile_image}`;
        }
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

async function updateProfile(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('profileName').value);
    formData.append('phone', document.getElementById('profilePhone').value);
    formData.append('location', document.getElementById('profileLocation').value);
    
    const imageFile = document.getElementById('profileImage').files[0];
    if (imageFile) {
        formData.append('profile_image', imageFile);
    }

    try {
        await apiCall('/profile', 'PUT', formData, true);
        showAlert('Profile updated successfully!', 'success');
        loadProfile();
        await fetchUserProfile(); // Refresh navbar image
    } catch (error) {
        console.error('Failed to update profile:', error);
    }
}

// --- Messaging functions (REWRITTEN) ---
function initializeSocket() {
    if (!currentUser) return;
    if (socket) {
        socket.disconnect();
    }
    socket = io();
    socket.on('connect', () => {
        // No room join needed
        console.log('Socket connected:', socket.id);
    });
    socket.on('newMessage', (message) => {
        if (
            currentChatUser &&
            (message.sender_id == currentChatUser && message.receiver_id == currentUser.id ||
             message.sender_id == currentUser.id && message.receiver_id == currentChatUser)
        ) {
            displayMessage(message);
        }
        loadConversations();
        updateMessagesBadge();
    });
}

async function loadConversations() {
    try {
        const conversations = await apiCall('/conversations');
        displayConversations(conversations);
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}

function displayConversations(conversations) {
    const container = document.getElementById('conversationsList');
    container.innerHTML = '';
    if (conversations.length === 0) {
        container.innerHTML = '<p class="text-center text-muted p-3">No conversations yet</p>';
        return;
    }
    conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = 'conversation-item';
        div.onclick = (event) => openChat(conv.user_id, conv.name, event);
        div.innerHTML = `
            <div class="d-flex align-items-center">
                <img src="${conv.profile_image ? '/uploads/' + conv.profile_image : 'https://via.placeholder.com/40'}" 
                     class="profile-img me-3" alt="Profile">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${conv.name}</h6>
                    <p class="mb-0 text-muted small">${conv.last_message || 'No messages yet'}</p>
                </div>
                <small class="text-muted">${conv.last_message_time ? formatDate(conv.last_message_time) : ''}</small>
            </div>
        `;
        container.appendChild(div);
    });
}

async function openChat(userId, userName, event = null) {
    currentChatUser = userId;
    document.getElementById('chatHeader').textContent = userName;
    document.getElementById('messageForm').classList.remove('d-none');
    // Highlight active conversation
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    if (event && event.target) {
        event.target.closest('.conversation-item').classList.add('active');
    }
    try {
        const messages = await apiCall(`/messages/${userId}`);
        displayMessages(messages);
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    messages.forEach(message => {
        displayMessage(message);
    });
    container.scrollTop = container.scrollHeight;
}

function displayMessage(message) {
    const container = document.getElementById('messagesContainer');
    const isOwn = message.sender_id == currentUser.id;
    const div = document.createElement('div');
    div.className = `d-flex ${isOwn ? 'justify-content-end' : 'justify-content-start'} mb-2`;
    div.innerHTML = `
        <div class="message-bubble ${isOwn ? 'message-sent' : 'message-received'}">
            <p class="mb-1">${message.message}</p>
            <small class="opacity-75">${formatTime(message.created_at)}</small>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function sendMessage(event) {
    event.preventDefault();
    if (!socket || socket.disconnected) {
        showAlert('Not connected to chat server. Please refresh the page.', 'danger');
        return;
    }
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (!message || !currentChatUser) return;
    socket.emit('sendMessage', {
        senderId: currentUser.id,
        receiverId: currentChatUser,
        message: message
    });
    // Do not display the message immediately; wait for the socket event
    messageInput.value = '';
}

function startChat(userId) {
    showMessages();
    // Find user name and open chat
    // This is simplified - in real app, you'd fetch user details
    setTimeout(() => {
        openChat(userId, 'User');
    }, 100);
}

// Report functions
function showReportModal(postId, userId) {
    currentPostId = postId;
    currentReportedUserId = userId;
    new bootstrap.Modal(document.getElementById('reportModal')).show();
}

async function submitReport(event) {
    event.preventDefault();
    
    const type = document.getElementById('reportType').value;
    const description = document.getElementById('reportDescription').value;
    
    try {
        await apiCall('/reports', 'POST', {
            reported_user_id: currentReportedUserId,
            post_id: currentPostId,
            type: type,
            description: description
        });
        
        showAlert('Report submitted successfully. We will review it shortly.', 'success');
        bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
        document.getElementById('reportModal').querySelector('form').reset();
    } catch (error) {
        console.error('Failed to submit report:', error);
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 100px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

// --- Notification Badge Logic ---
async function updateMessagesBadge() {
    if (!authToken || !currentUser) return;
    try {
        const response = await fetch('/api/messages/unread-count', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await response.json();
        const badge = document.getElementById('messagesBadge');
        if (result && result.unreadCount > 0) {
            badge.textContent = result.unreadCount;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    } catch (e) {}
}
setInterval(updateMessagesBadge, 10000);
document.addEventListener('DOMContentLoaded', updateMessagesBadge);

// Update navbar profile image
function updateNavbarProfileImage(profileImage) {
    const img = document.getElementById('navbarProfileImg');
    if (img) {
        img.src = profileImage ? '/uploads/' + profileImage : 'https://via.placeholder.com/32';
    }
}

async function loadPlatformStats() {
    try {
        const res = await fetch('/api/platform-stats');
        const stats = await res.json();
        const container = document.getElementById('platformStatsContainer');
        container.innerHTML = `
            <div class="col-3">
                <h4 class="text-success">${stats.farmers}</h4>
                <small class="text-muted">Farmers</small>
            </div>
            <div class="col-3">
                <h4 class="text-success">${stats.crops}</h4>
                <small class="text-muted">Crops</small>
            </div>
            <div class="col-3">
                <h4 class="text-success">${stats.trades}</h4>
                <small class="text-muted">Trades (Sold)</small>
            </div>
            <div class="col-3">
                <h4 class="text-success">${typeof stats.available !== 'undefined' ? stats.available : 0}</h4>
                <small class="text-muted">Available</small>
            </div>
        `;
    } catch (e) {
        // fallback or error message
    }
}

async function loadFarmingTips() {
    try {
        const res = await fetch('/api/farming-tips');
        const tips = await res.json();
        const container = document.getElementById('farmingTipsContainer');
        container.innerHTML = tips.map(tip => `
            <li class="mb-2">
                <i class="fas fa-check-circle text-success me-2"></i>
                ${tip.tip}
            </li>
        `).join('');
    } catch (e) {
        // fallback or error message
    }
}
