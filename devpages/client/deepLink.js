/**
 * deepLink.js - Handles deep linking functionality and post-login redirection
 */
import { logMessage } from '/client/log/index.js';
import { appStore } from '/client/appState.js';
import eventBus from '/client/eventBus.js';

const DEEP_LINK_KEY = 'deepLinkRequest';

// Helper for logging
function logDeepLink(message, level = 'text') {
    const type = 'DEEP_LINK';
    // Use window.logMessage if available, otherwise fallback to console
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

/**
 * Save the current URL parameters for restoration after login
 */
export function saveDeepLinkRequest() {
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = urlParams.get('pathname');
    
    // Only save if a pathname is specified
    if (pathname) {
        const deepLinkData = {
            pathname,
            timestamp: Date.now() // Add timestamp for potential expiration handling
        };
        
        localStorage.setItem(DEEP_LINK_KEY, JSON.stringify(deepLinkData));
        logDeepLink(`Saved request: ${JSON.stringify(deepLinkData)}`);
    } else {
        logDeepLink('No pathname parameter found to save.');
    }
}

/**
 * Check for and retrieve a saved deep link request
 * @returns {Object|null} The saved deep link data or null if none exists
 */
export function getSavedDeepLinkRequest() {
    try {
        const savedData = localStorage.getItem(DEEP_LINK_KEY);
        if (!savedData) return null;
        
        const deepLinkData = JSON.parse(savedData);
        
        // Validate the data structure
        if (!deepLinkData.pathname) {
            logDeepLink(`Saved deep link data is invalid or missing pathname: ${savedData}`, 'warning');
            return null;
        }
        
        return deepLinkData;
    } catch (error) {
        logDeepLink(`Error retrieving saved request: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Clear the saved deep link request
 */
export function clearSavedDeepLinkRequest() {
    localStorage.removeItem(DEEP_LINK_KEY);
    logDeepLink('Cleared saved request');
}

/**
 * Restore navigation to a saved deep link if one exists
 * @returns {boolean} True if navigation was initiated, false otherwise
 */
export function restoreDeepLinkNavigation() {
    const savedRequest = getSavedDeepLinkRequest();
    if (!savedRequest || !savedRequest.pathname) return false;
    
    logDeepLink(`Restoring navigation to pathname: '${savedRequest.pathname}'`);
    
    // Use the eventBus to navigate to the saved pathname
    if (window.eventBus && typeof window.eventBus.emit === 'function') {
        // The isDirectory flag will be determined by handleNavigateToPathname
        const isDirectory = !/\.[^/]+$/.test(savedRequest.pathname);
        logDeepLink(`Emitting navigate:pathname with isDirectory=${isDirectory}`);
        
        window.eventBus.emit('navigate:pathname', {
            pathname: savedRequest.pathname,
            isDirectory: isDirectory
        });
        
        // Clear the saved request after navigation
        clearSavedDeepLinkRequest();
        return true;
    }
    
    logDeepLink('EventBus not available, cannot restore navigation', 'warning');
    return false;
}

/**
 * Initialize deep link handling by checking URL parameters
 */
export function initDeepLinkHandler() {
    const urlParams = new URLSearchParams(window.location.search);
    const dir = urlParams.get('dir');
    
    // If there's a dir parameter, check if we need to save it for post-login
    if (dir) {
        // Check if user is logged in by accessing appState directly
        const authState = appStore.getState().auth;
        if (!authState.isLoggedIn && authState.authChecked) {
            // User is not logged in but auth check is complete, save the deep link
            saveDeepLinkRequest();
            logDeepLink('URL parameters saved for post-login navigation');
        }
    }
}

export function generateDeepLink() {
    logMessage('Generating deep link...', 'debug');
    const currentState = appStore.getState();
    const currentFile = currentState.file?.currentFile;
    const currentDir = currentState.file?.currentDirectory;
    
    // --- 2. Set Initial View Mode ---
    const viewModeParam = urlParams.get('view');
    if (viewModeParam && ['editor', 'preview', 'split'].includes(viewModeParam)) {
        logMessage(`Deep link: Setting view mode to '${viewModeParam}'`, 'info');
        // Update central state directly
        appStore.update(currentState => ({
            ui: { ...currentState.ui, viewMode: viewModeParam }
        }));
    }
}

export default {
    initDeepLinkHandler,
    restoreDeepLinkNavigation,
    saveDeepLinkRequest,
    getSavedDeepLinkRequest,
    clearSavedDeepLinkRequest
}; 