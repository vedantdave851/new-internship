// Global Application State
let state = {
    currentUser: null,
    activeView: 'home',
    selectedProjectId: null,
    activeChatPartnerId: null,
    sseSource: null
};

// Initialization on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    loadProjects();
    startEmailSimulationPolling();

    // Check url params for simulated email click routing
    handleUrlRouting();
});

// Helper: Handle direct URLs or simulation links
function handleUrlRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const email = urlParams.get('email');
    const token = urlParams.get('token');

    if (window.location.pathname.includes('/verify') || code) {
        navigateTo('verify');
        if (email) document.getElementById('reg-email').value = email; // Pre-fill if signup flow
        if (code) document.getElementById('verify-code').value = code;
    } else if (window.location.pathname.includes('/reset-password') || token) {
        navigateTo('reset-password');
        if (email) document.getElementById('reset-email-hidden').value = email;
        if (token) document.getElementById('reset-token').value = token;
    }
}

// Check Active Session
async function checkSession() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        if (data.user) {
            state.currentUser = data.user;
            setupSessionUI();
            connectSSE();
        } else {
            state.currentUser = null;
            setupGuestUI();
            disconnectSSE();
        }
    } catch (err) {
        console.error('Session check failed:', err);
    }
}

// Setup UI for Logged In User
function setupSessionUI() {
    const user = state.currentUser;
    if (!user) return;

    // Sidebar navigation updates
    document.getElementById('nav-login').classList.add('d-none');
    document.getElementById('nav-logout').classList.remove('d-none');
    document.getElementById('nav-chat').classList.remove('d-none');

    // Sidebar User Badge
    document.getElementById('sidebar-user-badge').classList.remove('d-none');
    document.getElementById('badge-avatar-letter').innerText = user.name.charAt(0).toUpperCase();
    document.getElementById('badge-user-name').innerText = user.name;
    document.getElementById('badge-user-role').innerText = user.role.toUpperCase();

    // Show Wallet for Clients and Freelancers
    const wallet = document.getElementById('header-wallet');
    const walletBal = document.getElementById('wallet-balance');
    wallet.classList.remove('d-none');
    walletBal.innerText = `$${user.balance.toFixed(2)}`;

    // Show Specific Role Dashboards
    document.getElementById('nav-client-dashboard').classList.add('d-none');
    document.getElementById('nav-freelancer-dashboard').classList.add('d-none');
    document.getElementById('nav-admin-dashboard').classList.add('d-none');

    // Post job shortcut shortcut
    const postShortcut = document.getElementById('btn-post-job-shortcut');
    if (postShortcut) postShortcut.classList.add('d-none');

    if (user.role === 'client') {
        document.getElementById('nav-client-dashboard').classList.remove('d-none');
        if (postShortcut) postShortcut.classList.remove('d-none');
    } else if (user.role === 'freelancer') {
        document.getElementById('nav-freelancer-dashboard').classList.remove('d-none');
    } else if (user.role === 'admin') {
        document.getElementById('nav-admin-dashboard').classList.remove('d-none');
    }

    // Refresh dashboard context if on a dashboard view
    if (state.activeView === 'client-dashboard') loadClientDashboard();
    if (state.activeView === 'freelancer-dashboard') loadFreelancerDashboard();
    if (state.activeView === 'admin-dashboard') loadAdminDashboard();
}

// Setup UI for Guest User
function setupGuestUI() {
    document.getElementById('nav-login').classList.remove('d-none');
    document.getElementById('nav-logout').classList.add('d-none');
    document.getElementById('nav-chat').classList.add('d-none');
    document.getElementById('sidebar-user-badge').classList.add('d-none');
    document.getElementById('header-wallet').classList.add('d-none');

    // Hide dashboards
    document.getElementById('nav-client-dashboard').classList.add('d-none');
    document.getElementById('nav-freelancer-dashboard').classList.add('d-none');
    document.getElementById('nav-admin-dashboard').classList.add('d-none');

    const postShortcut = document.getElementById('btn-post-job-shortcut');
    if (postShortcut) postShortcut.classList.add('d-none');

    // If on a private view, force redirect to login
    const privateViews = ['client-dashboard', 'freelancer-dashboard', 'admin-dashboard', 'chat'];
    if (privateViews.includes(state.activeView)) {
        navigateTo('home');
    }
}

