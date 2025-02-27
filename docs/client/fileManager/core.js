import { logMessage } from '../log.js';
import { 
    loadFile,
    saveFile,
    loadFiles,
    loadDirectories
} from './operations.js';
import { getCurrentDirectory, saveFileSystemState, loadFileSystemState } from './state.js';
import { authState } from '../auth.js';
import { publish } from '../pubsub.js';

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

        if (newDir === currentDir) {
            logMessage(`[FILES] Directory unchanged: '${newDir}'`);
            return true;
        }

        logMessage(`[FILES] Changing directory from '${currentDir}' to '${newDir}'`);
        
        const oldDir = currentDir;
        currentDir = newDir;
        
        const dirSelect = document.getElementById('dir-select');
        if (dirSelect) {
            let option = Array.from(dirSelect.options).find(opt => opt.value === newDir);
            if (!option) {
                option = document.createElement('option');
                option.value = newDir;
                option.textContent = newDir;
                dirSelect.appendChild(option);
            }
            dirSelect.value = newDir;
            
            // Update path display
            const pathDisplay = document.getElementById('current-path');
            if (pathDisplay) {
                const displayPath = newDir === '.' ? 'Community Files' : newDir;
                pathDisplay.textContent = `Current: ${displayPath}`;
            }
        }
        
        const filesLoaded = await loadFiles(newDir);
        
        if (!filesLoaded) {
            logMessage(`[FILES ERROR] Failed to load files for directory: ${newDir}, reverting to ${oldDir}`);
            currentDir = oldDir;
            if (dirSelect) dirSelect.value = oldDir;
            return false;
        }
        
        saveFileSystemState({
            currentDir: newDir,
            currentFile: ''
        });
        
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