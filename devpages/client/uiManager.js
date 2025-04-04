// Import necessary modules
import { logMessage, toggleLog } from "./log/index.js";
import { globalFetch } from './globalFetch.js';
import { updateTopBar } from './components/topBar.js';
// Removed imports for functions/modules no longer used directly here

// UI Manager class to handle all UI-related operations
class UIManager {
    constructor() {
        // UI element references using getters for lazy evaluation
        this.elements = {
            get loginForm() { return document.getElementById('login-form'); },
            get logoutBtn() { return document.getElementById('logout-btn'); },
            get pwdDisplay() { return document.getElementById('pwd-display'); },
            get dirSelect() { return document.getElementById('dir-select'); },
            get fileSelect() { return document.getElementById('file-select'); },
            get logBtn() { return document.getElementById('log-btn'); }
        };

        // Bind methods to preserve 'this' context
        this.handleDirectoryChange = this.handleDirectoryChange.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleLogButtonClick = this.handleLogButtonClick.bind(this);
        this.updateAuthDisplay = this.updateAuthDisplay.bind(this);
        this.updateMobileLayout = this.updateMobileLayout.bind(this); // Bind resize handler
        this.handlePwdDisplayClick = this.handlePwdDisplayClick.bind(this); // Bind mobile logout handler
    }

    /**
     * Initialize the UI manager
     */
    async initialize() {
        console.log('[UI] Initializing UI Manager');
        updateTopBar(); // Initialize top bar first
        this.setupEventListeners();
        await this.updateAuthDisplay(); // Update display based on initial auth state
        this.initializeSimpleMobileUI(); // Handle mobile specifics like password visibility
        this.updateMobileLayout(); // Adjust layout for mobile if needed
        window.addEventListener('resize', this.updateMobileLayout); // Handle resize
        console.log('[UI] UI Manager initialized successfully');
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Logout button handler
        if (this.elements.logoutBtn) {
            this.elements.logoutBtn.removeEventListener('click', this.handleLogout);
            this.elements.logoutBtn.addEventListener('click', this.handleLogout);
            console.log('[UI] Logout button handler set up');
        }

        // Login form handler
        if (this.elements.loginForm) {
            this.elements.loginForm.removeEventListener('submit', this.handleLogin);
            this.elements.loginForm.addEventListener('submit', this.handleLogin);
            console.log('[UI] Login form handler set up');
        }

        // Directory selection handler
        if (this.elements.dirSelect) {
            this.elements.dirSelect.removeEventListener('change', this.handleDirectoryChange);
            this.elements.dirSelect.addEventListener('change', this.handleDirectoryChange);
            console.log('[UI] Directory handler set up');
        }

        // Log button handler
        if (this.elements.logBtn) {
            this.elements.logBtn.removeEventListener('click', this.handleLogButtonClick);
            this.elements.logBtn.addEventListener('click', this.handleLogButtonClick);
            console.log('[UI] Log button handler set up');
        }

        // Add mobile logout handler for pwdDisplay click
        if (this.elements.pwdDisplay) {
            this.elements.pwdDisplay.removeEventListener('click', this.handlePwdDisplayClick);
            this.elements.pwdDisplay.addEventListener('click', this.handlePwdDisplayClick);
            console.log('[UI] Mobile logout (pwdDisplay click) handler set up');
        }
    }

    /**
     * Handle directory selection change
     */
    async handleDirectoryChange(event) {
        const selectedDir = event.target.value;
        if (selectedDir) {
            logMessage(`[UI] Directory selected: ${selectedDir}`);
            await this.loadDirectoryFiles(selectedDir);
            localStorage.setItem('lastSelectedDirectory', selectedDir);
            } else {
            // Clear file select if no directory is chosen
            this.updateFileSelect([]);
            if(this.elements.fileSelect) this.elements.fileSelect.style.display = 'none';
        }
    }

