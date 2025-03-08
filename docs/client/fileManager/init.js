import { logMessage } from '../log/index.js';
import { loadFileSystemState, setCurrentDirectory, setCurrentFile, getCurrentDirectory } from './state.js';
import { loadFiles, loadDirectories, getDirectoryDisplayName } from './operations.js';
import { getDirectoryIdFromUrl, getFileFromUrl } from './url.js';
import fileManager from './core.js';
import { authState } from '../auth.js';

// Guard to prevent multiple initializations
let fileManagerInitializing = false;
let fileManagerInitialized = false;

// Helper function to ensure file select functionality
function ensureFileSelectFunctionality() {
    const fileSelect = document.getElementById('file-select');
    if (!fileSelect) {
        logMessage('[FILES] File select element not found');
        return;
    }
    
    // Remove existing listeners by cloning and replacing
    const newFileSelect = fileSelect.cloneNode(true);
    fileSelect.parentNode.replaceChild(newFileSelect, fileSelect);
    
    // Preserve the currently selected value
    const selectedValue = fileSelect.value;
    if (selectedValue) {
        newFileSelect.value = selectedValue;
        
        // Double-check that the value was set correctly
        if (newFileSelect.value !== selectedValue) {
            // Try to find the option and select it directly
            const option = Array.from(newFileSelect.options).find(opt => opt.value === selectedValue);
            if (option) {
                option.selected = true;
                logMessage(`[FILES] Restored selected file: ${selectedValue}`);
            }
        }
    }
    
    // Add new listener
    newFileSelect.addEventListener('change', async (event) => {
        const selectedFile = event.target.value;
        if (!selectedFile) return;
        
        logMessage(`[FILES] File selected from dropdown: ${selectedFile}`);
        await fileManager.loadFile(selectedFile);
    });
    
    logMessage('[FILES] File select functionality restored');
}

// Helper function to explicitly set the file selection
function setFileSelection(filename) {
    if (!filename) return false;
    
    const fileSelect = document.getElementById('file-select');
    if (!fileSelect) return false;
    
    // Check if the option exists
    let option = Array.from(fileSelect.options).find(opt => opt.value === filename);
    
    // If the option doesn't exist, we need to wait for the file list to load
    if (!option) {
        logMessage(`[FILES] File option not found: ${filename}, will try again after files load`);
        
        // Set up a one-time event listener for when files are loaded
        const fileLoadedHandler = () => {
            setTimeout(() => {
                const updatedFileSelect = document.getElementById('file-select');
                if (!updatedFileSelect) return;
                
                // Try again after files are loaded
                updatedFileSelect.value = filename;
                
                // Verify it was set correctly
                if (updatedFileSelect.value !== filename) {
                    // Try to find the option and select it directly
                    const updatedOption = Array.from(updatedFileSelect.options).find(opt => opt.value === filename);
                    if (updatedOption) {
                        updatedOption.selected = true;
                        logMessage(`[FILES] Explicitly set file selection to: ${filename} after files loaded`);
                    }
                }
            }, 100);
        };
        
        document.addEventListener('files:loaded', fileLoadedHandler, { once: true });
        return false;
    }
    
    // Set the value
    fileSelect.value = filename;
    
    // Verify it was set correctly
    if (fileSelect.value !== filename) {
        // Try to find the option and select it directly
        if (option) {
            option.selected = true;
            logMessage(`[FILES] Explicitly set file selection to: ${filename}`);
            
            // Trigger change event
            fileSelect.dispatchEvent(new Event('change'));
            return true;
        }
        return false;
    }
    
    // Trigger change event
    fileSelect.dispatchEvent(new Event('change'));
    
    logMessage(`[FILES] File selection set to: ${filename}`);
    return true;
}

