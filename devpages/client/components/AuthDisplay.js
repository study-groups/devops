/**
 * AuthDisplay.js - A vanilla JavaScript component for handling user authentication UI.
 *
 * This component renders a login form or a user display with a dropdown menu.
 * It connects to the Redux store using a custom `connect` utility to react to state
 * changes and dispatch actions (thunks). This approach mimics the behavior of
 * `react-redux` in a pure vanilla JS environment.
 */
import { appStore, dispatch } from '/client/appState.js';
import { authThunks } from '/client/store/slices/authSlice.js';
import { uiActions } from '/client/store/uiSlice.js';
import { showFatalError } from '/client/utils/uiError.js';
import { connect } from '/client/store/connect.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('AuthDisplay');

/**
 * The factory function for the authentication display component.
 * It manages its own internal state (e.g., dropdown visibility) and renders
 * the UI based on props passed from the `connect` utility.
 * @param {string} targetElementId - The ID of the DOM element to mount into.
 * @returns {object} A component instance with `mount`, `destroy`, and `update` methods.
 */
function AuthDisplayComponent(targetElementId) {
    let element = null;
    let props = {};

    // --- Event Handlers ---
    const onLoginSubmit = async (event) => {
        event.preventDefault();
        log.info('AUTH', 'LOGIN_SUBMITTED', '[AuthDisplay] Login submitted');

        const usernameInput = element?.querySelector('#username');
        const passwordInput = element?.querySelector('#password');
        const username = usernameInput?.value?.trim();
        const password = passwordInput?.value;

        if (!username || !password) {
            alert("Please enter username and password.");
            return;
        }

        try {
            if (passwordInput) passwordInput.value = '';
            log.info('AUTH', 'LOGIN_ATTEMPT', `[AuthDisplay] Calling authThunks.loginWithCredentials for user: ${username}`);
            await props.login({ username, password });
            render();
        } catch (error) {
            log.error('AUTH', 'LOGIN_ERROR', `[AuthDisplay] Error during login: ${error.message}`, error);
            showFatalError(error, 'Login Process');
        }
    };

    const onLogoutClick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        log.info('AUTH', 'LOGOUT_CLICKED', '[AuthDisplay] Logout clicked');
        try {
            // Hide dropdown first to prevent UI issues
            hideDropdown();
            
            // Perform logout
            await props.logout();
            
            // Don't call render() here - let the store subscription handle it
            // This prevents race conditions during logout
            log.info('AUTH', 'LOGOUT_SUCCESS', '[AuthDisplay] Logout completed successfully');
        } catch (error) {
            log.error('AUTH', 'LOGOUT_ERROR', `[AuthDisplay] Logout error: ${error.message}`, error);
            alert(`Logout failed: ${error.message}`);
            // Only render on error to show the error state
            render();
        }
    };

    const onUserDropdownClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        log.info('AUTH', 'USER_DROPDOWN_CLICKED', '[AuthDisplay] User dropdown clicked');
        props.toggleAuthDropdown();
    };

    /**
     * Toggles the visibility of the user dropdown menu.
     */
    const toggleDropdown = () => {
        props.toggleAuthDropdown();
    };

    /**
     * Hides the user dropdown menu if it is currently visible.
     */
    const hideDropdown = () => {
        if (props.ui.isAuthDropdownVisible) {
            props.toggleAuthDropdown();
        }
    };

    // --- Rendering Logic ---

    /**
     * Renders the main component UI based on the current authentication state.
     */
    const render = () => {
        if (!element) return;

        const { auth } = props;
        if (!auth) return;

        // Removed verbose render logging - now only logs when auth state actually changes

        if (!auth.authChecked || auth.isLoading) {
            element.innerHTML = `<div class="auth-status"><div>Checking authentication...</div></div>`;
            return;
        }

        if (auth.isAuthenticated && auth.user) {
            const username = auth.user.username;
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
            element.querySelector('.user-button').addEventListener('click', onUserDropdownClick);
            renderDropdown();
        } else {
            element.innerHTML = `
                <form id="login-form" class="login-form" style="display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 5px; white-space: nowrap;" method="POST">
                    <input type="text" id="username" name="username" placeholder="Username" required autocomplete="username" style="padding: 4px; flex-shrink: 0; min-width: 0;">
                    <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password" style="padding: 4px; flex-shrink: 0; min-width: 0;">
                    <button type="submit" id="login-btn" class="btn btn-primary btn-sm" style="flex-shrink: 0;">Login</button>
                </form>
            `;
            element.querySelector('#login-form').addEventListener('submit', onLoginSubmit);
        }
    };

    /**
     * Renders the dropdown menu and its backdrop.
     * Manages its own event listeners for closing.
     */
    const renderDropdown = () => {
        if (!element) return;

        const existingDropdown = document.querySelector('.user-dropdown');
        if (existingDropdown) existingDropdown.remove();
        const existingBackdrop = document.querySelector('.user-dropdown-backdrop');
        if (existingBackdrop) existingBackdrop.remove();

        if (!props.ui.isAuthDropdownVisible) return;

        const { auth } = props;
        if (!auth || !auth.isAuthenticated || !auth.user) return;

        const backdropHtml = `<div class="user-dropdown-backdrop"></div>`;
        const dropdownHtml = `
            <div class="user-dropdown">
                <div class="user-dropdown-header">
                    <div class="user-info">
                        <div class="user-display-name">${auth.user.username}</div>
                        <div class="user-org">${auth.user.org || 'No Organization'}</div>
                    </div>
                </div>
                <div class="user-dropdown-section">
                    <button class="btn btn-secondary logout-button">Logout</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', backdropHtml);
        document.body.insertAdjacentHTML('beforeend', dropdownHtml);

        const backdrop = document.querySelector('.user-dropdown-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', hideDropdown);
        }

        const userButton = element.querySelector('.user-button');
        const dropdown = document.querySelector('.user-dropdown');
        if (userButton && dropdown) {
            const buttonRect = userButton.getBoundingClientRect();
            dropdown.style.top = `${buttonRect.bottom + 4}px`;
            dropdown.style.right = `${window.innerWidth - buttonRect.right}px`;
        }

        dropdown.querySelector('.logout-button').addEventListener('click', onLogoutClick);
    };

    const mount = () => {
        log.info('AUTH', 'MOUNTING', '[AuthDisplay] Mounting...');
        element = document.getElementById(targetElementId);
        if (!element) {
            log.error('AUTH', 'MOUNT_ERROR', `[AuthDisplay] Target element #${targetElementId} not found.`);
            return false;
        }
        render();
        log.info('AUTH', 'MOUNTED', '[AuthDisplay] Mounted.');
        return true;
    };

    const destroy = () => {
        log.info('AUTH', 'DESTROYING', '[AuthDisplay] Destroying...');
        hideDropdown();
        if (element) {
            element.innerHTML = '';
        }
        element = null;
        log.info('AUTH', 'DESTROYED', '[AuthDisplay] Destroyed.');
    };

    const update = (newProps) => {
        const oldProps = props;
        props = { ...props, ...newProps };
        
        // Only log when auth state actually changes, not on every render
        const authChanged = oldProps.auth?.isAuthenticated !== props.auth?.isAuthenticated ||
                           oldProps.auth?.user?.id !== props.auth?.user?.id ||
                           oldProps.auth?.authChecked !== props.auth?.authChecked;
        
        if (authChanged) {
            log.info('AUTH', 'STATE_CHANGED', `[AuthDisplay] Auth state changed: isAuthenticated=${props.auth?.isAuthenticated}, user=${JSON.stringify(props.auth?.user)}, authChecked=${props.auth?.authChecked}`);
        }
        
        render();
    };

    return {
        mount,
        destroy,
        update
    };
}

const mapStateToProps = state => ({
    auth: state.auth,
    ui: state.ui,
});

const mapDispatchToProps = dispatch => ({
    login: (credentials) => dispatch(authThunks.loginWithCredentials(credentials)),
    logout: () => dispatch(authThunks.logoutAsync()),
    toggleAuthDropdown: () => dispatch(uiActions.toggleAuthDropdown()),
});

const ConnectedAuthDisplay = connect(mapStateToProps, mapDispatchToProps)(AuthDisplayComponent);

export function initializeAuthDisplay(containerId) {
    const component = ConnectedAuthDisplay(containerId);
    if (component) {
        component.mount();
    }
    return component;
} 