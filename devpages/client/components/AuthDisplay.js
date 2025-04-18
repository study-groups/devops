/**
 * AuthDisplay.js - Component to manage login form and user status display.
 */
import { appState } from '/client/appState.js'; // IMPORT central state
import { eventBus } from '/client/eventBus.js';
import { logMessage } from '/client/log/index.js'; // Assuming logMessage is globally available or adjust path

// Remove handleLogin import, keep logout
import { logout } from '/client/auth.js'; 

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
                // Emit event instead of calling handleLogin
                logAuth(`[AuthDisplay] Emitting auth:loginRequested for user: ${username}`);
                eventBus.emit('auth:loginRequested', { username, password });

                // Clear password field immediately (optimistic)
                if (passwordInput) passwordInput.value = '';
                
                // Remove direct call and subsequent logic based on its return value
                /*
                const success = await handleLogin(username, password);
                if (!success) {
                    // Error should be reflected in appState.auth.error, but we can still alert
                    const errorMsg = appState.getState().auth.error || "Login failed. Please check credentials or console.";
                    alert(errorMsg);
                } else {
                    // Clear password field on successful login
                    if (passwordInput) passwordInput.value = '';
                }
                */
            } catch (error) {
                // This catch block might be less relevant now as the event emitter doesn't throw
                // But keep it in case eventBus.emit itself could error?
                logAuth(`[AuthDisplay] Error emitting login event: ${error.message}`, 'error');
                alert(`An error occurred trying to log in: ${error.message}`);
            }
        } else {
            alert("Please enter username and password.");
        }
    };

    const onLogoutClick = async (event) => {
        event.preventDefault();
        logAuth("[AuthDisplay] Logout clicked");
        try {
            await logout();
        } catch (error) {
            logAuth(`[AuthDisplay] Logout action failed: ${error.message}`, 'error');
            alert(`Logout failed: ${error.message}`);
        }
    };

    // --- Rendering Logic --- 
    // Accepts the `auth` slice of the central state
    const render = (authStateSlice) => {
        if (!element) return;

        // Use properties from the central auth state
        const isLoggedIn = authStateSlice.isLoggedIn;
        const username = authStateSlice.user?.username; // Access nested username
        const isLoading = authStateSlice.isLoading; // Check if auth action is in progress
        const authChecked = authStateSlice.authChecked; // Check if initial load is done

        // Don't render anything until the initial auth check is complete
        if (!authChecked) {
            element.innerHTML = '<span>Loading...</span>'; // Or some placeholder
            return;
        }

        // Use template literal for structure
        element.innerHTML = `
            <form id="login-form" class="login-form hide-on-small" style="display: ${isLoggedIn || isLoading ? 'none' : 'flex'}; flex-wrap: nowrap; gap: 5px;" method="POST">
                <input type="text" id="username" name="username" placeholder="Username" required autocomplete="username" style="padding: 4px;" ${isLoading ? 'disabled' : ''}>
                <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password" style="padding: 4px;" ${isLoading ? 'disabled' : ''}>
                <button type="submit" id="login-btn" class="btn btn-primary btn-sm" ${isLoading ? 'disabled' : ''}>${isLoading ? 'Logging in...' : 'Login'}</button>
            </form>
            <div class="auth-status" style="display: ${isLoggedIn ? 'flex' : 'none'}; align-items: center; gap: 10px;">
                <span id="auth-status-display" style="display: inline-block;">
                    👤 ${username || 'Logged In'}
                </span>
                <button id="logout-btn" class="btn btn-secondary btn-sm hide-on-small" style="display: inline-block;" ${isLoading ? 'disabled' : ''}>${isLoading ? 'Logging out...' : 'Logout'}</button>
            </div>
            <!-- Add mobile profile button logic if needed -->
            <!-- <button id="profile-btn" class="show-on-small" style="display: none;" title="User Profile/Login">👤</button> -->
        `;

        // --- Re-attach Event Listeners AFTER innerHTML overwrite ---
        const loginForm = element.querySelector('#login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', onLoginSubmit);
        }
        const logoutBtn = element.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', onLogoutClick);
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
        authUnsubscribe = appState.subscribe((newState, prevState) => {
            // Only re-render if the auth part of the state has changed
            if (newState.auth !== prevState.auth) {
                logAuth('[AuthDisplay] Auth state changed, re-rendering.');
                 render(newState.auth); // Pass the auth slice
            }
        });

        // Initial render based on current auth state
        render(appState.getState().auth); // Pass the initial auth slice

        logAuth('[AuthDisplay] Mounted and subscribed to appState.auth.');
        return true; // Indicate success
    };

    const update = (newState) => {
        // Subscription handles updates based on appState changes.
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
            // Remove listeners manually if they weren't handled by innerHTML overwrite (though they should be)
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