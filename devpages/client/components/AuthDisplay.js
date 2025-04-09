/**
 * AuthDisplay.js - Component to manage login form and user status display.
 */
import { authState } from '/client/authState.js';
import { eventBus } from '/client/eventBus.js';
import { logMessage } from '/client/log/index.js'; // Assuming logMessage is globally available or adjust path

// Assuming auth.js exports handleLogin and logout directly now
// NOTE: We need to ensure handleLogin and logout ARE exported from auth.js
import { handleLogin, logout } from '/client/auth.js'; 

export function createAuthDisplayComponent(targetElementId) {
    let element = null;
    let authUnsubscribe = null;

    // --- Private Event Handlers (bound to component instance) ---
    const onLoginSubmit = async (event) => {
        event.preventDefault();
        logMessage("[AuthDisplay] Login submitted");
        const usernameInput = element?.querySelector('#username');
        const passwordInput = element?.querySelector('#password');
        const username = usernameInput?.value;
        const password = passwordInput?.value;

        if (username && password) {
            try {
                // Call imported function
                const success = await handleLogin(username, password);
                if (!success) {
                    // Maybe show error near the form?
                    alert("Login failed. Please check credentials or console.");
                } else {
                   // Clear password field on successful login
                   if (passwordInput) passwordInput.value = '';
                }
            } catch (error) {
                logMessage(`[AuthDisplay] Login action failed: ${error.message}`, 'error');
                alert(`Login failed: ${error.message}`);
            }
        } else {
            alert("Please enter username and password.");
        }
    };

    const onLogoutClick = async (event) => {
        event.preventDefault();
        logMessage("[AuthDisplay] Logout clicked");
        try {
            await logout();
        } catch (error) {
            logMessage(`[AuthDisplay] Logout action failed: ${error.message}`, 'error');
            alert(`Logout failed: ${error.message}`);
        }
    };

    // --- Rendering Logic --- 
    const render = (state) => {
        if (!element) return;

        const isLoggedIn = state.isAuthenticated;
        const username = state.username;

        // Use template literal for structure
        // Note: Using inline styles for simplicity here, classes are better for real apps
        element.innerHTML = `
            <form id="login-form" class="login-form hide-on-small" style="display: ${isLoggedIn ? 'none' : 'flex'}; flex-wrap: nowrap; gap: 5px;" method="POST">
                <input type="text" id="username" name="username" placeholder="Username" required autocomplete="username" style="padding: 4px;">
                <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password" style="padding: 4px;">
                <button type="submit" id="login-btn" class="btn btn-primary btn-sm">Login</button>
            </form>
            <div class="auth-status" style="display: ${isLoggedIn ? 'flex' : 'none'}; align-items: center; gap: 10px;">
                <span id="auth-status-display" style="display: inline-block;">
                    👤 ${username || 'Logged In'}
                </span>
                <button id="logout-btn" class="btn btn-secondary btn-sm hide-on-small" style="display: inline-block;">Logout</button>
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
        logMessage('[AuthDisplay] Mounting...');
        element = document.getElementById(targetElementId);
        if (!element) {
            console.error(`[AuthDisplay] Target element #${targetElementId} not found.`);
            logMessage(`[AuthDisplay] Target element #${targetElementId} not found.`, 'error'); // Log using helper
            return false; // Indicate failure
        }

        // Initial render based on current auth state
        // Subscribe to state changes, which also triggers initial render via the callback
        // NOTE: The subscription automatically calls the callback (render) with the current state upon subscribing.
        authUnsubscribe = authState.subscribe(render); 
        logMessage('[AuthDisplay] Mounted and subscribed to authState.');
        return true; // Indicate success
    };

    const update = (newState) => {
        // In this simple case, the subscription handles updates.
        // This method is kept for API consistency but might not be used directly.
        logMessage('[AuthDisplay] Update called (likely redundant due to subscription).');
        // render(newState); // Could force render if needed
    };

    const destroy = () => {
        logMessage('[AuthDisplay] Destroying...');
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
        logMessage('[AuthDisplay] Destroyed.');
    };

    return { mount, update, destroy };
} 