// Connect Server-Sent Events (SSE) for Live Messaging & Notifications
function connectSSE() {
    if (state.sseSource) return;

    state.sseSource = new EventSource('/api/chat/stream');

    state.sseSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'ping') return; // Heartbeat ignore

            if (data.type === 'message') {
                handleIncomingChatMessage(data.message);
            } else if (data.type === 'notification') {
                showToast(data.message, 'info');
                // Auto-refresh wallets & tables
                checkSession();
                if (state.activeView === 'client-dashboard') loadClientDashboard();
                if (state.activeView === 'freelancer-dashboard') loadFreelancerDashboard();
            }
        } catch (err) {
            console.error('SSE data parsing error:', err);
        }
    };

    state.sseSource.onerror = (err) => {
        console.error('SSE Error, reconnecting...', err);
        disconnectSSE();
        setTimeout(connectSSE, 5000); // Attempt auto-reconnect
    };
}

function disconnectSSE() {
    if (state.sseSource) {
        state.sseSource.close();
        state.sseSource = null;
    }
}

// Router/Navigator
function navigateTo(viewId, params = {}) {
    state.activeView = viewId;

    // Toggle view elements
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.add('d-none');
    });

    const activeViewEl = document.getElementById(`view-${viewId}`);
    if (activeViewEl) {
        activeViewEl.classList.remove('d-none');
    }

    // Toggle Sidebar active visual class
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNavItem = document.getElementById(`nav-${viewId}`);
    if (activeNavItem) activeNavItem.classList.add('active');

    // View Routing Hooks
    const headerTitle = document.getElementById('header-title-text');
    if (viewId === 'home') {
        headerTitle.innerText = 'Explore Projects';
        loadProjects();
        loadPlatformStats();
    } else if (viewId === 'project-details') {
        headerTitle.innerText = 'Project Details';
        if (params.id) loadProjectDetails(params.id);
    } else if (viewId === 'login') {
        headerTitle.innerText = 'Account Authentication';
    } else if (viewId === 'register') {
        headerTitle.innerText = 'Register Profile';
    } else if (viewId === 'verify') {
        headerTitle.innerText = 'Confirm Verification';
    } else if (viewId === 'client-dashboard') {
        headerTitle.innerText = 'Client Workspace';
        loadClientDashboard();
    } else if (viewId === 'freelancer-dashboard') {
        headerTitle.innerText = 'Freelancer Hub';
        loadFreelancerDashboard();
    } else if (viewId === 'chat') {
        headerTitle.innerText = 'Chat Messages';
        loadChatContacts(params.selectUserId);
    } else if (viewId === 'admin-dashboard') {
        headerTitle.innerText = 'Admin Management';
        loadAdminDashboard();
    }
}

// Load platform stats for homepage hero section
async function loadPlatformStats() {
    try {
        const stats = await (await fetch('/api/stats')).json();
        document.getElementById('stats-active-users').innerText = stats.users;
        document.getElementById('stats-total-jobs').innerText = stats.openProjects;
    } catch (err) {
        console.error('Failed to load platform stats:', err);
    }
}

