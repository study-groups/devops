/**
 * core/fileManager.js
 * Single source of truth for file system operations
 */
import { logMessage } from '../log/index.js';
import { eventBus } from '../eventBus.js';
import { getContent, setContent } from './editor.js';

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
    // First restore state from localStorage if available
    restoreState();
    
    // Ensure authentication is restored before loading directories
    try {
      const auth = await import('./auth.js');
      if (!auth.AUTH_STATE.isLoggedIn && typeof auth.restoreLoginState === 'function') {
        logMessage('[FILEMGR] Auth state not loaded, attempting to restore...');
        await auth.restoreLoginState();
      }
    } catch (authError) {
      logMessage(`[FILEMGR WARNING] Auth restoration failed: ${authError.message}`, 'warning');
    }
    
    // Load available directories first
    await loadDirectories();
    
    // Apply URL parameters if they exist
    const urlParams = new URLSearchParams(window.location.search);
    const urlDir = urlParams.get('dir');
    const urlFile = urlParams.get('file');
    
    if (urlDir) {
      logMessage(`[FILEMGR] URL has directory parameter: ${urlDir}`);
      fileState.currentDirectory = getDirectoryIdFromDisplayName(urlDir);
    }
    
    if (urlFile) {
      logMessage(`[FILEMGR] URL has file parameter: ${urlFile}`);
      fileState.currentFile = urlFile;
    }
    
    // Initialize UI elements
    initializeFileSelector();
    
    // Set up event listeners
    setupEventListeners();
    
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
            logMessage(`[FILEMGR WARNING] Could not load previously selected file. Clearing selection.`);
            fileState.currentFile = '';
            // Update URL to remove the file parameter
            updateUrlParameters(fileState.currentDirectory);
          }
        }
      } catch (error) {
        // Directory couldn't be loaded, clear both directory and file but continue initialization
        logMessage(`[FILEMGR WARNING] Could not load previously selected directory. Clearing selection.`);
        fileState.currentDirectory = '';
        fileState.currentFile = '';
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
    // Get auth headers from auth module
    const auth = await import('./auth.js');
    const authHeaders = auth.getAuthHeaders();
    
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
    const auth = await import('./auth.js');
    const authHeaders = auth.getAuthHeaders();
    
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
    const api = await import('./api.js');
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
    // Get auth headers from auth module
    const auth = await import('./auth.js');
    const authHeaders = auth.getAuthHeaders();
    
    // Fetch from API with auth headers
    const response = await fetch('/api/files/dirs', {
      headers: authHeaders
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load directories: ${response.status} ${response.statusText}`);
    }
    
    const directories = await response.json();
    
    // Update the directory selector
    // refreshDirectorySelector(directories);
    
    // Optional: Update internal cache if needed
    directoryCache.clear();
    directories.forEach(dir => directoryCache.set(dir, true)); // Example cache update
    
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
  
  // Load files from the new directory
  const success = await loadFiles(directory);
  
  if (success) {
    // Reset current file when changing directories
    fileState.currentFile = '';
    
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
  if (currentValue) {
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
  // Listen for auth:loginComplete to initialize
  eventBus.on('auth:loginComplete', async () => {
    logMessage('[FILEMGR] Auth complete, potentially re-initializing file manager');
    // await loadDirectories(); // REMOVED - Initialization path should handle loading
    // Re-run initialization logic if needed, ensuring it handles being called multiple times
    await initializeFileManager({ force: false }); // Use force: false to prevent re-init if already done
  });
  
  // Listen for file:loaded to update state
  document.addEventListener('file:loaded', (event) => {
    const { filename, directory } = event.detail;
    fileState.currentFile = filename;
    fileState.currentDirectory = directory;
    saveState();
  });

  // Ensure the directory change listener is set up (might be redundant if initializeFileManager runs)
  initializeDirectorySelector();
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
 * Save the current state to localStorage
 */
function saveState() {
  try {
    localStorage.setItem('currentDir', fileState.currentDirectory);
    localStorage.setItem('currentFile', fileState.currentFile);
    logMessage('[FILEMGR] File system state saved to localStorage');
  } catch (error) {
    console.error('[FILEMGR ERROR]', error);
    logMessage(`[FILEMGR ERROR] Failed to save state: ${error.message}`, 'error');
  }
}

/**
 * Restore state from localStorage
 */
function restoreState() {
  try {
    const savedDir = localStorage.getItem('currentDir');
    const savedFile = localStorage.getItem('currentFile');
    
    if (savedDir) {
      fileState.currentDirectory = savedDir;
    }
    
    if (savedFile) {
      fileState.currentFile = savedFile;
    }
    
    logMessage(`[FILEMGR] State restored from localStorage: dir=${savedDir}, file=${savedFile}`);
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
 * Set the current directory
 * @param {string} directory - Directory to set
 */
export function setCurrentDirectory(directory) {
  if (directory) {
    fileState.currentDirectory = directory;
    saveState();
    logMessage(`[FILEMGR] Current directory set to: ${directory}`);
    return true;
  }
  return false;
}

/**
 * Set the current file
 * @param {string} file - File to set
 */
export function setCurrentFile(file) {
  if (file) {
    fileState.currentFile = file;
    saveState();
    logMessage(`[FILEMGR] Current file set to: ${file}`);
    return true;
  }
  return false;
}

/**
 * Clear the file system state
 */
export function clearFileSystemState() {
  localStorage.removeItem('currentDir');
  localStorage.removeItem('currentFile');
  
  fileState.currentDirectory = '';
  fileState.currentFile = '';
  
  logMessage('[FILEMGR] File system state cleared');
}

/**
 * Initialize the directory selector
 */
function initializeDirectorySelector() {
  const directorySelector = document.getElementById('dir-select');
  if (!directorySelector) {
    logMessage('[FILEMGR WARNING] Directory selector not found for listener setup', 'warning');
    return;
  }

  // Clear existing options and add placeholder
  // directorySelector.innerHTML = '<option value="">Select Directory</option>';

  // Add event listener
  // Ensure listener isn't added multiple times if init runs again
  directorySelector.removeEventListener('change', handleDirectoryChangeFromUI); // Use a named function
  directorySelector.addEventListener('change', handleDirectoryChangeFromUI);

  logMessage('[FILEMGR] Directory selector event listener initialized');
}

// Add a named handler function for the directory change
async function handleDirectoryChangeFromUI(event) {
  const selectedDirectory = event.target.value;
  if (!selectedDirectory) return;
  // Call the existing fileManager logic when the UI selection changes
  await changeDirectory(selectedDirectory);
}

/**
 * Update the directory selector with available directories
 * @param {Array} directories - Array of directories
 * @param {string} selectedDirectory - Directory to select
 */
function updateDirectorySelector(directories, selectedDirectory = null) {
  const directorySelector = document.getElementById('dir-select');
  if (!directorySelector) {
    // logMessage('[FILEMGR WARNING] Directory selector not found', 'warning'); // Commented out, UIManager handles UI
    return;
  }
  logMessage('[FILEMGR] updateDirectorySelector called, but UI updates are handled by UIManager.'); // Log that this is now passive

  // Store current selected value to preserve it if nothing else is specified
  // const currentValue = selectedDirectory || directorySelector.value; // REMOVED

  // Clear existing options and add placeholder
  // directorySelector.innerHTML = '<option value="">Select Directory</option>'; // REMOVED

  // Add options for each directory
  // directories.forEach(dir => { ... }); // REMOVED

  // Set the selected value
  // if (currentValue) { ... } // REMOVED

  // logMessage(`[FILEMGR] Directory selector updated with ${directories.length} directories`); // REMOVED
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
  setCurrentDirectory,
  setCurrentFile,
  clearFileSystemState,
  updateFileSelector
};

export const currentDir = getCurrentDirectory(); 