// Import necessary modules
// import { logMessage, toggleLog } from "/client/log/index.js";
import { globalFetch } from '/client/globalFetch.js';
import { updateTopBar } from '/client/components/topBar.js';
import { eventBus } from '/client/eventBus.js';
import { AUTH_STATE } from '/client/auth.js';
import fileManager from '/client/fileManager.js'; // Assuming default export
// Removed imports for functions/modules no longer used directly here

// Helper for logging within this module
function logUI(message, level = 'text') {
    const prefix = '[UI]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

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
        this.handleMainLogToggle = this.handleMainLogToggle.bind(this);
        this.updateAuthDisplay = this.updateAuthDisplay.bind(this);
        this.updateMobileLayout = this.updateMobileLayout.bind(this); // Bind resize handler
        this.handlePwdDisplayClick = this.handlePwdDisplayClick.bind(this); // Bind mobile logout handler
    }

    /**
     * Initialize the UI manager
     */
    async initialize() {
        logUI('Initializing UI Manager');
        updateTopBar(); // Initialize top bar first
        this.setupEventListeners();
        this.initializeSimpleMobileUI(); // Handle mobile specifics like password visibility
        this.updateMobileLayout(); // Adjust layout for mobile if needed
        window.addEventListener('resize', this.updateMobileLayout); // Handle resize
        logUI('UI Manager initialized successfully');

        // Listen for auth state changes
        eventBus.off('auth:stateChanged', this.updateAuthDisplay); // Prevent duplicates if re-initialized
        eventBus.on('auth:stateChanged', this.updateAuthDisplay);
        logUI('Listening for auth:stateChanged events');

        // Listen for file manager state being settled
        eventBus.off('fileManager:stateSettled', this.handleFileManagerStateSettled);
        eventBus.on('fileManager:stateSettled', this.handleFileManagerStateSettled.bind(this)); // Bind context
        logUI('Listening for fileManager:stateSettled events');
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Logout button handler
        if (this.elements.logoutBtn) {
            this.elements.logoutBtn.removeEventListener('click', this.handleLogout);
            this.elements.logoutBtn.addEventListener('click', this.handleLogout);
            logUI('Logout button handler set up');
        }

        // Login form handler
        if (this.elements.loginForm) {
            this.elements.loginForm.removeEventListener('submit', this.handleLogin);
            this.elements.loginForm.addEventListener('submit', this.handleLogin);
            logUI('Login form handler set up');
        }

        // Directory selection handler
        if (this.elements.dirSelect) {
            this.elements.dirSelect.removeEventListener('change', this.handleDirectoryChange);
            this.elements.dirSelect.addEventListener('change', this.handleDirectoryChange);
            logUI('Directory handler set up');
        }

        // // REMOVE or COMMENT OUT the explicit listener for #log-btn
        // const logBtn = document.getElementById('log-btn');
        // if (logBtn) {
        //     logBtn.addEventListener('click', (event) => {
        //         // Potentially problematic code was here, maybe preventDefault() or direct UI manipulation
        //         // We now rely on data-action="toggleLogVisibility" and the global handler
        //         // No need to explicitly trigger actions.trigger('toggleLogVisibility') here either
        //         console.warn('[UI Manager] Explicit #log-btn listener removed/commented out.'); 
        //     });
        //     logUI('Main log toggle button (#log-btn) handler setup removed/commented.');
        // } else {
        //     logUI('Main log toggle button (#log-btn) not found during explicit listener setup.', 'warning');
        // }

        // Add mobile logout handler for pwdDisplay click
        if (this.elements.pwdDisplay) {
            this.elements.pwdDisplay.removeEventListener('click', this.handlePwdDisplayClick);
            this.elements.pwdDisplay.addEventListener('click', this.handlePwdDisplayClick);
            logUI('Mobile logout (pwdDisplay click) handler set up');
        }
    }

    /**
     * Handle directory selection change
     */
    async handleDirectoryChange(event) {
        logUI(`handleDirectoryChange triggered. Event type: ${event?.type}, IsTrusted: ${event?.isTrusted}, Target value: ${event?.target?.value}`);
        const selectedDir = event.target.value;
        if (selectedDir) {
            logUI(`Directory selected: ${selectedDir}`);
            await this.loadDirectoryFiles(selectedDir);
            // Don't save to localStorage directly, let fileSystemState handle it
            // localStorage.setItem('lastSelectedDirectory', selectedDir);
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
            // REMOVED client-side auth check
            /*
            const authState = this.getAuthState();
            if (!authState.isLoggedIn) {
                console.warn('[UI] Cannot load files: Not logged in');
                this.updateFileSelect([]); // Clear files if not logged in
                return;
            }
            */
            logUI(`Loading files for directory: ${directory}`);

            // Use globalFetch (relies on session cookie)
            const response = await globalFetch(`/api/files/list?dir=${encodeURIComponent(directory)}`);

            if (response.ok) {
                const files = await response.json();
                logUI(`Files loaded: ${files.length}`);
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

        // --- ADDED: Restore file selection --- 
        try {
            const restoredFile = fileManager.getCurrentFile?.(); // Get restored file
            if (restoredFile && files.some(f => (typeof f === 'string' ? f : f.name) === restoredFile)) {
                 fileSelect.value = restoredFile;
                 logUI(`Restored file selection to: ${restoredFile}`);
            } else if (restoredFile) {
                logUI(`Restored file '${restoredFile}' not found in current list.`, 'warning');
            }
        } catch (e) {
            logUI(`Failed to get/set restored file: ${e.message}`, 'error');
        }
        // --- END ADDED --- 

        // Show only if logged in (check live state) and there are files
        fileSelect.style.display = (AUTH_STATE.current === AUTH_STATE.AUTHENTICATED && files.length > 0) ? 'block' : 'none';
    }

    /**
     * Handle logout action
     */
    async handleLogout(event) {
        if (event) event.preventDefault();
        logUI('Triggering logout...');
        try {
            const { logout } = await import('/client/auth.js');
            await logout(); // Call the actual logout function
            // UI update will happen via auth:stateChanged listener
        } catch(e) {
            const { AUTH_STATE } = await import('/client/auth.js'); // Need AUTH_STATE here
            if (AUTH_STATE.current === AUTH_STATE.UNAUTHENTICATED) {
                // Logout succeeded locally, server response might have been non-standard (e.g., 204)
                logUI(`Logout completed but caught minor exception: ${e.message}`, 'warning');
            } else {
                // Logout likely failed more significantly
                logUI(`Logout failed: ${e.message}`, 'error');
                alert(`Logout failed: ${e.message}`); // Show alert only on significant failure
            }
        }
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

        logUI(`Attempting login for user: ${username}`);

        try {
            const { handleLogin } = await import('/client/auth.js');
            const success = await handleLogin(username, password);

            if (success) {
                logUI('Login successful');
                // UI update will happen via auth:stateChanged listener
                // REMOVED: window.location.reload();
            } else {
                 alert('Login failed. Please check username and password.');
            }
        } catch (error) {
            logUI(`Login error: ${error.message}`, 'error');
            alert(`Login failed: ${error.message}`);
        }
    }

    /**
     * Update the auth display and related UI elements based on current AUTH_STATE
     */
    async updateAuthDisplay() {
        // Read current state directly from imported AUTH_STATE
        const isLoggedIn = AUTH_STATE.current === AUTH_STATE.AUTHENTICATED;
        const username = AUTH_STATE.username;
        logUI(`Updating auth display. Logged in: ${isLoggedIn}, User: ${username || 'none'}`);

        if (isLoggedIn) {
            // Pass username to updateLoggedInUI
            await this.updateLoggedInUI(username);
        } else {
            this.updateLoggedOutUI();
        }
        this.initializeSimpleMobileUI();
    }

    /**
     * Update UI for logged in state
     * SIMPLIFIED: Only fetches and populates directory list.
     * Selection restoration is handled by fileManager:stateRestored listener.
     */
    async updateLoggedInUI(username) {
        const { loginForm, logoutBtn, pwdDisplay, dirSelect } = this.elements;

        if (loginForm) loginForm.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (pwdDisplay) {
            pwdDisplay.textContent = username;
            pwdDisplay.style.display = 'inline-block';
        }

        document.body.setAttribute('data-auth-state', 'logged-in');

        // Load directories and populate dropdown, but DON'T set selection here
        if (dirSelect) {
            logUI('Fetching directories for logged in UI...');
            try {
                const response = await globalFetch('/api/files/dirs');
                if (response.ok) {
                    const dirs = await response.json();
                    logUI(`Directories fetched successfully. Raw response: ${JSON.stringify(dirs)}`, 'debug');
                    if (!Array.isArray(dirs)) {
                        logUI(`Fetched directories is not an array! Type: ${typeof dirs}`, 'error');
                        this.updateDirectorySelect([]); // Treat as error
                    } else if (dirs.length === 0) {
                        logUI('Fetched directories list is empty.', 'warning');
                        this.updateDirectorySelect(dirs); // Proceed with empty list
                    } else {
                        logUI(`Successfully loaded directories: ${JSON.stringify(dirs).substring(0, 100)}...`);
                        this.updateDirectorySelect(dirs); // Populates the dropdown
                    }
                } else {
                     console.error(`[UI] Failed to load directories: ${response.status}`);
                     const errorText = await response.text().catch(() => 'Could not read error text');
                     logUI(`Failed to load directories. Status: ${response.status}. Response: ${errorText}`, 'error');
                     this.updateDirectorySelect([]); // Show empty state
                }
            } catch (error) {
                console.error('[UI] Error during directory loading fetch:', error);
                logUI(`[UI] Error loading directories: ${error.message}`);
                this.updateDirectorySelect([]); // Show empty state on error
            }
        } else {
             console.warn("[UI] Directory select element not found for logged-in state.");
             logUI("[UI] Directory select element not found.");
        }
    }

    /**
     * Update UI for logged out state
     */
    updateLoggedOutUI() {
        const { loginForm, logoutBtn, pwdDisplay, dirSelect, fileSelect } = this.elements;

        if (loginForm) loginForm.style.display = 'flex'; // Or 'flex'
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (pwdDisplay) {
            pwdDisplay.textContent = 'Not logged in';
            pwdDisplay.style.display = 'inline-block';
        }
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

        // Restore previous selection OR select username default AFTER populating
        let selectionRestored = false;
        try {
            const restoredDir = fileManager.getCurrentDirectory?.(); // Get restored directory
            logUI(`Attempting to restore directory. Restored value: '${restoredDir}'. Available dirs: ${JSON.stringify(dirs)}`, 'debug');

            if (restoredDir && dirs.some(d => d === restoredDir)) {
                 logUI(`Restored directory '${restoredDir}' found in options. Setting select value...`, 'debug');
                 dirSelect.value = restoredDir;
                 logUI(`dirSelect.value after setting: '${dirSelect.value}'`, 'debug');
                 selectionRestored = (dirSelect.value === restoredDir); // Verify it was set
                 if (selectionRestored) {
                    logUI(`Restored directory selection to: ${restoredDir}`);
                 } else {
                    logUI(`Failed to set dirSelect.value to '${restoredDir}'!`, 'warning');
                 }
            } else if (restoredDir) {
                 logUI(`Restored directory '${restoredDir}' not found in current list.`, 'warning');
                 dirSelect.value = ''; // Reset selection if restored dir not found
            } else {
                // No specific directory restored, leave selection at placeholder
                logUI('No specific directory state found to restore.');
            }
        } catch (e) {
            logUI(`Failed to get/set restored directory: ${e.message}`, 'error');
            dirSelect.value = ''; // Reset on error
        }

        // Show only if logged in
        dirSelect.style.display = AUTH_STATE.current === AUTH_STATE.AUTHENTICATED ? 'block' : 'none';

        // If a directory was successfully restored, trigger change event to load files
        if (selectionRestored && dirSelect.value) {
             logUI(`Triggering change event for restored directory: ${dirSelect.value}`);
             // Use setTimeout to ensure the UI has updated before dispatching
             setTimeout(() => {
                logUI(`Dispatching 'change' event on dirSelect now for '${dirSelect.value}'...`, 'debug');
                dirSelect.dispatchEvent(new Event('change'));
             }, 0);
        } else if (!dirSelect.value) {
             // If no directory is selected (placeholder or cleared), ensure file list is cleared
             this.updateFileSelect([]);
             if(this.elements.fileSelect) this.elements.fileSelect.style.display = 'none';
        }
    }

    // Handler for the main log toggle button in the navbar
    handleMainLogToggle(event) {
        event.preventDefault();
        logUI('Main log toggle button clicked');
        // Use the global LogPanel instance
        window.logPanel?.toggle();
    }

    /**
     * Handle click on pwdDisplay (for mobile logout)
     */
    handlePwdDisplayClick(event) {
        // Check window width dynamically inside the handler
        if (window.innerWidth <= 768 && AUTH_STATE.current === AUTH_STATE.AUTHENTICATED) {
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
                logUI("Set password input type to text for mobile");
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
            logUI("Applying mobile layout adjustments");
        } else {
            document.body.classList.remove('mobile-layout');
            logUI("Applying desktop layout adjustments");
        }
    }

    /**
     * Display detailed system information
     */
    async showSystemInfo() {
        try {
            if (AUTH_STATE.current !== AUTH_STATE.AUTHENTICATED) {
                logUI('Cannot fetch system info: Not logged in', 'warning');
                alert('Please log in to view system information.'); // Provide user feedback
                return;
            }

            logUI('Fetching system information...');
            
            // Fetch system info using globalFetch
            const response = await globalFetch('/api/auth/system');
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const info = await response.json();
            
            // Log the information directly using logUI
            logUI('\n=== SYSTEM INFORMATION ===');
            
            // Environment
            logUI('\nEnvironment:');
            Object.entries(info.environment || {}).forEach(([key, value]) => {
                logUI(`${key.padEnd(15)} = ${value}`);
            });

            // Paths
            logUI('\nPaths:');
            Object.entries(info.paths || {}).forEach(([key, value]) => {
                logUI(`${key.padEnd(15)} = ${value}`);
            });

            // Server Stats
            if (info.server) {
                logUI('\nServer:');
                logUI(`Uptime         = ${Math.round(info.server.uptime / 60)} minutes`);
                logUI(`Memory (RSS)   = ${Math.round(info.server.memory.rss / 1024 / 1024)} MB`);
                
                // Active Users (Optional: Check if needed)
                // if (info.server.activeUsers?.length > 0) {
                //     logUI('\nActive Users:');
                //     info.server.activeUsers.forEach(user => {
                //         const lastSeen = new Date(user.lastSeen).toLocaleTimeString();
                //         const marker = user.isCurrentUser ? '👤' : '👻';
                //         logUI(`${marker} ${user.username.padEnd(15)} (last seen: ${lastSeen})`);
                //     });
                // }
            }

            // Add other sections if needed (like stream info)

            logUI('\n=== END OF SYSTEM INFORMATION ===');
            // Optionally, show a confirmation alert
            // alert('System information logged to console.');

        } catch (error) {
            console.error('[SYSTEM ERROR]', error);
            logUI(`[SYSTEM ERROR] Failed to fetch system info: ${error.message}`);
            alert(`Error fetching system info: ${error.message}`); // User feedback on error
        }
    }

    async loadInitialDirectories() {
        logUI('[UI] Loading initial directories...');
        try {
            const response = await globalFetch('/api/files/dirs');
            // ... (error handling) ...
            const dirs = await response.json();
            this.updateDirectorySelect(dirs); // Populates dropdown again
        } catch (error) {
            // ...
        }
    }

    // Handler for the new file manager state settled event
    /**
     * Handle the event indicating the file manager has determined its initial state.
     * This is the correct time to update the UI based on auth state after a reload.
     */
    handleFileManagerStateSettled() {
        logUI(`Received fileManager:stateSettled event. Checking auth state: ${AUTH_STATE.current}`);
        if (AUTH_STATE.current === AUTH_STATE.AUTHENTICATED) {
            logUI('Auth is AUTHENTICATED upon state settlement, calling updateAuthDisplay.');
            // No need for setTimeout here, as this event fires after the relevant state is ready
            this.updateAuthDisplay(); 
        } else {
            logUI('Auth is not AUTHENTICATED upon state settlement.');
            // If logged out, updateAuthDisplay might have already run via auth:stateChanged,
            // but calling it again ensures UI is in the correct logged-out state.
            this.updateLoggedOutUI(); 
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
export const showSystemInfo = () => uiManagerInstance.showSystemInfo();

// Add any other exports needed by other modules here
// export const someOtherFunction = () => uiManagerInstance.someOtherMethod(); 