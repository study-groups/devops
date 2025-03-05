// appInit.js - Central initialization for the entire application
// Handles all startup tasks in a coordinated way

import { logState, logMessage, initLogVisibility, forceLogHidden } from './log.js';
import { authState, handleLogin } from './auth.js';
import { appName, appVer } from './config.js';
import { initializeUI } from './uiManager.js';
import { debugUI, testApiEndpoints, debugFileOperations, debugApiResponses, testFileLoading } from './debug.js';
import { debugFileSystemState } from './fileSystemState.js';
import { initCommunityLink } from './components/communityLink.js';
import { restoreLoginState } from './authManager.js';
import { initializeFileManager } from './fileManager.js';
import { UI_STATES, setUIState } from './uiState.js';
// import { testAuthStatus } from './authManager.js';

// Track initialization state
let initialized = false;

// Main initialization function
export function initializeApp() {
    if (initialized) {
        console.log('[APP] App already initialized, skipping');
        return;
    }

    initLogVisibility();
    initialized = true;
}

// Initialize all localStorage-based settings
function initLocalStorageSettings() {
    console.log('[APP] Starting localStorage initialization');
    
    // DEBUG: Show all localStorage at startup
    console.log('[APP] All localStorage at startup:');
    try {
        const allStorage = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            allStorage[key] = localStorage.getItem(key);
        }
        console.log('[APP] localStorage:', allStorage);
    } catch (e) {
        console.log('[APP] Error accessing localStorage:', e);
    }
    
    // Use the imported initLogVisibility from log.js - this respects localStorage
    console.log('[APP] Calling initLogVisibility from log.js');
    initLogVisibility();
    
    // Initialize view mode from localStorage
    console.log('[APP] Initializing view mode');
    initViewMode();
    
    // Initialize other localStorage settings as needed
    // ...
    
    console.log('[APP] LocalStorage settings initialized');
    logMessage('[APP] LocalStorage settings initialized');
}

// Initialize view mode from localStorage
function initViewMode() {
    const savedView = localStorage.getItem('viewMode') || 'split';
    
    // Apply the saved view mode
    const viewButtons = {
        'code': document.getElementById('code-view'),
        'split': document.getElementById('split-view'),
        'preview': document.getElementById('preview-view')
    };
    
    // Remove active class from all buttons
    Object.values(viewButtons).forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    
    // Add active class to the saved view button
    if (viewButtons[savedView]) {
        viewButtons[savedView].classList.add('active');
    }
    
    // Apply the view mode to the UI
    document.body.setAttribute('data-view-mode', savedView);
    
    console.log(`[APP] View mode initialized from localStorage: ${savedView}`);
}

// Register global functions for debugging and other purposes
function registerGlobalFunctions() {
    // Debug functions
    window.debugUI = debugUI;
    window.testApiEndpoints = testApiEndpoints;
    window.debugFileOperations = debugFileOperations;
    window.debugApiResponses = debugApiResponses;
    window.testFileLoading = testFileLoading;
    window.debugFileSystemState = debugFileSystemState;
    // Remove or correct this line if testAuthStatus is not available
    // window.testAuthStatus = testAuthStatus;
    
    // Make app config available globally
    window.APP_CONFIG = {
        name: appName,
        version: appVer,
        buildDate: new Date().toISOString().split('T')[0]
    };
    
    // Register the showAppInfo function
    window.showAppInfo = showAppInfo;
    
    console.log('[APP] Global functions registered');
}

// Show application information
function showAppInfo() {
    logMessage('\n=== APPLICATION INFORMATION ===');
    logMessage(`Name: ${appName}`);
    logMessage(`Version: ${appVer}`);
    logMessage(`Build Date: ${window.APP_CONFIG.buildDate}`);
    logMessage('================================');
}

// Update app info in the UI
function updateAppInfo() {
    const appInfo = document.getElementById('app-info');
    if (appInfo) {
        appInfo.textContent = `${appName} ${appVer}`;
    }
}

