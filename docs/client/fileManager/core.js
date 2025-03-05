import { logMessage } from '../log.js';
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
                let option = Array.from(dirSelect.options).find(opt => opt.value === newDir);
                if (!option) {
                    option = document.createElement('option');
                    option.value = newDir;
                    option.textContent = getDirectoryDisplayName(newDir);
                    dirSelect.appendChild(option);
                    logMessage(`[FILES] Added missing directory option: ${newDir}`);
                }
                dirSelect.value = newDir;
                logMessage(`[FILES] Updated directory selector to match state: ${newDir}`);
            }
            
            return true; // Return true since the directory is already set correctly
        }
        
        logMessage(`[FILES] Changing directory from '${currentStateDir}' to '${newDir}'`);
        
        const oldDir = currentStateDir;
        currentDir = newDir;
        
        const dirSelect = document.getElementById('dir-select');
        if (dirSelect) {
            let option = Array.from(dirSelect.options).find(opt => opt.value === newDir);
            if (!option) {
                option = document.createElement('option');
                option.value = newDir;
                option.textContent = getDirectoryDisplayName(newDir);
                dirSelect.appendChild(option);
                logMessage(`[FILES] Added missing directory option: ${newDir}`);
            }
            dirSelect.value = newDir;
            
            // Update path display
            const pathDisplay = document.getElementById('current-path');
            if (pathDisplay) {
                const displayPath = newDir === 'Community_Files' ? 'Community Files' : newDir;
                pathDisplay.textContent = `Current: ${displayPath}`;
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

export default fileManager;