import { logMessage } from '../log.js';
import { loadFileSystemState, setCurrentDirectory, setCurrentFile, getCurrentDirectory } from './state.js';
import { loadFiles, loadDirectories } from './operations.js';
import fileManager from './core.js';
import { authState } from '../auth.js';

export async function initializeFileManager() {
    logMessage('[FILES] Initializing file manager...');

    // Get URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const urlDir = urlParams.get('dir');
    const urlFile = urlParams.get('file');
    
    // Get saved state
    const savedState = loadFileSystemState();
    logMessage(`[FILES] Loaded saved state: ${JSON.stringify(savedState)}`);

    // Initialize buttons first
    initializeButtons();

    // Wait a moment for auth state to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Load directories first if logged in
    if (authState?.isLoggedIn) {
        logMessage('[FILES] Loading directories for logged in user');
        const dirs = await loadDirectories();
        
        const dirSelect = document.getElementById('dir-select');
        if (dirSelect) {
            // Clear and populate directory select
            dirSelect.innerHTML = '<option value="">Select Directory</option>';
            
            // Sort directories with user's directory first
            const sortedDirs = [...dirs].sort((a, b) => {
                // Ensure we're comparing strings
                const strA = String(a);
                const strB = String(b);
                
                if (strA === authState.username) return -1;
                if (strB === authState.username) return 1;
                return strA.localeCompare(strB);
            });
            
            sortedDirs.forEach(dir => {
                const option = document.createElement('option');
                option.value = dir;
                
                // Add icons based on directory type
                if (dir === 'Community Files' || dir === '.') {
                    option.textContent = `📚 ${dir}`;
                    option.dataset.icon = '📚';
                } else if (dir === authState.username) {
                    option.textContent = `👤 ${dir}`;
                    option.dataset.icon = '👤';
                } else if (dir === 'images') {
                    option.textContent = `🖼️ ${dir}`;
                    option.dataset.icon = '🖼️';
                } else {
                    option.textContent = `📁 ${dir}`;
                    option.dataset.icon = '📁';
                }
                
                dirSelect.appendChild(option);
            });

            // Set directory based on priority: URL > saved state > user directory
            let dirToUse = null;
            
            if (urlDir && dirs.includes(urlDir)) {
                dirToUse = urlDir;
                logMessage(`[FILES] Using directory from URL: ${urlDir}`);
            } else if (savedState.currentDir && dirs.includes(savedState.currentDir)) {
                dirToUse = savedState.currentDir;
                logMessage(`[FILES] Using directory from saved state: ${savedState.currentDir}`);
            } else if (authState.username && dirs.includes(authState.username)) {
                dirToUse = authState.username;
                logMessage(`[FILES] Using user's directory: ${authState.username}`);
            }
            
            if (dirToUse) {
                dirSelect.value = dirToUse;
                await fileManager.changeDirectory(dirToUse);
                
                // If we have a file parameter and we're in the right directory, load it
                if (urlFile && urlDir === dirToUse) {
                    logMessage(`[FILES] Using file from URL: ${urlFile}`);
                    await fileManager.loadFile(urlFile, dirToUse);
                } else if (savedState.currentFile && !urlDir) {
                    // Only use saved file if URL didn't specify a directory
                    logMessage(`[FILES] Using file from saved state: ${savedState.currentFile}`);
                    await fileManager.loadFile(savedState.currentFile, dirToUse);
                }
            }
        }
    }

    document.dispatchEvent(new CustomEvent('fileManager:ready', {
        detail: { 
            currentDir: fileManager.currentDir,
            currentFile: loadFileSystemState().currentFile
        }
    }));
    
    return true;
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

document.addEventListener('auth:login', async () => {
    logMessage('[FILES] Auth login detected, reinitializing file manager');
    await initializeFileManager();
});

document.addEventListener('auth:logout', () => {
    logMessage('[FILES] Auth logout detected, clearing file manager state');
    // Clear UI elements
    const dirSelect = document.getElementById('dir-select');
    if (dirSelect) {
        dirSelect.innerHTML = '<option value="">Select Directory</option>';
    }
    
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        fileSelect.innerHTML = '<option value="">Select File</option>';
    }
}); 