// Initialize UI components
function initUIComponents() {
    // Initialize main UI system
    initializeUI();
    
    // Initialize community link component
    initCommunityLink();
    
    logMessage('[APP] All UI components initialized');
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // All initialization happens here
    initializeApp();
    const isLoggedIn = await restoreLoginState();
    initializeUI(); // This would include calling initializeTopNav()
    
    if (isLoggedIn) {
        // Fetch system info
        try {
            const { fetchSystemInfo } = await import('./uiState.js');
            await fetchSystemInfo();
        } catch (error) {
            console.warn('[APP] Failed to fetch system info during initialization:', error.message);
            // Continue anyway - the UI will use fallback values
        }
        
        await initializeFileManager();
        setUIState(UI_STATES.USER);
    } else {
        setUIState(UI_STATES.LOGIN);
    }
    
    // Set up login button handler
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            // DYNAMIC IMPORT FOUND: This should be changed
            // const { handleLogin } = await import('./auth.js'); // No longer needed
            // Should be: import('$lib/auth.js')
            await handleLogin(username, password);
        });
    }

    // Listen for the login event and initialize file manager and set UI state
    document.addEventListener('auth:login', async (event) => {
        // Fetch system info after login
        try {
            const { fetchSystemInfo } = await import('./uiState.js');
            await fetchSystemInfo();
        } catch (error) {
            console.warn('[APP] Failed to fetch system info after login:', error.message);
            // Continue anyway - the UI will use fallback values
        }
        
        await initializeFileManager();
        setUIState(UI_STATES.USER, { username: event.detail.username });
    });

    // Listen for logout event and set UI state
    document.addEventListener('auth:logout', () => {
        setUIState(UI_STATES.LOGIN);
    });

    // Initialize the community link component
    console.log('[APP] DOM loaded, initializing components');
    
    // Initialize the community link component
    try {
        initCommunityLink();
        console.log('[APP] Community link component initialized');
    } catch (error) {
        console.error('[APP] Error initializing community link component:', error);
    }
});

// Add a final check but DON'T override the localStorage value
window.addEventListener('load', () => {
    console.log('[APP] Window loaded, checking for localStorage conflicts');
    
    // Wait a bit to ensure all other initialization is complete
    setTimeout(() => {
        // Read current localStorage value
        const storedVisibility = localStorage.getItem('logVisible');
        console.log('[APP] FINAL CHECK - localStorage logVisible:', storedVisibility);
        
        // CRITICAL: Ensure UI reflects localStorage without triggering saveState()
        if (storedVisibility === 'true' && !logState.visible) {
            console.log('[APP] *** FIXING UI: Making log visible based on localStorage ***');
            
            // Temporarily disable saveState
            const originalSaveState = logState.saveState;
            logState.saveState = function() {
                console.log('[APP] State save PREVENTED during visibility fix');
            };
            
            // Update both logState and UI - this will fix button state too
            logState.visible = true;
            logState.updateUI();
            
            // Restore originalSaveState
            setTimeout(() => {
                logState.saveState = originalSaveState;
                console.log('[APP] Normal state saving restored after visibility fix');
            }, 100);
            
        } else if (storedVisibility === 'false' && logState.visible) {
            console.log('[APP] *** FIXING UI: Making log hidden based on localStorage ***');
            
            // Temporarily disable saveState
            const originalSaveState = logState.saveState;
            logState.saveState = function() {
                console.log('[APP] State save PREVENTED during visibility fix');
            };
            
            // Update both logState and UI - this will fix button state too
            logState.visible = false;
            logState.updateUI();
            
            // Restore originalSaveState
            setTimeout(() => {
                logState.saveState = originalSaveState;
                console.log('[APP] Normal state saving restored after visibility fix');
            }, 100);
        } else {
            console.log('[APP] UI already matches localStorage value:', 
                       (storedVisibility === 'true') ? 'visible' : 'hidden');
        }
        
        // Final verification
        console.log('[APP] After window.load fixes:');
        console.log('[APP] - logState.visible =', logState.visible);
        console.log('[APP] - localStorage.logVisible =', localStorage.getItem('logVisible'));
        console.log('[APP] - Log button state =', document.getElementById('log-btn')?.classList.contains('active'));
    }, 300);
});

// Export for direct use
export default { initializeApp }; 