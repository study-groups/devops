/**
 * AuthDisplay.js - Redux-first authentication display component
 * Handles login form and user dropdown with immediate state updates
 */
import { authThunks } from '../slices/authSlice.js';

function getStore() {
    if (window.APP && window.APP.store) {
        return window.APP.store;
    }
    console.error("Redux store not found on window.APP.store");
    // Return a dummy store to prevent crashes
    return {
        getState: () => ({ auth: { isInitializing: true, isAuthenticated: false, user: null } }),
        dispatch: () => Promise.resolve(),
        subscribe: () => (() => {})
    };
}

function logAuth(message, level = 'info') {
    const type = 'AUTH_DISPLAY';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export function createAuthDisplayComponent(targetElementId) {
    let element = null;
    let authUnsubscribe = null;
    let dropdownVisible = false;

    // --- Event Handlers ---
    const onLoginSubmit = async (event) => {
        event.preventDefault();
        logAuth("[AuthDisplay] Login submitted");
        
        const usernameInput = element?.querySelector('#username');
        const passwordInput = element?.querySelector('#password');
        const username = usernameInput?.value?.trim();
        const password = passwordInput?.value;

        if (!username || !password) {
            alert("Please enter username and password.");
            return;
        }

        // Dispatch the login thunk and let Redux handle the state updates.
        // The component will re-render via its subscription.
        getStore().dispatch(authThunks.login({ username, password }));
    };

    const onLogoutClick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        logAuth("[AuthDisplay] Logout clicked");
        console.log("[AuthDisplay] Logout button clicked - starting logout process");
        
        try {
            logAuth("[AuthDisplay] Dispatching logout thunk...");
            console.log("[AuthDisplay] About to dispatch logout thunk");
            
            const result = await getStore().dispatch(authThunks.logout());
            console.log("[AuthDisplay] Logout thunk completed with result:", result);
            logAuth(`[AuthDisplay] Logout result: ${JSON.stringify(result)}`);
            
            // Check auth state directly after logout
            const authStateAfterLogout = getStore().getState().auth;
            console.log("[AuthDisplay] Auth state after logout:", authStateAfterLogout);
            console.log("[AuthDisplay] isAuthenticated after logout:", authStateAfterLogout.isAuthenticated);
            
            hideDropdown();
            logAuth("[AuthDisplay] Logout successful");
            console.log("[AuthDisplay] Logout process completed successfully");
            
            // Force re-render since subscription might not be working
            console.log("[AuthDisplay] Forcing manual re-render after logout");
            render();
        } catch (error) {
            console.error("[AuthDisplay] Logout error:", error);
            logAuth(`[AuthDisplay] Logout error: ${error.message}`, 'error');
            alert(`Logout failed: ${error.message}`);
        }
    };

    const onUserDropdownClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        logAuth("[AuthDisplay] User dropdown clicked");
        toggleDropdown();
    };

    const toggleDropdown = () => {
        dropdownVisible = !dropdownVisible;
        renderDropdown();
        
        if (dropdownVisible) {
            document.addEventListener('click', onClickOutside);
        } else {
            document.removeEventListener('click', onClickOutside);
        }
    };

    const hideDropdown = () => {
        if (dropdownVisible) {
            dropdownVisible = false;
            renderDropdown();
            document.removeEventListener('click', onClickOutside);
        }
    };

    const onClickOutside = (event) => {
        const dropdown = document.querySelector('.user-dropdown');
        const userButton = element?.querySelector('.user-button');
        const backdrop = document.querySelector('.user-dropdown-backdrop');
        
        if ((backdrop && event.target === backdrop) ||
            (dropdown && userButton && 
             !dropdown.contains(event.target) && 
             !userButton.contains(event.target))) {
            hideDropdown();
        }
    };

    // --- Rendering Logic ---
    const render = () => {
        if (!element) return;
        
        const authState = getStore().getState().auth;
        console.log("[AuthDisplay] Render called. Auth state:", authState);
        logAuth(`[AuthDisplay] Render called. Auth state: isAuthenticated=${authState.isAuthenticated}, user=${JSON.stringify(authState.user)}, isInitializing=${authState.isInitializing}`, 'info');
        
        // Show loading state during initialization
        if (authState.isInitializing) {
            element.innerHTML = `
                <div class="auth-status">
                    <div>Checking authentication...</div>
                </div>
            `;
            return;
        }

        // Show authenticated user
        if (authState.isAuthenticated && authState.user) {
            const username = authState.user.username;
            
            element.innerHTML = `
                <div class="auth-status authenticated">
                    <button class="btn btn-ghost user-button" title="User Menu">
                        <svg class="user-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span class="username">${username}</span>
                        <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                </div>
            `;
            
            // Attach user dropdown handler
            const userButton = element.querySelector('.user-button');
            if (userButton) {
                userButton.addEventListener('click', onUserDropdownClick);
            }
            
            // Render dropdown if visible
            renderDropdown();
        } else {
            // Show login form
            element.innerHTML = `
                <form id="login-form" class="login-form hide-on-small" style="display: flex; flex-wrap: nowrap; gap: 5px;" method="POST">
                    <input type="text" id="username" name="username" placeholder="Username" required autocomplete="username" style="padding: 4px;">
                    <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password" style="padding: 4px;">
                    <button type="submit" id="login-btn" class="btn btn-primary btn-sm">Login</button>
                </form>
                <div class="error-container" style="color: red; margin-top: 5px; display: none;"></div>
            `;
            
            // Add form submit listener
            const loginForm = element.querySelector('#login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', onLoginSubmit);
            }
        }
        
        // Display login error if it exists
        if (authState.error) {
            const errorContainer = element.querySelector('.error-container');
            if (errorContainer) {
                errorContainer.textContent = authState.error;
                errorContainer.style.display = 'block';
            }
        }
    };

    const renderDropdown = () => {
        if (!element) return;
        
        // Remove existing dropdown and backdrop
        const existingDropdown = document.querySelector('.user-dropdown');
        const existingBackdrop = document.querySelector('.user-dropdown-backdrop');
        if (existingDropdown) existingDropdown.remove();
        if (existingBackdrop) existingBackdrop.remove();
        
        if (!dropdownVisible) return;
        
        const authState = getStore().getState().auth;
        if (!authState.isAuthenticated || !authState.user) return;
        
        // Create backdrop and dropdown HTML
        const backdropHtml = `<div class="user-dropdown-backdrop"></div>`;
        const dropdownHtml = `
            <div class="user-dropdown">
                <div class="user-dropdown-header">
                    <div class="user-info">
                        <div class="user-display-name">${authState.user.username}</div>
                        <div class="user-org">${authState.user.org || 'No Organization'}</div>
                    </div>
                </div>
                
                <div class="user-dropdown-section">
                    <button class="btn btn-secondary logout-button">Logout</button>
                </div>
            </div>
        `;
        
        // Add backdrop to body first
        document.body.insertAdjacentHTML('beforeend', backdropHtml);
        
        // Add dropdown to body
        document.body.insertAdjacentHTML('beforeend', dropdownHtml);
        
        // Position dropdown relative to user button
        const userButton = element?.querySelector('.user-button');
        const dropdown = document.querySelector('.user-dropdown');
        if (userButton && dropdown) {
            const buttonRect = userButton.getBoundingClientRect();
            dropdown.style.top = `${buttonRect.bottom + 4}px`;
            dropdown.style.right = `${window.innerWidth - buttonRect.right}px`;
        }
        
        // Attach event listeners to dropdown elements
        if (dropdown) {
            const logoutButton = dropdown.querySelector('.logout-button');
            if (logoutButton) {
                console.log('[AuthDisplay] Found logout button, attaching click handler');
                
                // Add a simple test handler first
                logoutButton.addEventListener('click', (e) => {
                    console.log('[AuthDisplay] Logout button clicked!');
                });
                
                logoutButton.addEventListener('click', onLogoutClick);
                console.log('[AuthDisplay] Logout button click handler attached');
            } else {
                console.error('[AuthDisplay] Logout button not found in dropdown');
            }
        } else {
            console.error('[AuthDisplay] Dropdown element not found');
        }
    };

    // --- Lifecycle Methods ---
    const mount = () => {
        logAuth('[AuthDisplay] Mounting...');
        
        element = document.getElementById(targetElementId);
        if (!element) {
            console.error(`[AuthDisplay] Target element #${targetElementId} not found.`);
            logAuth(`[AuthDisplay] Target element #${targetElementId} not found.`, 'error');
            return false;
        }

        // Subscribe to store changes with detailed logging
        authUnsubscribe = getStore().subscribe(() => {
            const newState = getStore().getState();
            // A simple way to get previous state might not be available with a basic store.
            // For now, we compare against the last known state or just re-render.
            
            console.log('[AuthDisplay] Store subscription fired');
            const newAuth = newState.auth;

            // Simple check: has auth status changed?
            const currentDisplayIsAuthenticated = !!element.querySelector('.authenticated');
            if (newAuth.isAuthenticated !== currentDisplayIsAuthenticated) {
                 logAuth(`[AuthDisplay] Auth state changed, re-rendering...`);
                 render();
            }
        });

        // Initial render
        render();
        
        // Test: Log initial auth state
        const initialAuthState = getStore().getState().auth;
        logAuth(`[AuthDisplay] Initial auth state: isAuthenticated=${initialAuthState.isAuthenticated}, user=${JSON.stringify(initialAuthState.user)}`, 'debug');
        
        // Add a global test function for debugging logout
        window.testLogout = () => {
            console.log('[TEST] Testing logout functionality...');
            getStore().dispatch(authThunks.logout()).then(result => {
                console.log('[TEST] Logout test result:', result);
            }).catch(error => {
                console.error('[TEST] Logout test error:', error);
            });
        };
        
        logAuth('[AuthDisplay] Mounted and subscribed to appStore.');
        return true;
    };

    const destroy = () => {
        logAuth('[AuthDisplay] Destroying...');
        
        hideDropdown();
        
        if (authUnsubscribe) {
            authUnsubscribe();
            authUnsubscribe = null;
        }
        
        if (element) {
            const loginForm = element.querySelector('#login-form');
            if (loginForm) loginForm.removeEventListener('submit', onLoginSubmit);
            
            const userButton = element.querySelector('.user-button');
            if (userButton) userButton.removeEventListener('click', onUserDropdownClick);

            element.innerHTML = '';
        }
        element = null;
        logAuth('[AuthDisplay] Destroyed.');
    };

    return {
        mount,
        destroy
    };
}

/**
 * Initializes and mounts the authentication display component.
 */
export function initializeAuthDisplay() {
    createAuthDisplayComponent('auth-component-container').mount();
} 