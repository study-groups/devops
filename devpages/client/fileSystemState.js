/**
 * fileSystemState.js
 * Handles persistence of the core user filesystem context (top-level directory, file).
 * Reads initial state prioritizing URL parameters over localStorage.
 */
import { eventBus } from '/client/eventBus.js';

// Helper for logging
function logFS(message, level = 'text') {
    const prefix = '[FS STATE]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

const STATE_KEY = 'devpages_fsState'; // Use a unique key

/**
 * Load the initial filesystem state, prioritizing URL parameters.
 * Returns { currentDir, currentFile, currentRelativePath }
 */
export function loadState() {
    const urlParams = new URLSearchParams(window.location.search);
    const dirFromUrl = urlParams.get('dir') || '';
    const fileFromUrl = urlParams.get('file') || '';
    // Get relative path from URL 'path' parameter
    const relativePathFromUrl = urlParams.get('path') || '';

    // --- Prioritize URL parameters ---
    if (dirFromUrl || fileFromUrl || relativePathFromUrl) {
        logFS(`Initializing state from URL: dir='${dirFromUrl}', path='${relativePathFromUrl}', file='${fileFromUrl}'`);
        // Return state based purely on URL for consistency on reload
        return {
            currentDir: dirFromUrl,
            currentFile: fileFromUrl,
            currentRelativePath: relativePathFromUrl // Pass this along
            // Note: We don't load recentFiles from localStorage when using URL params
            // to ensure the URL represents the exact state requested.
        };
    }

    // --- If no relevant URL params, THEN try localStorage ---
    logFS('No relevant URL params found, attempting to load from localStorage.');
    try {
        const savedState = localStorage.getItem(STATE_KEY);
        if (savedState) {
            const state = JSON.parse(savedState);
            logFS(`Loaded state from localStorage: ${JSON.stringify(state)}`);
            // Ensure essential fields exist, provide defaults
            return {
                currentDir: state.currentDir || '',
                currentFile: state.currentFile || '',
                // Relative path is generally NOT persisted, it's derived from navigation
                // or potentially the URL 'path' param (handled above). Default to empty.
                currentRelativePath: '',
                // recentFiles: state.recentFiles || [], // Could optionally load recent files
                // lastModified: state.lastModified || null
            };
        } else {
            logFS('No saved state found in localStorage.');
        }
    } catch (error) {
        logFS(`Error loading file system state from localStorage: ${error.message}`, 'error');
    }

    // --- Fallback to default empty state ---
    logFS('Returning default empty state.');
    return { currentDir: '', currentFile: '', currentRelativePath: '' };
}

/**
 * Save the essential filesystem state (currentDir, currentFile) to localStorage.
 * @param {object} stateToSave - Object containing { currentDir, currentFile } properties to save.
 */
export function saveState(stateToSave) {
    if (typeof stateToSave !== 'object' || stateToSave === null) {
        logFS('Invalid state provided to saveState.', 'error');
        return false;
    }

    try {
        // Load existing state only to potentially merge non-provided fields if needed (e.g., recentFiles)
        // For now, we only care about saving currentDir and currentFile explicitly passed.
        let stateToStore = {};
        const existingStateRaw = localStorage.getItem(STATE_KEY);
        if (existingStateRaw) {
            try {
                 stateToStore = JSON.parse(existingStateRaw);
            } catch { /* ignore parsing error, start fresh */ }
        }


        // Update only the relevant fields provided in stateToSave
        if (stateToSave.currentDir !== undefined) {
            stateToStore.currentDir = stateToSave.currentDir;
        }
        if (stateToSave.currentFile !== undefined) {
            stateToStore.currentFile = stateToSave.currentFile;
        }
        // Add timestamp
        stateToStore.lastModified = Date.now();
        // Note: currentRelativePath is NOT saved.

        localStorage.setItem(STATE_KEY, JSON.stringify(stateToStore));
        logFS(`Saved state to localStorage: ${JSON.stringify(stateToStore)}`);
        return true;
    } catch (error) {
        logFS(`Error saving file system state to localStorage: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Clear filesystem state from localStorage (used during logout).
 */
export function clearState() {
    try {
        localStorage.removeItem(STATE_KEY);
        logFS('Cleared file system state from localStorage.');
        // Optionally emit an event, though fileManager clearing its state might be enough
        // eventBus.emit('fileSystem:cleared');
        return true;
    } catch (error) {
        logFS(`Error clearing file system state: ${error.message}`, 'error');
        return false;
    }
}

// Export functions needed by other modules
export default {
    loadState,
    saveState,
    clearState
}; 