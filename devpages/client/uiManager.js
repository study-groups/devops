/**
 * uiManager.js - Manages UI updates based on events from other modules.
 * Does NOT manage state or fetch data directly.
 */
import { eventBus } from '/client/eventBus.js';
import { logMessage } from '/client/log/index.js';
import { appState } from '/client/appState.js'; // Import central state
import { setUIState, getUIState } from '/client/uiState.js'; // Use uiState for persistent UI settings

// Components (Import constructors/factories)
import { createAuthDisplayComponent } from '/client/components/AuthDisplay.js';
import { createContextManagerComponent } from '/client/components/ContextManagerComponent.js';
// Import LogPanel if needed for direct interaction, otherwise rely on events/global instance
// import LogPanel from '/client/components/LogPanel.js'; 

// Variable to hold component instances
let authDisplayComponent = null;
let contextManagerComponent = null;
// let logPanelInstance = null; // If managing LogPanel instance here

// Initialize UI components and listeners
export function initializeUI() {
    logMessage('[UI_MANAGER] Initializing UI...');

    // Mount components
    try {
        authDisplayComponent = createAuthDisplayComponent('auth-area');
        authDisplayComponent.mount();
    } catch (e) {
        logMessage(`[UI_MANAGER] Failed to initialize AuthDisplay Component: ${e.message}`, 'error');
        console.error('[BOOTSTRAP_AUTH_DISPLAY] Failed to initialize AuthDisplay Component:', e);
    }
    
    try {
        contextManagerComponent = createContextManagerComponent('context-manager');
        contextManagerComponent.mount();
    } catch (e) {
        logMessage(`[UI_MANAGER] Failed to initialize ContextManager Component: ${e.message}`, 'error');
        console.error('[BOOTSTRAP_CTX_MANAGER] Failed to initialize ContextManager Component:', e);
    }
    
    // Mount LogPanel (if needed here)
    // try {
    //     logPanelInstance = new LogPanel('log-container', '/client/components/LogPanel.css');
    //     logPanelInstance.mount(); // Assuming mount method exists
    // } catch (e) {
    //    logMessage(`[UI_MANAGER] Failed to initialize LogPanel Component: ${e.message}`, 'error');
    //    console.error('[BOOTSTRAP_LOG_PANEL] Failed to initialize LogPanel Component:', e);
    // }
    
    // Initialize other UI elements or listeners if necessary
    initializeEventListeners();

    logMessage('[UI_MANAGER] UI Initialized.');
}

// Setup global event listeners relevant to UI state
function initializeEventListeners() {
    logMessage('[UI_MANAGER] Initializing UI event listeners...');

    // Listen for view mode changes triggered by actions/shortcuts
    eventBus.on('ui:viewModeChanged', (mode) => {
        logMessage(`[UI_MANAGER] Received ui:viewModeChanged event: ${mode}`);
        setUIState('viewMode', mode); // Persist view mode
        applyViewMode(mode); // Apply the view mode change to the DOM
    });

    // Listen for log visibility changes
    eventBus.on('ui:logVisibilityChanged', (isVisible) => {
        logMessage(`[UI_MANAGER] Received ui:logVisibilityChanged event: ${isVisible}`);
        applyLogVisibility(isVisible);
        // Optionally resize content area if needed
    });
    
    // Listen for log height changes
    eventBus.on('ui:logHeightChanged', (newHeight) => {
        logMessage(`[UI_MANAGER] Received ui:logHeightChanged event: ${newHeight}`);
        applyLogHeight(newHeight);
        // Optionally resize content area if needed
    });

    // Restore UI state on load (like view mode, log visibility/height)
    restoreUIState();

    logMessage('[UI_MANAGER] UI event listeners initialized.');
}

// Function to apply view mode class to body
function applyViewMode(mode) {
    logMessage(`[UI_MANAGER] Applying view mode: ${mode}`);
    const body = document.body;
    body.classList.remove('view-code', 'view-preview', 'view-split');
    switch (mode) {
        case 'code':
            body.classList.add('view-code');
            break;
        case 'preview':
            body.classList.add('view-preview');
            break;
        case 'split':
        default: // Default to split view
            body.classList.add('view-split');
            // If mode was explicitly something else but defaulted, log it
            if (mode !== 'split') {
                logMessage(`[UI_MANAGER] Warning: Received invalid view mode '${mode}', defaulting to 'split'.`, 'warning');
                mode = 'split'; // Ensure mode reflects the applied class
            }
            break;
    }
    logMessage(`[UI_MANAGER] Body classes after applyViewMode('${mode}'): ${body.className}`);
    // Trigger content height update in case view change affects layout
    window.dispatchEvent(new Event('resize')); 
}

