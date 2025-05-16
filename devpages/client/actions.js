// actions.js - Centralized action handlers
console.log('[DEBUG] actions.js: Module start');
import eventBus from '/client/eventBus.js';
import { withAuthHeaders } from '/client/headers.js';
import { globalFetch } from '/client/globalFetch.js';
import { appStore } from '/client/appState.js'; // Correct import
import { logMessage } from '/client/log/index.js';
import { ActionTypes, dispatch } from '/client/messaging/messageQueue.js';
import fileManager from '/client/filesystem/fileManager.js'; // Needed for loadFile (Updated path)
import { loadFile, saveFile } from '/client/filesystem/fileManager.js'; // (Updated path)
import { logout } from '/client/auth.js';
import { handleDeleteImageAction } from '/client/image/imageManager.js'; // Updated path
import { downloadStaticHTML } from '/client/utils/staticHtmlGenerator.js'; // Use the correct absolute path
import { refreshPreview as refreshPreviewFunction } from '/client/previewManager.js';
import { editor } from '/client/editor.js';


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
            console.log('[DEBUG actions.js] Current state before update:', appStore.getState().ui);
            
            // ADDED: Update central state
            appStore.update(currentState => {
                console.log('[DEBUG actions.js] Inside update callback, currentState:', currentState);
                const newState = {
                    ui: { ...currentState.ui, viewMode: mode }
                };
                console.log('[DEBUG actions.js] Returning new state:', newState);
                return newState;
            });
            
            // Log the state after updating
            console.log('[DEBUG actions.js] Updated state after update:', appStore.getState().ui);
            
            logAction(`Updated appState.ui.viewMode to: ${mode}`);
        } else {
            logAction(`setView triggered with invalid or missing viewMode: ${mode}`, 'warning');
            console.warn('[DEBUG actions.js] setView called with invalid/missing viewMode data.', data);
        }
    },

    // --- Log Toolbar Actions ---
    copyLog: async () => {
        // logAction('Triggering copyLog...'); // <<< SILENCED
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
        logAction('Triggering toggleLogVisibility via dispatch...');
        try {
            dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
        } catch (e) {
            logAction(`toggleLogVisibility dispatch failed: ${e.message}`, 'error');
        }
    },
    minimizeLog: async () => {
        logAction('Triggering minimizeLog via dispatch...');
        try {
            dispatch({ type: ActionTypes.UI_SET_LOG_VISIBILITY, payload: false });
        } catch (e) {
            logAction(`minimizeLog dispatch failed: ${e.message}`, 'error');
        }
    },
    showSystemInfo: async () => {
        // logAction('Triggering showSystemInfo (calling showAppInfo)...'); // <<< SILENCED
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
            const { initializeFileManager } = await import('/client/filesystem/fileManager.js');
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
            const { appStore } = await import('/client/appState.js'); 
            const currentState = appStore.getState().auth; // Get auth slice from appState
            logAction(`Current Auth State (from appState): ${JSON.stringify(currentState)}`);
            logAction(`Is Logged In: ${currentState.isLoggedIn}`); // Use isLoggedIn from appState.auth
        } catch (error) {
            logAction(`Error loading appState or auth state: ${error.message}`, 'error');
        }
    },

    // --- NEW Nav Bar Actions ---
    refreshPreview: (params, element) => {
        console.log('[Action] refreshPreview triggered');
        try {
            // CORRECTED: Call the imported and aliased function
            refreshPreviewFunction();
        } catch (error) {
            console.error('[Action refreshPreview ERROR]', error);
            // Optionally show an error message to the user
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
                const fileManager = await import('/client/filesystem/fileManager.js');
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
            const fileManager = await import('/client/filesystem/fileManager.js');
            
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

    // --- FIXED & REFINED: Static HTML Download Action ---
    downloadStaticHTML: async () => {
        logAction('Triggering static HTML generation via imported function...');
        // Call the refactored function
        await downloadStaticHTML();
    },

    // --- Image Actions ---
    'delete-image': handleDeleteImageAction, // Map the action string to the handler

    // --- Clipboard Actions ---
    copyLog: async () => {
        // logAction('Triggering copyLog...'); // <<< SILENCED
        try {
            window.logPanel?.copyLog();
        } catch (e) { logAction(`copyLog failed: ${e.message}`, 'error'); }
    },

    // --- Log Entry Actions ---
    copyLogEntry: async (data, element) => {
        // logAction('Triggering copyLogEntry...'); // <<< SILENCED for now
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
            // Actual implementation would be here
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
    toggleLogMenu: (() => {
        let lastToggleTime = 0;
        const THROTTLE_MS = 200; // Prevent toggle more than once per 200ms
        
        return () => {
            const now = Date.now();
            if (now - lastToggleTime < THROTTLE_MS) {
                console.log('[Action] toggleLogMenu throttled - preventing rapid re-trigger');
                return;
            }
            
            lastToggleTime = now;
            console.log('[Action] Triggering toggleLogMenu...');
            
            try {
                appStore.update(currentState => {
                    const newLogMenuVisibleState = !currentState.ui.logMenuVisible;
                    console.log(`[Action] Log menu visibility will be set to: ${newLogMenuVisibleState}`);
                    
                    const currentUiState = currentState.ui || {};
                    return {
                        ...currentState,
                        ui: {
                            ...currentUiState,
                            logMenuVisible: newLogMenuVisibleState
                        }
                    };
                });
            } catch (e) {
                console.error(`[Action] toggleLogMenu failed: ${e.message}`);
            }
        };
    })(),
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

    // <<< MODIFIED ACTIONS for A/B State (LogPanel Toolbar Buttons) >>>
    setSelectionStateA: (data, element) => {
        logAction('Setting Selection State A...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        let currentFile = appStore.getState().file?.currentFile; // Get current file path
        if (currentFile === undefined) {
            logAction('No current file path found in appState for State A, proceeding without it.', 'debug');
            // currentFile can remain undefined, it's fine for the stateData
        }
        
        if (editorTextArea) { // Simplified check: only need editor
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;
            const text = editorTextArea.value.substring(start, end);

            if (start === end) {
                 logAction('Cannot set State A: No text selected.', 'warning');
                 alert('Cannot store state: No text selected in editor.');
                 if (window.logPanel?.updateSelectionButtonUI) {
                    window.logPanel.updateSelectionButtonUI('A', false);
                 }
                 return;
            }

            const stateData = { 
                filePath: currentFile, // Will be undefined if no file, which is fine
                start, 
                end, 
                text 
            };

            if (window.logPanel) {
                window.logPanel._selectionStateA = stateData; 
                logAction(`State A stored: File=${currentFile || 'N/A'}, Start=${start}, End=${end}, Text Length=${text.length}`);
                if (window.logPanel.updateSelectionButtonUI) {
                    window.logPanel.updateSelectionButtonUI('A', true, stateData);
                }
            } else {
                logAction('Cannot set State A: LogPanel instance not found.', 'error');
            }
        } else {
             logAction(`Cannot set State A: Editor textarea not found.`, 'error');
             if (window.logPanel?.updateSelectionButtonUI) {
                window.logPanel.updateSelectionButtonUI('A', false);
             }
        }
    },
    setSelectionStateB: (data, element) => {
        logAction('Setting Selection State B...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        let currentFile = appStore.getState().file?.currentFile; // Get current file path
        if (currentFile === undefined) {
            logAction('No current file path found in appState for State B, proceeding without it.', 'debug');
            // currentFile can remain undefined
        }

        if (editorTextArea) { // Simplified check
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;
            const text = editorTextArea.value.substring(start, end);

            if (start === end) {
                 logAction('Cannot set State B: No text selected.', 'warning');
                 alert('Cannot store state: No text selected in editor.');
                 if (window.logPanel?.updateSelectionButtonUI) {
                    window.logPanel.updateSelectionButtonUI('B', false);
                 }
                 return;
            }

            const stateData = { 
                filePath: currentFile, // Will be undefined if no file
                start, 
                end, 
                text 
            };

            if (window.logPanel) {
                window.logPanel._selectionStateB = stateData;
                logAction(`State B stored: File=${currentFile || 'N/A'}, Start=${start}, End=${end}, Text Length=${text.length}`);
                if (window.logPanel.updateSelectionButtonUI) {
                    window.logPanel.updateSelectionButtonUI('B', true, stateData);
                }
            } else {
                logAction('Cannot set State B: LogPanel instance not found.', 'error');
            }
        } else {
             logAction(`Cannot set State B: Editor textarea not found.`, 'error');
             if (window.logPanel?.updateSelectionButtonUI) {
                window.logPanel.updateSelectionButtonUI('B', false);
            }
        }
    },
    // <<< END MODIFIED A/B STATE ACTIONS >>>

    // <<< NEW ACTION: Replace Editor Selection (from LogPanel code fence menu) >>>
    replaceEditorSelection: (payload) => {
        const { codeContent } = payload;
        if (typeof codeContent === 'string') {
            logAction(`Triggering replaceEditorSelection with content length: ${codeContent.length}`);
            if (editor && typeof editor.replaceSelection === 'function') {
                editor.replaceSelection(codeContent);
            } else {
                logAction('Editor or editor.replaceSelection method not available.', 'error');
                alert('Failed to replace editor content: Editor component is not ready.');
            }
        } else {
            logAction('replaceEditorSelection called without valid codeContent.', 'warning');
        }
    },
    // <<< END NEW ACTION >>>

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

    // --- SmartCopy Actions --- 
    setSmartCopyBufferA: () => {
        logAction('Setting SmartCopy Buffer A...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        if (!editorTextArea) {
            logAction('Cannot set SmartCopy A: Editor textarea not found.', 'error');
            alert('Editor not found to copy selection from.');
            return;
        }
        const start = editorTextArea.selectionStart;
        const end = editorTextArea.selectionEnd;
        const selectedText = editorTextArea.value.substring(start, end);

        if (start === end) {
             logAction('Cannot set SmartCopy A: No text selected.', 'warning');
             // Optionally provide feedback - maybe a quick flash?
             return;
        }

        try {
            // Use the key defined in appState.js
            localStorage.setItem('smartCopyBufferA', selectedText);
            logAction(`SmartCopy Buffer A set (Length: ${selectedText.length})`);
            // Dispatch action (primarily for logging/tracing)
            dispatch({ type: ActionTypes.SET_SMART_COPY_A, payload: { length: selectedText.length } });
            // TODO: Add user feedback (e.g., brief message, UI indicator)
        } catch (e) {
            logAction(`Failed to save SmartCopy Buffer A to localStorage: ${e.message}`, 'error');
            alert('Failed to save selection to buffer A.');
        }
    },

    publishToSpaces: async () => {
        const logPrefix = 'ACTION publishToSpaces';
        logAction('Triggering file publish to DO Spaces...', 'info', 'PUBLISH');
        let editor, rawMarkdownContent, currentPathname, generatedHtmlContent;

        try {
            // 1. Get Editor Content
            const editorSelectors = [
                '#md-editor textarea', '#editor-container textarea',
                'textarea.markdown-editor', 'textarea#editor', 'textarea'
            ];
            editor = editorSelectors.map(sel => document.querySelector(sel)).find(el => el);
            if (!editor) throw new Error('Editor element not found.');
            rawMarkdownContent = editor.value || '';
            if (!rawMarkdownContent.trim()) throw new Error('Editor content is empty.');
            logAction('Editor content retrieved.', 'debug', 'PUBLISH');

            // 2. Get Current Pathname from appStore
            currentPathname = appStore.getState().file?.currentPathname;
            if (!currentPathname || appStore.getState().file?.isDirectorySelected) {
                throw new Error('No file is currently selected for publishing.');
            }
            logAction(`Publishing: ${currentPathname}`, 'debug', 'PUBLISH');

            // 3. Generate HTML using the Client-Side Utility
            logAction('Generating static HTML string...', 'debug', 'PUBLISH');
            // Ensure generateStaticHTMLString is correctly imported and works
            generatedHtmlContent = await downloadStaticHTML({
                markdownSource: rawMarkdownContent,
                originalFilePath: currentPathname,
                // activeCssPaths: [], // Pass active CSS if needed by your generator
            });
            if (generatedHtmlContent === null || typeof generatedHtmlContent !== 'string') {
                // Check for null or non-string return value indicating failure
                throw new Error('Static HTML string generation failed or returned invalid content.');
            }
            logAction(`HTML generated (Length: ${generatedHtmlContent.length})`, 'debug', 'PUBLISH');

            // 4. Send Generated HTML to Server
            logAction(`Sending generated HTML to /api/publish...`, 'debug', 'PUBLISH');
            const response = await fetch('/api/publish', { // Use fetch directly
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // Ensure correct header
                body: JSON.stringify({
                    pathname: currentPathname,          // Original MD path for tracking
                    htmlContent: generatedHtmlContent   // Send the generated HTML
                })
            });

            const data = await response.json(); // Always try to parse JSON response

            if (!response.ok) {
                // Use error message from server response if available
                throw new Error(data?.error || `Server error: ${response.status} ${response.statusText}`);
            }
            if (!data.success || !data.url) {
                 throw new Error('Publish API returned success=false or missing URL');
            }

            // 5. Handle Success
            logAction(`Published successfully to: ${data.url}`, 'info', 'PUBLISH');
            if (confirm(`File published successfully!\n\nURL: ${data.url}\n\nClick OK to copy URL.`)) {
                try {
                    await navigator.clipboard.writeText(data.url);
                    logAction('Published URL copied.', 'info', 'PUBLISH');
                } catch (copyError) {
                     logAction(`Failed to copy URL to clipboard: ${copyError.message}`, 'warn', 'PUBLISH');
                     // Alert user maybe?
                     alert("Could not automatically copy URL, but it is: " + data.url);
                }
            }
            // Maybe update the button state via publishButton.js checkPublishStatus?
            // import { checkPublishStatus } from '/client/components/publishButton.js'; checkPublishStatus(currentPathname);

        } catch (error) {
            logAction(`Publish error: ${error.message}`, 'error', 'PUBLISH');
            console.error('[PUBLISH ACTION ERROR]', error);
            alert(`Failed to publish: ${error.message}`);
        }
    },
}; // <<< Add missing closing brace for triggerActions object

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
        const { initializeFileManager } = await import('/client/filesystem/fileManager.js'); 
        await initializeFileManager();
        break;
      }
      case 'loadDirectory': {
        // Import from client/
        const { loadFiles } = await import('/client/filesystem/fileManager.js'); 
        await loadFiles(params.directory);
        break;
      }
      case 'loadFile': {
        // Import from client/
        const { loadFile } = await import('/client/filesystem/fileManager.js'); 
        await loadFile(params.filename, params.directory);
        break;
      }
      case 'saveFile': {
        // Import from client/
        const { saveFile } = await import('/client/filesystem/fileManager.js'); 
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
  const { appStore } = await import('/client/appState.js'); 
  if (!appStore.getState().auth.isLoggedIn) { // Check central state
    logAction('[ACTION] User not logged in, cannot save.', 'warning');
    alert('You must be logged in to save.');
    return;
  }
  // ... rest of save logic ...
  logAction('Save click approved (User logged in) - Actual save needs implementation here or call triggerActions.saveFile');
  // Example: triggerActions.saveFile(); // If this function is meant to trigger the save
}

export function triggerActionFromDOM(element) {
    const actionName = element.dataset.action;
    if (actionName && typeof generalActions[actionName] === 'function') {
        console.log('Action triggered via DOM event:', actionName, element);
        // First, attempt to use a specific handler if one exists
        if (actionHandlers[actionName] && typeof actionHandlers[actionName].handler === 'function') {
            // ... existing code ...
        }
    }
}
