/**
 * fileSystemState.js
 * Handles persistence of user's filesystem context (directory, file, etc.)
 */
import { logMessage } from '/client/log/index.js';
import { eventBus } from '/client/eventBus.js';

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
    // Return default state on error to prevent breaking
    return { currentDir: '', currentFile: '', recentFiles: [] };
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
    if (state.currentDir !== undefined) localStorage.setItem('currentDir', state.currentDir);
    if (state.currentFile !== undefined) localStorage.setItem('currentFile', state.currentFile);
    
    // Emit events for state changes
    if (state.currentDir !== undefined && state.currentDir !== currentState.currentDir) {
        eventBus.emit('fileSystem:directoryChanged', state.currentDir);
    }
    if (state.currentFile !== undefined && state.currentFile !== currentState.currentFile) {
        eventBus.emit('fileSystem:fileChanged', state.currentFile);
    }
    
    return true;
  } catch (error) {
    logMessage('[FS STATE ERROR] Failed to save state: ' + error.message);
    return false;
  }
}

/**
 * Update current directory
 * @deprecated Use fileManager.changeDirectory() instead
 */
export function setCurrentDirectory(dir) {
  logMessage('[FS STATE WARN] setCurrentDirectory is deprecated. Use fileManager.changeDirectory()', 'warning');
  return saveFileSystemState({ currentDir: dir });
}

/**
 * Update current file
 * @deprecated Use fileManager.loadFile() instead
 */
export function setCurrentFile(file) {
  logMessage('[FS STATE WARN] setCurrentFile is deprecated. Use fileManager.loadFile()', 'warning');
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
    localStorage.removeItem('currentDir'); // Keep legacy clear for safety
    localStorage.removeItem('currentFile');
    logMessage('[FS STATE] Cleared state');
    
    // Emit event
    eventBus.emit('fileSystem:cleared');
    
    return true;
  } catch (error) {
    logMessage('[FS STATE ERROR] Failed to clear state: ' + error.message);
    return false;
  }
}

// Export functions needed by other modules
export default {
  loadState: loadFileSystemState,
  saveState: saveFileSystemState,
  getCurrentDirectory,
  getCurrentFile,
  clearState: clearFileSystemState,
  // Deprecated, keep for potential backward compat issues temporarily
  setCurrentDirectory,
  setCurrentFile
}; 