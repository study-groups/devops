// operations.js - Core file operations
import { logMessage, initLogToolbar } from '../log.js';
import { fetchFileContent, saveFileContent, fetchDirectoryListing } from './api.js';
import { 
    loadFileSystemState, 
    saveFileSystemState, 
    getCurrentDirectory,
    updateUrlState
} from './state.js';
import { updatePreview } from '../markdown.js';
import { authState } from '../auth.js';
import { publish } from '../pubsub.js';

export async function loadFile(filename, directory = '') {
    try {
        const dir = directory || getCurrentDirectory();
        logMessage(`[FILES] Loading file: ${filename} from directory: ${dir}`);
        
        const response = await fetchFileContent(filename, dir);
        const content = await response.text();
        
        const editor = document.querySelector('#md-editor textarea');
        if (!editor) {
            throw new Error('Editor textarea not found');
        }
        
        editor.value = content;
        updatePreview(content);
        
        // Update UI elements
        const fileSelect = document.getElementById('file-select');
        if (fileSelect) {
            let option = Array.from(fileSelect.options).find(opt => opt.value === filename);
            if (!option) {
                option = document.createElement('option');
                option.value = filename;
                option.textContent = filename;
                fileSelect.appendChild(option);
            }
            fileSelect.value = filename;
        }
        
        updateUrlState(dir, filename);
        saveFileSystemState({ currentDir: dir, currentFile: filename });
        
        // Publish file loaded event
        publish('fileManager:fileLoaded', {
            filename,
            directory: dir,
            content
        });
        
        // Initialize log toolbar to ensure resize functionality works
        initLogToolbar();
        
        return true;
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to load file: ${error.message}`);
        return false;
    }
}

export async function saveFile(filename, directory = '') {
    try {
        const dir = directory || getCurrentDirectory();
        const file = filename || document.getElementById('file-select')?.value;
        
        if (!file) {
            logMessage('[FILES ERROR] Cannot save: No file selected');
            return false;
        }
        
        logMessage(`[FILES] Saving file: ${file} to directory: ${dir}`);
        
        const editor = document.querySelector('#md-editor textarea');
        if (!editor) {
            throw new Error('Editor textarea not found');
        }
        
        const content = editor.value;
        
        // Use our new simple save endpoint directly
        const url = `/api/save?file=${encodeURIComponent(file)}&dir=${encodeURIComponent(dir)}`;
        logMessage(`[FILES] Using save endpoint: ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
            },
            body: content
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
        
        logMessage(`[FILES] Successfully saved file: ${file}`);
        
        // Update file system state - use saveFileSystemState instead of setCurrentFile
        saveFileSystemState({
            currentDir: dir,
            currentFile: file,
            lastModified: Date.now()
        });
        
        // Publish save event
        document.dispatchEvent(new CustomEvent('file:saved', {
            detail: { filename: file, directory: dir }
        }));
        
        return true;
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to save file: ${error.message}`);
        return false;
    }
}

export async function loadFiles(directory = '') {
    try {
        if (!authState?.isLoggedIn) {
            logMessage('[FILES] Cannot load files: User not logged in');
            return false;
        }

        logMessage(`[FILES] Loading files from directory: ${directory || 'root'}`);
        
        // Use fetch directly for more control
        const response = await fetch(`/api/files/list?dir=${encodeURIComponent(directory)}`, {
            headers: {
                'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Normalize file data
        let files = [];
        if (Array.isArray(data)) {
            files = data.map(file => typeof file === 'string' ? { name: file } : file);
        } else if (data.files) {
            files = data.files.map(file => typeof file === 'string' ? { name: file } : file);
        }
        
        // Update file select dropdown
        const fileSelect = document.getElementById('file-select');
        if (fileSelect) {
            fileSelect.innerHTML = '<option value="">Select File</option>';
            
            // Sort files alphabetically
            files.sort((a, b) => a.name.localeCompare(b.name));
            
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name;
                fileSelect.appendChild(option);
            });
            
            // Check if we should select a file from URL or state
            const urlParams = new URLSearchParams(window.location.search);
            const urlFile = urlParams.get('file');
            const state = loadFileSystemState();
            
            if (urlFile && files.some(f => f.name === urlFile)) {
                fileSelect.value = urlFile;
                logMessage(`[FILES] Selected file from URL: ${urlFile}`);
                
                // Auto-load the file content
                loadFile(urlFile, directory);
            } else if (state.currentFile && files.some(f => f.name === state.currentFile)) {
                fileSelect.value = state.currentFile;
                logMessage(`[FILES] Selected file from state: ${state.currentFile}`);
                
                // Auto-load the file content
                loadFile(state.currentFile, directory);
            } else if (files.length > 0) {
                // Select the first file by default
                fileSelect.value = files[0].name;
                logMessage(`[FILES] Selected first available file: ${files[0].name}`);
                
                // Auto-load the file content
                loadFile(files[0].name, directory);
            }
        }

        logMessage(`[FILES] Loaded ${files.length} files from ${directory}`);
        
        // Initialize log toolbar to ensure resize functionality works
        initLogToolbar();
        
        return files;
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to load files: ${error.message}`);
        return false;
    }
}

export async function loadDirectories() {
    try {
        if (!authState?.isLoggedIn) {
            logMessage('[FILES] Cannot load directories: User not logged in');
            return [];
        }

        logMessage('[FILES] Loading directories...');
        const response = await fetch('/api/files/dirs', {
            headers: {
                'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Normalize directory data - ensure all entries are strings and remove emoji prefixes
        let dirs = [];
        if (Array.isArray(data)) {
            dirs = data.map(dir => {
                if (typeof dir === 'string') {
                    return cleanDirectoryName(dir);
                } else {
                    return cleanDirectoryName(dir.name || dir.id || String(dir));
                }
            });
        } else if (data.directories) {
            dirs = data.directories.map(dir => {
                if (typeof dir === 'string') {
                    return cleanDirectoryName(dir);
                } else {
                    return cleanDirectoryName(dir.name || dir.id || String(dir));
                }
            });
        }
        
        // Always include user's directory if logged in
        if (authState.username && !dirs.includes(authState.username)) {
            dirs.unshift(authState.username);
        }
        
        // Add common directories if not already included
        const commonDirs = ['images', 'docs', 'templates'];
        commonDirs.forEach(dir => {
            if (!dirs.includes(dir)) {
                dirs.push(dir);
            }
        });
        
        // Remove duplicates
        dirs = [...new Set(dirs)];
        
        logMessage(`[FILES] Loaded ${dirs.length} directories: ${dirs.join(', ')}`);
        return dirs;
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to load directories: ${error.message}`);
        return [];
    }
}

// Helper function to clean directory names
function cleanDirectoryName(dirName) {
    // Remove emoji prefixes like 📁, 📚, etc.
    return dirName.replace(/^[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
} 