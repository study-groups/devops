/**
 * fileSystemState.js
 * Handles persistence/loading of the filesystem context, prioritizing URL parameters.
 */
import { pathJoin } from '/client/utils/pathUtils.js'; // Assuming path utils exist
// Legacy fileReducer.js no longer exists - implement loadLastOpened locally

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('FileSystemState');

/**
 * Load last opened file from localStorage (replaces legacy fileReducer function)
 */
function loadLastOpened() {
    try {
        const saved = localStorage.getItem('devpages_lastOpened');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.warn('[FileSystemState] Failed to load last opened from localStorage:', error);
    }
    return null;
}

// We might not store anything here anymore if URL is the primary source
// const STATE_KEY = 'devpages_fsState'; // Keep key if needed for other settings later

/**
 * Load the initial filesystem path, prioritizing the URL 'pathname' parameter.
 * If no URL parameter, falls back to localStorage for last opened file.
 * Returns { initialPathname: string | null, isDirectorySelected: boolean }
 */
export function loadState() {
    try {
        // Get parameters from URL first (highest priority)
        const params = new URLSearchParams(window.location.search);
        const pathname = params.get('pathname') || null;
        
        // Better detection of file vs directory
        let isDirectorySelected = true; // Default assumption
        if (pathname) {
            // Consider it a file if it has an extension
            isDirectorySelected = !/\.[^/]+$/.test(pathname);
            console.log(`[FileSystemState] Loaded pathname from URL: "${pathname}" (${isDirectorySelected ? 'directory' : 'file'})`);
            return { 
                initialPathname: pathname,
                isDirectorySelected 
            };
        }
        
        // If no URL parameter, try to restore from localStorage
        const lastOpened = loadLastOpened();
        if (lastOpened && lastOpened.pathname) {
            console.log(`[FileSystemState] No URL parameter, restored from localStorage: "${lastOpened.pathname}" (${lastOpened.isDirectory ? 'directory' : 'file'})`);
            return {
                initialPathname: lastOpened.pathname,
                isDirectorySelected: lastOpened.isDirectory
            };
        }
        
        console.log('[FileSystemState] No URL parameter or localStorage data, starting fresh');
        return { initialPathname: null, isDirectorySelected: true };
    } catch (error) {
        console.error("Error loading file system state:", error);
        return { initialPathname: null, isDirectorySelected: true };
    }
}

/**
 * Save state - currently does nothing as URL parameters are preferred for persistence.
 * Can be extended later if specific non-URL state needs saving.
 * @param {object} stateToSave - Object containing state properties to potentially save.
 */
export function saveState(stateToSave) {
    // No-op for now - state is reflected in URL parameters by fileManager
    log.info('FS_STATE', 'SAVE_STATE', `saveState called (currently no-op): ${JSON.stringify(stateToSave)}`);
    return true;
}

/**
 * Clear persisted state (if any existed).
 */
export function clearState() {
    // No state currently persisted, but clear any legacy keys if needed.
    // try {
    //     localStorage.removeItem(STATE_KEY);
    //     log.info('FS_STATE', 'CLEAR_STATE_SUCCESS', 'Cleared file system state from localStorage.');
    // } catch (error) {
    //     log.error('FS_STATE', 'CLEAR_STATE_ERROR', `Error clearing file system state: ${error.message}`, error);
    //     return false;
    // }
    log.info('FS_STATE', 'CLEAR_STATE', 'clearState called (currently no-op).');
    return true;
}

// Export functions needed by other modules
export default {
    loadState,
    saveState,
    clearState
}; 