// Explore Gigs: Fetch all projects
async function loadProjects() {
    try {
        const res = await fetch('/api/projects');
        const projects = await res.json();

        const grid = document.getElementById('jobs-listings-container');
        grid.innerHTML = '';

        if (projects.length === 0) {
            grid.innerHTML = '<div class="text-center text-muted" style="grid-column: 1/-1; padding: 40px;">No projects available right now. Let\'s post one!</div>';
            return;
        }

        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = 'glass-card project-card';
            card.innerHTML = `
                <div>
                    <div class="project-card-header">
                        <span class="badge badge-${p.status}">${p.status}</span>
                        <small class="text-muted">${p.category}</small>
                    </div>
                    <h3 class="project-card-title">${escapeHTML(p.title)}</h3>
                    <p class="project-card-desc">${escapeHTML(p.description)}</p>
                </div>
                <div class="project-card-footer">
                    <div class="project-card-budget">$${p.budget.toFixed(2)}</div>
                    <button class="btn btn-secondary" onclick="navigateTo('project-details', { id: ${p.id} })">View Project</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load projects:', err);
    }
}

// Load Specific Project Details & Bids
async function loadProjectDetails(projectId) {
    state.selectedProjectId = projectId;
    try {
        const res = await fetch(`/api/projects`);
        const projects = await res.json();
        const project = projects.find(p => p.id === parseInt(projectId));

        if (!project) {
            showToast('Project not found', 'error');
            navigateTo('home');
            return;
        }

        // Fill detail fields
        document.getElementById('pd-title').innerText = project.title;
        document.getElementById('pd-description').innerText = project.description;
        document.getElementById('pd-category').innerText = project.category;
        document.getElementById('pd-deadline').innerText = project.deadline;
        document.getElementById('pd-client').innerText = project.client_name || 'Client ID: ' + project.client_id;
        document.getElementById('pd-budget').innerText = `$${project.budget.toFixed(2)}`;

        const statusBadge = document.getElementById('pd-status-badge');
        statusBadge.className = `badge badge-${project.status}`;
        statusBadge.innerText = project.status;

        // Toggle bid interfaces based on role
        const user = state.currentUser;
        const freelancerBidSection = document.getElementById('pd-freelancer-bid-section');
        const guestBidSection = document.getElementById('pd-guest-bid-section');

        freelancerBidSection.classList.add('d-none');
        guestBidSection.classList.add('d-none');

        if (user && user.role === 'freelancer' && project.status === 'open') {
            freelancerBidSection.classList.remove('d-none');
        } else if (!user) {
            guestBidSection.classList.remove('d-none');
        }

        // Load project bids
        const bidsRes = await fetch(`/api/bids/project?projectId=${projectId}`);
        const bids = await bidsRes.json();

        document.getElementById('pd-bids-count').innerText = bids.length;
        const tableBody = document.getElementById('pd-bids-table-body');
        const thActions = document.getElementById('th-bid-actions');

        tableBody.innerHTML = '';

        // If client is viewing their own project, display the Hire Actions column
        const isClientOwner = user && user.id === project.client_id;
        if (isClientOwner && project.status === 'open') {
            thActions.classList.remove('d-none');
        } else {
            thActions.classList.add('d-none');
        }

        if (bids.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${isClientOwner ? 6 : 5}" class="text-center text-muted">No bids submitted yet.</td></tr>`;
            return;
        }

        bids.forEach(b => {
            const tr = document.createElement('tr');
            let actionCell = '';

            if (isClientOwner && project.status === 'open') {
                actionCell = `<td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size:12px;" onclick="hireFreelancer(${b.id}, ${b.amount})">Accept & Fund</button>
                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size:12px;" onclick="navigateTo('chat', { selectUserId: ${b.freelancer_id} })">Message</button>
                    </div>
                </td>`;
            } else if (thActions.classList.contains('d-none') === false) {
                actionCell = `<td>-</td>`;
            }

            tr.innerHTML = `
                <td><strong>${escapeHTML(b.freelancer_name)}</strong></td>
                <td style="color: var(--color-success); font-weight:700;">$${b.amount.toFixed(2)}</td>
                <td>${b.delivery_days} Days</td>
                <td style="max-width: 250px; white-space: normal; word-break: break-word;">${escapeHTML(b.proposal)}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                ${actionCell}
            `;
            tableBody.appendChild(tr);
        });

    } catch (err) {
        console.error('Failed to load project details:', err);
    }
}

