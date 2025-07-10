// Admin dashboard JS

document.addEventListener('DOMContentLoaded', function() {
    loadAdminUsers();
    loadAdminCrops();
    loadAdminReports();
    loadAdminTips(); // Load farming tips on page load
});

async function loadAdminUsers() {
    const res = await fetch('/api/admin/users');
    const users = await res.json();
    const tbody = document.getElementById('adminUsersTable');
    tbody.innerHTML = '';
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.phone || ''}</td>
            <td>${user.location || ''}</td>
            <td>${user.is_verified ? 'Yes' : 'No'}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteAdminUser(${user.id})">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadAdminCrops() {
    const res = await fetch('/api/admin/crops');
    const crops = await res.json();
    const tbody = document.getElementById('adminCropsTable');
    tbody.innerHTML = '';
    crops.forEach(crop => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${crop.id}</td>
            <td>${crop.user_name}</td>
            <td>${crop.crop_name}</td>
            <td>${crop.area}</td>
            <td>${crop.phone}</td>
            <td>${crop.location || ''}</td>
            <td>${crop.price || ''}</td>
            <td>${crop.quantity || ''}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteAdminCrop(${crop.id})">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadAdminReports() {
    const res = await fetch('/api/admin/reports');
    const reports = await res.json();
    const tbody = document.getElementById('adminReportsTable');
    tbody.innerHTML = '';
    reports.forEach(report => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${report.id}</td>
            <td>${report.reporter_name}</td>
            <td>${report.reported_user_name || ''}</td>
            <td>${report.post_id || ''}</td>
            <td>${report.type}</td>
            <td>${report.description}</td>
            <td>
                <select class="form-select form-select-sm" onchange="updateReportStatus(${report.id}, this.value, document.getElementById('reply-${report.id}').value)">
                    <option value="pending" ${report.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="resolved" ${report.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                    <option value="rejected" ${report.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                </select>
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" id="reply-${report.id}" value="${report.reply || ''}" onchange="updateReportStatus(${report.id}, document.querySelector('[onchange*=updateReportStatus][value]:checked')?.value || 'pending', this.value)">
            </td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteAdminReport(${report.id})">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateReportStatus(id, status, reply) {
    await fetch(`/api/admin/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reply })
    });
    loadAdminReports();
}

// Farming Tips Management
async function loadAdminTips() {
    const res = await fetch('/api/farming-tips');
    const tips = await res.json();
    const container = document.getElementById('adminTipsContainer');
    container.innerHTML = '';
    tips.forEach(tip => {
        const div = document.createElement('div');
        div.className = 'd-flex align-items-center mb-2';
        div.innerHTML = `
            <span class="flex-grow-1">${tip.tip}</span>
            <button class="btn btn-danger btn-sm ms-2" onclick="deleteAdminTip(${tip.id})">Delete</button>
        `;
        container.appendChild(div);
    });
}
async function addAdminTip(event) {
    event.preventDefault();
    const tip = document.getElementById('adminTipInput').value.trim();
    if (!tip) return;
    await fetch('/api/admin/farming-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tip })
    });
    document.getElementById('adminTipInput').value = '';
    loadAdminTips();
}
async function deleteAdminTip(id) {
    await fetch(`/api/admin/farming-tips/${id}`, { method: 'DELETE' });
    loadAdminTips();
}
window.loadAdminTips = loadAdminTips;
window.addAdminTip = addAdminTip;
window.deleteAdminTip = deleteAdminTip;

async function deleteAdminUser(id) {
    if (!confirm('Delete this user?')) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    loadAdminUsers();
}

async function deleteAdminCrop(id) {
    if (!confirm('Delete this crop?')) return;
    await fetch(`/api/admin/crops/${id}`, { method: 'DELETE' });
    loadAdminCrops();
}

async function deleteAdminReport(id) {
    if (!confirm('Delete this report?')) return;
    await fetch(`/api/admin/reports/${id}`, { method: 'DELETE' });
    loadAdminReports();
} 