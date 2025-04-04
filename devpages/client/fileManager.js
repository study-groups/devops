/**
 * fileManager.js
 * Single source of truth for file system operations
 */
import { logMessage } from '/client/log/index.js';
import { eventBus } from '/client/eventBus.js';
import { getContent, setContent } from '/client/editor.js';
import * as fileSystemState from '/client/fileSystemState.js';

// State
const fileState = {
  currentDirectory: '',
  currentFile: '',
  isInitialized: false,
  filesLoaded: false,
  isLoading: false
};

// Cache
const directoryCache = new Map();
const fileContentCache = new Map();

/**
 * Get auth headers safely without circular dependencies
 */
function getAuthHeaders() {
  try {
    const storedAuth = localStorage.getItem('authState');
    if (storedAuth) {
      const parsed = JSON.parse(storedAuth);
      if (parsed.isLoggedIn && parsed.username && parsed.hashedPassword) {
        return {
          'Authorization': `Basic ${btoa(`${parsed.username}:${parsed.hashedPassword}`)}`
        };
      }
    }
  } catch (e) {
    logMessage('[FILEMGR] Error retrieving auth headers from localStorage');
  }
  
  return {};
}

/**
 * Initialize the file manager
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} Success status
 */
export async function initializeFileManager(options = {}) {
  if (fileState.isInitialized && !options.force) {
    logMessage('[FILEMGR] Already initialized, skipping');
    return true;
  }
  
  logMessage('[FILEMGR] Initializing file manager');
  
  try {
    // First restore state from localStorage using fileSystemState
    restoreState();
    
    // Ensure authentication is restored before loading directories
    try {
      // Use dynamic import for auth ONLY if needed, prefer localStorage check
      let auth = null;
      const authStateLocal = JSON.parse(localStorage.getItem('authState') || '{}');
      if (!authStateLocal.isLoggedIn) {
          logMessage('[FILEMGR] Auth state not loaded locally, attempting dynamic import and restore...');
          auth = await import('/client/auth.js');
          if (typeof auth.restoreLoginState === 'function') {
              await auth.restoreLoginState();
          }
      }
    } catch (authError) {
      logMessage(`[FILEMGR WARNING] Auth restoration failed: ${authError.message}`, 'warning');
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load available directories first
    await loadDirectories();
    
    // Apply URL parameters if they exist
    const urlParams = new URLSearchParams(window.location.search);
    const urlDir = urlParams.get('dir');
    const urlFile = urlParams.get('file');
    
    if (urlDir) {
      logMessage(`[FILEMGR] URL has directory parameter: ${urlDir}`);
      fileState.currentDirectory = getDirectoryIdFromDisplayName(urlDir);
      // Ensure state is saved if loaded from URL
      saveState();
    }
    
    if (urlFile) {
      logMessage(`[FILEMGR] URL has file parameter: ${urlFile}`);
      fileState.currentFile = urlFile;
       // Ensure state is saved if loaded from URL
      saveState();
    }
    
    // Initialize UI elements
    initializeFileSelector();
    
    // Set up directory select listener (moved from fileSystemState)
    setupDirectorySelectListener();
    
    // If we have a current directory, load its files
    if (fileState.currentDirectory) {
      try {
        await loadFiles(fileState.currentDirectory);
        
        // If we have a current file, load it
        if (fileState.currentFile) {
          try {
            await loadFile(fileState.currentFile, fileState.currentDirectory);
          } catch (error) {
            // File couldn't be loaded, clear the current file but continue initialization
            logMessage(`[FILEMGR WARNING] Could not load previously selected file: ${error.message}. Clearing selection.`);
            fileState.currentFile = '';
            saveState(); // Save cleared state
            // Update URL to remove the file parameter
            updateUrlParameters(fileState.currentDirectory);
          }
        }
      } catch (error) {
        // Directory couldn't be loaded, clear both directory and file but continue initialization
        logMessage(`[FILEMGR WARNING] Could not load previously selected directory: ${error.message}. Clearing selection.`);
        fileState.currentDirectory = '';
        fileState.currentFile = '';
        saveState(); // Save cleared state
        // Clear URL parameters
        updateUrlParameters();
      }
    }
    
    fileState.isInitialized = true;
    eventBus.emit('fileManager:initialized', { state: { ...fileState } });
    logMessage('[FILEMGR] File manager initialized');
    return true;
  } catch (error) {
    console.error('[FILEMGR ERROR]', error);
    logMessage(`[FILEMGR ERROR] Initialization failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Load files for a directory
 * @param {string} directory - Directory to load files from
 * @returns {Promise<string[]>} List of files
 */
export async function loadFiles(directory) {
  if (!directory) {
    logMessage('[FILEMGR WARNING] No directory specified for loadFiles', 'warning');
    return [];
  }
  
  logMessage(`[FILEMGR] Loading files from directory: ${directory}`);
  
  try {
    // Get auth headers from local helper function
    const authHeaders = getAuthHeaders();
    
    // Try multiple endpoints in sequence until one works
    const endpoints = [
      `/api/files/list?dir=${encodeURIComponent(directory)}`,
      `/api/files?dir=${encodeURIComponent(directory)}`,
      `/api/markdown/files?dir=${encodeURIComponent(directory)}`,
      `/api/markdown/list?dir=${encodeURIComponent(directory)}`
    ];
    
    let response = null;
    let files = null;
    let successEndpoint = null;
    
    for (const endpoint of endpoints) {
      try {
        logMessage(`[FILEMGR] Trying endpoint: ${endpoint}`);
        
        const resp = await fetch(endpoint, {
          headers: authHeaders
        });
        
        if (resp.ok) {
          response = resp;
          successEndpoint = endpoint;
          break;
        }
      } catch (err) {
        // Continue to next endpoint
        logMessage(`[FILEMGR] Endpoint ${endpoint} failed: ${err.message}`);
      }
    }
    
    if (!response) {
      throw new Error('All API endpoints failed');
    }
    
    // Parse the response
    const filesData = await response.json();
    logMessage(`[FILEMGR] Successfully loaded files using endpoint: ${successEndpoint}`);
    
    // Extract filenames from the response
    if (Array.isArray(filesData)) {
      if (typeof filesData[0] === 'string') {
        files = filesData;
      } else if (typeof filesData[0] === 'object') {
        if (filesData[0].name) {
          files = filesData.map(file => file.name);
        } else if (filesData[0].filename) {
          files = filesData.map(file => file.filename);
        }
      }
    } else if (typeof filesData === 'object') {
      files = Object.keys(filesData);
    }
    
    if (!files) {
      files = [];
    }
    
    // Update the file selector
    updateFileSelector(files);
    
    logMessage(`[FILEMGR] Loaded ${files.length} files`);
    return files;
  } catch (error) {
    console.error('[FILEMGR ERROR]', error);
    logMessage(`[FILEMGR ERROR] Failed to load files: ${error.message}`, 'error');
    
    // Clear the file selector on error
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
      fileSelect.innerHTML = '<option value="">Select File</option>';
    }
    
    return [];
  }
}

/**
 * Load a single file
 * @param {string} filename - File to load
 * @param {string} directory - Directory containing the file (optional, uses current directory if not specified)
 * @returns {Promise<boolean>} Success status
 */
export async function loadFile(filename, directory = null) {
  directory = directory || fileState.currentDirectory;
  
  if (!filename || !directory) {
    logMessage('[FILEMGR ERROR] Missing filename or directory', 'error');
    return false;
  }
  
  logMessage(`[FILEMGR] Loading file: ${filename} from ${directory}`);
  
  try {
    // Get auth headers
    const authHeaders = getAuthHeaders();
    
    // Use the one endpoint that matches your server
    const endpoint = `/api/files/content?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(directory)}`;
    
    const response = await fetch(endpoint, {
      headers: authHeaders
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    
    // Set the content in the editor
    setContent(content);
    
    // Update state and UI
    fileState.currentFile = filename;
    fileState.currentDirectory = directory;
    saveState();
    updateUrlParameters(directory, filename);
    
    // Dispatch events
    eventBus.emit('fileManager:fileLoaded', { filename, directory, content });
    document.dispatchEvent(new CustomEvent('file:loaded', {
      detail: { filename, directory, content }
    }));
    
    return true;
  } catch (error) {
    logMessage(`[FILEMGR ERROR] Failed to load file: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Save a file
 * @param {string} filename - File to save
 * @param {string} directory - Directory to save to (optional, uses current directory if not specified)
 * @param {string} content - Content to save (optional, uses current editor content if not specified)
 * @returns {Promise<boolean>} Success status
 */
export async function saveFile(filename = null, directory = null, content = null) {
  filename = filename || fileState.currentFile;
  directory = directory || fileState.currentDirectory;
  content = content || getContent();
  
  if (!filename || !directory) {
    logMessage('[FILEMGR ERROR] Missing filename or directory', 'error');
    return false;
  }
  
  logMessage(`[FILEMGR] Saving file: ${filename} to ${directory}`);
  
  try {
    const api = await import('/client/api.js'); // Use $lib alias
    const response = await api.saveFileContent(filename, directory, content);
    
    if (!response.ok) {
      throw new Error(`Failed to save file: ${response.status} ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    logMessage(`[FILEMGR ERROR] Failed to save file: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Load available directories
 * @returns {Promise<string[]>} List of directories
 */
export async function loadDirectories() {
  logMessage('[FILEMGR] Loading directories');
  
  try {
    // Get auth headers from local helper function
    const authHeaders = getAuthHeaders();
    
    // Fetch from API with auth headers
    const response = await fetch('/api/files/dirs', {
      headers: authHeaders
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load directories: ${response.status} ${response.statusText}`);
    }
    
    const directories = await response.json();
    
    // Update the directory selector - Now handled by UIManager
    // updateDirectorySelector(directories);
    
    // Update internal cache
    directoryCache.clear();
    directories.forEach(dir => directoryCache.set(dir, true));
    
    logMessage(`[FILEMGR] Fetched ${directories.length} directories`);
    return directories;
  } catch (error) {
    console.error('[FILEMGR ERROR]', error);
    logMessage(`[FILEMGR ERROR] Failed to load directories: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Change the current directory
 * @param {string} directory - Directory to change to
 * @returns {Promise<boolean>} Success status
 */
export async function changeDirectory(directory) {
  if (!directory) {
    logMessage('[FILEMGR ERROR] No directory specified', 'error');
    return false;
  }
  
  if (directory === fileState.currentDirectory) {
    logMessage(`[FILEMGR] Already in directory: ${directory}`);
    return true;
  }
  
  logMessage(`[FILEMGR] Changing directory to: ${directory}`);
  
  // Update internal state first
  fileState.currentDirectory = directory;
  fileState.currentFile = ''; // Reset file when changing directory
  saveState();
  
  // Load files from the new directory
  const files = await loadFiles(directory);
  
  if (files) { // Check if loading was successful (even if empty list)
    // Update URL
    updateUrlParameters(directory);
    
    // Emit events
    eventBus.emit('fileManager:directoryChanged', { 
      directory, 
      previousDirectory: fileState.currentDirectory 
    });
    
    // Also dispatch to DOM for backward compatibility
    document.dispatchEvent(new CustomEvent('directory:changed', {
      detail: { directory }
    }));
    
    return true;
  }
  
  return false;
}

// Helper functions

/**
 * Initialize the file selector
 */
function initializeFileSelector() {
  const fileSelector = document.getElementById('file-select');
  if (!fileSelector) {
    logMessage('[FILEMGR WARNING] File selector not found', 'warning');
    return;
  }
  
  // Clear existing options and add placeholder
  fileSelector.innerHTML = '<option value="">Select File</option>';
  
  // Add event listener
  fileSelector.addEventListener('change', async (event) => {
    const selectedFile = event.target.value;
    if (!selectedFile) return;
    
    await loadFile(selectedFile);
  });
  
  logMessage('[FILEMGR] File selector initialized');
}

/**
 * Update the file selector with available files
 * @param {Array} files - Array of files
 * @param {string} selectedFile - File to select
 */
function updateFileSelector(files, selectedFile = null) {
  const fileSelector = document.getElementById('file-select');
  if (!fileSelector) {
    logMessage('[FILEMGR WARNING] File selector not found', 'warning');
    return;
  }
  
  // Store current selected value to preserve it if nothing else is specified
  const currentValue = selectedFile || fileSelector.value || fileState.currentFile;
  
  // Clear existing options and add placeholder
  fileSelector.innerHTML = '<option value="">Select File</option>';
  
  // Add options for each file
  files.forEach(file => {
    const option = document.createElement('option');
    option.value = typeof file === 'string' ? file : file.name;
    option.textContent = typeof file === 'string' ? file : file.name;
    fileSelector.appendChild(option);
  });
  
  // Set the selected value
  if (currentValue && files.includes(currentValue)) {
    selectFileInDropdown(currentValue);
  }
  
  logMessage(`[FILEMGR] File selector updated with ${files.length} files`);
}

/**
 * Select a file in the dropdown
 * @param {string} filename - File to select
 */
function selectFileInDropdown(filename) {
  if (!filename) return;
  
  const fileSelector = document.getElementById('file-select');
  if (!fileSelector) return;
  
  // Try to set the value
  fileSelector.value = filename;
  
  // If it wasn't set, find the option and select it manually
  if (fileSelector.value !== filename) {
    const option = Array.from(fileSelector.options).find(opt => opt.value === filename);
    if (option) {
      option.selected = true;
    }
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for auth:restored event to reload directories/state
  eventBus.on('auth:restored', async (data) => {
    logMessage('[FILEMGR] Auth restored, ensuring file manager state is consistent.');
    // Reload directories and potentially the current file based on restored state
    if (fileState.isInitialized) {
       await loadDirectories();
       if(fileState.currentDirectory) {
          await loadFiles(fileState.currentDirectory);
          if(fileState.currentFile) {
             await loadFile(fileState.currentFile, fileState.currentDirectory);
          }
       }
    } else {
        // If not initialized yet, initialization flow should handle it
        logMessage('[FILEMGR] Not initialized yet, init flow will handle state restoration.');
    }
  });
  
  // Listen for auth:logout event to clear file system state
  eventBus.on('auth:logout', () => {
    clearFileSystemState();
  });
  
  // Listen for fileSystem:directorySelected event (from fileSystemState or UI manager)
  eventBus.on('fileSystem:directorySelected', async (selectedDir) => {
      logMessage(`[FILEMGR] Received directorySelected event: ${selectedDir}`);
      await changeDirectory(selectedDir);
  });
  
  // Listen for file:loaded to update internal state
  // Note: This might be redundant if loadFile always calls saveState
  eventBus.on('fileManager:fileLoaded', (data) => {
    const { filename, directory } = data;
    fileState.currentFile = filename;
    fileState.currentDirectory = directory;
    // saveState(); // Redundant? loadFile already calls saveState
  });

  // DOM listener for file:loaded (backward compatibility)
  document.addEventListener('file:loaded', (event) => {
    const { filename, directory } = event.detail;
    fileState.currentFile = filename;
    fileState.currentDirectory = directory;
    saveState();
  });
}

/**
 * Get display name for a directory
 * @param {string} directory - Directory ID
 * @returns {string} Display name
 */
function getDirectoryDisplayName(directory) {
  if (!directory) return '';
  
  // Handle special cases
  switch (directory) {
    case 'Community_Files':
      return 'Community Files';
    default:
      return directory;
  }
}

/**
 * Get directory ID from display name
 * @param {string} displayName - Display name
 * @returns {string} Directory ID
 */
function getDirectoryIdFromDisplayName(displayName) {
  if (!displayName) return '';
  
  // Handle special cases
  switch (displayName) {
    case 'Community Files':
      return 'Community_Files';
    default:
      return displayName;
  }
}

/**
 * Save the current state using fileSystemState module
 */
function saveState() {
  try {
    fileSystemState.saveState({
      currentDir: fileState.currentDirectory,
      currentFile: fileState.currentFile
    });
    logMessage('[FILEMGR] File system state saved via fileSystemState');
  } catch (error) {
    console.error('[FILEMGR ERROR]', error);
    logMessage(`[FILEMGR ERROR] Failed to save state: ${error.message}`, 'error');
  }
}

/**
 * Restore state using fileSystemState module
 */
function restoreState() {
  try {
    const state = fileSystemState.loadFileSystemState();
    
    if (state.currentDir) {
      fileState.currentDirectory = state.currentDir;
    }
    
    if (state.currentFile) {
      fileState.currentFile = state.currentFile;
    }
    
    logMessage(`[FILEMGR] State restored from fileSystemState: dir=${state.currentDir || ''}, file=${state.currentFile || ''}`);
  } catch (error) {
    console.error('[FILEMGR ERROR]', error);
    logMessage(`[FILEMGR ERROR] Failed to restore state: ${error.message}`, 'error');
  }
}

/**
 * Update URL parameters for directory and file
 * @param {string} directory - Directory
 * @param {string} file - File
 */
function updateUrlParameters(directory, file = null) {
  try {
      const url = new URL(window.location.href);
    
      // Set directory parameter, using display name for better readability
      if (directory) {
        url.searchParams.set('dir', getDirectoryDisplayName(directory));
      } else {
        url.searchParams.delete('dir');
      }
      
      // Set file parameter if provided
      if (file) {
        url.searchParams.set('file', file);
      } else {
        url.searchParams.delete('file');
      }
      
      // Update URL without reloading the page
      window.history.replaceState({}, document.title, url.toString());
      
      logMessage('[FILEMGR] URL parameters updated');
  } catch(e) {
      logMessage(`[FILEMGR ERROR] Failed to update URL parameters: ${e.message}`, 'error');
  }
}

/**
 * Get the current directory
 * @returns {string} Current directory
 */
export function getCurrentDirectory() {
  return fileState.currentDirectory;
}

/**
 * Get the current file
 * @returns {string} Current file
 */
export function getCurrentFile() {
  return fileState.currentFile;
}

/**
 * Set the current directory (deprecated - use changeDirectory)
 */
export function setCurrentDirectory(directory) {
  logMessage('[FILEMGR WARN] setCurrentDirectory is deprecated, use changeDirectory instead', 'warning');
  if (directory) {
    changeDirectory(directory);
    return true;
  }
  return false;
}

/**
 * Set the current file (deprecated - use loadFile)
 */
export function setCurrentFile(file) {
   logMessage('[FILEMGR WARN] setCurrentFile is deprecated, use loadFile instead', 'warning');
  if (file) {
    loadFile(file);
    return true;
  }
  return false;
}

/**
 * Clear the file system state
 */
export function clearFileSystemState() {
  logMessage('[FILEMGR] Clearing file system state');
  
  // Clear internal state
  fileState.currentDirectory = '';
  fileState.currentFile = '';
  fileState.filesLoaded = false;
  
  // Clear caches
  directoryCache.clear();
  fileContentCache.clear();
  
  // Clear UI
  const fileSelect = document.getElementById('file-select');
  if (fileSelect) {
    fileSelect.innerHTML = '<option value="">Select File</option>';
  }
  
  // Clear editor content
  setContent('');
  
  // Use fileSystemState to clear localStorage
  fileSystemState.clearState();
  
  // Emit event
  eventBus.emit('fileManager:cleared');
  
  logMessage('[FILEMGR] File system state cleared');
}

/**
 * Initialize the directory selector event listener (moved here from fileSystemState)
 */
function setupDirectorySelectListener() {
  const dirSelect = document.getElementById('dir-select');
  if (dirSelect) {
    // Use a named function for the handler to allow removal
    const handleDirChange = async function() {
      const selectedDir = this.value;
      if (selectedDir) {
        logMessage(`[FILEMGR] Directory select changed to: ${selectedDir}`);
        await changeDirectory(selectedDir);
      }
    };

    // Remove any existing listeners to prevent duplicates
    dirSelect.removeEventListener('change', handleDirChange); // Needs the exact function reference
    
    // Add the listener
    dirSelect.addEventListener('change', handleDirChange);
    
    logMessage('[FILEMGR] Set up directory select listener');
  } else {
    logMessage('[FILEMGR WARNING] Directory select element not found for listener setup');
  }
}

// Export the file manager object for module use
export default {
  initializeFileManager,
  loadFiles,
  loadFile,
  saveFile,
  loadDirectories,
  changeDirectory,
  getCurrentDirectory,
  getCurrentFile,
  setCurrentDirectory, // Keep for potential legacy usage, but warn
  setCurrentFile,      // Keep for potential legacy usage, but warn
  clearFileSystemState,
  updateFileSelector
};

// This export likely causes issues if fileManager initializes before auth
// export const currentDir = getCurrentDirectory(); 
// Consider accessing directory via getCurrentDirectory() when needed instead of top-level export. 