// Client Dashboard
async function loadClientDashboard() {
    try {
        const res = await fetch('/api/projects/my');
        const projects = await res.json();
        const tbody = document.getElementById('client-jobs-table-body');
        tbody.innerHTML = '';

        if (projects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No projects created yet. Click "Post New Job" to list one.</td></tr>';
            return;
        }

        projects.forEach(p => {
            const tr = document.createElement('tr');

            let actionButtons = '-';
            if (p.status === 'open') {
                actionButtons = `<button class="btn btn-secondary" style="padding: 6px 12px; font-size:12px;" onclick="navigateTo('project-details', { id: ${p.id} })">Manage Proposals</button>`;
            } else if (p.status === 'ongoing') {
                actionButtons = `<div class="d-flex gap-2">
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size:12px;" onclick="navigateTo('chat', { selectUserId: ${p.freelancer_id} })">Chat</button>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size:12px;" onclick="refundEscrow(${p.id})">Cancel & Refund</button>
                </div>`;
            } else if (p.status === 'submitted') {
                actionButtons = `<div class="d-flex gap-2">
                    <button class="btn btn-success" style="padding: 6px 12px; font-size:12px; background: var(--color-success); color:white;" onclick="releaseEscrow(${p.id})">Approve & Release Pay</button>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size:12px;" onclick="navigateTo('chat', { selectUserId: ${p.freelancer_id} })">Review Work Chat</button>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size:12px;" onclick="refundEscrow(${p.id})">Reject & Dispute</button>
                </div>`;
            } else if (p.status === 'completed') {
                actionButtons = `<span class="badge badge-completed">Paid Out</span>`;
            } else if (p.status === 'cancelled') {
                actionButtons = `<span class="badge badge-cancelled">Refunded</span>`;
            }

            tr.innerHTML = `
                <td>#${p.id}</td>
                <td><strong>${escapeHTML(p.title)}</strong></td>
                <td style="font-weight: 600;">$${p.budget.toFixed(2)}</td>
                <td>${p.freelancer_name ? escapeHTML(p.freelancer_name) : '<em class="text-muted">None hired</em>'}</td>
                <td><span class="badge badge-${p.status}">${p.status}</span></td>
                <td>${actionButtons}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed loading client dashboard:', err);
    }
}

// Freelancer Dashboard
async function loadFreelancerDashboard() {
    try {
        const res = await fetch('/api/projects/my');
        const projects = await res.json();
        const tbody = document.getElementById('freelancer-jobs-table-body');
        tbody.innerHTML = '';

        if (projects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">You haven\'t been hired for any contracts yet. Head to "Explore Projects" and submit bids!</td></tr>';
            return;
        }

        projects.forEach(p => {
            const tr = document.createElement('tr');

            let actionBtn = '-';
            if (p.status === 'ongoing') {
                actionBtn = `<div class="d-flex gap-2">
                    <button class="btn btn-accent" style="padding: 6px 12px; font-size:12px;" onclick="submitProjectWork(${p.id})">Submit Work</button>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size:12px;" onclick="navigateTo('chat', { selectUserId: ${p.client_id} })">Chat Client</button>
                </div>`;
            } else if (p.status === 'submitted') {
                actionBtn = `<span class="text-muted" style="font-size:13px;">Awaiting Client Review</span>`;
            } else if (p.status === 'completed') {
                actionBtn = `<span class="badge badge-completed">Payment Released</span>`;
            } else if (p.status === 'cancelled') {
                actionBtn = `<span class="badge badge-cancelled">Cancelled by Client</span>`;
            }

            tr.innerHTML = `
                <td>#${p.id}</td>
                <td><strong>${escapeHTML(p.title)}</strong></td>
                <td style="font-weight: 600; color: var(--color-success);">$${p.budget.toFixed(2)}</td>
                <td>${escapeHTML(p.client_name)}</td>
                <td><span class="badge badge-${p.status}">${p.status}</span></td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed loading freelancer dashboard:', err);
    }
}

// Admin Console
async function loadAdminDashboard() {
    try {
        // Fetch Admin Users list
        const userRes = await fetch('/api/admin/users');
        const users = await userRes.json();

        // Update stats
        document.getElementById('admin-stat-users').innerText = users.length;

        const uTbody = document.getElementById('admin-users-table-body');
        uTbody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            const toggleText = u.is_verified ? 'Suspend' : 'Verify';
            const toggleClass = u.is_verified ? 'btn-danger' : 'btn-primary';

            // Disable button if managing themselves
            const isSelf = u.id === state.currentUser.id;
            const actionButton = isSelf
                ? '<span class="text-muted">Active Session</span>'
                : `<button class="btn ${toggleClass}" style="padding: 6px 12px; font-size:11px;" onclick="adminToggleUser(${u.id})">${toggleText}</button>`;

            tr.innerHTML = `
                <td>#${u.id}</td>
                <td><strong>${escapeHTML(u.name)}</strong></td>
                <td>${escapeHTML(u.email)}</td>
                <td><span class="quick-user-role role-${u.role}">${u.role}</span></td>
                <td><span class="badge ${u.is_verified ? 'badge-open' : 'badge-cancelled'}">${u.is_verified ? 'Verified' : 'Suspended'}</span></td>
                <td>$${u.balance.toFixed(2)}</td>
                <td>${actionButton}</td>
            `;
            uTbody.appendChild(tr);
        });

        // Fetch all projects for escrow metrics
        const projRes = await fetch('/api/projects');
        const projects = await projRes.json();
        document.getElementById('admin-stat-projects').innerText = projects.length;

        // Escrow funds locked in platform
        const lockedFunds = projects
            .filter(p => p.status === 'ongoing' || p.status === 'submitted')
            .reduce((acc, curr) => acc + curr.budget, 0);
        document.getElementById('admin-stat-escrow').innerText = `$${lockedFunds.toFixed(2)}`;

    } catch (err) {
        console.error('Failed loading admin dashboard:', err);
    }
}