    /**
     * Load files for selected directory
     */
    async loadDirectoryFiles(directory) {
        const fileSelect = this.elements.fileSelect;
        if (!fileSelect) {
            console.error('[UI] File select element not found');
            return;
        }

        try {
            const authState = this.getAuthState();
            if (!authState.isLoggedIn) {
                console.warn('[UI] Cannot load files: Not logged in');
                this.updateFileSelect([]); // Clear files if not logged in
                return;
            }
            logMessage(`[UI] Loading files for directory: ${directory}`);

            // Use globalFetch which should handle auth headers
            const response = await globalFetch(`/api/files/list?dir=${encodeURIComponent(directory)}`);

            if (response.ok) {
                const files = await response.json();
                logMessage(`[UI] Files loaded: ${files.length}`);
                this.updateFileSelect(files);
        } else {
                 console.error(`[UI] Failed to load files: ${response.status}`);
                 this.updateFileSelect([]); // Clear files on error
            }
        } catch (error) {
            console.error('[UI] Error loading files:', error);
            this.updateFileSelect([]); // Clear files on exception
        }
    }

    /**
     * Update file select dropdown with files
     */
    updateFileSelect(files) {
        const fileSelect = this.elements.fileSelect;
        if (!fileSelect) return;

        // Clear existing options
        while (fileSelect.options.length > 0) {
            fileSelect.remove(0);
        }

        // Add placeholder
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = files.length > 0 ? 'Select File' : 'No files found';
        placeholder.disabled = files.length === 0;
        fileSelect.appendChild(placeholder);

        // Add files
        files.forEach(file => {
            const option = document.createElement('option');
            const fileName = typeof file === 'object' ?
                (file.name || file.filename || file.path || JSON.stringify(file)) :
                file;
            option.value = fileName;
            option.textContent = fileName;
            fileSelect.appendChild(option);
        });

        // Show only if logged in and there are files (more than just placeholder)
        fileSelect.style.display = this.getAuthState().isLoggedIn && files.length > 0 ? 'block' : 'none';
    }

    /**
     * Handle logout action
     */
    handleLogout(event) {
        if (event) event.preventDefault();
        logMessage('[UI] Logging out and reloading...');
        localStorage.clear();
        setTimeout(() => {
            window.location.reload();
        }, 100);
    }

    /**
     * Handle login form submission
     */
    async handleLogin(event) {
        event.preventDefault();
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        if (!usernameInput || !passwordInput) {
             alert('Login form elements not found!');
             return;
        }
        const username = usernameInput.value;
        const password = passwordInput.value;

        logMessage(`[UI] Attempting login for user: ${username}`);

        try {
            // Dynamically import handleLogin function from core auth module
            const { handleLogin } = await import('./core/auth.js');
            const success = await handleLogin(username, password);

            if (success) {
                logMessage('[UI] Login successful, reloading page...');
                window.location.reload(); // Reload for clean state
            } else {
                 alert('Login failed. Please check username and password.');
            }
        } catch (error) {
            console.error('[UI] Login error:', error);
            logMessage(`[UI] Login error: ${error.message}`, 'error');
            alert(`Login failed: ${error.message}`);
        }
    }

    /**
     * Get current auth state from localStorage
     */
    getAuthState() {
        try {
            // Check if localStorage is available
            if (typeof localStorage === 'undefined') {
                console.warn("[UI] localStorage not available.");
                return {};
            }
            return JSON.parse(localStorage.getItem('authState') || '{}');
        } catch (e) {
            console.error("[UI] Error parsing authState from localStorage", e);
            return {}; // Return empty object on error
        }
    }

    /**
     * Update the auth display and related UI elements
     */
    async updateAuthDisplay() {
        const authState = this.getAuthState();
        logMessage(`[UI] Updating auth display. Logged in: ${authState.isLoggedIn}`);

        if (authState.isLoggedIn) {
            await this.updateLoggedInUI(authState);
        } else {
            this.updateLoggedOutUI();
        }
        // Ensure mobile password visibility is correct after update
        this.initializeSimpleMobileUI();
    }

