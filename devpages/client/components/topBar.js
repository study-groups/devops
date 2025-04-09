import { authState } from '/client/authState.js';
import { logout } from '/client/auth.js';
import { eventBus } from '/client/eventBus.js';

// Helper for logging within this module
function logTopBar(message, level = 'text') {
    const prefix = '[TOP BAR]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

export function updateTopBar() {
    logTopBar('Updating Top Bar UI based on auth state...');
    try {
        const state = authState.get(); // Get current state
        const isLoggedIn = state.isAuthenticated;
        const username = state.username || '';

        const loginForm = document.getElementById('login-form');
        const logoutBtn = document.getElementById('logout-btn');
        const authStatusDisplay = document.getElementById('auth-status-display');

        if (loginForm) loginForm.style.display = isLoggedIn ? 'none' : 'flex';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
        if (authStatusDisplay) {
            authStatusDisplay.textContent = isLoggedIn ? username : 'Not Logged In';
            authStatusDisplay.style.display = 'inline-block';
        }

        document.body.setAttribute('data-auth-state', isLoggedIn ? 'logged-in' : 'logged-out');

        logTopBar(`Update complete. Logged in: ${isLoggedIn}, User: ${username}`);

    } catch (error) {
        logTopBar(`Error updating top bar: ${error.message}`, 'error');
    }
}

export function setupTopBarListeners() {
    logTopBar('Setting up Top Bar listeners...');
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logTopBar('Logout button clicked.');
            logout(); // Call the imported logout function
        });
    }
    // Add other listeners if the topBar component handles them directly
    logTopBar('Top Bar listeners setup complete.');
}

// Subscribe to auth state changes to keep the top bar updated
authState.subscribe(() => {
    logTopBar('Auth state changed, triggering top bar update.');
    updateTopBar();
});

// Initial update on load
// updateTopBar(); // This will be called by the initial subscription trigger

// Optional: Immediate setup of listeners if the element exists early
// document.addEventListener('DOMContentLoaded', setupTopBarListeners);

/**
 * Update content height based on actual top bar height
 * This is important for responsive layouts where the top bar height may change
 */
function updateContentHeight() {
    // Get the actual height of the top bar
    const topBar = document.querySelector('nav.top-bar') || document.querySelector('.top-bar');
    if (!topBar) return;
    
    const topBarHeight = topBar.offsetHeight;
    const mainContainer = document.getElementById('main-container');
    const content = document.getElementById('content');
    
    if (!mainContainer || !content) return;
    
    // Get log container height if visible
    const logVisible = document.documentElement.getAttribute('data-log-visible') === 'true';
    const logHeight = logVisible ? (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--log-height')) || 120) : 0;
    
    // Update content max-height
    content.style.maxHeight = `calc(100vh - ${topBarHeight}px${logVisible ? ` - ${logHeight}px` : ''})`;
    
    logTopBar(`Content height updated. Top bar: ${topBarHeight}px, Log height: ${logHeight}px`);
}

// Add resize listener to update content height when window is resized
window.addEventListener('resize', updateContentHeight);

// Ensure content height is updated when the page loads
document.addEventListener('DOMContentLoaded', updateContentHeight);

// REMOVED updateUserInfo function as it depended on fetchSystemInfo/uiState

// REMOVED attachTopBarHandlers function as handlers are managed centrally

// REMOVED loadCodebaseStructure function

// REMOVED userView and adminView HTML strings as structure is in index.html 