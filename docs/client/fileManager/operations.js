// operations.js - Core file operations
import { logMessage, initLogToolbar } from '../log.js';
import { fetchFileContent, saveFileContent, fetchDirectoryListing } from './api.js';
import { 
    loadFileSystemState, 
    saveFileSystemState, 
    getCurrentDirectory,
    setCurrentFile
} from './state.js';
import { updateUrlState } from './url.js';  // Ensure we're importing this correctly
import { updatePreview } from '../markdown.js';
import { authState } from '../auth.js';
import { publish } from '../pubsub.js';

// Store directory ID to display name mappings
const directoryMappings = {
    'Community_Files': '📚 Community_Files'  // Using underscore format with emoji
};

/**
 * Store a mapping between directory ID and display name
 */
function storeDirectoryMapping(dirId, displayName) {
    // Special case for Community_Files - preserve it exactly as is
    if (dirId === 'Community_Files') {
        directoryMappings[dirId] = '📚 Community_Files';
        return;
    }
    
    // Remove any leading emoji characters to prevent duplicate icons with CSS
    if (displayName) {
        displayName = displayName.replace(/^[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
    }
    directoryMappings[dirId] = displayName;
}

/**
 * Get the display name for a directory ID
 */
export function getDirectoryDisplayName(dirId) {
    return directoryMappings[dirId] || dirId;
}

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
            // First check if the option exists
            let option = Array.from(fileSelect.options).find(opt => opt.value === filename);
            
            // If not, create it
            if (!option) {
                option = document.createElement('option');
                option.value = filename;
                option.textContent = filename;
                fileSelect.appendChild(option);
            }
            
            // Set the value
            fileSelect.value = filename;
            
            // Verify it was set correctly
            if (fileSelect.value !== filename) {
                // Try to select the option directly
                option.selected = true;
                logMessage(`[FILES] Manually selected option for: ${filename}`);
            }
        }
        
        // Update URL and state - fix error by using object structure with the update
        try {
            updateUrlState({ dir, file: filename });
        } catch (error) {
            logMessage(`[FILES WARNING] Failed to update URL: ${error.message}`);
        }
        
        // Save state separately to ensure it works even if URL update fails
        saveFileSystemState({ currentDir: dir, currentFile: filename });
        
        // Update the community link button state
        try {
            // Dynamically import to avoid circular dependencies
            const { updateLinkButtonState } = await import('../components/communityLink.js');
            await updateLinkButtonState(filename, dir);
        } catch (error) {
            logMessage(`[FILES WARNING] Failed to update link button state: ${error.message}`);
        }
        
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

        // No longer trying to convert between space and underscore versions
        const normalizedDir = directory;
        
        logMessage(`[FILES] Loading files from directory: ${normalizedDir || 'root'}`);
        
        // Get the file select dropdown
        const fileSelect = document.getElementById('file-select');
        if (fileSelect) {
            // Save the current selection if any
            const currentSelection = fileSelect.value;
            
            // Show loading state
            if (fileSelect.options.length <= 1) {
                fileSelect.innerHTML = '<option value="">Loading files...</option>';
            }
            fileSelect.disabled = true; // Disable during loading
        }
        
        // Use fetchDirectoryListing which now handles Community Files appropriately
        const response = await fetchDirectoryListing(normalizedDir);
        
        if (!response.ok) {
            logMessage(`[FILES ERROR] Failed to fetch directory listing: ${response.status}`);
            // Re-enable the dropdown in case of error
            if (fileSelect) {
                fileSelect.disabled = false;
            }
            return false;
        }
        
        const data = await response.json();
        
        // Normalize file data
        let files = [];
        if (Array.isArray(data)) {
            files = data.map(file => typeof file === 'string' ? { name: file } : file);
        } else if (data.files) {
            files = data.files.map(file => typeof file === 'string' ? { name: file } : file);
        }
        
        // For Community Files, ensure we handle symlinks properly
        if (normalizedDir === 'Community_Files' && data.symlinks && Array.isArray(data.symlinks)) {
            // Add symlinks to the files array with a special flag
            const symlinks = data.symlinks.map(symlink => ({
                name: symlink.name || symlink,
                isSymlink: true,
                sourceDir: symlink.sourceDir || null,
                sourceFile: symlink.sourceFile || null
            }));
            
            files = [...files, ...symlinks];
        }
        
        // Update file select dropdown
        if (fileSelect) {
            fileSelect.innerHTML = '<option value="">Select File</option>';
            
            // Sort files alphabetically
            files.sort((a, b) => a.name.localeCompare(b.name));
            
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                
                // Add an icon for symlinks
                if (file.isSymlink) {
                    option.textContent = `🔗 ${file.name}`;
                    option.dataset.isSymlink = 'true';
                    if (file.sourceDir && file.sourceFile) {
                        option.title = `Link to ${file.sourceDir}/${file.sourceFile}`;
                    }
                } else {
                    option.textContent = file.name;
                }
                
                fileSelect.appendChild(option);
            });
            
            // Check if we should select a file from URL or state
            const urlParams = new URLSearchParams(window.location.search);
            const urlFile = urlParams.get('file');
            const state = loadFileSystemState();
            
            // Store the file we're going to select to ensure it's properly set
            let selectedFile = null;
            
            if (urlFile && files.some(f => f.name === urlFile)) {
                selectedFile = urlFile;
                logMessage(`[FILES] Using file from URL: ${urlFile}`);
            } else if (state.currentFile && files.some(f => f.name === state.currentFile)) {
                selectedFile = state.currentFile;
                logMessage(`[FILES] Using file from saved state: ${state.currentFile}`);
            } else if (files.length > 0) {
                // Select the first file by default
                selectedFile = files[0].name;
                logMessage(`[FILES] Selected first available file: ${files[0].name}`);
            }
            
            if (selectedFile) {
                // Set the dropdown value
                fileSelect.value = selectedFile;
                
                // Ensure the value is actually set by checking and forcing if needed
                if (fileSelect.value !== selectedFile) {
                    // Try to find the option and select it directly
                    const option = Array.from(fileSelect.options).find(opt => opt.value === selectedFile);
                    if (option) {
                        option.selected = true;
                        logMessage(`[FILES] Explicitly set file selection to: ${selectedFile}`);
                    }
                }
                
                // Update state
                setCurrentFile(selectedFile);
                
                // Load the file content
                loadFile(selectedFile, normalizedDir);
            }
            
            // Re-enable the dropdown
            fileSelect.disabled = false;
        }
        
        // Dispatch events to notify that files have been loaded
        document.dispatchEvent(new CustomEvent('files:loaded', { 
            detail: { 
                directory: normalizedDir,
                files: files 
            }
        }));
        
        // Also dispatch a more general event for backward compatibility
        document.dispatchEvent(new CustomEvent('fileManager:filesLoaded', { 
            detail: { 
                directory: normalizedDir,
                files: files 
            }
        }));
        
        logMessage(`[FILES] Successfully loaded ${files.length} files from ${normalizedDir || 'root'}`);
        return true;
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to load files: ${error.message}`);
        console.error('[FILES ERROR]', error);
        
        // Re-enable the dropdown in case of error
        const fileSelect = document.getElementById('file-select');
        if (fileSelect) {
            fileSelect.disabled = false;
        }
        
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
                    // Prioritize id over name for directory identification
                    // This ensures we use 'Community_Files' instead of 'Community Files'
                    const dirId = dir.id || dir.name || String(dir);
                    
                    // Store the display name separately for UI purposes
                    const displayName = dir.name || dir.id || String(dir);
                    
                    // Store the mapping for later use
                    storeDirectoryMapping(dirId, displayName);
                    
                    return dirId;
                }
            });
        } else if (data.directories) {
            dirs = data.directories.map(dir => {
                if (typeof dir === 'string') {
                    return cleanDirectoryName(dir);
                } else {
                    // Prioritize id over name for directory identification
                    const dirId = dir.id || dir.name || String(dir);
                    
                    // Store the display name separately for UI purposes
                    const displayName = dir.name || dir.id || String(dir);
                    
                    // Store the mapping for later use
                    storeDirectoryMapping(dirId, displayName);
                    
                    return dirId;
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