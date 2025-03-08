// appInit.js - Central initialization for the entire application
// Handles all startup tasks in a coordinated way

import { logState, logMessage, initLogVisibility, forceLogHidden } from './log/index.js';
import { authState, handleLogin, initializeAuth } from './auth.js';
import { appName, appVer } from './config.js';
import { initializeUI } from './uiManager.js';
import { debugUI, testApiEndpoints, debugFileOperations, debugApiResponses, testFileLoading } from './debug.js';
import { debugFileSystemState } from './fileSystemState.js';
import { initCommunityLink } from './components/communityLink.js';
import { restoreLoginState } from './authManager.js';
import { initializeFileManager } from './fileManager.js';
import { UI_STATES, setUIState } from './uiState.js';
import { initializeEditor } from './editor.js';

// GLOBAL INITIALIZATION FLAG - prevent any other initialization
window.__APP_INITIALIZED = false;
window.__INITIALIZATION_IN_PROGRESS = false;

// Main initialization function
let initialized = false;
export async function initializeApp() {
    // Prevent re-initialization
    if (initialized) {
        console.log('[APP] Already initialized, skipping');
        return;
    }
    
    // Prevent concurrent initialization
    if (window.__INITIALIZATION_IN_PROGRESS) {
        console.log('[APP] Initialization already in progress, skipping');
        return;
    }
    
    // Set global initialization lock
    window.__INITIALIZATION_IN_PROGRESS = true;
    
    try {
        console.log('[APP] ====== STARTING APPLICATION INITIALIZATION ======');
        logMessage('[APP] Starting application initialization...');
        
        // PHASE 1: Core systems
        initLogVisibility();
        initLocalStorageSettings();
        registerGlobalFunctions();
        
        // PHASE 2: Auth state
        logMessage('[APP] Restoring authentication state...');
        const isLoggedIn = await restoreLoginState();
        logMessage(`[APP] Login state restored: ${isLoggedIn ? 'logged in' : 'logged out'}`);
        
        // PHASE 3: Core UI components in correct order
        logMessage('[APP] Initializing core systems...');
        await initializeAuth();
        await initializeUI();
        await initializeEditor();
        
        // PHASE 4: Conditional systems based on auth state
        if (isLoggedIn) {
            logMessage('[APP] User is logged in, initializing file system...');
            await initializeFileManager();
            setUIState(UI_STATES.USER);
        } else {
            logMessage('[APP] User is not logged in, setting login UI state...');
            setUIState(UI_STATES.LOGIN);
        }
        
        // PHASE 5: Additional components
        logMessage('[APP] Initializing additional components...');
        try {
            await initCommunityLink();
        } catch (error) {
            console.warn('[APP] Failed to initialize community link:', error.message);
        }
        
        // PHASE 6: Register global event handlers
        setupGlobalEventHandlers();
        
        // Initialization complete
        initialized = true;
        window.__APP_INITIALIZED = true;
        window.__INITIALIZATION_IN_PROGRESS = false;
        logMessage('[APP] ====== APPLICATION INITIALIZATION COMPLETE ======');
        
    } catch (error) {
        console.error('[APP] Fatal initialization error:', error);
        logMessage(`[APP ERROR] Initialization failed: ${error.message}`);
        window.__INITIALIZATION_IN_PROGRESS = false;
    }
}

// Register single global event handler for auth state changes
function setupGlobalEventHandlers() {
    // Clean up any existing handlers
    const oldHandlers = window.__EVENT_HANDLERS || {};
    
    // Auth login event
    if (oldHandlers.authLogin) {
        document.removeEventListener('auth:login', oldHandlers.authLogin);
    }
    
    // Create handler with marking to prevent duplicate processing
    const handleAuthLogin = async (event) => {
        // Check if this event has already been handled
        if (event.detail.handled) {
            console.log('[APP] Auth login event already handled, skipping');
            return;
        }
        
        // Mark as handled
        event.detail.handled = true;
        
        try {
            logMessage('[APP] Auth login event received');
            
            // Initialize file manager if needed
            await initializeFileManager();
            setUIState(UI_STATES.USER, { username: event.detail.username });
        } catch (error) {
            console.error('[APP] Error handling login event:', error);
        }
    };
    
    // Auth logout event
    if (oldHandlers.authLogout) {
        document.removeEventListener('auth:logout', oldHandlers.authLogout);
    }
    
    const handleAuthLogout = () => {
        logMessage('[APP] Auth logout event received');
        setUIState(UI_STATES.LOGIN);
    };
    
    // Register new handlers
    document.addEventListener('auth:login', handleAuthLogin);
    document.addEventListener('auth:logout', handleAuthLogout);
    
    // Store handlers for future cleanup
    window.__EVENT_HANDLERS = {
        authLogin: handleAuthLogin,
        authLogout: handleAuthLogout
    };
    
    logMessage('[APP] Global event handlers registered');
}

