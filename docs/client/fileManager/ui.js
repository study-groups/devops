// ui.js - Handles UI interactions and DOM manipulation
import { logMessage } from '../log.js';
import { loadFile, saveFile } from './operations.js';

export function connectFileSelect() {
    try {
        const fileSelect = document.getElementById('file-select');
        if (!fileSelect) {
            logMessage('[FILES WARN] File select not found');
            return false;
        }
        
        const newFileSelect = fileSelect.cloneNode(true);
        fileSelect.parentNode.replaceChild(newFileSelect, fileSelect);
        
        newFileSelect.addEventListener('change', async () => {
            const selectedFile = newFileSelect.value;
            if (!selectedFile) return;
            
            logMessage(`[FILES] File selected from dropdown: ${selectedFile}`);
            await loadFile(selectedFile);
        });
        
        logMessage('[FILES] File select connected successfully');
        return true;
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to connect file select: ${error.message}`);
        return false;
    }
}

export function connectSaveButton() {
    try {
        const saveBtn = document.getElementById('save-btn');
        if (!saveBtn) {
            logMessage('[FILES WARN] Save button not found');
            return false;
        }
        
        // Clone and replace to remove existing listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', async () => {
            logMessage('[FILES] Save button clicked');
            
            // Get current file and directory
            const fileSelect = document.getElementById('file-select');
            const dirSelect = document.getElementById('dir-select');
            
            if (!fileSelect || !fileSelect.value) {
                logMessage('[FILES WARN] Cannot save: No file selected');
                return;
            }
            
            const filename = fileSelect.value;
            const directory = dirSelect ? dirSelect.value : '';
            
            // Call the saveFile function
            const success = await saveFile(filename, directory);
            
            if (success) {
                logMessage(`[FILES] Successfully saved file: ${filename}`);
            } else {
                logMessage(`[FILES ERROR] Failed to save file: ${filename}`);
            }
        });
        
        logMessage('[FILES] Save button connected successfully');
        return true;
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to connect save button: ${error.message}`);
        return false;
    }
}

export function connectLoadButton() {
    // Implementation needed
}

export function initScrollLock() {
    // Implementation needed
}

export function updateFileList(files, currentFile = '') {
    try {
        const fileList = document.getElementById('file-list');
        if (!fileList) return false;
        
        // Clear existing list
        fileList.innerHTML = '';
        
        // Sort files alphabetically
        files.sort((a, b) => a.name.localeCompare(b.name));
        
        // Add files to list
        files.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            if (file.name === currentFile) {
                li.classList.add('active');
            }
            
            li.innerHTML = `<span class="file-name">${file.name}</span>`;
            
            li.addEventListener('click', () => loadFile(file.name));
            fileList.appendChild(li);
        });
        
        return true;
    } catch (error) {
        logMessage(`[FILES UI ERROR] Failed to update file list: ${error.message}`);
        return false;
    }
}