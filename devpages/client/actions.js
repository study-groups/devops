// actions.js - Centralized action handlers
console.log('[DEBUG] actions.js: Module start');
import eventBus from '/client/eventBus.js';
import { withAuthHeaders } from '/client/headers.js';
import { globalFetch } from '/client/globalFetch.js';
import { getUIState, setUIState } from '/client/uiState.js';
import { logMessage } from '/client/log/index.js';


import { refreshPreview } from '/client/previewManager.js'; // UPDATED - Correct function name
import fileManager from '/client/fileManager.js'; // Needed for loadFile
import { loadFile, saveFile } from '/client/fileManager.js';
import { logout } from '/client/auth.js';
import { handleDeleteImageAction } from '/client/imageManager.js'; // Import delete handler


// Helper for logging within this module
function logAction(message, level = 'text') {
    const type = 'ACTION'
    if (typeof window.logMessage === 'function') {
        window.logMessage(message,type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${type}: ${message}`);
    }
}

// Initialize all action handlers
export function initializeActions() {
    console.log('[DEBUG] actions.js: initializeActions() called');
    // Image actions
    registerImageActions();
    
    // File actions
    registerFileActions();
    
    // REMOVED: Auth actions registration via event bus is no longer needed here
    // registerAuthActions();
    
    logAction('Action handlers registration complete (auth handled directly).');
}

// Register image-related actions
function registerImageActions() {
    // Handle image deletion
    eventBus.on('image:delete', async ({ imageName }) => {
        logAction(`Delete requested for image: ${imageName}`);
        
        if (confirm(`Are you sure you want to delete ${decodeURIComponent(imageName)}?`)) {
            try {
                const imageUrl = `/uploads/${decodeURIComponent(imageName)}`;
                
                // Use the emergency endpoint
                const response = await globalFetch('/image-delete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: imageUrl })
                });
                
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Server error: ${response.status} ${text}`);
                }
                
                const data = await response.json();
                logAction(`Successfully deleted: ${imageName}`);
                
                // Notify of successful deletion
                eventBus.emit('image:deleted', { imageName });
                
                // Reload the page to refresh the index
                window.location.reload();
            } catch (error) {
                logAction(`Image delete error: ${error.message}`, 'error');
                alert(`Error deleting image: ${error.message}`);
                
                // Notify of failed deletion
                eventBus.emit('image:deleteError', { imageName, error: error.message });
            }
        }
    });
    
    // Add other image actions here
    
    logAction('Image actions registered');
}

// Register file-related actions
function registerFileActions() {
    // Example: Add listener if needed, but direct triggers are preferred now
    // eventBus.on('file:save', async ({ filename, directory, content }) => {
    //     // ... 
    // });
    logAction('File actions registered (now mostly via triggerActions)');
}


