/**
 * fileSystemState.js
 * Handles persistence of user's filesystem context (directory, file, etc.)
 */
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

// Helper for logging within this module
function logFS(message, level = 'text') {
    const prefix = '[FS STATE]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

const STATE_KEY = 'fileSystemState';

/**
 * Load filesystem state from localStorage
 */
export function loadFileSystemState() {
  try {
    const savedState = localStorage.getItem(STATE_KEY);
    if (savedState) {
      const state = JSON.parse(savedState);
      logFS(`Loaded state: ${JSON.stringify(state)}`);
      return state;
    } else {
        logFS('No saved file system state found.');
    }
  } catch (error) {
    logFS(`Error loading file system state: ${error.message}`, 'error');
  }
  // Return default state if loading fails or no state exists
  return { currentDir: '', currentFile: '', recentFiles: [], lastModified: null }; 
}

/**
 * Save filesystem state to localStorage
 */
export function saveFileSystemState(state) {
  try {
    const currentState = loadFileSystemState();
    const newState = { ...currentState, ...state, lastModified: Date.now() };
    
    localStorage.setItem(STATE_KEY, JSON.stringify(newState));
    
    // Log the saved state for debugging
    logFS(`Saved state: ${JSON.stringify(newState)}`);
    
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
    logFS(`Error saving file system state: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Update current directory
 * @deprecated Use fileManager.changeDirectory() instead
 */
export function setCurrentDirectory(dir) {
  logFS('[FS STATE WARN] setCurrentDirectory is deprecated. Use fileManager.changeDirectory()', 'warning');
  return saveFileSystemState({ currentDir: dir });
}

/**
 * Update current file
 * @deprecated Use fileManager.loadFile() instead
 */
export function setCurrentFile(file) {
  logFS('[FS STATE WARN] setCurrentFile is deprecated. Use fileManager.loadFile()', 'warning');
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
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem('currentDir'); // Keep legacy clear for safety
    localStorage.removeItem('currentFile');
    logFS('Cleared file system state from localStorage.');
    
    // Emit event
    eventBus.emit('fileSystem:cleared');
    
    return true;
  } catch (error) {
    logFS(`Error clearing file system state: ${error.message}`, 'error');
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