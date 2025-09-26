// Self-invoking anonymous function to encapsulate the code and avoid polluting the global scope.
(function() {
    // ===================================================================================
    // APP STATE & LOCALSTORAGE MANAGEMENT
    // All data is stored in the browser's localStorage to make the app work offline.
    // ===================================================================================

    // Load users from localStorage, or initialize with an empty array if none exist.
    let users = JSON.parse(localStorage.getItem('lostFoundUsers') || '[]');
    // Load items from localStorage, or initialize with an empty array.
    let items = JSON.parse(localStorage.getItem('lostFoundItems') || '[]');
    // Load notifications from localStorage, or initialize with an empty array.
    let notifications = JSON.parse(localStorage.getItem('lostFoundNotifications') || '[]');
    // Variable to hold the currently logged-in user object.
    let currentUser = null;

    // --- Helper Functions to Save Data ---

    /**
     * Saves the current `users` array to localStorage.
     */
    function saveUsers() {
        localStorage.setItem('lostFoundUsers', JSON.stringify(users));
    }

    /**
     * Saves the current `items` array to localStorage.
     */
    function saveItems() {
        localStorage.setItem('lostFoundItems', JSON.stringify(items));
    }

    /**
     * Saves the current `notifications` array to localStorage.
     */
    function saveNotifications() {
        localStorage.setItem('lostFoundNotifications', JSON.stringify(notifications));
    }

    /**
     * Generates a simple unique ID using the current timestamp and a random number.
     * @returns {number} A unique ID.
     */
    function uid() {
        return Date.now() + Math.floor(Math.random() * 999);
    }

    /**
     * Gets today's date in 'YYYY-MM-DD' format, suitable for date input fields.
     * @returns {string} Today's date.
     */
    function todayISO() {
        return new Date().toISOString().split('T')[0];
    }

    // ===================================================================================
    // SAMPLE DATA INITIALIZATION
    // ===================================================================================

    /**
     * Populates the system with some default users if it's the first time running.
     * This ensures the app has some data to work with immediately.
     */
    function ensureSampleUsers() {
        if (users.length === 0) {
            users.push({ name: "Admin", email: "admin@school.edu", id: "A001", role: "admin", password: "admin123" });
            users.push({ name: "John Doe", email: "john.doe@school.edu", id: "S001", role: "student", password: "student123" });
            users.push({ name: "Jane Smith", email: "jane.smith@school.edu", id: "T001", role: "staff", password: "staff123" });
            saveUsers();
        }
    }

    // ===================================================================================
    // UI UTILITY FUNCTIONS
    // These functions handle interactions with the DOM (Document Object Model).
    // ===================================================================================

    /**
     * A shortcut function to get a DOM element by its ID.
     * @param {string} id - The ID of the element to find.
     * @returns {HTMLElement} The found element.
     */
    function el(id) {
        return document.getElementById(id);
    }

    /**
     * Manages the visibility of the login and register tabs.
     * @param {Event} ev - The click event from the tab button.
     * @param {string} tab - The name of the tab to show ('login' or 'register').
     */
    window.showAuthTab = function(ev, tab) {
        el('loginTab').classList.toggle('hidden', tab !== 'login');
        el('registerTab').classList.toggle('hidden', tab !== 'register');
        document.querySelectorAll('#authCard .nav-tab').forEach(t => t.classList.remove('active'));
        if (ev && ev.target) ev.target.classList.add('active');
    }

    /**
     * Shows a specific content tab (like 'Browse' or 'Report Lost') and hides the dashboard.
     * @param {string} tab - The name of the tab to display.
     */
    window.showTabContent = function(tab) {
        const tabIds = { browse: 'browseTab', reportLost: 'reportLostTab', reportFound: 'reportFoundTab', myReports: 'myReportsTab', notifications: 'notificationsTab' };
        Object.values(tabIds).forEach(id => el(id).classList.add('hidden'));

        el('dashboardGrid').classList.add('hidden');
        el('mainContentArea').classList.remove('hidden');
        el(tabIds[tab]).classList.remove('hidden');

        // Refresh data when switching to certain tabs.
        if (tab === 'browse') renderBrowse();
        if (tab === 'myReports') renderMyReports();
        if (tab === 'notifications') renderNotifications();
    }

    /**
     * Shows the main dashboard grid and hides any open tab content. Also closes the sidebar.
     */
    window.showDashboard = function() {
        el('mainContentArea').classList.add('hidden');
        el('dashboardGrid').classList.remove('hidden');
        el('sidebar').classList.remove('open');
    }

    /**
     * Switches the UI to the main application view after a successful login.
     * @param {object} user - The user object of the logged-in user.
     */
    function showAppFor(user) {
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user)); // Save session
        el('authCard').classList.add('hidden');
        el('appCard').classList.remove('hidden');
        el('currentUserName').textContent = user.name;
        el('currentUserRole').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        showDashboard(); // Start at the dashboard
        renderNotifyBadge();
    }

    /**
     * Logs the current user out and returns to the authentication screen.
     */
    window.logout = function() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        el('authCard').classList.remove('hidden');
        el('appCard').classList.add('hidden');
    }

    // ===================================================================================
    // RENDER FUNCTIONS
    // These functions are responsible for displaying data on the screen.
    // ===================================================================================

    /**
     * Renders the list of items in the 'Browse' tab, applying search and status filters.
     */
    function renderBrowse() {
        const container = el('itemsContainer');
        container.innerHTML = '';
        const query = (el('searchInput')?.value || '').toLowerCase();
        const statusFilter = el('statusFilter')?.value || '';

        const filtered = items
            .filter(it => {
                const statusMatch = !statusFilter || it.status === statusFilter || (statusFilter === 'lost' && it.type === 'lost' && it.status !== 'claimed') || (statusFilter === 'found' && it.type === 'found' && it.status !== 'claimed');
                if (!statusMatch) return false;
                const queryMatch = !query || it.name.toLowerCase().includes(query) || it.location.toLowerCase().includes(query);
                return queryMatch;
            })
            .sort((a, b) => b.id - a.id); // Sort by most recent

        if (filtered.length === 0) {
            container.innerHTML = '<div class="small">No items to show.</div>';
            return;
        }
        filtered.forEach(it => container.appendChild(itemCardElement(it)));
    }

    /**
     * Renders the items reported by the currently logged-in user in the 'My Reports' tab.
     */
    function renderMyReports() {
        const container = el('myReportsContainer');
        container.innerHTML = '';
        const myItems = items.filter(it => currentUser && it.userId === currentUser.id).sort((a, b) => b.id - a.id);

        if (myItems.length === 0) {
            container.innerHTML = '<div class="small">You have no reports yet.</div>';
            return;
        }
        myItems.forEach(it => container.appendChild(itemCardElement(it)));
    }

    /**
     * Renders the notifications for the current user.
     */
    function renderNotifications() {
        const container = el('notificationsContainer');
        container.innerHTML = '';
        if (!currentUser) return;

        const myNotifications = notifications.filter(n => n.forUserId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt);

        if (myNotifications.length === 0) {
            container.innerHTML = '<div class="small">No notifications.</div>';
            return;
        }

        myNotifications.forEach(n => {
            const div = document.createElement('div');
            div.className = 'item-card';
            div.style.marginBottom = '10px';
            const seenMark = n.seen ? '' : '<span class="badge">NEW</span> ';
            const created = new Date(n.createdAt).toLocaleString();

            // Generate HTML for matched items within the notification.
            const matchesHtml = n.matches.map(id => {
                const item = items.find(x => x.id === id);
                return item ? `<div><b>${item.name}</b> (${item.location})</div>` : '';
            }).join('');

            div.innerHTML = `
                <div class="small">${seenMark}<strong>${n.title}</strong> <span style="float:right">${created}</span></div>
                <div style="margin-top:8px">${n.message}</div>
                <div style="margin-top:8px">${matchesHtml}</div>
                <div style="margin-top:10px" class="flex">
                    <button class="btn-secondary" onclick="markNotificationSeen(${n.id})">Mark as read</button>
                    <button class="btn-secondary" onclick="dismissNotification(${n.id})">Dismiss</button>
                </div>`;
            container.appendChild(div);
        });
    }

    /**
     * Updates the notification badge count in the UI.
     */
    function renderNotifyBadge() {
        if (!currentUser) return;
        const count = notifications.filter(n => n.forUserId === currentUser.id && !n.seen).length;
        const badge = el('notifyBadge');
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    /**
     * Creates and returns the HTML element for a single item card.
     * @param {object} it - The item object to display.
     * @returns {HTMLElement} The card element.
     */
    function itemCardElement(it) {
        const div = document.createElement('div');
        div.className = 'item-card';
        const statusClass = it.status === 'claimed' ? 'status-claimed' : (it.type === 'lost' ? 'status-lost' : 'status-found');
        const statusText = it.status === 'claimed' ? 'CLAIMED' : it.type.toUpperCase();
        const imageHtml = it.image ? `<img src="${it.image}" class="item-image" alt="${it.name}">` : '';

        // Determine which buttons to show based on user role and item status.
        const markClaimedBtn = (it.status !== 'claimed' && currentUser && (currentUser.id === it.userId || currentUser.role === 'admin'))
            ? `<button class="btn-secondary" onclick="markItemClaimed(${it.id})">Mark as Claimed</button>` : '';
        const claimBtn = (it.status !== 'claimed' && currentUser && currentUser.id !== it.userId)
            ? `<button class="btn" onclick="createClaim(${it.id})">I want to claim</button>` : '';

        div.innerHTML = `
            <div class="item-status ${statusClass}">${statusText}</div>
            ${imageHtml}
            <h3 style="margin:.3rem 0">${it.name}</h3>
            <div class="small"><b>Location:</b> ${it.location}</div>
            <div class="small"><b>Date:</b> ${it.date}</div>
            <div class="small" style="margin-top:6px">${it.description || ''}</div>
            <div class="small" style="margin-top:8px"><b>Reported by:</b> ${it.reporter}</div>
            <div style="margin-top:10px" class="flex">
                ${markClaimedBtn}
                ${claimBtn}
            </div>`;
        return div;
    }

    // ===================================================================================
    // CORE LOGIC: MATCHING & NOTIFICATIONS
    // ===================================================================================

    /**
     * Checks if a newly reported item matches any existing items of the opposite type.
     * If matches are found, it creates a notification for the original reporter.
     * @param {object} newItem - The newly reported item.
     */
    function checkMatchesFor(newItem) {
        const lowerName = newItem.name.toLowerCase();
        const oppositeType = newItem.type === 'lost' ? 'found' : 'lost';

        const matches = items.filter(it =>
            it.type === oppositeType && it.status !== 'claimed' && it.id !== newItem.id &&
            (it.name.toLowerCase().includes(lowerName) || lowerName.includes(it.name.toLowerCase()))
        ).map(it => it.id);

        if (matches.length > 0) {
            const reporterToNotify = items.find(item => item.id === matches[0])?.userId;
            if(reporterToNotify){
                const notification = {
                    id: uid(),
                    forUserId: reporterToNotify,
                    createdAt: Date.now(),
                    seen: false,
                    title: `Possible match for your item "${items.find(i => i.id === matches[0]).name}"`,
                    message: `A similar item was just reported: "${newItem.name}".`,
                    matches: [newItem.id]
                };
                notifications.push(notification);
                saveNotifications();
                renderNotifyBadge();
                alert(`🔔 Possible match detected! A notification has been sent to the other user.`);
            }
        }
    }

    // --- Notification Controls ---
    /** Marks a notification as read. */
    window.markNotificationSeen = function(nid) {
        notifications = notifications.map(n => n.id === nid ? { ...n, seen: true } : n);
        saveNotifications();
        renderNotifications();
        renderNotifyBadge();
    };

    /** Removes a notification permanently. */
    window.dismissNotification = function(nid) {
        notifications = notifications.filter(n => n.id !== nid);
        saveNotifications();
        renderNotifications();
        renderNotifyBadge();
    };

    // ===================================================================================
    // FORM HANDLERS
    // ===================================================================================

    // --- Authentication ---
    /** Handles the user registration form submission. */
    function registerUser(ev) {
        ev.preventDefault();
        const name = el('regName').value.trim();
        const email = el('regEmail').value.trim().toLowerCase();
        const id = el('regId').value.trim();
        const role = el('regRole').value;
        const pw = el('regPassword').value;

        if (!name || !email || !id || !role || !pw) return alert('Please complete the form.');
        if (users.find(u => u.email === email || u.id === id)) return alert('A user with this email or ID already exists.');

        users.push({ name, email, id, role, password: pw });
        saveUsers();
        alert('Registered successfully — please login.');
        showAuthTab(null, 'login');
        ev.target.reset();
    }

    /** Handles the user login form submission. */
    function loginUser(ev) {
        ev.preventDefault();
        const ident = el('loginEmailTextfield').value.trim().toLowerCase();
        const pw = el('loginPasswordTextfield').value;
        const user = users.find(u => (u.email === ident || u.id.toLowerCase() === ident) && u.password === pw);

        if (!user) return alert('Invalid credentials — try sample accounts or register.');

        showAppFor(user);
    }

    // --- Image Handling ---
    /**
     * Reads an image file from an input, displays a preview, and returns its Base64 representation.
     * @param {HTMLInputElement} inputElement - The file input element.
     * @param {HTMLImageElement} previewElement - The img element for the preview.
     * @returns {Promise<string|null>} A promise that resolves with the Base64 string of the image.
     */
    function handleImageUpload(inputElement, previewElement) {
        return new Promise((resolve) => {
            const file = inputElement.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewElement.src = e.target.result;
                    previewElement.style.display = 'block';
                    resolve(e.target.result);
                };
                reader.readAsDataURL(file);
            } else {
                resolve(null);
            }
        });
    }

    // --- Item Reporting ---
    /** Handles the 'Report Lost' form submission. */
    async function submitLost(ev) {
        ev.preventDefault();
        if (!currentUser) return alert('Please login first.');
        const name = el('lost_name').value.trim();
        const location = el('lost_location').value.trim();
        const description = el('lost_description').value.trim();
        const date = el('lost_date').value || todayISO();

        if (!name || !location || !date) return alert('Please fill all required fields.');

        const image = await handleImageUpload(el('lost_image'), el('lost_image_preview'));

        const newItem = { id: uid(), type: 'lost', name, location, description, date, reporter: currentUser.name, userId: currentUser.id, status: 'active', image };
        items.push(newItem);
        saveItems();
        checkMatchesFor(newItem);
        alert('Lost item reported successfully.');
        ev.target.reset();
        el('lost_image_preview').style.display = 'none';
        showDashboard();
    }

    /** Handles the 'Report Found' form submission. */
    async function submitFound(ev) {
        ev.preventDefault();
        if (!currentUser) return alert('Please login first.');
        const name = el('found_name').value.trim();
        const location = el('found_location').value.trim();
        const description = el('found_description').value.trim();
        const date = el('found_date').value || todayISO();

        if (!name || !location || !date) return alert('Please fill all required fields.');

        const image = await handleImageUpload(el('found_image'), el('found_image_preview'));

        const newItem = { id: uid(), type: 'found', name, location, description, date, reporter: currentUser.name, userId: currentUser.id, status: 'active', image };
        items.push(newItem);
        saveItems();
        checkMatchesFor(newItem);
        alert('Found item reported successfully.');
        ev.target.reset();
        el('found_image_preview').style.display = 'none';
        showDashboard();
    }

    // --- Claims & Actions ---
    /** Creates a notification for the item's reporter when another user wants to claim it. */
    window.createClaim = function(itemId) {
        const item = items.find(x => x.id === itemId);
        if (!item || !currentUser) return;

        const note = { id: uid(), forUserId: item.userId, createdAt: Date.now(), seen: false, title: `Claim attempt for "${item.name}"`, message: `${currentUser.name} (ID: ${currentUser.id}) wants to claim this item.`, matches: [item.id] };
        notifications.push(note);
        saveNotifications();
        renderNotifyBadge(); // Update badge for the *other* user (not visible here)
        alert('Your claim has been sent to the reporter. They will be notified.');
    };

    /** Marks an item's status as 'claimed'. */
    window.markItemClaimed = function(itemId) {
        items = items.map(it => it.id === itemId ? { ...it, status: 'claimed' } : it);
        saveItems();
        renderBrowse();
        renderMyReports();
    };

    // ===================================================================================
    // INITIALIZATION
    // This function sets up the application when the page loads.
    // ===================================================================================

    function init() {
        ensureSampleUsers();

        // Attach event listeners to forms.
        el('registerForm').addEventListener('submit', registerUser);
        el('loginForm').addEventListener('submit', loginUser);
        el('lostForm').addEventListener('submit', submitLost);
        el('foundForm').addEventListener('submit', submitFound);

        // Attach event listeners for image previews.
        el('lost_image').addEventListener('change', () => handleImageUpload(el('lost_image'), el('lost_image_preview')));
        el('found_image').addEventListener('change', () => handleImageUpload(el('found_image'), el('found_image_preview')));

        // Attach event listeners for sidebar controls.
        el('menuIcon').addEventListener('click', () => el('sidebar').classList.add('open'));
        el('closeSidebar').addEventListener('click', () => el('sidebar').classList.remove('open'));

        // Pre-fill date fields with today's date.
        el('lost_date').value = todayISO();
        el('found_date').value = todayISO();

        // Check for a saved session and auto-login if one exists.
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showAppFor(currentUser);
        }
    }

    // Run the initialization function when the script loads.
    init();
})();