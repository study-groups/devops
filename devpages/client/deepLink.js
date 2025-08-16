/**
 * deepLink.js - Handles deep linking functionality and post-login redirection
 */
import { logMessage } from '/client/log/index.js';
import { appStore } from '/client/appState.js';
import { pathThunks } from '/client/store/slices/pathSlice.js';
import eventBus from '/client/eventBus.js';
import { storageService } from '/client/services/storageService.js';

const log = window.APP.services.log.createLogger('DeepLink');
const DEEP_LINK_KEY = 'deepLinkRequest';

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
        
        storageService.setItem(DEEP_LINK_KEY, deepLinkData);
        log.info('DEEP_LINK', 'SAVED_REQUEST', `Saved request: ${JSON.stringify(deepLinkData)}`);
    } else {
        log.info('DEEP_LINK', 'NO_PATHNAME', 'No pathname parameter found to save.');
    }
}

/**
 * Check for and retrieve a saved deep link request
 * @returns {Object|null} The saved deep link data or null if none exists
 */
export function getSavedDeepLinkRequest() {
    try {
        const savedData = storageService.getItem(DEEP_LINK_KEY);
        if (!savedData) return null;
        
        const deepLinkData = savedData;
        
        // Validate the data structure
        if (!deepLinkData.pathname) {
            log.warn('DEEP_LINK', 'INVALID_DATA', `Saved deep link data is invalid or missing pathname: ${savedData}`);
            return null;
        }
        
        return deepLinkData;
    } catch (error) {
        log.error('DEEP_LINK', 'RETRIEVE_ERROR', `Error retrieving saved request: ${error.message}`, error);
        return null;
    }
}

/**
 * Clear the saved deep link request
 */
export function clearSavedDeepLinkRequest() {
    storageService.removeItem(DEEP_LINK_KEY);
    log.info('DEEP_LINK', 'CLEARED_REQUEST', 'Cleared saved request');
}

/**
 * Restore navigation to a saved deep link if one exists
 * @returns {boolean} True if navigation was initiated, false otherwise
 */
export function restoreDeepLinkNavigation() {
    const savedRequest = getSavedDeepLinkRequest();
    if (!savedRequest || !savedRequest.pathname) return false;
    
    log.info('DEEP_LINK', 'RESTORING_NAVIGATION', `Restoring navigation to pathname: '${savedRequest.pathname}'`);
    
    // Use the Redux thunk to navigate to the saved pathname
    const isDirectory = !/\.[^/]+$/.test(savedRequest.pathname);
    log.info('DEEP_LINK', 'DISPATCHING_NAVIGATION', `Dispatching navigateToPath with isDirectory=${isDirectory}`);
    
    appStore.dispatch(pathThunks.navigateToPath({
        pathname: savedRequest.pathname,
        isDirectory: isDirectory
    }));
    
    // Clear the saved request after navigation
    clearSavedDeepLinkRequest();
    return true;
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
        if (!authState.isAuthenticated && authState.authChecked) {
            // User is not logged in but auth check is complete, save the deep link
            saveDeepLinkRequest();
            log.info('DEEP_LINK', 'URL_PARAMS_SAVED', 'URL parameters saved for post-login navigation');
        }
    }
}

export function generateDeepLink() {
    log.debug('DEEP_LINK', 'GENERATE', 'Generating deep link...');
    const currentState = appStore.getState();
    const currentFile = currentState.file?.currentFile;
    const currentDir = currentState.file?.currentDirectory;
    
    // --- 2. Set Initial View Mode ---
    const viewModeParam = urlParams.get('view');
    if (viewModeParam && ['editor', 'preview', 'split'].includes(viewModeParam)) {
        log.info('DEEP_LINK', 'SET_VIEW_MODE', `Deep link: Setting view mode to '${viewModeParam}'`);
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