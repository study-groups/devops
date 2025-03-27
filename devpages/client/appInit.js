// appInit.js - Central initialization for the entire application
// Handles all startup tasks in a coordinated way

import { logState, logMessage, initLogVisibility, forceLogHidden } from './log/index.js';
import { AUTH_STATE, initAuth } from './core/auth.js';
import { appName, appVer } from './config.js';
import { initializeUI } from './uiManager.js';
import { debugUI, testApiEndpoints, debugFileOperations, debugApiResponses, testFileLoading } from './debug.js';
import { debugFileSystemState } from './fileManager/fileSystemState.js';
import { initCommunityLink } from './components/communityLink.js';
import { restoreLoginState } from './core/auth.js';
import { initializeFileManager } from './fileManager/index.js';
import { UI_STATES, setUIState } from './uiState.js';
import { initializeEditor } from './editor.js';
import { eventBus } from './eventBus.js';
import { initViewControls } from './core/views.js';

// For backwards compatibility
const authState = AUTH_STATE;

// GLOBAL INITIALIZATION FLAG - prevent any other initialization
// window.__APP_INITIALIZED = false; // Keep these commented or remove if bootstrap.js handles state
// window.__INITIALIZATION_IN_PROGRESS = false;

// Main initialization function
let initialized = false; // This flag is local to appInit.js

export async function initializeApp() {
    // --- MORE ROBUST CHECK ---
    // If bootstrap.js has started (created window.APP), stop appInit.js immediately.
    if (typeof window.APP !== 'undefined') {
        console.warn('[appInit.js] Bootstrap process detected (window.APP exists). Halting legacy appInit.js execution.');
        return; // Stop right here
    }
    // --- END ROBUST CHECK ---


    // Original check (can keep as secondary guard)
    // if (window.APP?.initializing || window.APP?.initialized) {
    //    console.warn('[appInit.js] Bootstrap process detected. Skipping legacy appInit.js execution.');
    //    return;
    // }

    // Prevent re-initialization using appInit's local flag
    if (initialized) {
        console.log('[APP] Already initialized, skipping');
        return;
    }

    // Prevent concurrent initialization (using a different flag than bootstrap.js)
    if (window.__LEGACY_INITIALIZATION_IN_PROGRESS) {
        console.log('[APP] Legacy appInit initialization already in progress, skipping');
        return;
    }

    // Set legacy initialization lock
    window.__LEGACY_INITIALIZATION_IN_PROGRESS = true;

    try {
        console.log('[APP] Starting application initialization...');
        
        // PHASE 1: Core systems
        // initLogVisibility(); // CRITICAL: Comment this out or wrap in check
        // It's safer to let bootstrap.js handle this call exclusively.
        console.log('[APP] Skipping initLogVisibility in legacy init.');
        registerGlobalFunctions();
        
        // PHASE 2: Auth state
        console.log('[APP] Restoring authentication state (legacy)...');
        const isLoggedIn = await restoreLoginState();
        console.log(`[APP] Login state restored (legacy): ${isLoggedIn ? 'logged in' : 'logged out'}`);
        
        // PHASE 3: Core UI components in correct order
        console.log('[APP] Initializing core systems (legacy)...');
        await initAuth();
        await initializeUI();
        await initializeEditor();
        
        // PHASE 4: Initialize file manager based on auth state
        if (isLoggedIn) {
            console.log('[APP] User is logged in, initializing file system...');
            await initializeFileManager();
            setUIState(UI_STATES.USER);
        } else {
            console.log('[APP] User is not logged in, setting login UI state...');
            setUIState(UI_STATES.LOGIN);
        }
        
        // PHASE 5: Additional components
        console.log('[APP] Initializing additional components...');
        try {
            await initCommunityLink();
        } catch (error) {
            console.warn('[APP] Failed to initialize community link:', error.message);
        }
        
        // PHASE 6: Register global event handlers
        setupGlobalEventHandlers();
        
        // Initialization complete
        initialized = true;
        // window.__APP_INITIALIZED = true; // Don't set bootstrap's flag
        window.__LEGACY_INITIALIZATION_IN_PROGRESS = false;
        eventBus.emit('app:initialized');
        console.log('[APP] Application initialization complete');

    } catch (error) {
        console.error('[APP ERROR - LEGACY] Initialization failed:', error);
        window.__LEGACY_INITIALIZATION_IN_PROGRESS = false;
        eventBus.emit('app:error', { error });
    } finally {
        // Ensure flag is cleared even if error occurs
        window.__LEGACY_INITIALIZATION_IN_PROGRESS = false;
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
        if (event.detail.handled) {
            console.log('[APP] Auth login event already handled, skipping');
            return;
        }
        event.detail.handled = true;
        try {
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
        console.log('[APP] Auth logout event received');
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
    
    console.log('[APP] Global event handlers registered');
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
    
    console.log('[APP] Global functions registered');
}

// Show application information
function showAppInfo() {
    console.log('\n=== APPLICATION INFORMATION ===');
    console.log(`Name: ${appName}`);
    console.log(`Version: ${appVer}`);
    console.log(`Build Date: ${window.APP_CONFIG?.buildDate || new Date().toISOString().split('T')[0]}`);
    console.log('================================');
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
// setupInitialization(); // COMMENT OUT THIS LINE

// Export for direct use
// export default { initializeApp }; // COMMENT OUT THIS LINE 

// Add this function to help debug view button issues
export function checkViewButtonHandlers() {
    console.log('[DEBUG] Checking view button handlers');
    
    const buttons = ['code-view', 'split-view', 'preview-view'];
    
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            console.log(`[DEBUG] Found button: ${id}`);
            
            // Create a test click to check for handlers
            const testEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            
            // Check if the event is being prevented (has handlers)
            const hasHandlers = !btn.dispatchEvent(testEvent);
            console.log(`[DEBUG] Button ${id} has handlers: ${hasHandlers}`);
            
            // Alternative approach: directly check for listeners (Chrome only)
            if (window.getEventListeners) {
                const listeners = window.getEventListeners(btn);
                console.log(`[DEBUG] Button ${id} event listeners:`, listeners);
            }
        } else {
            console.warn(`[DEBUG] Button not found: ${id}`);
        }
    });
}

// Call the check function after a short delay
setTimeout(checkViewButtonHandlers, 2000); 