console.log('[DEBUG] actions.js: Defining triggerActions...');
// Export direct action triggers for convenience
export const triggerActions = {
    deleteImage: (imageName) => eventBus.emit('image:delete', { imageName }),
    
    // MODIFIED: Emit event instead of calling handleLogin
    login: (username, password) => { // No need for async here anymore
        logAction(`Triggering login action for user: ${username}`);
        // Emit the event that auth.js is listening for
        eventBus.emit('auth:loginRequested', { username, password }); 
        logAction(`Emitted auth:loginRequested for user: ${username}`);
    },
    logout: async () => {
        logAction('Triggering logout action...');
        try {
            await logout();
             // Success/failure is now handled by components subscribing to appState
        } catch (error) {
            logAction(`logout call failed: ${error.message}`, 'error');
             // Optionally show an alert or rely on appState error handling
            alert(`Logout failed: ${error.message}`);
        }
    },
    
    saveFile: async () => {
        logAction('Triggering saveFile action...');
        try {
            // Use the imported saveFile function directly
            const success = await saveFile(); // Assuming saveFile is exported and handles getting content
            if (success) {
                logAction('saveFile executed successfully.');
            } else {
                logAction('saveFile failed.', 'error');
            }
        } catch (error) {
            logAction(`Error during saveFile trigger: ${error.message}`, 'error');
            alert('An error occurred while trying to save.');
        }
    },

    // --- View Mode --- 
    setView: (data) => {
        console.log('[DEBUG actions.js] setView action triggered. Data:', data);
        const mode = data.viewMode;
        if (mode) {
            logAction(`Triggering setView: ${mode}`);
            console.log(`[DEBUG actions.js] Publishing ui:viewModeChanged with mode: ${mode}`);
            eventBus.emit('ui:viewModeChanged', mode);
            console.log('[DEBUG actions.js] Event published.');
        } else {
            logAction('setView triggered without viewMode data.', 'warning');
            console.warn('[DEBUG actions.js] setView called without viewMode data.', data);
        }
    },

    // --- Log Toolbar Actions ---
    copyLog: async () => {
        logAction('Triggering copyLog...');
        try {
            // Use the global LogPanel instance
            window.logPanel?.copyLog(); 
        } catch (e) { logAction(`copyLog failed: ${e.message}`, 'error'); }
    },
    clearLog: async () => {
        logAction('Triggering clearLog...');
        try {
            // Use the global LogPanel instance
            window.logPanel?.clearLog();
        } catch (e) { logAction(`clearLog failed: ${e.message}`, 'error'); }
    },
    toggleLogVisibility: async () => { 
        logAction('Triggering toggleLogVisibility via uiState...');
        try {
            const currentVisibility = getUIState('logVisible');
            setUIState('logVisible', !currentVisibility);
        } catch (e) { logAction(`toggleLogVisibility failed: ${e.message}`, 'error'); }
    },
    minimizeLog: async () => {
        logAction('Triggering minimizeLog...');
        try {
            setUIState('logVisible', false); // Use uiState to hide the log
            logAction('Log panel visibility set to false.');
        } catch (e) {
            logAction(`minimizeLog failed: ${e.message}`, 'error');
        }
    },
    showSystemInfo: async () => {
        logAction('Triggering showSystemInfo (calling showAppInfo)...');
        try {
            window.dev?.showAppInfo?.();
        } catch (e) { logAction(`showSystemInfo/showAppInfo failed: ${e.message}`, 'error'); }
    },

    // --- Debug Actions (now using global debug object) ---
    runDebugUI: async () => {
        logAction('Triggering runAllDiagnostics...');
        try {
            await window.dev?.runAllDiagnostics?.(); 
        } catch (e) { logAction(`runAllDiagnostics failed: ${e.message}`, 'error'); }
    },
    showAppInfo: async () => { 
        logAction('Triggering showAppInfo...');
        try {
            window.dev?.showAppInfo?.();
        } catch (e) { logAction(`showAppInfo failed: ${e.message}`, 'error'); }
    },
    debugAllApiEndpoints: async () => {
        logAction('Triggering debugAllApiEndpoints...');
        try {
            await window.dev?.debugAllApiEndpoints?.(); 
        } catch (e) { logAction(`debugAllApiEndpoints failed: ${e.message}`, 'error'); }
    },
    debugUrlParameters: async () => { // New action
        logAction('Triggering debugUrlParameters...');
        try {
            // CORRECTED: Use window.dev
            window.dev?.debugUrlParameters?.(); 
        } catch (e) { logAction(`debugUrlParameters failed: ${e.message}`, 'error'); }
    },
    debugFileList: async () => { // New action
        logAction('Triggering debugFileList...');
        try {
            // CORRECTED: Use window.dev
            window.dev?.debugFileList?.(); 
        } catch (e) { logAction(`debugFileList failed: ${e.message}`, 'error'); }
    },
     debugFileLoadingIssues: async () => {
        logAction('Manually triggering file manager initialization for debugging...');
        try {
            // CORRECTED: Call named export directly
            const { initializeFileManager } = await import('/client/fileManager.js');
            await initializeFileManager(); 
            logAction('File manager initialization attempt complete.');
        } catch (error) {
            logAction(`Failed to initialize file manager: ${error.message}`, 'error');
        }
    },
    debugAuthState: async () => {
        logAction('Debugging Auth State...');
        try {
            // Use appState instead of authState directly
            const { appState } = await import('/client/appState.js'); 
            const currentState = appState.getState().auth; // Get auth slice from appState
            logAction(`Current Auth State (from appState): ${JSON.stringify(currentState)}`);
            logAction(`Is Logged In: ${currentState.isLoggedIn}`); // Use isLoggedIn from appState.auth
        } catch (error) {
            logAction(`Error loading appState or auth state: ${error.message}`, 'error');
        }
    },

    // --- NEW Nav Bar Actions ---
    refreshPreview: async () => {
        logAction('Triggering refreshPreview...');
        try {
            await refreshPreview(); // Call the correctly imported function
        } catch (error) {
            logAction(`Error during refreshPreview trigger: ${error.message}`, 'error');
            console.error('[ACTION ERROR] refreshPreview', error);
        }
    },
    loadFile: async (data = {}) => {
        logAction(`Triggering loadFile action...`);
        try {
            const filename = data?.filename;
            logAction(`  Filename from data: ${filename}`);

            if (filename) {
                // Filename provided in the action data (e.g., from future uses)
                logAction(`  Emitting navigate:file for provided filename: ${filename}`);
                eventBus.emit('navigate:file', { filename: filename });
            } else {
                // No filename in data, try to get from the file select dropdown
                logAction('  No filename in data, checking file-select dropdown.');
                const fileSelect = document.getElementById('file-select');
                const selectedFile = fileSelect?.value;

                if (selectedFile) {
                    logAction(`  Found selected file in dropdown: ${selectedFile}. Emitting navigate:file.`);
                    eventBus.emit('navigate:file', { filename: selectedFile });
                } else {
                    logAction('  Cannot load file: No filename provided and file select has no value.', 'error');
                    alert('Cannot load file: No file selected.');
                }
            }
        } catch (error) {
            logAction(`Error during loadFile trigger: ${error.message}`, 'error');
            alert('An error occurred while trying to load the file.');
        }
    },
    refreshPreview: async () => {
        logAction('Manual refresh triggered', 'debug');
        const editor = document.getElementById('md-editor');
        if (editor) {
            const { updateMarkdownPreview } = await import('/client/markdown.js');
            updateMarkdownPreview(editor.value);
        }
    },
    loadFile: async (data) => {
        // Get the filename either from the data parameter or from the file select element
        let filenameToLoad = data?.filename;
        
        if (!filenameToLoad) {
            // Try to get from #file-select
            const fileSelect = document.getElementById('file-select');
            if (fileSelect && fileSelect.value) {
                filenameToLoad = fileSelect.value;
                logAction(`Getting filename from #file-select: ${filenameToLoad}`);
            } else {
                // As a last resort, try to get from current file state
                const fileManager = await import('/client/fileManager.js');
                if (fileManager.default?.getCurrentFile) {
                    filenameToLoad = fileManager.default.getCurrentFile();
                    logAction(`Getting filename from fileManager state: ${filenameToLoad}`);
                }
            }
            
            if (!filenameToLoad) {
                logAction('Error: No filename found in data, select element, or file state.', 'error');
                return;
            }
        }
        
        logAction(`Load file action triggered for: ${filenameToLoad}`, 'debug');
        try {
            const fileManager = await import('/client/fileManager.js');
            
            // Check if fileManager.default exists and has the necessary functions
            if (!fileManager.default) {
                logAction('Error: fileManager module not available.', 'error');
                return;
            }

            const topLevelDir = document.getElementById('dir-select')?.value || '';
            
            // Get the subdirectory if selected
            let relativePath = '';
            const subdirSelect = document.getElementById('subdir-select');
            if (subdirSelect && subdirSelect.value) {
                // Remove trailing slash if present (e.g., "iframe/" becomes "iframe")
                relativePath = subdirSelect.value.replace(/\/$/, '');
                logAction(`Using subdirectory from dropdown: ${relativePath}`, 'debug');
            }
            
            logAction(`Attempting to load '${filenameToLoad}' with context: Top='${topLevelDir}', Rel='${relativePath}'`, 'debug');

            // Call loadFile with all required arguments
            await fileManager.default.loadFile(filenameToLoad, topLevelDir, relativePath);
             
            logAction(`File load attempt complete for ${filenameToLoad}.`);
        } catch (error) {
            logAction(`Error loading file via fileManager: ${error.message}`, 'error');
            console.error('[ACTION loadFile ERROR]', error); // Log the full error
        }
    },

    // --- Updated: Static HTML Download Action (Client-Side) ---
    downloadStaticHTML: async () => { // Made async to await fileManager import
        logAction('Triggering client-side downloadStaticHTML...');
        try {
            logAction('Generating static HTML from Markdown preview area...');
            
            // Import editorCore to get content
            const { getContent } = await import('/client/editor.js'); // Import specific function
            
            // Import file system state for metadata
            const { getCurrentFile, getCurrentDirectory } = await import('/client/fileSystemState.js');
            
            // Get file info from fileSystemState
            let currentFile = getCurrentFile() || 'unknown_file';
            let currentDir = getCurrentDirectory() || 'unknown_dir';
            
            // 1. Get the Markdown preview element again
            const previewElement = document.getElementById('md-preview');
            if (!previewElement) {
                throw new Error('Markdown preview element (#md-preview) not found.');
            }
            
            // 2. Get preview's rendered inner HTML content for the body
            const previewContent = previewElement.innerHTML;
            // 3. Get original Markdown for the comment
            const markdownContent = getContent() || ''; // Use imported getContent()
            const generationTime = new Date().toISOString();
            
            // 4. Construct YAML Front Matter (within the comment)
            const yamlFrontMatter = `---
file: ${currentFile}
directory: ${currentDir}
generated_at: ${generationTime}
---`;
            
            // 5. Construct the hidden div containing metadata and source
            const metadataContainer = `
<div id="devpages-metadata-source" style="display:none; height:0; overflow:hidden; position:absolute;">
<pre># --- DevPages Metadata & Source --- #
${yamlFrontMatter}

## Original Markdown Source ##

${markdownContent}
</pre>
</div>`;
            
            // 6. Create the full HTML structure
            const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${currentFile}</title> <!-- Updated title -->
  <link rel="stylesheet" href="/client/preview.css"> 
</head>
<body>
  <div class="markdown-body">
${previewContent} <!-- Use rendered HTML here -->
  </div>
${metadataContainer} <!-- Added hidden div at the end of body -->
</body>
</html>`;
            
            // 7. Create a Blob from the HTML content
            const blob = new Blob([htmlContent], { type: 'text/html' });
            
            // 8. Create an Object URL for the Blob
            const url = window.URL.createObjectURL(blob);
            
            // 9. Create a temporary link element
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'preview.html'; // Set the desired filename
            
            // 10. Append the link to the body and trigger the download
            document.body.appendChild(a);
            a.click();
            
            // 11. Clean up: Revoke the Object URL and remove the link
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            logAction('Static HTML generated from preview (with metadata) and download initiated.');

        } catch (error) {
            logAction(`Error during client-side downloadStaticHTML: ${error.message}`, 'error');
            logAction(`[ACTION ERROR] Failed to generate static HTML: ${error.message}`, 'error');
            alert(`Failed to generate static HTML: ${error.message}`); // Notify user
        }
    },

    // --- Image Actions ---
    'delete-image': handleDeleteImageAction, // Map the action string to the handler

    // --- Clipboard Actions ---
    copyLog: async () => {
        logAction('Triggering copyLog...');
        try {
            // Use the global LogPanel instance
            window.logPanel?.copyLog(); 
        } catch (e) { logAction(`copyLog failed: ${e.message}`, 'error'); }
    },

    // --- Log Entry Actions ---
    copyLogEntry: async (data, element) => {
        logAction('Triggering copyLogEntry...');
        if (!element) {
            logAction('copyLogEntry failed: No element provided.', 'error');
            return;
        }
        const logEntryDiv = element.closest('.log-entry');
        const textSpan = logEntryDiv?.querySelector('.log-entry-text');
        if (textSpan?.textContent) {
            try {
                await navigator.clipboard.writeText(textSpan.textContent);
                logAction('Log entry copied to clipboard.');
                // Optional: Show brief feedback
                const originalText = element.textContent;
                element.textContent = '✓';
                setTimeout(() => { element.textContent = originalText; }, 1000);
            } catch (err) {
                logAction(`Failed to copy log entry: ${err}`, 'error');
            }
        } else {
            logAction('Could not find text content for log entry.', 'warning');
        }
    },
    pasteLogEntry: async (data, element) => {
        logAction('Triggering pasteLogEntry...');
        if (!element) {
            logAction('pasteLogEntry failed: No element provided.', 'error');
            return;
        }
        const logEntryDiv = element.closest('.log-entry');
        const textSpan = logEntryDiv?.querySelector('.log-entry-text');
        if (textSpan?.textContent) {
            try {
                // Attempt to get editor instance (adapt this if needed)
                const editor = window.editorInstance; // Or use getEditorInstance()
                if (editor && typeof editor.replaceSelection === 'function') {
                    editor.replaceSelection(textSpan.textContent);
                    logAction('Log entry pasted into editor.');
                    // Optional: Show brief feedback
                    const originalText = element.textContent;
                    element.textContent = '✓';
                    setTimeout(() => { element.textContent = originalText; }, 1000);
                } else {
                    logAction('Editor instance not found or lacks replaceSelection method.', 'error');
                    alert('Could not paste into editor. Editor not available.');
                }
            } catch (err) {
                logAction(`Failed to paste log entry: ${err}`, 'error');
            }
        } else {
            logAction('Could not find text content for log entry.', 'warning');
        }
    },
    cLogEntry: async (data, element) => {
        logAction('Triggering cLogEntry (placeholder)...');
        if (!element) {
            logAction('cLogEntry failed: No element provided.', 'error');
            return;
        }
        const logEntryDiv = element.closest('.log-entry');
        const textSpan = logEntryDiv?.querySelector('.log-entry-text');
        logAction(`Placeholder action C triggered for log entry: ${textSpan?.textContent?.substring(0, 50)}...`);
        alert('Action C is not yet implemented.');
        // Optional: Show brief feedback
        const originalText = element.textContent;
        element.textContent = '?';
        setTimeout(() => { element.textContent = originalText; }, 1000);
    },
};

// <<< ADD LOG AFTER triggerActions >>>
console.log('[DEBUG] actions.js: Defined triggerActions:', Object.keys(triggerActions));

// Backwards compatibility - Map old functions if needed

async function executeAction(action, params = {}) {
  logAction(`Executing: ${action}`);
  
  // Dynamically import modules only when needed
  try {
    switch(action) {
      // ... existing code ...
      case 'initFileManager': {
        // Import from client/
        const { initializeFileManager } = await import('/client/fileManager.js'); 
        await initializeFileManager();
        break;
      }
      case 'loadDirectory': {
        // Import from client/
        const { loadFiles } = await import('/client/fileManager.js'); 
        await loadFiles(params.directory);
        break;
      }
      case 'loadFile': {
        // Import from client/
        const { loadFile } = await import('/client/fileManager.js'); 
        await loadFile(params.filename, params.directory);
        break;
      }
      case 'saveFile': {
        // Import from client/
        const { saveFile } = await import('/client/fileManager.js'); 
        await saveFile(params.filename, params.directory, params.content);
        break;
      }
      // ... existing code ...
    }
  } catch (error) {
    logAction(`[ACTION ERROR] Failed to execute ${action}: ${error.message}`, 'error');
    console.error(`[ACTION ERROR] Action: ${action}`, error);
  }
}

async function handleSaveClick() {
  // Use appState to check if authenticated
  const { appState } = await import('/client/appState.js'); 
  if (!appState.getState().auth.isLoggedIn) { // Check central state
    logAction('[ACTION] User not logged in, cannot save.', 'warning');
    alert('You must be logged in to save.');
    return;
  }
  // ... rest of save logic ...
  logAction('Save click approved (User logged in) - Actual save needs implementation here or call triggerActions.saveFile');
  // Example: triggerActions.saveFile(); // If this function is meant to trigger the save
}
