/**
 * fileSystemState.js
 * Handles persistence/loading of the filesystem context, prioritizing URL parameters.
 */
import { pathJoin } from '/client/utils/pathUtils.js'; // Assuming path utils exist

// Helper for logging
function logFS(message, level = 'text') {
    const type = 'FS_STATE';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

// We might not store anything here anymore if URL is the primary source
// const STATE_KEY = 'devpages_fsState'; // Keep key if needed for other settings later

/**
 * Load the initial filesystem path, prioritizing the URL 'pathname' parameter.
 * Returns { initialPathname: string | null }
 */
export function loadState() {
    try {
        // Get parameters from URL
        const params = new URLSearchParams(window.location.search);
        const pathname = params.get('pathname') || null;
        
        // Better detection of file vs directory
        let isDirectorySelected = true; // Default assumption
        if (pathname) {
            // Consider it a file if it has an extension
            isDirectorySelected = !/\.[^/]+$/.test(pathname);
        }
        
        return { 
            initialPathname: pathname,
            isDirectorySelected 
        };
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
    logFS(`saveState called (currently no-op): ${JSON.stringify(stateToSave)}`);
    return true;
}

/**
 * Clear persisted state (if any existed).
 */
export function clearState() {
    // No state currently persisted, but clear any legacy keys if needed.
    // try {
    //     localStorage.removeItem(STATE_KEY);
    //     logFS('Cleared file system state from localStorage.');
    // } catch (error) {
    //     logFS(`Error clearing file system state: ${error.message}`, 'error');
    //     return false;
    // }
    logFS('clearState called (currently no-op).');
    return true;
}

// Export functions needed by other modules
export default {
    loadState,
    saveState,
    clearState
}; 