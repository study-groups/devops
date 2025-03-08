/**
 * File System State Management
 * Handles persistence of user's filesystem context (directory, file, etc.)
 */

import { logMessage } from '../log/index.js';

// Directory name mappings
const displayToId = {
    'Community Files': 'Community_Files'
};

// Update the defaultState to include URL parameters if available
const defaultState = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dirParam = urlParams.get('dir');
    
    // Convert display name to ID if needed
    const dirId = dirParam ? (displayToId[dirParam] || dirParam) : '';
    
    return {
        currentDir: dirId,
        currentFile: urlParams.get('file') || '',
        recentFiles: [],
        lastModified: Date.now()
    };
})();

// Maximum number of recent files to track
const MAX_RECENT_FILES = 10;

/**
 * Load filesystem state from localStorage
 */
export function loadFileSystemState() {
    try {
        const state = JSON.parse(localStorage.getItem('fileSystemState') || '{}');
        const urlParams = new URLSearchParams(window.location.search);
        const dirParam = urlParams.get('dir');
        
        // Convert display name to ID if needed
        const dirId = dirParam ? (displayToId[dirParam] || dirParam) : '';
        
        // URL parameters take precedence over stored state
        const mergedState = {
            ...defaultState,
            ...state,
            currentDir: dirId || state.currentDir || defaultState.currentDir,
            currentFile: urlParams.get('file') || state.currentFile || defaultState.currentFile,
            recentFiles: state.recentFiles || defaultState.recentFiles
        };
        
        logMessage('[FS STATE] Loaded state: ' + JSON.stringify(mergedState));
        return mergedState;
    } catch (error) {
        logMessage('[FS STATE ERROR] Failed to load state: ' + error.message);
        return defaultState;
    }
}

/**
 * Save filesystem state to localStorage
 */
export function saveFileSystemState(state) {
    try {
        const currentState = loadFileSystemState();
        const newState = { ...currentState, ...state, lastModified: Date.now() };
        
        localStorage.setItem('fileSystemState', JSON.stringify(newState));
        
        // Log the saved state for debugging
        logMessage('[FS STATE] Saved state: ' + JSON.stringify(newState));
        
        return true;
    } catch (error) {
        logMessage('[FS STATE ERROR] Failed to save state: ' + error.message);
        return false;
    }
}

/**
 * Update current directory
 */
export function setCurrentDirectory(dir) {
    // Convert display name to ID if needed
    const dirId = displayToId[dir] || dir;
    return saveFileSystemState({ currentDir: dirId });
}

/**
 * Update current file
 */
export function setCurrentFile(file) {
    const state = loadFileSystemState();
    
    // Update recent files list
    let recentFiles = [...state.recentFiles];
    
    // Remove if already exists
    recentFiles = recentFiles.filter(f => f !== file);
    
    // Add to beginning
    recentFiles.unshift(file);
    
    // Limit to max size
    if (recentFiles.length > MAX_RECENT_FILES) {
        recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
    }
    
    return saveFileSystemState({ 
        currentFile: file,
        recentFiles
    });
}

/**
 * Get current directory
 */
export function getCurrentDirectory() {
    const state = loadFileSystemState();
    return state.currentDir || '';
}

// Keep only URL-specific functionality
export function getLastUrlUpdate() {
    return lastUrlUpdate;
}

export function updateUrlState(dir, file) {
    // Check if this is a duplicate update
    if (lastUrlUpdate.dir === dir && lastUrlUpdate.file === file) {
        logMessage('[FILES DEBUG] Skipping duplicate URL update');
        return;
    }
    
    // Update the URL
    const url = new URL(window.location.href);
    url.searchParams.set('dir', dir || '');
    url.searchParams.set('file', file || '');
    window.history.replaceState({}, '', url.toString());
    
    // Save the last update
    lastUrlUpdate.dir = dir;
    lastUrlUpdate.file = file;
    
    logMessage(`[FILES] URL updated: dir=${dir}, file=${file}`);
}

// Note: Legacy state functions have been removed in favor of fileSystemState.js 