/**
 * FileSystem State Manager
 * Handles persistence of user's filesystem context (directory, file, etc.)
 */

import { logMessage } from './log/index.js';

// Update the defaultState to include URL parameters if available
const defaultState = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        currentDir: urlParams.get('dir') || '',
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
    
    // URL parameters take precedence over stored state
    const mergedState = {
      ...defaultState,
      ...state,
      currentDir: urlParams.get('dir') || state.currentDir || defaultState.currentDir,
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
 * Get recent files
 */
export function getRecentFiles() {
  const state = loadFileSystemState();
  return state.recentFiles || [];
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

/**
 * Debug filesystem state
 */
export function debugFileSystemState() {
  try {
    const state = loadFileSystemState();
    logMessage('[FS STATE DEBUG] Current state: ' + JSON.stringify(state));
    
    // Check localStorage directly
    const rawState = localStorage.getItem('fileSystemState');
    logMessage('[FS STATE DEBUG] Raw localStorage: ' + rawState);
    
    // Check legacy storage
    const lastDir = localStorage.getItem('lastDir');
    const lastFile = localStorage.getItem('lastFile');
    logMessage(`[FS STATE DEBUG] Legacy storage: lastDir=${lastDir}, lastFile=${lastFile}`);
    
    return state;
  } catch (error) {
    logMessage('[FS STATE DEBUG] Error debugging state: ' + error.message);
    return null;
  }
}

/**
 * Get the full filesystem context
 */
export function getFileSystemContext() {
  return loadFileSystemState();
}

/**
 * Get current directory
 */
export function getCurrentDirectory() {
  const state = loadFileSystemState();
  return state.currentDir || '';
}