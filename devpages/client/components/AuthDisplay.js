/**
 * AuthDisplay.js - Component to manage login form and user status display.
 * Relies on central appStore for state.
 */
import { appStore } from '/client/appState.js'; // IMPORT central state
// REMOVED: eventBus import no longer needed for login trigger
// import { eventBus } from '/client/eventBus.js';
// Assuming logMessage is globally available or adjust path
// import { logMessage } from '/client/log/index.js'; 

// CHANGED: Import only logout
import { logout } from '/client/auth.js';
// ADDED: Import triggerActions
import { triggerActions } from '/client/actions.js';

function logAuth(message, level = 'info') {
    const type = 'AUTH_DISPLAY';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`); // Fallback
    }
}

export function createAuthDisplayComponent(targetElementId) {
    let element = null;
    let authUnsubscribe = null;

    // --- Private Event Handlers (bound to component instance) ---
    const onLoginSubmit = async (event) => {
        event.preventDefault();
        logAuth("[AuthDisplay] Login submitted");
        const usernameInput = element?.querySelector('#username');
        const passwordInput = element?.querySelector('#password');
        const username = usernameInput?.value;
        const password = passwordInput?.value;

        if (username && password) {
            try {
                // Clear password field immediately (optimistic)
                if (passwordInput) passwordInput.value = '';
                
                // CHANGED: Use triggerActions to emit login request
                logAuth(`[AuthDisplay] Triggering login action for user: ${username}`);
                triggerActions.login(username, password); // This emits an event
                
                // Login success/failure/error display is now handled by rendering based on appStore.auth state changes.
                // No need for success check or manual error handling here.
                logAuth(`[AuthDisplay] login action triggered for ${username}. Waiting for state update.`);

            } catch (error) {
                // This catch block might still be useful if triggerActions.login itself could throw an error
                // (though unlikely in its current implementation).
                logAuth(`[AuthDisplay] Error during triggerActions.login call: ${error.message}`, 'error');
                alert(`An unexpected error occurred trying to log in: ${error.message}`);
            }
        } else {
            alert("Please enter username and password.");
        }
    };

    const onLogoutClick = async (event) => {
        event.preventDefault();
        logAuth("[AuthDisplay] Logout clicked, calling logout().");
        try {
            // Call logout directly, it will dispatch AUTH_LOGOUT
            await logout(); 
        } catch (error) {
             // Catch errors from the logout API call itself
            logAuth(`[AuthDisplay] Error during logout call: ${error.message}`, 'error');
            alert(`Logout failed: ${error.message}`);
        }
    };

    // --- Rendering Logic --- 
    // Accepts the `auth` slice of the central state
    const render = (authStateSlice) => {
        // <<< ADD LOGGING HERE >>>
        logAuth(`[AuthDisplay render] Received authStateSlice: ${JSON.stringify(authStateSlice)}`);

        if (!element) return;

        // Use properties from the central auth state
        const isAuthenticated = authStateSlice.isAuthenticated;
        const username = authStateSlice.user?.username; // Access nested username
        const isInitializing = authStateSlice.isInitializing; // Track initial load/login process
        const error = authStateSlice.error; // Get error message

        // Determine if any auth-related action is in progress
        // For now, treat 'isInitializing' as the loading indicator for login/logout/status check
        const isLoading = isInitializing; 

        // Don't render the form/status until the initial check is complete (isInitializing is false)
        if (isInitializing && !isAuthenticated) { // Show loading only during initial check
             element.innerHTML = '<span class="auth-loading">Checking auth...</span>';
             return;
        }
        
        // Build HTML conditionally
        let content = '';
        if (isAuthenticated) {
             content = `
                 <div class="auth-status" style="display: flex; align-items: center; gap: 10px;">
                     <span id="auth-status-display" title="Logged in as ${username}">
                         👤 ${username}
                     </span>
                     <button id="logout-btn" class="btn btn-secondary btn-sm hide-on-small" ${isLoading ? 'disabled' : ''}>${isLoading ? 'Working...' : 'Logout'}</button>
                 </div>
             `;
        } else {
             content = `
                 <form id="login-form" class="login-form hide-on-small" style="display: flex; flex-wrap: nowrap; gap: 5px;" method="POST">
                     <input type="text" id="username" name="username" placeholder="Username" required autocomplete="username" style="padding: 4px;" ${isLoading ? 'disabled' : ''}>
                     <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password" style="padding: 4px;" ${isLoading ? 'disabled' : ''}>
                     <button type="submit" id="login-btn" class="btn btn-primary btn-sm" ${isLoading ? 'disabled' : ''}>${isLoading ? 'Working...' : 'Login'}</button>
                     ${error ? `<span class="auth-error" style="color: red; font-size: 0.8em; margin-left: 5px;" title="${error}">Login Failed!</span>` : ''}
                 </form>
             `;
        }
        
        element.innerHTML = content;
        // Add mobile profile button logic if needed
        // element.innerHTML += `<button id="profile-btn" class="show-on-small" style="display: none;" title="User Profile/Login">👤</button>`;

        // --- Re-attach Event Listeners AFTER innerHTML overwrite ---
        if (isAuthenticated) {
            const logoutBtn = element.querySelector('#logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', onLogoutClick);
            }
        } else {
            const loginForm = element.querySelector('#login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', onLoginSubmit);
                // If there was an error, focus the username field after rendering
                if (error) {
                     const usernameInput = element.querySelector('#username');
                     usernameInput?.focus();
                }
            }
        }
        // Add listener for mobile profile button if implemented
    };

    // --- Lifecycle Methods --- 
    const mount = () => {
        logAuth('[AuthDisplay] Mounting...');
        element = document.getElementById(targetElementId);
        if (!element) {
            console.error(`[AuthDisplay] Target element #${targetElementId} not found.`);
            logAuth(`[AuthDisplay] Target element #${targetElementId} not found.`, 'error'); // Log using helper
            return false; // Indicate failure
        }

        // Subscribe to central state changes, specifically watching the auth slice
        authUnsubscribe = appStore.subscribe((newState, prevState) => {
            if (newState.auth !== prevState.auth) {
                // <<< ADD LOGGING HERE >>>
                logAuth(`[AuthDisplay subscribe] Auth changed!`);
                logAuth(`  prevState.auth: ${JSON.stringify(prevState.auth)}`);
                logAuth(`  newState.auth: ${JSON.stringify(newState.auth)}`);
                render(newState.auth);
            }
        });

        // Initial render based on current auth state
        render(appStore.getState().auth); // Pass the initial auth slice

        logAuth('[AuthDisplay] Mounted and subscribed to appStore.auth.');
        return true; // Indicate success
    };

    const update = (newState) => {
        // Subscription handles updates based on appState changes.
        // This method is likely no longer needed for external calls.
        logAuth('[AuthDisplay] Update called (likely redundant).');
    };

    const destroy = () => {
        logAuth('[AuthDisplay] Destroying...');
        // Clean up: unsubscribe, remove specific listeners if needed
        if (authUnsubscribe) {
            authUnsubscribe();
            authUnsubscribe = null;
        }
        if (element) {
            // Remove listeners manually just in case
            const loginForm = element.querySelector('#login-form');
            if (loginForm) loginForm.removeEventListener('submit', onLoginSubmit);
            const logoutBtn = element.querySelector('#logout-btn');
            if (logoutBtn) logoutBtn.removeEventListener('click', onLogoutClick);

            element.innerHTML = ''; // Clear content
        }
        element = null;
        logAuth('[AuthDisplay] Destroyed.');
    };

    return { mount, update, destroy };
} 