// Function to apply log visibility state
function applyLogVisibility(isVisible) {
    logMessage(`[UI_MANAGER] Applying log visibility: ${isVisible}`);
    document.documentElement.setAttribute('data-log-visible', isVisible.toString());
    // Trigger content height update
    window.dispatchEvent(new Event('resize')); 
}

// Function to apply log height state
function applyLogHeight(height) {
    logMessage(`[UI_MANAGER] Applying log height: ${height}px`);
    document.documentElement.style.setProperty('--log-height', `${height}px`);
    // Trigger content height update
    window.dispatchEvent(new Event('resize')); 
}

// Function to restore UI state from uiState module
function restoreUIState() {
    logMessage('[UI_MANAGER] Restoring UI state...');
    const storedViewMode = getUIState('viewMode'); // Get stored value first
    logMessage(`[UI_MANAGER] Value from getUIState('viewMode'): ${storedViewMode}`);
    const viewMode = storedViewMode || 'split'; // Apply default if necessary
    const logVisible = getUIState('logVisible') || false; 
    const logHeight = getUIState('logHeight') || 120; 

    logMessage(`[UI_MANAGER] Restored state - viewMode (effective): ${viewMode}, logVisible: ${logVisible}, logHeight: ${logHeight}`);
    
    applyViewMode(viewMode);
    applyLogVisibility(logVisible);
    applyLogHeight(logHeight);

    logMessage('[UI_MANAGER] UI state restored.');
}

// Optional: Add functions to destroy components if needed during logout or re-init
export function destroyUI() {
    logMessage('[UI_MANAGER] Destroying UI components...');
    authDisplayComponent?.destroy();
    contextManagerComponent?.destroy();
    // logPanelInstance?.destroy(); // If managing LogPanel instance here
    authDisplayComponent = null;
    contextManagerComponent = null;
    // logPanelInstance = null;
    logMessage('[UI_MANAGER] UI components destroyed.');
    // Note: Event listeners on eventBus might need explicit removal if uiManager itself is destroyed.
}

