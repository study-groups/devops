/**
 * FileSystem State Manager
 * Handles persistence of user's filesystem context (directory, file, etc.)
 * 
 * Moved from client/fileSystemState.js to client/fileManager/fileSystemState.js
 * for better file organization
 */

import { logMessage } from '../log/index.js';

// Get URL parameters if available
const urlParams = new URLSearchParams(window.location.search);
const defaultState = {
    currentDir: urlParams.get('dir') || '',
    currentFile: urlParams.get('file') || '',
    recentFiles: [],
    lastModified: Date.now()
};

// Maximum number of recent files to track
const MAX_RECENT_FILES = 10;

/**
 * Load filesystem state from localStorage
 */
export function loadFileSystemState() {
  try {
    const state = JSON.parse(localStorage.getItem('fileSystemState') || '{}');
    const urlParams = new URLSearchParams(window.location.search);
    
    // URL parameters take precedence over stored state
    const mergedState = {
      ...defaultState,
      ...state,
      currentDir: urlParams.get('dir') || state.currentDir || defaultState.currentDir,
      currentFile: urlParams.get('file') || state.currentFile || defaultState.currentFile,
    };
    
    logMessage('[FS STATE] Loaded state: ' + JSON.stringify(mergedState));
    return mergedState;
  } catch (error) {
    logMessage('[FS STATE ERROR] Failed to load state: ' + error.message);
    return { currentDir: '', currentFile: '' };
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
    
    // Also update legacy storage for backward compatibility
    if (state.currentDir) localStorage.setItem('lastDir', state.currentDir);
    if (state.currentFile) localStorage.setItem('lastFile', state.currentFile);
    
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
  return saveFileSystemState({ currentDir: dir });
}

/**
 * Update current file
 */
export function setCurrentFile(file) {
  const state = loadFileSystemState();
  
  // Update recent files list
  let recentFiles = [...(state.recentFiles || [])];
  
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

/**
 * Get current file
 */
export function getCurrentFile() {
  const state = loadFileSystemState();
  return state.currentFile || '';
}

/**
 * Clear filesystem state (used during logout)
 */
export function clearFileSystemState() {
  try {
    localStorage.removeItem('fileSystemState');
    localStorage.removeItem('lastDir');
    localStorage.removeItem('lastFile');
    logMessage('[FS STATE] Cleared state');
    return true;
  } catch (error) {
    logMessage('[FS STATE ERROR] Failed to clear state: ' + error.message);
    return false;
  }
}

// Export a simplified API for direct use from global context
window.fileSystem = {
  getDirectory: getCurrentDirectory,
  getFile: getCurrentFile,
  setDirectory: setCurrentDirectory,
  setFile: setCurrentFile,
  saveState: (dir, file) => {
    if (dir) setCurrentDirectory(dir);
    if (file) setCurrentFile(file);
  },
  clearState: clearFileSystemState
};


// Add event listener to directory select
const dirSelect = document.getElementById('dir-select');
if (dirSelect) {
  dirSelect.addEventListener('change', async function() {
    const selectedDir = this.value;
    if (selectedDir) {
      console.log(`[FS DEBUG] Directory select changed to: ${selectedDir}`);
      window.fileSystem.setDirectory(selectedDir);
      
      // Try to find loadFiles function
      if (typeof loadFiles === 'function') {
        await loadFiles(selectedDir);
      } else if (window.fileSystem && typeof window.fileSystem.loadFiles === 'function') {
        await window.fileSystem.loadFiles(selectedDir);
      } else {
        console.log('[FS DEBUG] loadFiles function not found');
      }
    }
  });
} 