    /**
     * Update UI for logged in state
     */
    async updateLoggedInUI(authState) {
        const { loginForm, logoutBtn, pwdDisplay, dirSelect } = this.elements;

        if (loginForm) loginForm.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (pwdDisplay) pwdDisplay.textContent = `Logged in as: ${authState.username}`;

        document.body.setAttribute('data-auth-state', 'logged-in');

        // Load directories
        if (dirSelect) {
            logMessage('[UI] Attempting to load directories...');
            try {
                logMessage('[UI] Fetching directories from /api/files/dirs...');
                const response = await globalFetch('/api/files/dirs'); // Use globalFetch

                logMessage(`[UI] Directory fetch response status: ${response.status}`);

                if (response.ok) {
                    const dirs = await response.json();
                    logMessage(`[UI] Successfully loaded directories: ${JSON.stringify(dirs)}`);
                    if (dirs && dirs.length > 0) {
                        this.updateDirectorySelect(dirs);

                        // Restore last selected directory if any
                        const lastDir = localStorage.getItem('lastSelectedDirectory');
                        if (lastDir && dirs.includes(lastDir)) {
                            dirSelect.value = lastDir;
                            // Trigger change event ONLY if value was actually set
                            if (dirSelect.value === lastDir) {
                                logMessage(`[UI] Restoring and triggering change for directory: ${lastDir}`);
                                dirSelect.dispatchEvent(new Event('change'));
                            }
                        } else {
                            logMessage('[UI] No last directory or last directory not found in list.');
                            // If no directory is selected (value is ""), clear files
                            this.updateFileSelect([]);
                            if(this.elements.fileSelect) this.elements.fileSelect.style.display = 'none';
                        }
                    } else {
                        logMessage('[UI] Directory list received from server is empty or invalid.');
                        this.updateDirectorySelect([]); // Show empty state
                    }
                } else {
                    const errorText = await response.text();
                    console.error(`[UI] Failed to load directories: ${response.status}. Response: ${errorText}`);
                    logMessage(`[UI] Failed to load directories: ${response.status}`);
                    this.updateDirectorySelect([]); // Show empty state
                }
            } catch (error) {
                console.error('[UI] Error during directory loading fetch:', error);
                logMessage(`[UI] Error loading directories: ${error.message}`);
                this.updateDirectorySelect([]); // Show empty state on error
            }
        } else {
             console.warn("[UI] Directory select element not found for logged-in state.");
             logMessage("[UI] Directory select element not found.");
        }
    }

    /**
     * Update UI for logged out state
     */
    updateLoggedOutUI() {
        const { loginForm, logoutBtn, pwdDisplay, dirSelect, fileSelect } = this.elements;

        if (loginForm) loginForm.style.display = 'block'; // Or 'flex'
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (pwdDisplay) pwdDisplay.textContent = 'Not logged in';
        if (dirSelect) {
             this.updateDirectorySelect([]); // Clear options
             dirSelect.style.display = 'none'; // Hide
        }
        if (fileSelect) {
             this.updateFileSelect([]); // Clear options
             fileSelect.style.display = 'none'; // Hide
        }

        document.body.setAttribute('data-auth-state', 'logged-out');
    }

    /**
     * Update directory select dropdown with directories
     */
    updateDirectorySelect(dirs) {
        const dirSelect = this.elements.dirSelect;
        if (!dirSelect) return;

        const currentVal = dirSelect.value; // Store current value before clearing

        // Clear existing options
        while (dirSelect.options.length > 0) {
            dirSelect.remove(0);
        }

        // Add placeholder
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = dirs.length > 0 ? 'Select Directory' : 'No directories available';
        placeholder.disabled = dirs.length === 0;
        dirSelect.appendChild(placeholder);

        // Add directories
        dirs.forEach(dir => {
            const option = document.createElement('option');
            option.value = dir;
            option.textContent = dir;
            dirSelect.appendChild(option);
        });

        // Try to restore previous value if it still exists in the new list
        if (dirs.includes(currentVal)) {
            dirSelect.value = currentVal;
        } else {
            dirSelect.value = ''; // Reset to placeholder if previous value is gone
        }

        // Show only if logged in
        dirSelect.style.display = this.getAuthState().isLoggedIn ? 'block' : 'none';
    }