export async function initializeFileManager(forceRefresh = false) {
    // Add guard to prevent multiple simultaneous initializations
    if (fileManagerInitializing) {
        logMessage('[FILES] File manager initialization already in progress, skipping');
        return false;
    }
    
    // If already initialized and not forcing a refresh, skip
    if (fileManagerInitialized && !forceRefresh) {
        logMessage('[FILES] File manager already initialized, skipping');
        return true;
    }
    
    fileManagerInitializing = true;
    
    // Clear file select dropdown before loading new files to prevent glitches
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        // Save the current selection if any
        const currentSelection = fileSelect.value;
        
        // Clear the dropdown
        fileSelect.innerHTML = '<option value="">Loading files...</option>';
        fileSelect.disabled = true; // Disable during loading
    }
    
    try {
        logMessage('[FILES] Initializing file manager...');
        
        // Load saved state
        const state = loadFileSystemState();
        logMessage('[FILES] Loaded saved state: ' + JSON.stringify(state));
        
        // Initialize buttons
        initializeButtons();
        
        // Get directory from URL or state
        const urlDir = getDirectoryIdFromUrl();
        const initialDir = urlDir || state.currentDir || '';
        
        // Set current directory in state
        if (initialDir) {
            setCurrentDirectory(initialDir);
            logMessage(`[FILES] Set current directory in state: ${initialDir}`);
        }
        
        // If user is logged in, load directories
        if (authState?.isLoggedIn) {
            logMessage('[FILES] Loading directories for logged in user');
            
            // IMPORTANT: Don't call loadDirectories() here since it's already called in uiManager.js
            // await loadDirectories();
            
            // Instead, just make sure the current directory is selected
            const dirSelect = document.getElementById('dir-select');
            if (dirSelect && initialDir) {
                // Make sure the option exists in the dropdown
                let dirOption = Array.from(dirSelect.options).find(opt => opt.value === initialDir);
                if (!dirOption) {
                    // If the option doesn't exist, create it
                    dirOption = document.createElement('option');
                    dirOption.value = initialDir;
                    dirOption.textContent = getDirectoryDisplayName(initialDir);
                    dirSelect.appendChild(dirOption);
                    logMessage(`[FILES] Added missing directory option: ${initialDir}`);
                }
                
                // Set the selected value
                dirSelect.value = initialDir;
                logMessage(`[FILES] Set directory selector to: ${initialDir}`);
                
                // Explicitly load files for initial directory
                logMessage(`[FILES] Explicitly loading files for initial directory: ${initialDir}`);
                await loadFiles(initialDir);
                
                // Get file from URL or state
                const urlFile = getFileFromUrl();
                const initialFile = urlFile || state.currentFile || '';
                
                // Explicitly set the file selection
                if (initialFile) {
                    logMessage(`[FILES] Setting initial file selection: ${initialFile}`);
                    setFileSelection(initialFile);
                    setCurrentFile(initialFile);
                }
                
                // Trigger change event on directory selector to ensure all listeners are notified
                // But don't trigger if it's already the correct value to avoid unnecessary reloads
                if (fileManager.currentDir !== initialDir) {
                    dirSelect.dispatchEvent(new Event('change'));
                }
            } else {
                // If no directory is selected but user is logged in, try to load files from default directory
                logMessage('[FILES] No directory selected, attempting to load files from default directory');
                await loadFiles('');
            }
        } else {
            logMessage('[FILES] User not logged in, skipping directory loading');
        }
        
        // Re-enable the file select dropdown
        if (fileSelect) {
            fileSelect.disabled = false;
        }
        
        document.dispatchEvent(new CustomEvent('fileManager:ready', {
            detail: { 
                currentDir: fileManager.currentDir,
                currentFile: loadFileSystemState().currentFile
            }
        }));
        
        // After everything is loaded, ensure file select functionality is working
        setTimeout(ensureFileSelectFunctionality, 500);
        
        // Mark initialization as complete
        fileManagerInitialized = true;
        fileManagerInitializing = false;
        
        return true;
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to initialize file manager: ${error.message}`);
        console.error('[FILES ERROR]', error);
        
        // Re-enable the file select dropdown in case of error
        if (fileSelect) {
            fileSelect.disabled = false;
        }
        
        fileManagerInitializing = false;
        return false;
    }
}

function initializeButtons() {
    // Remove any existing event listeners first
    const dirSelect = document.getElementById('dir-select');
    if (dirSelect) {
        // Clone and replace the element to remove all event listeners
        const newDirSelect = dirSelect.cloneNode(true);
        dirSelect.parentNode.replaceChild(newDirSelect, dirSelect);
        
        // Add our single event listener
        newDirSelect.addEventListener('change', async (event) => {
            const newDir = event.target.value;
            if (newDir) {
                logMessage(`[FILES] Directory selected: ${newDir}`);
                
                // Update state immediately when directory changes
                setCurrentDirectory(newDir);
                
                // Load files for the selected directory
                await fileManager.changeDirectory(newDir);
                
                // Update URL state
                const urlParams = new URLSearchParams(window.location.search);
                urlParams.set('dir', newDir);
                urlParams.delete('file'); // Clear file parameter when directory changes
                window.history.replaceState({}, '', `?${urlParams.toString()}`);
            }
        });
        logMessage('[FILES] Directory select connected successfully');
    }
    
    // Do the same for file select
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        // Clone and replace the element to remove all event listeners
        const newFileSelect = fileSelect.cloneNode(true);
        fileSelect.parentNode.replaceChild(newFileSelect, fileSelect);
        
        // Add our single event listener
        newFileSelect.addEventListener('change', async (event) => {
            const filename = event.target.value;
            if (filename) {
                const currentDir = getCurrentDirectory();
                logMessage(`[FILES] File selected: ${filename} in directory: ${currentDir}`);
                
                // Update state immediately when file changes
                setCurrentFile(filename);
                
                // Load the selected file - this is the key change to auto-load files
                await fileManager.loadFile(filename, currentDir);
                
                // Update URL state
                const urlParams = new URLSearchParams(window.location.search);
                urlParams.set('file', filename);
                window.history.replaceState({}, '', `?${urlParams.toString()}`);
            }
        });
        logMessage('[FILES] File select connected successfully');
    }
    
    // Initialize save button
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        // Clone and replace to remove existing listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', async () => {
            logMessage('[FILES] Save button clicked');
            await fileManager.saveFile();
        });
    }
    
    // The load button is now redundant since files auto-load on selection
    // But we'll keep it for backward compatibility
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        // Clone and replace to remove existing listeners
        const newLoadBtn = loadBtn.cloneNode(true);
        loadBtn.parentNode.replaceChild(newLoadBtn, loadBtn);
        
        newLoadBtn.addEventListener('click', async () => {
            const dirSelect = document.getElementById('dir-select');
            const fileSelect = document.getElementById('file-select');
            
            if (dirSelect && fileSelect && dirSelect.value && fileSelect.value) {
                await fileManager.loadFile(fileSelect.value, dirSelect.value);
            } else {
                logMessage('[FILES WARN] Cannot load: Directory or file not selected');
            }
        });
    }
}

// Use a single central handler for auth events with debouncing
let authLoginDebounceTimer = null;
let isInitializingFileManager = false;

document.addEventListener('auth:login', async (event) => {
    // Clear any existing timer
    if (authLoginDebounceTimer) {
        clearTimeout(authLoginDebounceTimer);
    }
    
    // If already initializing, don't start another initialization
    if (isInitializingFileManager) {
        logMessage('[FILES] File manager initialization already in progress, skipping duplicate request');
        return;
    }
    
    // Use a longer delay for better stability
    authLoginDebounceTimer = setTimeout(async () => {
        try {
            isInitializingFileManager = true;
            logMessage('[FILES] Auth login detected, initializing file manager');
            await initializeFileManager(true); // Force refresh with true parameter
        } catch (error) {
            logMessage(`[FILES ERROR] Failed to initialize file manager: ${error.message}`);
            console.error('[FILES ERROR]', error);
        } finally {
            isInitializingFileManager = false;
            authLoginDebounceTimer = null;
        }
    }, 500); // Increased delay for better stability
});

document.addEventListener('auth:logout', () => {
    logMessage('[FILES] Auth logout detected, clearing file manager state');
    
    // Import and use the centralized function to clear the directory selector
    import('./core.js').then(({ updateDirectorySelector }) => {
        updateDirectorySelector([]);
    }).catch(err => {
        // Fallback if import fails
        const dirSelect = document.getElementById('dir-select');
        if (dirSelect) {
            dirSelect.innerHTML = '<option value="">Select Directory</option>';
        }
    });
    
    // Clear file selector
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        fileSelect.innerHTML = '<option value="">Select File</option>';
    }
    
    // Reset initialization state to allow re-initialization after next login
    fileManagerInitialized = false;
}); 