import { AUTH_STATE } from '/client/auth.js';
import { logout } from '/client/auth.js';
import { eventBus } from '/client/eventBus.js';
import { showSystemInfo } from '/client/uiManager.js';

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
    const topBarElement = document.getElementById('top-bar-container') || document.querySelector('nav');
    if (!topBarElement) {
        console.error('[TOP BAR ERROR] Top bar container not found.');
        return;
    }

    // Update based on AUTH_STATE instead of UI_STATES
    if (AUTH_STATE.current === AUTH_STATE.AUTHENTICATED) {
        // Show user-related elements
        const pwdDisplay = document.getElementById('pwd-display');
        if (pwdDisplay) {
            pwdDisplay.textContent = AUTH_STATE.username || 'User';
            pwdDisplay.style.display = 'inline-block';
        }
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        
        // Hide login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.style.display = 'none';

    } else { // Handle unauthenticated, unknown, error states
        // Hide user-related elements
        const pwdDisplay = document.getElementById('pwd-display');
        if (pwdDisplay) pwdDisplay.style.display = 'none';
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'none';
        
        // Show login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.style.display = 'flex'; // Or 'inline-flex'?
    }

    // REMOVED logic based on UI_STATES
    /*
    if (uiState.current === UI_STATES.USER) {
        // ... show user elements
    } else if (uiState.current === UI_STATES.LOGIN) {
        // ... show login form
    }
    */

    logTopBar('UI updated based on auth state.');
}

// REMOVED updateUserInfo function as it depended on fetchSystemInfo/uiState

// REMOVED attachTopBarHandlers function as handlers are managed centrally

// REMOVED loadCodebaseStructure function

// REMOVED userView and adminView HTML strings as structure is in index.html 