// actions.js - Centralized action handlers
console.log('[DEBUG] actions.js: Module start');
import eventBus from '/client/eventBus.js';
import { withAuthHeaders } from '/client/headers.js';
import { globalFetch } from '/client/globalFetch.js';
import { appState } from '/client/appState.js'; // ADDED: Import central state
import { logMessage } from '/client/log/index.js';


import { refreshPreview } from '/client/previewManager.js'; // UPDATED - Correct function name
import fileManager from '/client/fileManager.js'; // Needed for loadFile
import { loadFile, saveFile } from '/client/fileManager.js';
import { logout } from '/client/auth.js';
import { handleDeleteImageAction } from '/client/imageManager.js'; // Import delete handler


// Helper for logging within this module
function logAction(message, level = 'debug') {
    const type = 'ACTION'
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
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
        if (mode && ['editor', 'preview', 'split'].includes(mode)) { // Validate mode
            logAction(`Triggering setView: ${mode}`);
            // console.log(`[DEBUG actions.js] Publishing ui:viewModeChanged with mode: ${mode}`);
            // eventBus.emit('ui:viewModeChanged', mode);
            // console.log('[DEBUG actions.js] Event published.');
            
            // Log the current state before updating
            console.log('[DEBUG actions.js] Current state before update:', appState.getState().ui);
            
            // ADDED: Update central state
            appState.update(currentState => {
                console.log('[DEBUG actions.js] Inside update callback, currentState:', currentState);
                const newState = {
                    ui: { ...currentState.ui, viewMode: mode }
                };
                console.log('[DEBUG actions.js] Returning new state:', newState);
                return newState;
            });
            
            // Log the state after updating
            console.log('[DEBUG actions.js] Updated state after update:', appState.getState().ui);
            
            logAction(`Updated appState.ui.viewMode to: ${mode}`);
        } else {
            logAction(`setView triggered with invalid or missing viewMode: ${mode}`, 'warning');
            console.warn('[DEBUG actions.js] setView called with invalid/missing viewMode data.', data);
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
        // logAction('Triggering clearLog...'); // <<< SILENCED
        try {
            window.logPanel?.clearLog();
        } catch (e) { logAction(`clearLog failed: ${e.message}`, 'error'); }
    },
    toggleLogVisibility: async () => { 
        // logAction('Triggering toggleLogVisibility via uiState...');
        // try {
        //     const currentVisibility = getUIState('logVisible');
        //     setUIState('logVisible', !currentVisibility);
        // } catch (e) { logAction(`toggleLogVisibility failed: ${e.message}`, 'error'); }
        logAction('Triggering toggleLogVisibility via appState...');
        try {
            // ADDED: Update central state
            const currentVisibility = appState.getState().ui.logVisible;
            appState.update(currentState => ({
                ui: { ...currentState.ui, logVisible: !currentVisibility }
            }));
            logAction(`Updated appState.ui.logVisible to: ${!currentVisibility}`);
        } catch (e) {
            logAction(`toggleLogVisibility update failed: ${e.message}`, 'error');
        }
    },
    minimizeLog: async () => {
        logAction('Triggering minimizeLog (setting logVisible=false via appState)...');
        try {
            // setUIState('logVisible', false); // Use uiState to hide the log
            // ADDED: Update central state
            appState.update(currentState => ({
                ui: { ...currentState.ui, logVisible: false }
            }));
            logAction('Log panel visibility set to false via appState.');
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
        logAction('Refresh Preview action triggered', 'info');
        try {
            // 1. Clear the client-side log panel FIRST
            if (window.logPanel && typeof window.logPanel.clearLog === 'function') {
                 window.logPanel.clearLog();
                 logAction('Client log panel cleared.', 'debug');
             } else {
                 logAction('window.logPanel or clearLog method not found.', 'warning');
             }

            // >>> ADDED: Emit event for host to reset its log <<<
            if (window.previewEventBus && typeof window.previewEventBus.emit === 'function') {
                window.previewEventBus.emit('host:reset_log');
                logAction('Emitted host:reset_log event.', 'debug');
            } else {
                logAction('window.previewEventBus not available, cannot emit host:reset_log', 'warning');
            }

            // 1. Clear the specific logs in the preview pane (Optional - Uncomment if host script uses these IDs)
            // try {
            //     const hostLog = document.getElementById('host-script-log-entries'); // Use the specific container
            //     const eventLog = document.getElementById('event-bus-log-entries'); // Use the specific container
            //     if (hostLog) hostLog.innerHTML = '';
            //     if (eventLog) eventLog.innerHTML = '';
            //     logAction('Cleared host and event bus logs in preview.', 'debug');
            // } catch (e) {
            //     logAction(`Error clearing logs: ${e.message}`, 'error');
            // }

            // 2. Optionally emit an event if some component needs to react before refresh
            // This part seems less necessary now that previewManager handles refresh directly
            // logAction('Emitting preview:force_reload event.', 'debug');
            // if (window.previewEventBus) {
            //     window.previewEventBus.emit('preview:force_reload');
            // } else {
            //     logAction('window.previewEventBus not found, cannot emit force_reload event.', 'warning');
            // }

            // 3. Refresh the actual markdown preview content using previewManager
            logAction('Refreshing markdown preview content via previewManager.refreshPreview().', 'debug');
            await refreshPreview(); // Call the directly imported function
            logAction('Called refreshPreview() successfully', 'debug');
        } catch (error) {
            logAction(`Error refreshing markdown preview: ${error.message}`, 'error');
            console.error('[ACTION refreshPreview ERROR]', error);
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
    pasteLogEntry: (data, element) => {
        console.log('[TEMP DEBUG] Entered pasteLogEntry function in actions.js'); // <<< ADD TEMP DEBUG
        logAction('>>> pasteLogEntry Action Started <<<'); 
        if (!element || element.tagName !== 'BUTTON') { // <<< Ensure element is the button
            logAction(`pasteLogEntry failed: Expected button element, got ${element?.tagName}.`, 'error');
            return;
        }
        const buttonElement = element;
        logAction(`Clicked button element: ${buttonElement.tagName}#${buttonElement.id}.${buttonElement.className}`, 'debug');

        // Get the RAW message from the button's data attribute
        const logText = buttonElement.dataset.logText;
        logAction(`Retrieved RAW log text from button dataset (length ${logText?.length}): \"${logText?.substring(0, 50)}...\"`, 'debug');

        // <<< ADD More Debugging >>>
        if (logText === undefined || logText === null) {
            logAction('Paste failed: logText is undefined or null.', 'error');
            return; // Stop if no text
        }
        if (logText.trim() === '') {
            logAction('Paste failed: logText is empty or whitespace.', 'warning');
            // Allow pasting whitespace if desired, otherwise return
             return; 
        }
        // <<< END Debugging >>>

        try {
            // Use standard textarea access
            const editorTextArea = document.querySelector('#editor-container textarea'); 
            logAction(`Found editor textarea (#editor-container textarea): ${editorTextArea ? 'Yes' : 'No'}`, 'debug');
            // <<< ADD Editor Check >>>
            if (!editorTextArea) {
                logAction('Paste failed: Editor textarea element not found.', 'error');
                alert('Editor is not available to paste into.');
                return; // Stop if no editor
            }
            // <<< END Editor Check >>>

            logAction(`Attempting to insert text into editor...`, 'debug');
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;
            // const currentValue = editorTextArea.value; // No longer needed
            
            // // Insert the log text at the cursor position (OLD METHOD)
            // const newValue = currentValue.substring(0, start) + logText + currentValue.substring(end);
            // editorTextArea.value = newValue;
            
            // // Move cursor to the end of the inserted text
            // const newCursorPos = start + logText.length;
            // editorTextArea.selectionStart = newCursorPos;
            // editorTextArea.selectionEnd = newCursorPos;
            
            // <<< NEW METHOD: Use execCommand for potential undo >>>
            // First, focus the editor and select the range where text should be inserted/replaced
            editorTextArea.focus();
            editorTextArea.setSelectionRange(start, end);
            
            // Execute the insertText command
            const success = document.execCommand('insertText', false, logText);
            if (!success) {
                // Fallback to old method if execCommand fails?
                logAction('execCommand insertText failed. Pasting may not be undoable.', 'warning');
                // Optionally fall back to the direct value manipulation if needed
                // editorTextArea.value = currentValue.substring(0, start) + logText + currentValue.substring(end);
                // editorTextArea.setSelectionRange(start + logText.length, start + logText.length);
                throw new Error('document.execCommand("insertText") failed'); // Or throw error
            }
            // <<< END NEW METHOD >>>
            
            // Focus the editor (redundant but safe)
            // editorTextArea.focus();

            logAction('Log entry pasted into editor.');
            
            // --- Trigger preview update --- 
            if (eventBus) {
                logAction('Emitting editor:contentChanged to trigger preview update.', 'debug');
                eventBus.emit('editor:contentChanged', { content: editorTextArea.value });
            } else {
                logAction('eventBus not available, cannot trigger preview update.', 'warning');
            }
            // --- End Trigger --- 

            // Optional: Show brief feedback on the clicked element (the button)
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '✓'; // Change button text briefly
            buttonElement.classList.add('pasted-feedback'); // Add class for styling
            setTimeout(() => { 
                buttonElement.textContent = originalText; // Restore original text
                buttonElement.classList.remove('pasted-feedback'); // Remove class
            }, 1500); 
        } catch (err) {
            logAction(`Error during text insertion: ${err}`, 'error'); // Log insertion errors
            console.error("Paste Log Entry Error:", err);
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

    // --- ADDED Pause Action ---
    toggleLogPause: () => {
        logAction('Triggering toggleLogPause...');
        try {
            // Call the method on the global instance
            window.logPanel?.togglePause();
        } catch (e) {
            logAction(`toggleLogPause failed: ${e.message}`, 'error');
        }
    },
    // --- END Added Action ---

    // Example action to toggle a setting (replace with actual implementation)
    toggleSetting: async (data) => {
        logAction(`Toggling setting: ${data.settingName}`);
        // Implementation...
    },

    // Example action to toggle the preview mode (e.g., between 'live' and 'html')
    togglePreviewMode: async (data) => {
        const newMode = data.mode; // Assume mode is passed in data, e.g., { mode: 'html' }
        if (!newMode) {
            logAction('Toggle Preview Mode failed: No mode specified.', 'warning');
            return;
        }
        logAction(`Toggling preview mode to: ${newMode}`, 'info');
        try {
            if (window.setPreviewMode) { // Assuming a global function exists
                window.setPreviewMode(newMode);
                logAction(`Preview mode set to ${newMode}.`, 'info');
            } else {
                logAction('setPreviewMode function not found.', 'warning');
            }
        } catch (error) {
            logAction(`Error toggling preview mode: ${error.message}`, 'error');
            console.error('[ACTION togglePreviewMode ERROR]', error);
        }
    },

    // <<< NEW ACTION >>>
    toggleLogMenu: () => {
        // logAction('Toggling log menu visibility...'); // <<< SILENCED
        const menuContainer = document.getElementById('log-menu-container');
        if (menuContainer) {
            menuContainer.classList.toggle('visible');
            // logAction(`Log menu container visibility toggled. Has class 'visible': ${menuContainer.classList.contains('visible')}`); // <<< SILENCED
        } else {
            // logAction('Log menu container (#log-menu-container) not found.', 'error'); // Keep error log?
        }
    },
    // <<< END NEW ACTION >>>

    // <<< NEW ACTION: Paste CLI Response over $$ Selection >>>
    pasteCliResponseOverSelection: (data, element) => {
        logAction('>>> pasteCliResponseOverSelection Action Started <<<');
        if (!element || element.tagName !== 'BUTTON') { 
            logAction(`PasteOver failed: Expected button element, got ${element?.tagName}.`, 'error');
            return;
        }
        const buttonElement = element;

        // Retrieve data from button dataset
        const start = parseInt(buttonElement.dataset.selectionStart, 10);
        const end = parseInt(buttonElement.dataset.selectionEnd, 10);
        const responseText = buttonElement.dataset.responseText;

        logAction(`PasteOver: Start=${start}, End=${end}, ResponseText Length=${responseText?.length}`, 'debug');

        // Validate data
        if (isNaN(start) || isNaN(end) || responseText === undefined || responseText === null) {
            logAction('PasteOver failed: Invalid data retrieved from button dataset.', 'error');
            return;
        }

        try {
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (!editorTextArea) {
                logAction('PasteOver failed: Editor textarea not found.', 'error');
                alert('Editor is not available to paste into.');
                return;
            }

            // Select the original range
            editorTextArea.focus();
            editorTextArea.setSelectionRange(start, end);

            // Execute the insertText command to replace selection
            const success = document.execCommand('insertText', false, responseText);
            if (!success) {
                logAction('PasteOver execCommand insertText failed.', 'warning');
                throw new Error('document.execCommand("insertText") failed');
            }

            logAction('CLI Response pasted over original selection.');

            // Trigger preview update
            if (eventBus) {
                eventBus.emit('editor:contentChanged', { content: editorTextArea.value });
            }

            // Optional: Feedback on button
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '✓'; 
            setTimeout(() => { buttonElement.innerHTML = originalHTML; }, 1500);

        } catch (err) {
            logAction(`Error during PasteOver insertion: ${err}`, 'error');
            console.error("Paste Over Selection Error:", err);
        }
    },
    // <<< END NEW ACTION >>>

    // <<< NEW ACTION: Copy Log Entry Text to Clipboard >>>
    copyLogEntryToClipboard: async (data, element) => {
        logAction('>>> copyLogEntryToClipboard Action Started <<<');
        if (!element || element.tagName !== 'BUTTON') { 
            logAction(`CopyEntry failed: Expected button element, got ${element?.tagName}.`, 'error');
            return;
        }
        const buttonElement = element;
        const logText = data?.logText; // Get text passed in data

        if (logText === undefined || logText === null) {
            logAction('CopyEntry failed: logText is undefined or null.', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(logText);
            logAction('Log entry text copied to clipboard.');
            
            // Feedback
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '✓ Copied'; 
            buttonElement.disabled = true;
            setTimeout(() => { 
                buttonElement.innerHTML = originalHTML;
                buttonElement.disabled = false; 
            }, 1500);

        } catch (err) {
            logAction(`Failed to copy log entry to clipboard: ${err}`, 'error');
            console.error("Copy Log Entry Error:", err);
            // Optionally show error feedback on button
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '❌ Error'; 
            setTimeout(() => { buttonElement.innerHTML = originalHTML; }, 2000);
        }
    },
    // <<< END NEW ACTION >>>

    // <<< NEW ACTIONS for A/B State >>>
    setSelectionStateA: (data, element) => {
        logAction('Setting Selection State A...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        const currentFile = appState.getState().file?.currentFile; // Get current file path from central state
        
        if (editorTextArea && currentFile !== undefined) {
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;
            const text = editorTextArea.value.substring(start, end);

            if (start === end) {
                 logAction('Cannot set State A: No text selected.', 'warning');
                 alert('Cannot store state: No text selected in editor.');
                 return;
            }

            const stateData = { filePath: currentFile, start, end, text };
            if (window.logPanel) {
                window.logPanel._selectionStateA = stateData;
                logAction(`State A stored: File=${currentFile}, Start=${start}, End=${end}, Text Length=${text.length}`);
                // Add visual feedback to button
                element?.classList.add('state-set');
                // <<< NEW: Update Tooltip >>>
                if (element) {
                    const snippet = text.substring(0, 50).replace(/\\n/g, ' '); // Show first 50 chars, replace newlines
                    element.title = `State A: ${currentFile} | Range: [${start}-${end}] | Text: \"${snippet}...\"`;
                }
                // Remove feedback after a delay?
                // setTimeout(() => element?.classList.remove('state-set'), 2000);
            } else {
                logAction('Cannot set State A: LogPanel instance not found.', 'error');
            }
        } else {
             logAction(`Cannot set State A: Editor (${!!editorTextArea}) or file path (${currentFile}) not found.`, 'error');
        }
    },
    setSelectionStateB: (data, element) => {
        logAction('Setting Selection State B...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        const currentFile = appState.getState().file?.currentFile; // Get current file path

        if (editorTextArea && currentFile !== undefined) {
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;
            const text = editorTextArea.value.substring(start, end);

            if (start === end) {
                 logAction('Cannot set State B: No text selected.', 'warning');
                 alert('Cannot store state: No text selected in editor.');
                 return;
            }

            const stateData = { filePath: currentFile, start, end, text };
            if (window.logPanel) {
                window.logPanel._selectionStateB = stateData;
                logAction(`State B stored: File=${currentFile}, Start=${start}, End=${end}, Text Length=${text.length}`);
                element?.classList.add('state-set');
                // <<< NEW: Update Tooltip >>>
                if (element) {
                    const snippet = text.substring(0, 50).replace(/\\n/g, ' '); // Show first 50 chars, replace newlines
                    element.title = `State B: ${currentFile} | Range: [${start}-${end}] | Text: \"${snippet}...\"`;
                }
            } else {
                logAction('Cannot set State B: LogPanel instance not found.', 'error');
            }
        } else {
             logAction(`Cannot set State B: Editor (${!!editorTextArea}) or file path (${currentFile}) not found.`, 'error');
        }
    },
    // <<< END NEW ACTIONS >>>

    // <<< NEW ACTION: Paste Text at Cursor >>>
    pasteTextAtCursor: (data) => {
        const textToPaste = data?.textToPaste;
        logAction('>>> pasteTextAtCursor Action Started <<<');
        
        if (textToPaste === undefined || textToPaste === null) {
            logAction('PasteText failed: textToPaste is undefined or null.', 'error');
            return;
        }

        try {
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (!editorTextArea) {
                logAction('PasteText failed: Editor textarea not found.', 'error');
                alert('Editor is not available to paste into.');
                return;
            }

            // Get current cursor position
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;

            // Select the current range (usually just the cursor position)
            editorTextArea.focus();
            editorTextArea.setSelectionRange(start, end);

            // Execute the insertText command to insert/replace
            const success = document.execCommand('insertText', false, textToPaste);
            if (!success) {
                logAction('PasteText execCommand insertText failed.', 'warning');
                throw new Error('document.execCommand("insertText") failed');
            }

            logAction('Text pasted into editor at cursor.');

            // Trigger preview update
            if (eventBus) {
                eventBus.emit('editor:contentChanged', { content: editorTextArea.value });
            }

        } catch (err) {
            logAction(`Error during PasteText insertion: ${err}`, 'error');
            console.error("Paste Text Error:", err);
        }
    },
    // <<< END NEW ACTION >>>

    // --- END NEW ACTIONS >>>

    copyLogEntryToClipboard: async (data, element) => {
        logAction('>>> copyLogEntryToClipboard Action Started <<<');
        if (!element || element.tagName !== 'BUTTON') { 
            logAction(`CopyEntry failed: Expected button element, got ${element?.tagName}.`, 'error');
            return;
        }
        const buttonElement = element;
        const logText = data?.logText; // Get text passed in data

        if (logText === undefined || logText === null) {
            logAction('CopyEntry failed: logText is undefined or null.', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(logText);
            logAction('Log entry text copied to clipboard.');
            
            // Feedback
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '✓ Copied'; 
            buttonElement.disabled = true;
            setTimeout(() => { 
                buttonElement.innerHTML = originalHTML;
                buttonElement.disabled = false; 
            }, 1500);

        } catch (err) {
            logAction(`Failed to copy log entry to clipboard: ${err}`, 'error');
            console.error("Copy Log Entry Error:", err);
            // Optionally show error feedback on button
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '❌ Error'; 
            setTimeout(() => { buttonElement.innerHTML = originalHTML; }, 2000);
        }
    },
    // <<< END NEW ACTION >>>

    // <<< NEW ACTIONS for A/B State >>>
    setSelectionStateA: (data, element) => {
        logAction('Setting Selection State A...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        const currentFile = appState.getState().file?.currentFile; // Get current file path from central state
        
        if (editorTextArea && currentFile !== undefined) {
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;
            const text = editorTextArea.value.substring(start, end);

            if (start === end) {
                 logAction('Cannot set State A: No text selected.', 'warning');
                 alert('Cannot store state: No text selected in editor.');
                 return;
            }

            const stateData = { filePath: currentFile, start, end, text };
            if (window.logPanel) {
                window.logPanel._selectionStateA = stateData;
                logAction(`State A stored: File=${currentFile}, Start=${start}, End=${end}, Text Length=${text.length}`);
                // Add visual feedback to button
                element?.classList.add('state-set');
                // <<< NEW: Update Tooltip >>>
                if (element) {
                    const snippet = text.substring(0, 50).replace(/\\n/g, ' '); // Show first 50 chars, replace newlines
                    element.title = `State A: ${currentFile} | Range: [${start}-${end}] | Text: \"${snippet}...\"`;
                }
                // Remove feedback after a delay?
                // setTimeout(() => element?.classList.remove('state-set'), 2000);
            } else {
                logAction('Cannot set State A: LogPanel instance not found.', 'error');
            }
        } else {
             logAction(`Cannot set State A: Editor (${!!editorTextArea}) or file path (${currentFile}) not found.`, 'error');
        }
    },
    setSelectionStateB: (data, element) => {
        logAction('Setting Selection State B...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        const currentFile = appState.getState().file?.currentFile; // Get current file path

        if (editorTextArea && currentFile !== undefined) {
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;
            const text = editorTextArea.value.substring(start, end);

            if (start === end) {
                 logAction('Cannot set State B: No text selected.', 'warning');
                 alert('Cannot store state: No text selected in editor.');
                 return;
            }

            const stateData = { filePath: currentFile, start, end, text };
            if (window.logPanel) {
                window.logPanel._selectionStateB = stateData;
                logAction(`State B stored: File=${currentFile}, Start=${start}, End=${end}, Text Length=${text.length}`);
                element?.classList.add('state-set');
                // <<< NEW: Update Tooltip >>>
                if (element) {
                    const snippet = text.substring(0, 50).replace(/\\n/g, ' '); // Show first 50 chars, replace newlines
                    element.title = `State B: ${currentFile} | Range: [${start}-${end}] | Text: \"${snippet}...\"`;
                }
            } else {
                logAction('Cannot set State B: LogPanel instance not found.', 'error');
            }
        } else {
             logAction(`Cannot set State B: Editor (${!!editorTextArea}) or file path (${currentFile}) not found.`, 'error');
        }
    },
    // <<< END NEW ACTIONS >>>
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
