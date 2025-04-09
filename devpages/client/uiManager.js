/**
 * uiManager.js - Manages UI updates based on events from other modules.
 * Does NOT manage state or fetch data directly.
 */
import { eventBus } from '/client/eventBus.js';
import { 
    initializeFileManager, 
    getIsInitialized, 
    getCurrentTopLevelDirectory, 
    getCurrentRelativePath, 
    getCurrentFile, 
    getIsLoading, 
    resetFileManagerState, 
    getAvailableTopLevelDirs,
    refreshFileManagerForUser
} from '/client/fileManager.js'; 
import { authState } from '/client/authState.js'; 
import { updateTopBar } from '/client/components/topBar.js'; // For initial setup maybe

// --- Logging Helper ---
function logUI(message, level = 'text') {
    const prefix = '[UI]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
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

        authState.subscribe(this.handleAuthStateChange);
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
    handleAuthStateChange(state) { 
        logUI(`Handling authState change: isAuthenticated=${state.isAuthenticated}, user=${state.username}`);
        const isLoggedIn = state.isAuthenticated;
        // REMOVED direct update of body attribute
        
        if (isLoggedIn) {
            // Use a single variable to check init status
            const isInitialized = typeof getIsInitialized === 'function' && getIsInitialized();
            
            if (!isInitialized) {
                logUI('User is authenticated & fileManager NOT initialized. Triggering fileManager.initializeFileManager()...');
                initializeFileManager().catch(err => { 
                    logUI(`FileManager initialization failed: ${err.message}`, 'error');
                });
            } else {
                logUI('User authenticated & fileManager WAS initialized. Triggering fileManager.refreshFileManagerForUser()...');
                // ADDED: Call the refresh function instead of just handling stateSettled
                if (typeof refreshFileManagerForUser === 'function') {
                    refreshFileManagerForUser(state.username).catch(err => {
                         logUI(`FileManager refresh for user failed: ${err.message}`, 'error');
                         // Optionally reset state here on refresh failure?
                    });
                } else {
                    logUI('refreshFileManagerForUser function not available.', 'warning');
                     // Fallback or error handling if function doesn't exist
                }
                // REMOVED: this.handleFileManagerStateSettled({ source: 'authStateChange' }); 
            }
        } else {
            logUI('User logged out. Clearing file manager state and UI.');
            if (typeof resetFileManagerState === 'function') { 
                resetFileManagerState(); 
            } else {
                 logUI('resetFileManagerState function not available.', 'warning');
            }
        }
        // These updates are still potentially relevant after state changes from either init or refresh
        this.updateActionButtonsState(); 
        this.updateBreadcrumbs(); 
    }

    // Simplify stateSettled if only used for button updates now
    handleFileManagerStateSettled(eventData = {}) {
        logUI('Handling fileManager:stateSettled...');
        this.updateActionButtonsState(); 
        this.updateBreadcrumbs(); 

        // ADDED: Check if we need to render the top-level selector for Mike
        try {
            const currentUser = authState.get();
            const currentTopDir = getCurrentTopLevelDirectory(); 
            const availableTopDirs = getAvailableTopLevelDirs();

            if (currentUser.username?.toLowerCase() === 'mike' && !currentTopDir && availableTopDirs.length > 0) {
                 logUI('State settled with empty topDir for mike. Emitting ui:renderFileList to show selector.');
                 // This event tells the actual list component to re-render its content
                 eventBus.emit('ui:renderFileList'); 
            } else if (!currentTopDir && !currentUser.isAuthenticated) {
                 // Also explicitly trigger re-render if logged out and at root
                 logUI('State settled with empty topDir (logged out). Emitting ui:renderFileList.');
                 eventBus.emit('ui:renderFileList'); 
            } else {
                 // For other cases, the listingLoaded event should have handled the render
                 logUI('State settled, standard listing expected.');
            }
        } catch (error) {
             logUI(`Error during stateSettled check for selector: ${error.message}`, 'error');
        }
    }

    handleLoadingStateChange(eventData) {
        logUI(`Event received: loadingStateChanged. isLoading=${eventData?.isLoading}, isSaving=${eventData?.isSaving}`);
        this.updateActionButtonsState(); // Still useful for save button state
    }

    // --- UI Update Functions --- 
    updateBreadcrumbs() {
        const container = this.elements.breadcrumbContainer;
        if (!container) return; // Don't try to update if container doesn't exist

        try {
            const topDir = getCurrentTopLevelDirectory();
            const relativePath = getCurrentRelativePath();
            const currentFile = getCurrentFile(); // May not be used in breadcrumbs but good to have

            let html = '';
            
            // 1. Root Element (Always present)
            html += `<a href="#" id="breadcrumb-root" title="Go to Root Selection / User Directory">📁 Root</a>`; 

            // 2. Top Level Directory (if selected)
            if (topDir) {
                html += ` <span class="breadcrumb-separator">/</span> `;
                // Link to the top-level directory itself (empty relative path)
                 html += `<a href="#" data-target-top="${topDir}" data-target-relative="">${topDir}</a>`;

                // 3. Relative Path Parts (if any)
                if (relativePath) {
                    const pathParts = relativePath.split('/').filter(p => p);
                    let currentBuiltPath = '';
                    pathParts.forEach((part, index) => {
                        currentBuiltPath = currentBuiltPath ? `${currentBuiltPath}/${part}` : part;
                        html += ` <span class="breadcrumb-separator">/</span> `;
                        // Link to the intermediate directory
                         html += `<a href="#" data-target-top="${topDir}" data-target-relative="${currentBuiltPath}">${part}</a>`;
                    });
                }
                 
                // 4. Current File (if selected - shown as text, not link)
                 if (currentFile) {
                     html += ` <span class="breadcrumb-separator">/</span> `;
                     html += `<span class="breadcrumb-current">${currentFile}</span>`;
                 }
            } else {
                 // Indicate that no directory is selected (optional)
                 html += ` <span class="breadcrumb-current">(Select a directory)</span>`;
            }


            container.innerHTML = html;
             logUI(`Breadcrumbs updated: Top='${topDir}', Rel='${relativePath}', File='${currentFile}'`);
        } catch (error) {
             logUI(`Error updating breadcrumbs: ${error.message}`, 'error');
             if (container) container.innerHTML = '<span class="error">Error loading path</span>';
        }
    }

    updateActionButtonsState() {
        const saveButton = this.elements.saveBtn;
        if (!saveButton) {
             logUI('Save button not found for state update.', 'warning');
        } else {
             try {
                 const hasTopDir = !!getCurrentTopLevelDirectory();
                 const hasFile = !!getCurrentFile();
                 const isLoading = getIsLoading();
                 const canSave = hasTopDir && hasFile && !isLoading;
                 saveButton.disabled = !canSave;
                 logUI(`Save button state updated. Disabled: ${!canSave} (Reason: ${isLoading ? 'loading' : (!hasFile ? 'no file' : (!hasTopDir ? 'no dir' : 'can save' ))})`);
             } catch (error) {
                  logUI(`Error updating save button state: ${error.message}`, 'error');
                  if (saveButton) saveButton.disabled = true; // Disable on error
             }
        }
    }

    // ADDED: Breadcrumb Listener Setup
    setupBreadcrumbListener() {
        const container = this.elements.breadcrumbContainer;
        if (!container) {
             logUI('Breadcrumb container not found. Listener not attached.', 'warning');
             return;
        }

        container.addEventListener('click', (event) => {
            const clickedElement = event.target.closest('a'); // Find the nearest anchor link clicked
            if (!clickedElement) return; // Ignore clicks not on links

            const rootLink = clickedElement.id === 'breadcrumb-root';
            const isPathLink = clickedElement.dataset.targetTop !== undefined || clickedElement.dataset.targetRelative !== undefined;

            if (rootLink) {
                event.preventDefault();
                logUI('[UI] Root breadcrumb clicked.');
                const currentUser = authState.get();

                if (currentUser.isAuthenticated) {
                    if (currentUser.username.toLowerCase() === 'mike') {
                        logUI('[UI] User is mike, requesting top-level dir selector.');
                        // Emit a request for the selector view, fileManager will handle state reset
                        eventBus.emit('ui:requestTopLevelSelector'); 
                    } else {
                        logUI(`[UI] User is ${currentUser.username}, navigating to user directory.`);
                        // Prevent redundant navigation if already there
                         const currentTopDir = getCurrentTopLevelDirectory(); 
                         const currentRelPath = getCurrentRelativePath();
                         if (currentTopDir !== currentUser.username || currentRelPath !== '') {
                            eventBus.emit('navigate:topLevelDir', { directory: currentUser.username });
                         } else {
                            logUI('[UI] Already at user directory root. No action.');
                         }
                    }
                } else {
                    logUI('[UI] User not authenticated, navigating to root selection.');
                    eventBus.emit('navigate:root');
                }
            } else if (isPathLink) {
                event.preventDefault();
                const targetTop = clickedElement.dataset.targetTop || ''; // Default to empty string if not present
                const targetRelative = clickedElement.dataset.targetRelative || '';
                logUI(`[UI] Breadcrumb part clicked: Top='${targetTop}', Rel='${targetRelative}'`);
                eventBus.emit('navigate:absolute', { topLevelDir: targetTop, relativePath: targetRelative });
            }
        });
        logUI('[UI] Breadcrumb click listener attached.');
    }
}

// --- Initialization & Instance Export ---
logUI('Creating UIManager instance...');
const uiManager = new UIManager();
logUI('UIManager instance created.');

// Removed DOMContentLoaded listener

// --- Exports ---
export default uiManager;

// Removed specific exports like showSystemInfo if not needed
// export const showSystemInfo = () => uiManager.showSystemInfo(); 