// HIRE Freelancer & lock Escrow budget
async function hireFreelancer(bidId, amount) {
    if (!confirm(`Are you sure you want to hire this freelancer and escrow $${amount.toFixed(2)}?`)) return;

    try {
        const res = await fetch('/api/projects/hire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bidId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            checkSession(); // Update balance
            navigateTo('client-dashboard');
        } else {
            showToast(data.error || 'Failed to hire freelancer', 'error');
        }
    } catch (err) {
        console.error('Hiring transaction failed:', err);
    }
}

// Freelancer Work Submission
async function submitProjectWork(projectId) {
    if (!confirm('Mark project work as finished and submit for Client review?')) return;

    try {
        const res = await fetch('/api/projects/submit-work', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            loadFreelancerDashboard();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

// Release Escrow payment
async function releaseEscrow(projectId) {
    if (!confirm('Are you satisfied with the work? This releases locked escrow funds to the Freelancer wallet permanently. This cannot be reversed.')) return;

    try {
        const res = await fetch('/api/payments/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            checkSession(); // refresh client wallet
            loadClientDashboard();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

// Dispute / Cancel & Refund escrow
async function refundEscrow(projectId) {
    if (!confirm('Do you want to cancel this contract and request a refund of escrowed funds back to the Client wallet?')) return;

    try {
        const res = await fetch('/api/payments/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            checkSession(); // refresh wallet
            loadClientDashboard();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

// Auth handlers
async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            checkSession();
            navigateTo('home');
            document.getElementById('login-form').reset();
        } else {
            showToast(data.error, 'error');
            if (data.unverified) {
                // Redirect to verification panel
                navigateTo('verify');
                document.getElementById('verify-email-text').innerText = data.email;
            }
        }
    } catch (err) {
        showToast('Login connection error', 'error');
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            document.getElementById('verify-email-text').innerText = data.email;
            navigateTo('verify');
            document.getElementById('register-form').reset();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Registration failed', 'error');
    }
}

async function handleVerifySubmit(e) {
    e.preventDefault();
    const email = document.getElementById('verify-email-text').innerText;
    const code = document.getElementById('verify-code').value;

    try {
        const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            navigateTo('login');
            document.getElementById('verify-form').reset();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleForgotSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    try {
        const res = await fetch('/api/auth/reset-password-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            document.getElementById('reset-email-hidden').value = email;
            navigateTo('reset-password');
            document.getElementById('forgot-form').reset();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleResetConfirmSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email-hidden').value;
    const token = document.getElementById('reset-token').value;
    const password = document.getElementById('reset-new-password').value;

    try {
        const res = await fetch('/api/auth/reset-password-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token, password })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            navigateTo('login');
            document.getElementById('reset-confirm-form').reset();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        showToast('Logged out', 'info');
        checkSession();
    } catch (err) {
        console.error(err);
    }
}

// Post Project
async function handlePostProjectSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('post-title').value;
    const category = document.getElementById('post-category').value;
    const budget = document.getElementById('post-budget').value;
    const deadline = document.getElementById('post-deadline').value;
    const description = document.getElementById('post-description').value;

    // Check user balance first before locking escrow
    if (state.currentUser.balance < parseFloat(budget)) {
        showToast('Insufficient wallet funds to lock escrow for this budget!', 'error');
        openModal('modal-add-funds');
        return;
    }

    try {
        const res = await fetch('/api/projects/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, budget, deadline, description })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            closeModal('modal-post-project');
            document.getElementById('modal-post-project').querySelector('form').reset();
            checkSession(); // update balance
            navigateTo('client-dashboard');
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

// Bids triggers
function openBidModal() {
    document.getElementById('bid-project-id').value = state.selectedProjectId;
    openModal('modal-place-bid');
}

async function handlePlaceBidSubmit(e) {
    e.preventDefault();
    const projectId = document.getElementById('bid-project-id').value;
    const amount = document.getElementById('bid-amount').value;
    const proposal = document.getElementById('bid-proposal').value;
    const deliveryDays = document.getElementById('bid-days').value;

    try {
        const res = await fetch('/api/bids/place', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, amount, proposal, deliveryDays })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            closeModal('modal-place-bid');
            document.getElementById('modal-place-bid').querySelector('form').reset();
            loadProjectDetails(projectId);
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

// Reload funds
async function handleAddFundsSubmit(e) {
    e.preventDefault();
    const amount = document.getElementById('funds-amount').value;
    try {
        const res = await fetch('/api/debug/add-funds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            closeModal('modal-add-funds');
            checkSession();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

// Admin moderate
async function adminToggleUser(userId) {
    try {
        const res = await fetch('/api/admin/toggle-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            loadAdminDashboard();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

// Developer quick switch
async function quickLoginAs(userId) {
    try {
        const res = await fetch('/api/debug/login-as', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            disconnectSSE(); // Kill old SSE stream
            state.currentUser = data.user;
            setupSessionUI();
            connectSSE(); // Bind new SSE stream

            // Smart routing depending on new role
            if (data.user.role === 'client') navigateTo('client-dashboard');
            else if (data.user.role === 'freelancer') navigateTo('freelancer-dashboard');
            else if (data.user.role === 'admin') navigateTo('admin-dashboard');
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Role switch failed', 'error');
    }
}

// Outbox Polling
function startEmailSimulationPolling() {
    loadSimulatedEmails();
    setInterval(loadSimulatedEmails, 3000);
}

async function loadSimulatedEmails() {
    try {
        const res = await fetch('/api/debug/emails');
        const emails = await res.json();
        const container = document.getElementById('sim-email-log-container');

        if (emails.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="font-size: 12px; margin-top: 20px;">No outgoing logs yet.</p>';
            return;
        }

        container.innerHTML = '';
        emails.forEach(email => {
            const card = document.createElement('div');
            card.className = 'sim-email-card';

            // Format clickable links inside body for extreme developer convenience!
            let formattedBody = escapeHTML(email.body);
            const linkRegex = /(https?:\/\/[^\s]+)/g;
            formattedBody = formattedBody.replace(linkRegex, (url) => {
                // Shorten displayed URL or parse tokens
                const cleanUrl = new URL(url);
                const code = cleanUrl.searchParams.get('code') || cleanUrl.searchParams.get('token');
                return `<a href="#" onclick="handleSimulatedEmailClick('${cleanUrl.pathname}${cleanUrl.search}')">${url}</a>`;
            });

            card.innerHTML = `
                <div class="sim-email-to">To: ${escapeHTML(email.to_email)}</div>
                <div class="sim-email-subject">Subject: ${escapeHTML(email.subject)}</div>
                <div class="sim-email-body">${formattedBody}</div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to poll simulated emails:', err);
    }
}

// Catch simulated link clicks and feed router
function handleSimulatedEmailClick(route) {
    // route e.g., /verify?email=x&code=y
    const tempUrl = new URL(route, 'http://localhost');
    const email = tempUrl.searchParams.get('email');
    const code = tempUrl.searchParams.get('code');
    const token = tempUrl.searchParams.get('token');

    if (tempUrl.pathname.includes('verify')) {
        navigateTo('verify');
        document.getElementById('verify-email-text').innerText = email;
        if (code) document.getElementById('verify-code').value = code;
    } else if (tempUrl.pathname.includes('reset-password')) {
        navigateTo('reset-password');
        document.getElementById('reset-email-hidden').value = email;
        if (token) document.getElementById('reset-token').value = token;
    }
}

// --- CHAT MODULE ---
async function loadChatContacts(selectUserId = null) {
    try {
        const res = await fetch('/api/chat/contacts');
        const contacts = await res.json();
        const container = document.getElementById('chat-contacts-container');
        container.innerHTML = '';

        // If a specific userId was passed (e.g. "Message" button clicked on project proposal)
        // Check if that user is already in the contact list. If not, fetch their info.
        if (selectUserId) {
            const numSelectId = parseInt(selectUserId);
            const exists = contacts.some(c => c.id === numSelectId);
            if (!exists) {
                try {
                    const userInfoRes = await fetch(`/api/users/info?userId=${numSelectId}`);
                    if (userInfoRes.ok) {
                        const userInfo = await userInfoRes.json();
                        contacts.unshift(userInfo);
                    }
                } catch (e) {
                    contacts.unshift({ id: numSelectId, name: 'User #' + numSelectId, role: 'partner' });
                }
            }
        }

        if (contacts.length === 0) {
            container.innerHTML = '<li class="text-center text-muted" style="padding: 20px; font-size:13px;">No active conversations. Click "Message" on a proposal to start chatting.</li>';
            return;
        }

        contacts.forEach(c => {
            const item = document.createElement('li');
            item.className = 'chat-contact-item';
            if (state.activeChatPartnerId === c.id || (selectUserId && parseInt(selectUserId) === c.id)) {
                item.className += ' active';
            }
            item.innerHTML = `
                <div class="contact-avatar">${c.name.charAt(0).toUpperCase()}</div>
                <div class="contact-details">
                    <div class="contact-name">${escapeHTML(c.name)}</div>
                    <div class="contact-role">${c.role}</div>
                </div>
            `;
            item.onclick = () => selectActiveChatPartner(c.id, c.name, c.role);
            container.appendChild(item);
        });

        // Auto select first or requested contact
        if (selectUserId) {
            const target = contacts.find(c => c.id === parseInt(selectUserId));
            if (target) selectActiveChatPartner(target.id, target.name, target.role);
        } else if (!state.activeChatPartnerId && contacts.length > 0) {
            selectActiveChatPartner(contacts[0].id, contacts[0].name, contacts[0].role);
        }
    } catch (err) {
        console.error('Failed to load chat contacts:', err);
    }
}

function selectActiveChatPartner(userId, name, role) {
    state.activeChatPartnerId = userId;

    // Highlight contact item
    document.querySelectorAll('.chat-contact-item').forEach(item => {
        item.classList.remove('active');
    });
    // Add active class to clicked item
    const contacts = document.getElementById('chat-contacts-container').children;
    for (let item of contacts) {
        if (item.querySelector('.contact-name').innerText === name) {
            item.classList.add('active');
        }
    }

    // Set Header
    document.getElementById('chat-active-header').classList.remove('d-none');
    document.getElementById('active-chat-avatar').innerText = name.charAt(0).toUpperCase();
    document.getElementById('active-chat-username').innerText = name;
    document.getElementById('active-chat-userrole').innerText = role;

    // Show input container
    document.getElementById('chat-input-container').classList.remove('d-none');

    // Fetch Convo History
    loadChatHistory(userId);
}

async function loadChatHistory(otherUserId) {
    try {
        const res = await fetch(`/api/chat/history?userId=${otherUserId}`);
        const messages = await res.json();

        const log = document.getElementById('chat-messages-log');
        log.innerHTML = '';

        if (messages.length === 0) {
            log.innerHTML = '<div class="text-center text-muted" style="margin-top: 50px; font-size: 13px;">No message history. Say hello!</div>';
            return;
        }

        messages.forEach(msg => {
            appendMessageToLog(msg);
        });

        scrollToBottom('chat-messages-log');
    } catch (err) {
        console.error('Failed to load chat history:', err);
    }
}

function appendMessageToLog(msg) {
    const log = document.getElementById('chat-messages-log');

    // Clean empty placeholder message
    if (log.querySelector('.text-muted')) {
        log.innerHTML = '';
    }

    const bubble = document.createElement('div');

    let isIncoming = msg.sender_id !== state.currentUser.id;
    let isSystem = msg.message.startsWith('[SYSTEM]');

    if (isSystem) {
        bubble.className = 'chat-message-bubble system';
    } else {
        bubble.className = `chat-message-bubble ${isIncoming ? 'incoming' : 'outgoing'}`;
    }

    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    bubble.innerHTML = `
        <div>${escapeHTML(msg.message)}</div>
        <span class="chat-message-meta">${time}</span>
    `;

    log.appendChild(bubble);
}

async function handleSendChatMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-message-input');
    const message = input.value.trim();
    if (!message || !state.activeChatPartnerId) return;

    try {
        const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverId: state.activeChatPartnerId, message })
        });
        const data = await res.json();
        if (res.ok) {
            appendMessageToLog(data.data);
            input.value = '';
            scrollToBottom('chat-messages-log');
            loadChatContacts(); // refresh contact order
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        console.error('Failed to send message:', err);
    }
}

// Dispatch incoming SSE message
function handleIncomingChatMessage(msg) {
    if (state.activeChatPartnerId === msg.sender_id) {
        appendMessageToLog(msg);
        scrollToBottom('chat-messages-log');
    } else {
        // Show live notification toast
        showToast(`New message from user #${msg.sender_id}!`, 'info');
        loadChatContacts(); // refresh sidebar indicators
    }
}

// Modal Helpers
function openModal(id) {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

// Toast System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');

    toast.innerHTML = `
        <span style="margin-right: 8px;">${icon} ${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; font-size:16px; margin-left:12px;">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove toast
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// General Utilities
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function scrollToBottom(id) {
    const el = document.getElementById(id);
    el.scrollTop = el.scrollHeight;
}
