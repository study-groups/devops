import { logMessage } from '../log/index.js';
import { 
    loadFile,
    saveFile,
    loadFiles,
    loadDirectories,
    getDirectoryDisplayName
} from './operations.js';
import { getCurrentDirectory, saveFileSystemState, loadFileSystemState } from './state.js';
import { authState } from '../auth.js';
import { publish } from '../pubsub.js';
import { updateUrlState } from './url.js';

export let currentDir = getCurrentDirectory();
let currentFile = '';

// Create fileManager object
const fileManager = {
    loadFile,
    saveFile,
    loadFiles,
    get currentDir() { return currentDir; },
    set currentDir(value) { currentDir = value; },
    changeDirectory: async (newDir) => {
        if (!authState?.isLoggedIn) {
            logMessage('[FILES] Cannot change directory: User not logged in.');
            return false;
        }

        if (!newDir) return false;
        
        // If directory hasn't changed, don't reload
        const currentStateDir = getCurrentDirectory();
        if (newDir === currentStateDir) {
            logMessage(`[FILES] Directory unchanged: '${newDir}'`);
            
            // Even if the directory hasn't changed, make sure the UI reflects it
            const dirSelect = document.getElementById('dir-select');
            if (dirSelect && dirSelect.value !== newDir) {
                // Instead of adding a potentially duplicate option, ensure it's in the list
                // and selected
                if (!Array.from(dirSelect.options).some(opt => opt.value === newDir)) {
                    // We need to fetch all directories and update the selector
                    fetchDirectories().then(dirs => {
                        updateDirectorySelector(dirs, newDir);
                    }).catch(err => {
                        // If we can't fetch directories, just ensure this one is in the list
                        const currentOptions = Array.from(dirSelect.options)
                            .filter(opt => opt.value !== '')
                            .map(opt => opt.value);
                        updateDirectorySelector([...currentOptions, newDir], newDir);
                    });
                } else {
                    dirSelect.value = newDir;
                }
                logMessage(`[FILES] Updated directory selector to match state: ${newDir}`);
            }
            
            return true; // Return true since the directory is already set correctly
        }
        
        logMessage(`[FILES] Changing directory from '${currentStateDir}' to '${newDir}'`);
        
        const oldDir = currentStateDir;
        currentDir = newDir;
        
        // Update the directory selector without adding duplicates
        const dirSelect = document.getElementById('dir-select');
        if (dirSelect) {
            if (!Array.from(dirSelect.options).some(opt => opt.value === newDir)) {
                // We need to fetch all directories and update the selector
                fetchDirectories().then(dirs => {
                    updateDirectorySelector(dirs, newDir);
                }).catch(err => {
                    // If we can't fetch directories, just ensure this one is in the list
                    const currentOptions = Array.from(dirSelect.options)
                        .filter(opt => opt.value !== '')
                        .map(opt => opt.value);
                    updateDirectorySelector([...currentOptions, newDir], newDir);
                });
            } else {
                dirSelect.value = newDir;
            }
        }
        
        // Update state - make sure to save both the directory and reset the current file
        saveFileSystemState({ currentDir: newDir, currentFile: '' });
        
        // Load files for the new directory
        const filesLoaded = await loadFiles(newDir);
        
        // Update URL
        const displayPath = newDir === 'Community_Files' ? 'Community Files' : newDir;
        updateUrlState({ dir: displayPath });
        
        // Update the community link button state based on the new directory
        try {
            // If we're in Community_Files, always show "Remove Link"
            const linkButton = document.getElementById('community-link-btn');
            if (linkButton) {
                if (newDir === 'Community_Files') {
                    linkButton.classList.add('linked');
                    linkButton.title = 'Remove from Community Files';
                    linkButton.innerHTML = '<i class="fas fa-unlink"></i> Remove Link';
                    logMessage('[FILES] Updated link button for Community_Files directory');
                } else {
                    // Reset the button state when changing to a non-Community_Files directory
                    // The actual state will be updated when a file is loaded
                    linkButton.classList.remove('linked');
                    linkButton.title = 'Add to Community Files';
                    linkButton.innerHTML = '<i class="fas fa-link"></i> Add Link';
                    logMessage('[FILES] Reset link button for non-Community_Files directory');
                }
            }
        } catch (error) {
            logMessage(`[FILES WARNING] Failed to update link button state: ${error.message}`);
        }
        
        if (!filesLoaded) {
            logMessage(`[FILES ERROR] Failed to load files for directory: ${newDir}, reverting to ${oldDir}`);
            currentDir = oldDir;
            if (dirSelect) dirSelect.value = oldDir;
            return false;
        }
        
        document.dispatchEvent(new CustomEvent('directory:changed', {
            detail: { directory: newDir }
        }));
        
        // Publish state change
        publish('fileManager:directoryChanged', { 
            directory: newDir,
            previousDirectory: oldDir
        });
        
        return true;
    }
};

// Add this new function to centralize directory selector management
export function updateDirectorySelector(directories, selectedDir = null) {
    const dirSelect = document.getElementById('dir-select');
    if (!dirSelect) {
        logMessage('[FILES] Directory selector not found');
        return false;
    }
    
    // Always clear existing options first
    dirSelect.innerHTML = '<option value="">Select Directory</option>';
    
    // Add all directories
    if (Array.isArray(directories)) {
        directories.forEach(dir => {
            const option = document.createElement('option');
            option.value = typeof dir === 'string' ? dir : dir.id;
            option.textContent = typeof dir === 'string' ? getDirectoryDisplayName(dir) : (dir.name || getDirectoryDisplayName(dir.id));
            if (typeof dir !== 'string' && dir.description) {
                option.title = dir.description;
            }
            dirSelect.appendChild(option);
        });
    } else if (directories && typeof directories === 'object') {
        // Handle case where directories is an object with id/name properties
        const option = document.createElement('option');
        option.value = directories.id;
        option.textContent = directories.name || getDirectoryDisplayName(directories.id);
        if (directories.description) {
            option.title = directories.description;
        }
        dirSelect.appendChild(option);
    }
    
    // Set the selected directory if provided
    if (selectedDir) {
        dirSelect.value = selectedDir;
    }
    
    logMessage(`[FILES] Directory selector updated with ${dirSelect.options.length - 1} directories`);
    return true;
}

// Add a helper function to fetch directories
async function fetchDirectories() {
    try {
        const response = await fetch('/api/files/dirs');
        if (!response.ok) {
            throw new Error(`Failed to fetch directories: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        logMessage(`[FILES] Error fetching directories: ${error.message}`);
        throw error;
    }
}

export default fileManager;