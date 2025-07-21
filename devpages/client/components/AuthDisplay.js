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
import { showFatalError } from '/client/utils/uiError.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('AuthDisplay');

/**
 * A simplified "connect" utility for vanilla JS components.
 * It subscribes a component to the Redux store and injects state and dispatch
 * functions as props.
 * @param {Function} mapStateToProps - Maps store state to component props.
 * @param {Function} mapDispatchToProps - Maps dispatch to component props.
 * @returns {Function} A function that takes a component factory and returns
 * a "connected" component factory.
 */
function connect(mapStateToProps, mapDispatchToProps) {
    return function (Component) {
        return function (targetElementId, props) {
            const component = Component(targetElementId, props);

            const handleChange = () => {
                const state = appStore.getState();
                const mappedState = mapStateToProps(state);
                component.update(mappedState);
            };

            const mappedDispatch = mapDispatchToProps(appStore.dispatch);
            component.update(mappedDispatch);

            const unsubscribe = appStore.subscribe(handleChange);
            handleChange(); // Initial render

            const originalDestroy = component.destroy;
            component.destroy = () => {
                unsubscribe();
                originalDestroy();
            };

            return component;
        };
    };
}

/**
 * The factory function for the authentication display component.
 * It manages its own internal state (e.g., dropdown visibility) and renders
 * the UI based on props passed from the `connect` utility.
 * @param {string} targetElementId - The ID of the DOM element to mount into.
 * @returns {object} A component instance with `mount`, `destroy`, and `update` methods.
 */
function AuthDisplayComponent(targetElementId) {
    let element = null;
    let dropdownVisible = false;
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
            log.info('AUTH', 'LOGIN_ATTEMPT', `[AuthDisplay] Calling authThunks.login for user: ${username}`);
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
            await props.logout();
            hideDropdown();
            render();
        } catch (error) {
            log.error('AUTH', 'LOGOUT_ERROR', `[AuthDisplay] Logout error: ${error.message}`, error);
            alert(`Logout failed: ${error.message}`);
        }
    };

    const onUserDropdownClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        log.info('AUTH', 'USER_DROPDOWN_CLICKED', '[AuthDisplay] User dropdown clicked');
        toggleDropdown();
    };

    /**
     * Toggles the visibility of the user dropdown menu.
     */
    const toggleDropdown = () => {
        dropdownVisible = !dropdownVisible;
        renderDropdown();
    };

    /**
     * Hides the user dropdown menu if it is currently visible.
     */
    const hideDropdown = () => {
        if (dropdownVisible) {
            dropdownVisible = false;
            renderDropdown();
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

        log.info('AUTH', 'RENDER_CALLED', `[AuthDisplay] Render called. Auth state: isAuthenticated=${auth.isAuthenticated}, user=${JSON.stringify(auth.user)}, isInitializing=${auth.isInitializing}`);

        if (auth.isInitializing) {
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
                <form id="login-form" class="login-form hide-on-small" style="display: flex; flex-wrap: nowrap; gap: 5px;" method="POST">
                    <input type="text" id="username" name="username" placeholder="Username" required autocomplete="username" style="padding: 4px;">
                    <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password" style="padding: 4px;">
                    <button type="submit" id="login-btn" class="btn btn-primary btn-sm">Login</button>
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

        if (!dropdownVisible) return;

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
        props = { ...props, ...newProps };
        render();
    };

    return {
        mount,
        destroy,
        update
    };
}

const mapStateToProps = state => ({
    auth: state.auth
});

const mapDispatchToProps = dispatch => ({
    login: (credentials) => dispatch(authThunks.login(credentials)),
    logout: () => dispatch(authThunks.logoutAsync())
});

const ConnectedAuthDisplay = connect(mapStateToProps, mapDispatchToProps)(AuthDisplayComponent);

export function initializeAuthDisplay() {
    ConnectedAuthDisplay('auth-component-container');
} 