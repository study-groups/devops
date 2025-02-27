// state.js - Handles file system state management
import { 
    loadFileSystemState,
    saveFileSystemState,
    setCurrentDirectory,
    setCurrentFile,
    getFileSystemContext,
    getCurrentDirectory
} from '../fileSystemState.js';
import { logMessage } from '../log.js';

let currentDir = '';
const lastUrlUpdate = { dir: '', file: '' };

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

// Re-export main state functions
export {
    loadFileSystemState,
    saveFileSystemState,
    setCurrentDirectory,
    setCurrentFile,
    getCurrentDirectory
};

// Note: Legacy state functions have been removed in favor of fileSystemState.js 