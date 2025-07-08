import { logMessage } from '../log/index.js';
import { loadFileSystemState, setCurrentFile } from '../fileSystemState.js';

// Simple dropdown list container
export class ListContainer {
    constructor(options = {}) {
        this.options = {
            onSelect: null,
            ...options
        };
        this.items = [];
        this.changeHandler = null;
        
        this.setupFileSelectHandler();
    }
    
    setupFileSelectHandler() {
        // Set up file select change handler with retry logic
        const attemptSetup = () => {
            const fileSelect = document.getElementById('file-select');
            if (fileSelect) {
                // Remove existing handler if any
                if (this.changeHandler) {
                    fileSelect.removeEventListener('change', this.changeHandler);
                }
                
                // Create new handler
                this.changeHandler = () => {
                    const selectedItem = this.items.find(item => item.name === fileSelect.value);
                    if (selectedItem && this.options.onSelect) {
                        this.options.onSelect(selectedItem);
                    }
                    // Save the selected file
                    if (fileSelect.value) {
                        setCurrentFile(fileSelect.value);
                        logMessage(`[LIST] Saved current file: ${fileSelect.value}`);
                    }
                };
                
                fileSelect.addEventListener('change', this.changeHandler);
                logMessage('[LIST] File select handler attached');
                return true;
            }
            return false;
        };
        
        // Try immediately
        if (!attemptSetup()) {
            // If not found, try again after a short delay for DOM to be ready
            setTimeout(() => {
                if (!attemptSetup()) {
                    logMessage('[LIST] File select element not found after retry', 'warn');
                }
            }, 100);
        }
    }
    
    setItems(items) {
        this.items = items;
        const fileSelect = document.getElementById('file-select');
        if (!fileSelect) {
            logMessage('[LIST] File select element not found during setItems', 'warn');
            return;
        }
        
        // Get the current file from state and URL
        const state = loadFileSystemState();
        const urlParams = new URLSearchParams(window.location.search);
        const urlFile = urlParams.get('file');
        const currentFile = urlFile || state.currentFile || '';
        const currentDir = state.currentDir || '';
        const isImagesDir = currentDir === 'images' || currentDir.endsWith('/images');
        
        logMessage(`[LIST] setItems called. currentFile: ${currentFile}, currentDir: ${currentDir}, isImagesDir: ${isImagesDir}`);
        
        // Clear and populate the select
        fileSelect.innerHTML = '<option value="">Select File</option>';
        
        // Track if we found the file to select
        let fileFound = false;
        
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            // Add rank and index if available
            const displayText = item.index ? `${item.index}. ${item.name}` : item.name;
            option.textContent = displayText;
            if (item.rank) {
                option.dataset.rank = item.rank;
            }
            fileSelect.appendChild(option);
            
            // Select the current file if it matches and we're not in images directory
            // Or select index.md if we are in images directory
            if ((!isImagesDir && currentFile === item.name) || 
                (isImagesDir && item.name === 'index.md')) {
                option.selected = true;
                fileFound = true;
                logMessage(`[LIST] Selecting file: ${item.name} based on current file`);
                // Trigger the onSelect callback
                if (this.options.onSelect) {
                    this.options.onSelect(item);
                }
            }
        });

        // If we didn't find the file but have items, select the first one
        if (!fileFound && items.length > 0) {
            fileSelect.selectedIndex = 1; // First item after the placeholder
            const firstItem = items[0];
            logMessage(`[LIST] File ${currentFile} not found, selecting first file: ${firstItem.name}`);
            if (this.options.onSelect) {
                this.options.onSelect(firstItem);
            }
        }

        // Make the select visible
        fileSelect.style.display = 'block';
        
        logMessage(`[LIST] Loaded ${items.length} items`);
    }
    
    // Method to refresh the handler setup (useful if DOM changes)
    refreshHandler() {
        this.setupFileSelectHandler();
    }
} 