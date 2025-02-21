// fileManager.js
import { logMessage } from "./utils.js";
import { updatePreview } from "./markdown.js";
import { globalFetch } from "./globalFetch.js";
import { authState } from "./auth.js"; 
import { ListContainer } from './components/ListContainer.js';
// Keep only these exports
export let currentDir = '';
let mdDir = '';
let fileList = null;

// Create fileManager object first
const fileManager = {
    loadFile,
    saveFile,
    loadFiles,
    currentDir,
    changeDirectory: async () => {
        if (!authState.isLoggedIn) return;
        const dirSelect = document.getElementById('dir-select');
        if (!dirSelect) return;
        
        currentDir = dirSelect.value;
        fileManager.currentDir = currentDir; // Keep them in sync
        
        const pathDisplay = document.getElementById('current-path');
        if (pathDisplay) {
            const displayPath = currentDir === '.' ? 'Community Files' : currentDir;
            pathDisplay.textContent = `Current: ${displayPath}`;
        }
        
        await loadFiles();
    }
};

// Make it globally available
window.fileManager = fileManager;

// Initialize buttons with the fileManager object
function initializeButtons() {
    const dirSelect = document.getElementById('dir-select');
    if (dirSelect) {
        // Make the directory selector visible
        dirSelect.style.display = 'block';

        dirSelect.addEventListener('change', async () => {
            currentDir = dirSelect.value;
            const pathDisplay = document.getElementById('current-path');
            if (pathDisplay) {
                const displayPath = currentDir === '.' ? 'Community Files' : currentDir;
                pathDisplay.textContent = `Current: ${displayPath}`;
            }
            await loadFiles();
        });
    }

    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        logMessage('[FILES] Initializing save button');
        saveBtn.addEventListener('click', () => {
            logMessage('[FILES] Save button clicked');
            saveFile();
        });
    } else {
        logMessage('[FILES ERROR] Save button not found');
    }

    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const fileSelect = document.getElementById('file-select');
            if (fileSelect && fileSelect.value) {
                fileManager.loadFile(fileSelect.value);
            } else {
                logMessage('[FILES] No file selected for loading');
            }
        });
    }
}

// Export initialization function
export async function initializeFileManager() {
    try {
        const config = await fetch('/api/auth/config').then(r => r.json());
        mdDir = config.MD_DIR;
        
        const mdDirDisplay = document.getElementById('md-dir-display');
        if (mdDirDisplay) {
            mdDirDisplay.textContent = `MD_DIR=${mdDir}`;
        }

        if (authState.isLoggedIn) {
            // Initialize fileList before loading files
            fileList = new ListContainer({
                onSelect: (file) => {
                    logMessage(`[FILES] Selected file: ${file.name}`);
                    loadFile(file.name);
                }
            });

            // Initialize buttons
            initializeButtons();

            // Load directories and files
            await loadDirs();
            await loadFiles();
        }
    } catch (error) {
        logMessage('[FILES ERROR] Failed to initialize file manager');
        console.error(error);
    }
}

export async function loadDirs() {
    if (!authState.isLoggedIn) return;

    try {
        const response = await globalFetch('/api/files/dirs');
        if (!response.ok) throw new Error('Failed to fetch directories');
        
        const dirs = await response.json();
        logMessage(`[FILES] Loaded ${dirs.length} directories`);

        const dirSelect = document.getElementById('dir-select');
        if (!dirSelect) {
            logMessage('[FILES ERROR] Directory select element not found');
            return;
        }

        // Clear and populate directory select
        dirSelect.innerHTML = '<option value="">Select Directory</option>';
        dirs.forEach(dir => {
            const option = document.createElement('option');
            option.value = dir.id;
            option.textContent = dir.name;
            dirSelect.appendChild(option);
        });

        // Set initial directory
        currentDir = authState.username;
        dirSelect.value = currentDir;

        // Update path display
        const pathDisplay = document.getElementById('current-path');
        if (pathDisplay) {
            pathDisplay.textContent = `Current: ${currentDir}`;
        }
    } catch (error) {
        logMessage('[FILES ERROR] Failed to load directories');
        console.error(error);
    }
}

export async function loadFiles() {
    if (!authState.isLoggedIn) return;

    try {
        logMessage(`[FILES] Fetching files from: /api/files/list`);
        const response = await globalFetch(`/api/files/list?dir=${currentDir}`);
        if (!response.ok) throw new Error('Failed to fetch files');
        
        let files = await response.json();
        logMessage(`[FILES] Loaded ${files.length} files`);

        fileList.setItems(files.map(file => ({
            name: file.name,
            rank: file.rank,
            index: file.index
        })));
    } catch (error) {
        logMessage('[FILES ERROR] Failed to load files');
        console.error(error);
    }
}

export async function loadFile(fileName) {
    if (!authState.isLoggedIn) return;

    try {
        logMessage(`[FILES] Loading file: ${fileName}`);
        const response = await globalFetch(`/api/files/get?name=${fileName}&dir=${currentDir}`);
        if (!response.ok) throw new Error('Failed to fetch file');
        
        const fileContent = await response.text();
        logMessage(`[FILES] Loaded file: ${fileName}`);

        // Update the editor with the file content
        const editor = document.getElementById('md-editor');
        if (editor) {
            editor.value = fileContent;
        }
        updatePreview(fileContent);
    } catch (error) {
        logMessage('[FILES ERROR] Failed to load file');
        console.error(error);
    }
}

export async function saveFile() {
    if (!authState.isLoggedIn) return;

    try {
        const editor = document.getElementById('md-editor');
        const fileSelect = document.getElementById('file-select');
        
        if (!editor || !fileSelect) {
            logMessage('[FILES ERROR] Editor or file select element not found');
            return;
        }

        const fileContent = editor.value;
        const fileName = fileSelect.value;
        
        if (!fileContent || !fileName) {
            logMessage('[FILES ERROR] File content or name not provided');
            return;
        }

        logMessage(`[SAVE] Saving ${fileName} in directory ${currentDir}`);

        const response = await globalFetch('/api/files/save/' + fileName, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: fileContent,
                pwd: currentDir,          // Current working directory
                userDir: authState.username  // User's home directory
            })
        });
        
        if (!response.ok) throw new Error('Failed to save file');
        
        logMessage(`[FILES] Saved file: ${fileName} in ${currentDir}`);
        // Only reload files if save was successful
        await loadFiles();
    } catch (error) {
        logMessage('[FILES ERROR] Failed to save file');
        console.error(error);
    }
}