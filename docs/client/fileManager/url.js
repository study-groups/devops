/**
 * URL State Management
 * Handles updating the URL with the current file system state
 */

import { logMessage } from '../log/index.js';

// Add missing lastUrlUpdate variable to track when the URL was last updated
let lastUrlUpdate = 0;

// Map of display names to internal IDs
const displayToId = {
    'Community Files': 'Community_Files'
};

// Map of internal IDs to display names
const idToDisplay = {
    'Community_Files': 'Community Files'
};

/**
 * Update the URL state with the current file system state
 */
export function updateUrlState(params = {}) {
    try {
        // Throttle URL updates to avoid excessive history entries
        const now = Date.now();
        if (now - lastUrlUpdate < 500) {
            return;
        }
        lastUrlUpdate = now;
        
        const urlParams = new URLSearchParams(window.location.search);
        
        // Handle directory and file params
        if (params.dir) urlParams.set('dir', params.dir);
        if (params.file) urlParams.set('file', params.file);
        
        // Handle removal of params
        if (params.dir === null) urlParams.delete('dir');
        if (params.file === null) urlParams.delete('file');
        
        // Update URL without page reload
        const newUrl = `?${urlParams.toString()}`;
        window.history.replaceState(null, '', newUrl);
        
        logMessage(`[FILES DEBUG] Updated URL: ${newUrl}`);
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to update URL: ${error.message}`);
    }
}

/**
 * Get directory ID from URL parameter
 */
export function getDirectoryIdFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const dirParam = urlParams.get('dir');
        
        if (!dirParam) return null;
        
        // Convert display name to ID if needed
        return displayToId[dirParam] || dirParam;
    } catch (error) {
        logMessage('[FILES ERROR] Failed to get directory from URL: ' + error.message);
        return null;
    }
}

/**
 * Get file name from URL parameter
 */
export function getFileFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('file');
    } catch (error) {
        logMessage('[FILES ERROR] Failed to get file from URL: ' + error.message);
        return null;
    }
} 