    /**
     * Handle log button click
     */
    handleLogButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        logMessage('[UI] Log button clicked, calling toggleLog');
        toggleLog('button');
    }

    /**
     * Handle click on pwdDisplay (for mobile logout)
     */
    handlePwdDisplayClick(event) {
        // Check window width dynamically inside the handler
        if (window.innerWidth <= 768 && this.getAuthState().isLoggedIn) {
            event.preventDefault();
            if (window.confirm('Are you sure you want to log out?')) {
                this.handleLogout();
            }
        }
    }

    /**
     * Mobile specific UI adjustments: Ensure password field is text
     */
    initializeSimpleMobileUI() {
        try {
            const passwordInput = this.elements.loginForm?.querySelector('input[name="password"]');
            if (passwordInput && passwordInput.type !== 'text') {
                passwordInput.type = 'text';
                passwordInput.setAttribute('autocomplete', 'off');
                logMessage("[UI] Set password input type to text");
        }
    } catch (error) {
        console.error('[UI ERROR] Failed to set password input type:', error);
    }
}

    /**
     * Adjust layout for mobile viewports (placeholder)
     */
    updateMobileLayout() {
        // Add mobile-specific layout adjustments here if needed
        // Example: Toggling classes, moving elements (carefully)
    if (window.innerWidth <= 768) {
            document.body.classList.add('mobile-layout');
            logMessage("[UI] Applying mobile layout adjustments");
        } else {
            document.body.classList.remove('mobile-layout');
            logMessage("[UI] Applying desktop layout adjustments");
        }
    }

    /**
     * Display detailed system information
     */
    async showSystemInfo() {
        try {
            const authState = this.getAuthState();
        if (!authState.isLoggedIn) {
            logMessage('[SYSTEM] Cannot fetch system info: Not logged in');
                alert('Please log in to view system information.'); // Provide user feedback
            return;
        }

        logMessage('[SYSTEM] Fetching system information...');
        
            // Fetch system info using globalFetch
        const response = await globalFetch('/api/auth/system');
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const info = await response.json();
        
        // Log the information directly using logMessage
        logMessage('\n=== SYSTEM INFORMATION ===');
        
        // Environment
        logMessage('\nEnvironment:');
        Object.entries(info.environment || {}).forEach(([key, value]) => {
            logMessage(`${key.padEnd(15)} = ${value}`);
        });

        // Paths
        logMessage('\nPaths:');
        Object.entries(info.paths || {}).forEach(([key, value]) => {
            logMessage(`${key.padEnd(15)} = ${value}`);
        });

        // Server Stats
        if (info.server) {
            logMessage('\nServer:');
            logMessage(`Uptime         = ${Math.round(info.server.uptime / 60)} minutes`);
            logMessage(`Memory (RSS)   = ${Math.round(info.server.memory.rss / 1024 / 1024)} MB`);
            
                // Active Users (Optional: Check if needed)
                // if (info.server.activeUsers?.length > 0) {
                //     logMessage('\nActive Users:');
                //     info.server.activeUsers.forEach(user => {
                //         const lastSeen = new Date(user.lastSeen).toLocaleTimeString();
                //         const marker = user.isCurrentUser ? '👤' : '👻';
                //         logMessage(`${marker} ${user.username.padEnd(15)} (last seen: ${lastSeen})`);
                //     });
                // }
            }

            // Add other sections if needed (like stream info)

            logMessage('\n=== END OF SYSTEM INFORMATION ===');
            // Optionally, show a confirmation alert
            // alert('System information logged to console.');

    } catch (error) {
        console.error('[SYSTEM ERROR]', error);
        logMessage(`[SYSTEM ERROR] Failed to fetch system info: ${error.message}`);
            alert(`Error fetching system info: ${error.message}`); // User feedback on error
        }
    }
}

// --- Initialization ---

// Create singleton instance of the UI Manager
const uiManagerInstance = new UIManager();

// Initialize when DOM is ready, preventing multiple initializations
let isUIManagerInitialized = false;
document.addEventListener('DOMContentLoaded', () => {
    if (!isUIManagerInitialized) {
        isUIManagerInitialized = true;
        uiManagerInstance.initialize().catch(error => {
            console.error("[UI] Initialization failed:", error);
        });
    }
});

// --- Exports ---

// Export the instance as default
export default uiManagerInstance;

// Export specific methods if they need to be called from other modules
export const updateAuthDisplay = uiManagerInstance.updateAuthDisplay;
export const showSystemInfo = () => uiManagerInstance.showSystemInfo();

// Add any other exports needed by other modules here
// export const someOtherFunction = () => uiManagerInstance.someOtherMethod(); 