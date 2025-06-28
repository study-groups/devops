/**
 * AuthDisplay.js - Component to manage login form and user dropdown with theme picker.
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
// ADDED: Import dispatch and ActionTypes for theme functionality
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

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
    let dropdownVisible = false;
    
    // Theme state
    let availableThemes = [];
    let themeSettings = {
        colorScheme: 'system',
        themeVariant: 'light',
        spacingDensity: 'normal',
        currentTheme: null
    };

    // Load component CSS
    const loadComponentStyles = () => {
        const cssPath = '/client/components/auth-display.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
            logAuth('AuthDisplay CSS loaded.', 'info');
        }
    };

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
            // Hide dropdown after logout
            hideDropdown();
        } catch (error) {
             // Catch errors from the logout API call itself
            logAuth(`[AuthDisplay] Error during logout call: ${error.message}`, 'error');
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
            // Add click outside listener
            document.addEventListener('click', onClickOutside);
            // Load theme data when dropdown opens
            loadThemeData();
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
        
        // Close if clicking on backdrop or outside dropdown/button
        if ((backdrop && event.target === backdrop) ||
            (dropdown && userButton && 
             !dropdown.contains(event.target) && 
             !userButton.contains(event.target))) {
            hideDropdown();
        }
    };

    // --- Theme Management Functions ---
    const loadThemeData = async () => {
        try {
            // Load current settings from store
            const state = appStore.getState();
            const designTokens = state.settings?.designTokens || {};
            
            const newThemeSettings = {
                colorScheme: state.ui?.colorScheme || 'system',
                themeVariant: designTokens.themeVariant || 'light',
                spacingDensity: designTokens.spacingVariant || 'normal',
                currentTheme: designTokens.activeTheme || 'system'
            };

            // Only update if settings actually changed
            const settingsChanged = JSON.stringify(themeSettings) !== JSON.stringify(newThemeSettings);
            if (settingsChanged) {
                themeSettings = newThemeSettings;
            }

            // Load available themes only if not already loaded
            if (availableThemes.length === 0) {
                await loadAvailableThemes();
            }
            
            // Re-render dropdown with theme data only if settings changed or dropdown just opened
            if (dropdownVisible && (settingsChanged || availableThemes.length === 0)) {
                renderDropdown();
            }
        } catch (error) {
            logAuth(`[AuthDisplay] Error loading theme data: ${error.message}`, 'error');
        }
    };

    const loadAvailableThemes = async () => {
        try {
            // Start with system themes
            availableThemes = [{
                id: 'system',
                name: 'System',
                path: 'client/styles',
                type: 'system',
                files: ['core.css', 'light.css', 'dark.css']
            }];

            // Check if user themes directory exists
            const response = await fetch(`/api/files/list?pathname=themes`);
            
            if (response.ok) {
                const data = await response.json();
                
                // Add user themes to the available themes list
                if (data.dirs) {
                    for (const dirName of data.dirs) {
                        const themeInfo = await validateThemeDirectory(dirName);
                        if (themeInfo) {
                            themeInfo.type = 'user';
                            availableThemes.push(themeInfo);
                        }
                    }
                }
            }
        } catch (error) {
            logAuth(`[AuthDisplay] Error loading available themes: ${error.message}`, 'error');
        }
    };

    const validateThemeDirectory = async (themeName) => {
        try {
            const response = await fetch(`/api/files/list?pathname=themes/${themeName}`);
            if (!response.ok) return null;
            
            const data = await response.json();
            const fileNames = data.files || [];
            
            if (fileNames.includes('core.css')) {
                return {
                    id: themeName,
                    name: formatThemeName(themeName),
                    path: `themes/${themeName}`,
                    type: 'theme',
                    files: fileNames.filter(f => f.endsWith('.css'))
                };
            }
            
            return null;
        } catch (error) {
            logAuth(`[AuthDisplay] Error validating theme ${themeName}: ${error.message}`, 'error');
            return null;
        }
    };

    const formatThemeName = (themeName) => {
        return themeName
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    const onThemeSelect = (themeId) => {
        if (themeSettings.currentTheme === themeId) return; // No change needed
        
        logAuth(`[AuthDisplay] Theme selected: ${themeId}`);
        const theme = availableThemes.find(t => t.id === themeId);
        if (theme) {
            applyTheme(theme);
        }
    };

    const onColorSchemeSelect = (colorScheme) => {
        if (themeSettings.colorScheme === colorScheme) return; // No change needed
        
        logAuth(`[AuthDisplay] Color scheme selected: ${colorScheme}`);
        
        dispatch({
            type: ActionTypes.UI_SET_COLOR_SCHEME,
            payload: colorScheme
        });
        
        document.documentElement.setAttribute('data-color-scheme', colorScheme);
        
        if (colorScheme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            updateThemeVariant(prefersDark ? 'dark' : 'light');
        } else {
            updateThemeVariant(colorScheme);
        }
        
        themeSettings.colorScheme = colorScheme;
        updateDropdownButtons();
    };

    const onSpacingSelect = (spacing) => {
        if (themeSettings.spacingDensity === spacing) return; // No change needed
        
        logAuth(`[AuthDisplay] Spacing selected: ${spacing}`);
        
        const densityMapping = {
            'tight': 'compact',
            'normal': 'normal',
            'comfortable': 'spacious'
        };

        document.documentElement.setAttribute('data-density', densityMapping[spacing] || 'normal');
        
        dispatch({
            type: ActionTypes.SETTINGS_SET_SPACING_VARIANT,
            payload: spacing
        });
        
        themeSettings.spacingDensity = spacing;
        updateDropdownButtons();
    };

    // Efficiently update button states without full re-render
    const updateDropdownButtons = () => {
        if (!dropdownVisible) return;
        
        const dropdown = document.querySelector('.user-dropdown');
        if (!dropdown) return;

        // Update theme buttons
        dropdown.querySelectorAll('.theme-option').forEach(btn => {
            const themeId = btn.getAttribute('data-theme-id');
            const isActive = themeSettings.currentTheme === themeId;
            btn.classList.toggle('active', isActive);
            btn.textContent = btn.textContent.replace(' ✓', '') + (isActive ? ' ✓' : '');
        });

        // Update color scheme buttons
        dropdown.querySelectorAll('.color-scheme-option').forEach(btn => {
            const scheme = btn.getAttribute('data-color-scheme');
            const isActive = themeSettings.colorScheme === scheme;
            btn.classList.toggle('active', isActive);
            btn.textContent = btn.textContent.replace(' ✓', '') + (isActive ? ' ✓' : '');
        });

        // Update spacing buttons
        dropdown.querySelectorAll('.spacing-option').forEach(btn => {
            const spacing = btn.getAttribute('data-spacing');
            const isActive = themeSettings.spacingDensity === spacing;
            btn.classList.toggle('active', isActive);
            btn.textContent = btn.textContent.replace(' ✓', '') + (isActive ? ' ✓' : '');
        });
    };

    const applyTheme = async (theme) => {
        themeSettings.currentTheme = theme.id;
        
        dispatch({
            type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME,
            payload: theme.id
        });
        
        if (theme.type === 'system') {
            // System theme - remove user theme stylesheets
            const userThemeLinks = document.querySelectorAll('style[data-theme]');
            userThemeLinks.forEach(link => link.remove());
        } else {
            // User theme - load additional CSS files
            const coreFile = 'core.css';
            const variantFile = themeSettings.themeVariant === 'dark' ? 'dark.css' : 'light.css';
            
            await loadThemeStylesheet(`${theme.path}/${coreFile}`, 'user-core', theme.type);
            await loadThemeStylesheet(`${theme.path}/${variantFile}`, 'user-variant', theme.type);
        }
        
        updateDropdownButtons();
    };

    const updateThemeVariant = (variant) => {
        document.documentElement.setAttribute('data-theme', variant);
        themeSettings.themeVariant = variant;
        
        const currentThemeLink = document.querySelector('link[data-theme="light"], link[data-theme="dark"]');
        if (currentThemeLink) {
            currentThemeLink.href = `/client/styles/${variant}.css`;
            currentThemeLink.setAttribute('data-theme', variant);
        }
        
        dispatch({
            type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT,
            payload: variant
        });
        
        // Re-apply current theme to load the correct variant stylesheet
        const currentTheme = availableThemes.find(t => t.id === themeSettings.currentTheme);
        if (currentTheme && currentTheme.type === 'user') {
            applyTheme(currentTheme);
        }
    };

    const loadThemeStylesheet = async (relativePath, dataTheme, themeType) => {
        try {
            const existingElements = document.querySelectorAll(`link[data-theme="${dataTheme}"], style[data-theme="${dataTheme}"]`);
            existingElements.forEach(el => el.remove());

            if (themeType === 'user') {
                const apiUrl = `/api/files/content?pathname=${encodeURIComponent(relativePath)}`;
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    throw new Error(`API fetch failed for ${relativePath} (status: ${response.status})`);
                }
                
                const cssText = await response.text();
                const styleElement = document.createElement('style');
                styleElement.setAttribute('data-theme', dataTheme);
                styleElement.textContent = cssText;
                document.head.appendChild(styleElement);
            } else {
                const linkElement = document.createElement('link');
                linkElement.rel = 'stylesheet';
                linkElement.type = 'text/css';
                linkElement.href = `/${relativePath}`;
                linkElement.setAttribute('data-theme', dataTheme);
                
                linkElement.onerror = () => {
                    logAuth(`[AuthDisplay] Error loading theme stylesheet: ${linkElement.href}`, 'error');
                    linkElement.remove();
                };

                document.head.appendChild(linkElement);
            }

            return true;
        } catch (error) {
            logAuth(`[AuthDisplay] Failed to load theme stylesheet ${relativePath}: ${error.message}`, 'error');
            return false;
        }
    };

    // --- Rendering Logic --- 
    const render = () => {
        if (!element) {
            logAuth('Render skipped: element is null', 'warn');
            return;
        }

        const authState = appStore.getState().auth;
        const settingsState = appStore.getState().settings;
        const selectedOrg = settingsState?.selectedOrg || localStorage.getItem('devpages_selected_org') || 'pixeljam-arcade';
        
        if (authState.isInitializing) {
            element.innerHTML = '<div class="auth-status">Checking authentication...</div>';
            return;
        }

        if (authState.isAuthenticated && authState.user) {
            const username = authState.user.username;
            
            element.innerHTML = `
                <div class="auth-status authenticated">
                    <button class="user-button" title="User Menu">
                        <span class="user-icon">👤</span>
                        <span class="username">${username}</span>
                        <span class="dropdown-arrow">▼</span>
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
            element.innerHTML = `
                <form id="login-form" class="login-form hide-on-small" style="display: flex; flex-wrap: nowrap; gap: 5px;" method="POST">
                    <input type="text" id="username" name="username" placeholder="Username" required autocomplete="username" style="padding: 4px;">
                    <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password" style="padding: 4px;">
                    <button type="submit" id="login-btn" class="btn btn-primary btn-sm">Login</button>
                </form>
            `;
            
            // Add form submit listener
            const loginForm = element.querySelector('#login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', onLoginSubmit);
            }
        }
    };

    const renderDropdown = () => {
        if (!element) return;
        
        // Remove existing dropdown and backdrop
        const existingDropdown = document.querySelector('.user-dropdown');
        const existingBackdrop = document.querySelector('.user-dropdown-backdrop');
        if (existingDropdown) {
            existingDropdown.remove();
        }
        if (existingBackdrop) {
            existingBackdrop.remove();
        }
        
        if (!dropdownVisible) return;
        
        const authState = appStore.getState().auth;
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
                    <div class="section-title">Theme</div>
                    <div class="theme-options">
                        ${availableThemes.map(theme => `
                            <button class="theme-option ${themeSettings.currentTheme === theme.id ? 'active' : ''}" 
                                    data-theme-id="${theme.id}">
                                ${theme.name}${themeSettings.currentTheme === theme.id ? ' ✓' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div class="user-dropdown-section">
                    <div class="section-title">Color Scheme</div>
                    <div class="color-scheme-options">
                        ${['system', 'light', 'dark'].map(scheme => `
                            <button class="color-scheme-option ${themeSettings.colorScheme === scheme ? 'active' : ''}" 
                                    data-color-scheme="${scheme}">
                                ${scheme.charAt(0).toUpperCase() + scheme.slice(1)}${themeSettings.colorScheme === scheme ? ' ✓' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div class="user-dropdown-section">
                    <div class="section-title">Spacing</div>
                    <div class="spacing-options">
                        ${['tight', 'normal', 'comfortable'].map(spacing => `
                            <button class="spacing-option ${themeSettings.spacingDensity === spacing ? 'active' : ''}" 
                                    data-spacing="${spacing}">
                                ${spacing.charAt(0).toUpperCase() + spacing.slice(1)}${themeSettings.spacingDensity === spacing ? ' ✓' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div class="user-dropdown-section">
                    <button class="logout-button">Logout</button>
                </div>
            </div>
        `;
        
        // Add backdrop to body first
        document.body.insertAdjacentHTML('beforeend', backdropHtml);
        
        // Add dropdown to body (not element to avoid layout issues)
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
            // Theme selection
            dropdown.querySelectorAll('.theme-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const themeId = e.target.getAttribute('data-theme-id');
                    onThemeSelect(themeId);
                });
            });
            
            // Color scheme selection
            dropdown.querySelectorAll('.color-scheme-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const colorScheme = e.target.getAttribute('data-color-scheme');
                    onColorSchemeSelect(colorScheme);
                });
            });
            
            // Spacing selection
            dropdown.querySelectorAll('.spacing-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const spacing = e.target.getAttribute('data-spacing');
                    onSpacingSelect(spacing);
                });
            });
            
            // Logout button
            const logoutButton = dropdown.querySelector('.logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', onLogoutClick);
            }
        }
    };

    // --- Lifecycle Methods --- 
    const mount = () => {
        logAuth('[AuthDisplay] Mounting...');
        
        // Load CSS first
        loadComponentStyles();
        
        element = document.getElementById(targetElementId);
        if (!element) {
            console.error(`[AuthDisplay] Target element #${targetElementId} not found.`);
            logAuth(`[AuthDisplay] Target element #${targetElementId} not found.`, 'error');
            return false;
        }

        // Subscribe to central state changes, specifically watching the auth slice
        authUnsubscribe = appStore.subscribe((newState, prevState) => {
            if (newState.auth !== prevState.auth) {
                logAuth(`[AuthDisplay subscribe] Auth changed!`);
                logAuth(`  prevState.auth: ${JSON.stringify(prevState.auth)}`);
                logAuth(`  newState.auth: ${JSON.stringify(newState.auth)}`);
                render();
            }
        });

        // Initial render based on current auth state
        render();

        logAuth('[AuthDisplay] Mounted and subscribed to appStore.auth.');
        return true;
    };

    const update = (newState) => {
        logAuth('[AuthDisplay] Update called (likely redundant).');
    };

    const destroy = () => {
        logAuth('[AuthDisplay] Destroying...');
        
        // Hide dropdown and remove listeners
        hideDropdown();
        
        // Clean up: unsubscribe, remove specific listeners if needed
        if (authUnsubscribe) {
            authUnsubscribe();
            authUnsubscribe = null;
        }
        if (element) {
            // Remove listeners manually just in case
            const loginForm = element.querySelector('#login-form');
            if (loginForm) loginForm.removeEventListener('submit', onLoginSubmit);
            
            const userButton = element.querySelector('.user-button');
            if (userButton) userButton.removeEventListener('click', onUserDropdownClick);

            element.innerHTML = ''; // Clear content
        }
        element = null;
        logAuth('[AuthDisplay] Destroyed.');
    };

    return { mount, update, destroy };
} 