// --- Logging Helper ---
function logUI(message, level = 'text') {
    const type = 'UI';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message,type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${type}:${message}`);
    }
}

// --- Path Display Helper --- (Based on fileManager state)
function constructDisplayPath(...parts) {
    const filteredParts = parts.filter(part => part && part !== '/');
    if (filteredParts.length === 0) return '/';
    return '/' + filteredParts.join('/').replace(/\/+/g, '/');
}

// --- UI Manager Class ---
class UIManager {
    constructor() {
        this.elements = {
            // REMOVED login/logout elements as they are handled by AuthDisplay component
            // get loginForm() { return document.getElementById('login-form'); },
            // get logoutBtn() { return document.getElementById('logout-btn'); },
            // get authStatusDisplay() { return document.getElementById('auth-status-display'); },
            get saveBtn() { return document.getElementById('save-btn'); },
            get breadcrumbContainer() { return document.getElementById('breadcrumb-container'); }, 
        };

        // REMOVED binding of handleLogin/handleLogout
        // this.handleLogout = this.handleLogout.bind(this);
        // this.handleLogin = this.handleLogin.bind(this);
        this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
        this.handleLoadingStateChange = this.handleLoadingStateChange.bind(this);
        this.handleFileManagerStateSettled = this.handleFileManagerStateSettled.bind(this);
        this.updateActionButtonsState = this.updateActionButtonsState.bind(this);
        this.updateBreadcrumbs = this.updateBreadcrumbs.bind(this);
        this.setupBreadcrumbListener = this.setupBreadcrumbListener.bind(this);
    }

    async initialize() {
        logUI('Initializing UI Manager (v_ContextMgrRefactor)...');
        this.setupEventListeners();
        this.setupEventBusListeners();
        this.setupBreadcrumbListener();

        // Subscribe to central state
        appState.subscribe(this.handleAuthStateChange); 
        // Initial UI update based on current auth state
        await this.handleAuthStateChange(appState.getState(), appState.getState());

        // --- ADDED: Re-apply view mode after initial auth/file handling ---
        const finalViewMode = getUIState('viewMode') || 'split';
        logUI(`Re-applying final view mode after UIManager init: ${finalViewMode}`);
        applyViewMode(finalViewMode); // Call the standalone function
        // --- END ADDED ---

        logUI('UIManager initialization sequence finished.');
    }

    // Setup listeners for user interactions with DOM elements
    setupEventListeners() {
        logUI('Setting up DOM event listeners...');
        // REMOVED listeners for login form/logout button
        // const loginForm = this.elements.loginForm;
        // if (loginForm) { loginForm.addEventListener('submit', this.handleLogin); }
        // const logoutBtn = this.elements.logoutBtn;
        // if (logoutBtn) { logoutBtn.addEventListener('click', this.handleLogout); }
        logUI('DOM event listeners set up (excluding AuthDisplay handled elements).');
    }

    // Setup listeners for events from other modules
    setupEventBusListeners() {
        logUI('Setting up Event Bus listeners...');
        eventBus.off('fileManager:dirsLoaded');
        eventBus.off('fileManager:listingLoaded');
        eventBus.off('fileManager:stateSettled');
        eventBus.off('fileManager:loadingStateChanged');
        eventBus.off('file:loaded');
        eventBus.off('file:loadError');
        eventBus.off('fileSystem:cleared');
        eventBus.off('ui:viewModeChanged');
        eventBus.off('ui:logVisibilityChanged');

        eventBus.on('fileManager:loadingStateChanged', this.handleLoadingStateChange);
        eventBus.on('fileManager:stateSettled', this.handleFileManagerStateSettled);

        eventBus.on('ui:viewModeChanged', (newMode) => {
            logUI(`Event received: ui:viewModeChanged - Mode: ${newMode}`);
            window.APP?.contentView?.update({ viewMode: newMode });
            window.APP?.viewControlsComponent?.update({ viewMode: newMode });
        });

        eventBus.on('ui:logVisibilityChanged', (isVisible) => {
             logUI(`Event received: ui:logVisibilityChanged - Visible: ${isVisible}`);
             window.APP?.contentView?.update({ isLogVisible: isVisible });
        });

        logUI('Event Bus listeners ready.');
    }

    // --- DOM Event Handlers ---
    // REMOVED handleLogin and handleLogout methods as they are handled by AuthDisplay component
    /*
    async handleLogin(event) { ... }
    async handleLogout(event) { ... }
    */

    // --- Reactive State/Event Bus Handlers ---
    async handleAuthStateChange(newState, prevState) {
        // Only react if the auth slice actually changed
        if (newState.auth === prevState.auth) { 
            return; 
        }
        logUI(`Handling authState change: isLoggedIn=${newState.auth.isLoggedIn}, user=${newState.auth.user?.username}, authChecked=${newState.auth.authChecked}`);
        
        if (!newState.auth.authChecked) {
             logUI('Auth state changed, but initial check not complete yet. Waiting...');
             return;
        }

        const isLoggedIn = newState.auth.isLoggedIn;
        const username = newState.auth.user?.username;

        // Dynamically import fileManager module HERE
        let fm = null;
        try {
             const fileManagerModule = await import('/client/fileManager.js');
             fm = fileManagerModule.default; // Assuming default export contains the methods
             if (!fm) throw new Error('fileManager default export is missing');
        } catch (err) {
            logUI(`Critical error importing fileManager: ${err.message}`, 'error');
            return; // Cannot proceed without fileManager
        }
        
        if (isLoggedIn) {
            const isInitialized = typeof fm.getIsInitialized === 'function' && fm.getIsInitialized();
            
            if (!isInitialized) {
                logUI('User is authenticated & fileManager NOT initialized. Triggering fileManager.initializeFileManager()...');
                if (typeof fm.initializeFileManager === 'function') { 
                    // Await the initialization
                    await fm.initializeFileManager().catch(err => { 
                        logUI(`FileManager initialization failed: ${err.message}`, 'error');
                    });
                    logUI('initializeFileManager awaited.'); // Log completion
                } else {
                     logUI('initializeFileManager function not found on fileManager module', 'error');
                }
            } else {
                logUI('User authenticated & fileManager WAS initialized. Triggering fileManager.refreshFileManagerForUser()...');
                if (typeof fm.refreshFileManagerForUser === 'function') {
                    // Await the refresh
                    await fm.refreshFileManagerForUser(username).catch(err => {
                         logUI(`FileManager refresh for user failed: ${err.message}`, 'error');
                    });
                     logUI('refreshFileManagerForUser awaited.'); // Log completion
                } else {
                    logUI('refreshFileManagerForUser function not available on fileManager module.', 'warning');
                }
            }
        } else {
            // User logged OUT
            if (prevState.auth.isLoggedIn) {
                logUI('User changed from logged-in to logged-out. Clearing file manager state and UI.');
                if (typeof fm.resetFileManagerState === 'function') { 
                    fm.resetFileManagerState(); 
                    // No need to await reset usually, but UI updates rely on events below
                } else {
                     logUI('resetFileManagerState function not available on fileManager module.', 'warning');
                }
            } else {
                logUI('User is logged out (or was already logged out). No reset needed.');
            }
        }
        // Remove direct UI updates - rely on stateSettled event handler
        /*
        // Update UI elements that depend on login state or file manager state
        // These also need to use the dynamically imported fm object
        this.updateActionButtonsState(fm); // Pass fm
        this.updateBreadcrumbs(fm); // Pass fm
        */
        logUI('handleAuthStateChange finished (UI updates delegated to stateSettled handler).')
    }

    // Simplify stateSettled if only used for button updates now
    async handleFileManagerStateSettled(eventData = {}) {
        logUI('Handling fileManager:stateSettled...');
        // Dynamically import fileManager
        let fm = null;
        try {
             const fileManagerModule = await import('/client/fileManager.js');
             fm = fileManagerModule.default;
             if (!fm) throw new Error('fileManager default export is missing');
        } catch (err) {
            logUI(`Critical error importing fileManager in stateSettled: ${err.message}`, 'error');
            return; 
        }

        this.updateActionButtonsState(fm); // Pass fm
        this.updateBreadcrumbs(fm); // Pass fm

        // ADDED: Check if we need to render the top-level selector for Mike
        try {
            const currentAuthState = appState.getState().auth;
            const currentUsername = currentAuthState.user?.username;
            const isLoggedIn = currentAuthState.isLoggedIn;
            
            // Use fm getters
            const currentTopDir = typeof fm.getCurrentTopLevelDirectory === 'function' ? fm.getCurrentTopLevelDirectory() : null;
            const availableTopDirs = typeof fm.getAvailableTopLevelDirs === 'function' ? fm.getAvailableTopLevelDirs() : [];

            if (currentUsername?.toLowerCase() === 'mike' && !currentTopDir && availableTopDirs.length > 0) {
                 logUI('State settled with empty topDir for mike. Emitting ui:renderFileList to show selector.');
                 eventBus.emit('ui:renderFileList'); 
            } else if (!currentTopDir && !isLoggedIn) { 
                 logUI('State settled with empty topDir (logged out). Emitting ui:renderFileList.');
                 eventBus.emit('ui:renderFileList'); 
            } else {
                 logUI('State settled, standard listing expected.');
            }
        } catch (error) {
             logUI(`Error during stateSettled check for selector: ${error.message}`, 'error');
        }
    }

    async handleLoadingStateChange(eventData) {
        logUI(`Event received: loadingStateChanged. isLoading=${eventData?.isLoading}, isSaving=${eventData?.isSaving}`);
        // Dynamically import fileManager
         let fm = null;
        try {
             const fileManagerModule = await import('/client/fileManager.js');
             fm = fileManagerModule.default;
             if (!fm) throw new Error('fileManager default export is missing');
        } catch (err) {
            logUI(`Critical error importing fileManager in loadingStateChanged: ${err.message}`, 'error');
            return; 
        }
        this.updateActionButtonsState(fm); // Pass fm
    }

    // --- UI Update Functions (Now accept fm object) --- 
    updateBreadcrumbs(fm) {
        const container = this.elements.breadcrumbContainer;
        if (!container || !fm) return;

        try {
            // Use fm getters
            const topDir = typeof fm.getCurrentTopLevelDirectory === 'function' ? fm.getCurrentTopLevelDirectory() : '';
            const relativePath = typeof fm.getCurrentRelativePath === 'function' ? fm.getCurrentRelativePath() : '';
            const currentFile = typeof fm.getCurrentFile === 'function' ? fm.getCurrentFile() : '';

            let html = '';
            html += `<a href="#" id="breadcrumb-root" title="Go to Root Selection / User Directory">📁 Root</a>`; 

            if (topDir) {
                html += ` <span class="breadcrumb-separator">/</span> `;
                 html += `<a href="#" data-target-top="${topDir}" data-target-relative="">${topDir}</a>`;

                if (relativePath) {
                    const pathParts = relativePath.split('/').filter(p => p);
                    let currentBuiltPath = '';
                    pathParts.forEach((part, index) => {
                        currentBuiltPath = currentBuiltPath ? `${currentBuiltPath}/${part}` : part;
                        html += ` <span class="breadcrumb-separator">/</span> `;
                         html += `<a href="#" data-target-top="${topDir}" data-target-relative="${currentBuiltPath}">${part}</a>`;
                    });
                }
                 
                 if (currentFile) {
                     html += ` <span class="breadcrumb-separator">/</span> `;
                     html += `<span class="breadcrumb-current">${currentFile}</span>`;
                 }
            } else {
                 const authChecked = appState.getState().auth.authChecked;
                 if (authChecked) { 
                    html += ` <span class="breadcrumb-current">(Select a directory)</span>`;
                 } else {
                     html += ` <span class="breadcrumb-current">(Loading...)</span>`;
                 }
            }

            container.innerHTML = html;
             logUI(`Breadcrumbs updated: Top='${topDir}', Rel='${relativePath}', File='${currentFile}'`);
        } catch (error) {
             logUI(`Error updating breadcrumbs: ${error.message}`, 'error');
             if (container) container.innerHTML = '<span class="error">Error loading path</span>';
        }
    }

    updateActionButtonsState(fm) {
        const saveButton = this.elements.saveBtn;
        if (!saveButton) {
             logUI('Save button not found for state update.', 'warning');
             return; // Exit if button not found
        }
        if (!fm) { // Check if fm is available
             logUI('FileManager module not available for button state update.', 'error');
             saveButton.disabled = true;
             return;
        }
        
        try {
            // Use fm getters
            const fmLoading = typeof fm.getIsLoading === 'function' ? fm.getIsLoading() : false;
            const fileSelected = typeof fm.getCurrentFile === 'function' ? fm.getCurrentFile() : null;
            
            const shouldDisableSave = fmLoading || !fileSelected;
            
            saveButton.disabled = shouldDisableSave;
            saveButton.title = shouldDisableSave ? (fmLoading ? 'Loading files...' : 'No file selected') : 'Save current file';
            saveButton.classList.toggle('disabled', shouldDisableSave);
            saveButton.classList.toggle('opacity-50', shouldDisableSave);
            saveButton.classList.toggle('cursor-not-allowed', shouldDisableSave);
            
            logUI(`Save button state updated: disabled=${shouldDisableSave}`);
        } catch (error) {
            logUI(`Error updating action button states: ${error.message}`, 'error');
             if (saveButton) {
                 saveButton.disabled = true;
                 saveButton.title = 'Error updating state';
                 saveButton.classList.add('disabled', 'opacity-50', 'cursor-not-allowed');
             }
        }
    }

    // ADDED: Breadcrumb Listener Setup
    setupBreadcrumbListener() {
        const container = this.elements.breadcrumbContainer;
        if (!container) {
            logUI('Breadcrumb container not found for listener setup.', 'error');
            return;
        }

        // Use event delegation on the container
        container.addEventListener('click', (event) => {
            const target = event.target.closest('a[href="#"]'); // Find the closest anchor link
            if (!target) return; // Exit if the click wasn't on a breadcrumb link

            event.preventDefault(); // Prevent default anchor behavior

            const targetTop = target.dataset.targetTop;
            const targetRelative = target.dataset.targetRelative;
            const targetId = target.id;

            logUI(`Breadcrumb clicked: ID='${targetId}', Top='${targetTop}', Relative='${targetRelative}'`);

            // Determine which directory to load based on data attributes
            let dirToLoad;
            if (targetId === 'breadcrumb-root') {
                 dirToLoad = ''; // Root means clear the selection, let File Manager handle root logic
                 logUI('Navigating to Root/User Selection...');
                 // Event tells file manager to show root/user dirs
                 eventBus.emit('fileManager:navigate', { dir: dirToLoad }); 
            } else if (targetTop !== undefined && targetRelative !== undefined) {
                // Combine top-level dir and relative path
                dirToLoad = targetRelative ? `${targetTop}/${targetRelative}` : targetTop;
                logUI(`Navigating to Directory: ${dirToLoad}`);
                 // Event tells file manager to load this specific combined directory
                eventBus.emit('fileManager:navigate', { dir: dirToLoad });
            } else {
                 logUI('Breadcrumb click target has no valid data attributes.', 'warning');
            }
        });
         logUI('Breadcrumb click listener attached.');
    }
}

// --- Singleton Instance ---
// Create and export a single instance of the UIManager
const uiManager = new UIManager();

// Export the initialize function as the primary way to start the manager
export default { initialize: uiManager.initialize.bind(uiManager) };

// Removed DOMContentLoaded listener

// --- Exports ---
// export default uiManager;

// Removed specific exports like showSystemInfo if not needed
// export const showSystemInfo = () => uiManager.showSystemInfo(); 