// Initialize localStorage settings once
function initLocalStorageSettings() {
    logMessage('[APP] Initializing localStorage settings');
    
    // Clear URL parameters if they contain sensitive data
    const url = new URL(window.location.href);
    if (url.searchParams.has('username') || url.searchParams.has('password')) {
        url.searchParams.delete('username');
        url.searchParams.delete('password');
        window.history.replaceState({}, document.title, url.toString());
        logMessage('[APP] Removed sensitive data from URL');
    }
    
    // Initialize view mode from localStorage
    const savedView = localStorage.getItem('viewMode') || 'split';
    document.body.setAttribute('data-view-mode', savedView);
    
    // Update view buttons
    const viewButtons = {
        'code': document.getElementById('code-view'),
        'split': document.getElementById('split-view'),
        'preview': document.getElementById('preview-view')
    };
    
    Object.entries(viewButtons).forEach(([mode, btn]) => {
        if (btn) {
            btn.classList.toggle('active', mode === savedView);
        }
    });
    
    logMessage('[APP] LocalStorage settings initialized');
}

// Register global debugging functions
function registerGlobalFunctions() {
    window.debugUI = debugUI;
    window.testApiEndpoints = testApiEndpoints;
    window.debugFileOperations = debugFileOperations;
    window.debugApiResponses = debugApiResponses;
    window.testFileLoading = testFileLoading;
    window.debugFileSystemState = debugFileSystemState;
    window.showAppInfo = showAppInfo;
    
    window.APP_CONFIG = {
        name: appName,
        version: appVer,
        buildDate: new Date().toISOString().split('T')[0]
    };
    
    logMessage('[APP] Global functions registered');
}

// Show application information
function showAppInfo() {
    logMessage('\n=== APPLICATION INFORMATION ===');
    logMessage(`Name: ${appName}`);
    logMessage(`Version: ${appVer}`);
    logMessage(`Build Date: ${window.APP_CONFIG?.buildDate || new Date().toISOString().split('T')[0]}`);
    logMessage('================================');
}

// CRITICAL: The ONLY DOMContentLoaded handler
function setupInitialization() {
    // Remove any existing initialization handlers
    if (window.__INIT_HANDLER) {
        document.removeEventListener('DOMContentLoaded', window.__INIT_HANDLER);
        window.removeEventListener('load', window.__LOAD_HANDLER);
    }
    
    // Define initialization handler
    const initHandler = () => {
        console.log('[APP] DOM ready, starting initialization');
        
        // Cancel any existing initialization attempts from other modules
        if (window.__APP_TIMEOUTS) {
            window.__APP_TIMEOUTS.forEach(timeout => clearTimeout(timeout));
        }
        window.__APP_TIMEOUTS = [];
        
        // Start initialization
        initializeApp();
    };
    
    // Store the handler for potential cleanup
    window.__INIT_HANDLER = initHandler;
    
    // Register the handler based on document state
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHandler);
        console.log('[APP] Waiting for DOMContentLoaded event');
    } else {
        console.log('[APP] Document already loaded, initializing immediately');
        setTimeout(initHandler, 0);
    }
    
    // Add a fallback handler for window.load
    const loadHandler = () => {
        if (!initialized && !window.__INITIALIZATION_IN_PROGRESS) {
            console.log('[APP] Window loaded but app not initialized, starting initialization');
            initializeApp();
        }
    };
    
    window.__LOAD_HANDLER = loadHandler;
    window.addEventListener('load', loadHandler);
}

// Start initialization process
setupInitialization();

// Export for direct use
export default { initializeApp }; 