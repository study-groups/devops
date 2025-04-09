// actions.js - Centralized action handlers
console.log('[DEBUG] actions.js: Module start');
import eventBus from '/client/eventBus.js';
import { withAuthHeaders } from '/client/headers.js';
import { globalFetch } from '/client/globalFetch.js';
// REMOVED: Obsolete import from deleted views.js
// import { setView, getView } from '/client/views.js';
import { getUIState, setUIState } from '/client/uiState.js';
import { handleLogin } from '/client/auth.js'; // Assuming triggerActions.login uses this
import { logMessage } from '/client/log/index.js';
// <<< UNCOMMENT THE DEBUG IMPORT >>>
// import * as debug from '/client/debug/index.js'; 

// Import other necessary modules
import { refreshPreview } from '/client/previewManager.js'; // UPDATED - Correct function name
// import { toggleCommunityLink } from '/client/communityLink.js'; // REMOVED - communityLink handles its own events
import fileManager from '/client/fileManager.js'; // Needed for loadFile

// REMOVED: Problematic debug console log
// console.log('[DEBUG] actions.js: Imported modules check - debug:', !!debug, 'refreshPreview:', !!refreshPreview, 'fileManager:', !!fileManager); 

// Helper for logging within this module
function logAction(message, level = 'text') {
    const prefix = '[ACTION]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

// Initialize all action handlers
export function initializeActions() {
    console.log('[DEBUG] actions.js: initializeActions() called');
    // Image actions
    registerImageActions();
    
    // File actions
    registerFileActions();
    
    // Auth actions
    registerAuthActions();
    
    logAction('All action handlers registered');
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

// Register authentication actions
function registerAuthActions() {
    // Handle login event received from form submission
    eventBus.on('auth:login', async ({ username, password }) => {
        logAction(`Login event received for user: ${username}`);
        
        // If password is provided, this is an initial login request
        if (password) {
            // Perform the actual login
            try {
                const success = await handleLogin(username, password);
                if (success) {
                    logAction(`Login successful via event for: ${username}`);
                } else {
                    logAction(`Login failed via event for: ${username}`);
                }
            } catch (error) {
                logAction(`Login attempt via event failed: ${error.message}`);
            }
        } else {
            // This is just a notification of successful login
            // Make sure file manager is initialized
            try {
                const { initializeFileManager } = await import('/client/fileManager.js');
                await initializeFileManager();
                logAction('File manager initialized after login event');
            } catch (error) {
                logAction(`Failed to initialize file manager: ${error.message}`);
            }
        }
    });
    
    // Handle login status updates
    eventBus.on('auth:loginStatus', async (data) => {
        if (data.success) {
            logAction(`Login successful for user: ${data.username}`);
            
            // Initialize file manager after successful login
            try {
                const { initializeFileManager } = await import('/client/fileManager.js');
                await initializeFileManager();
                logAction('File manager initialized after login status update');
            } catch (error) {
                logAction(`Failed to initialize file manager: ${error.message}`);
            }
        } else {
            logAction(`Login failed: ${data.error || 'Unknown error'}`, 'error');
        }
    });
    
    // Handle logout
    eventBus.on('auth:logout', () => {
        logAction('User logged out event received');
    });
    
    logAction('Auth actions registered');
}

// <<< ADD LOG BEFORE triggerActions >>>
console.log('[DEBUG] actions.js: Defining triggerActions...');
// Export direct action triggers for convenience
export const triggerActions = {
    deleteImage: (imageName) => eventBus.emit('image:delete', { imageName }),
    login: (username, password) => eventBus.emit('auth:login', { username, password }),
    logout: () => eventBus.emit('auth:logout'),
    saveFile: async () => {
        logAction('Triggering saveFile action...');
        try {
            // Assuming fileManager.js exports saveFile correctly
            const success = await fileManager.saveFile(); // Call saveFile from the imported module instance
            if (success) {
                logAction('saveFile executed successfully.');
            } else {
                logAction('saveFile failed.', 'error');
                alert('Failed to save file. Check console for details.');
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
    // MODIFIED: Use uiState to toggle visibility
    toggleLogVisibility: async () => { 
        logAction('Triggering toggleLogVisibility via uiState...');
        try {
            const currentVisibility = getUIState('logVisible');
            setUIState('logVisible', !currentVisibility);
            // The LogPanel component will react to this state change via its subscription
            // REMOVED: Direct call to window.logPanel?.toggle(); 
        } catch (e) { logAction(`toggleLogVisibility failed: ${e.message}`, 'error'); }
    },
    // MODIFIED: Use global debug object directly if available
    showSystemInfo: async () => {
        logAction('Triggering showSystemInfo (calling showAppInfo)...');
        try {
            // Re-route this to the showAppInfo debug function for consistency
            window.dev?.showAppInfo?.(); // Use globally registered debug object
        } catch (e) { logAction(`showSystemInfo/showAppInfo failed: ${e.message}`, 'error'); }
    },

    // --- Debug Actions (now using global debug object) ---
    runDebugUI: async () => {
        logAction('Triggering runAllDiagnostics...');
        try {
            // Call the new consolidated function via global object
            await window.dev?.runAllDiagnostics?.(); 
        } catch (e) { logAction(`runAllDiagnostics failed: ${e.message}`, 'error'); }
    },
    showAppInfo: async () => { 
        logAction('Triggering showAppInfo...');
        try {
            window.dev?.showAppInfo?.(); // Use globally registered debug object
        } catch (e) { logAction(`showAppInfo failed: ${e.message}`, 'error'); }
    },
    debugAllApiEndpoints: async () => { // New action for the consolidated endpoint tester
        logAction('Triggering debugAllApiEndpoints...');
        try {
            // CORRECTED: Use window.dev
            window.dev?.debugAllApiEndpoints?.(); 
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
            // Use reactive state directly
            const { authState } = await import('/client/authState.js'); 
            const currentState = authState.get();
            logAction(`Current Auth State: ${JSON.stringify(currentState)}`);
            logAction(`Is Logged In: ${currentState.isAuthenticated}`);
        } catch (error) {
            logAction(`Error loading auth module or state: ${error.message}`, 'error');
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
            logMessage('[ACTION] Generating static HTML from Markdown preview area...');
            
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
            
            logMessage('[ACTION] Static HTML generated from preview (with metadata) and download initiated.');

        } catch (error) {
            logAction(`Error during client-side downloadStaticHTML: ${error.message}`, 'error');
            logMessage(`[ACTION ERROR] Failed to generate static HTML: ${error.message}`, 'error');
            alert(`Failed to generate static HTML: ${error.message}`); // Notify user
        }
    }
};

// <<< ADD LOG AFTER triggerActions >>>
console.log('[DEBUG] actions.js: Defined triggerActions:', Object.keys(triggerActions));

// Backwards compatibility - Map old functions if needed

// Add this helper function to get the current auth token
async function getAuthToken() {
    // Try to get the token from your authManager
    const { getCurrentUser, getAuthToken } = await import('/client/auth.js');
    const token = getAuthToken();
    
    // If token exists, use it
    if (token) {
        return token;
    }
    
    // Fallback to localStorage if needed
    const authStateStr = localStorage.getItem('authState');
    if (authStateStr) {
        try {
            const authState = JSON.parse(authStateStr);
            return authState.hashedPassword || '';
        } catch (e) {
            console.error('Failed to parse authState from localStorage', e);
        }
    }
    
    return '';
}

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
      case 'authCheck': {
        // Import from client/
        const { getCurrentUser, getAuthToken } = await import('/client/auth.js'); 
        const user = getCurrentUser(); // Assuming getCurrentUser exists in auth.js
        const token = getAuthToken(); // Assuming getAuthToken exists in auth.js
        logMessage(`Auth Check: User=${user}, Token=${token ? 'Exists' : 'None'}`);
        break;
      }
      // ... existing code ...
    }
  } catch (error) {
    logMessage(`[ACTION ERROR] Failed to execute ${action}: ${error.message}`, 'error');
    console.error(`[ACTION ERROR] Action: ${action}`, error);
  }
}

async function handleSaveClick() {
  // Use AUTH_STATE.current to check if authenticated
  if (AUTH_STATE.current !== AUTH_STATE.AUTHENTICATED) {
    logMessage('[ACTION] User not logged in, cannot save.', 'warning');
    alert('You must be logged in to save.');
    return;
  }
  // ... rest of save logic ...
}

// Refactored handleLoginSubmit to use handleLogin from auth.js
async function handleLoginSubmit(event) {
    event.preventDefault(); // Prevent default form submission
    logMessage('[ACTION] Login form submitted');
    const form = event.target;
    const username = form.username.value;
    const password = form.password.value;

    if (!username || !password) {
        alert('Username and password are required.');
        return;
    }

    try {
        const success = await handleLogin(username, password);
        if (success) {
            logMessage('[ACTION] Login successful via handleLogin');
            // UI updates are handled via auth:stateChanged event listener in uiManager.js
        } else {
             logMessage('[ACTION] Login failed via handleLogin');
             // Potentially show error message to user, though handleLogin might do this
             alert('Login failed. Please check credentials.');
        }
    } catch (error) {
        logMessage(`[ACTION] Login error: ${error.message}`, 'error');
        alert('An error occurred during login.');
    }
}

// Function to handle logout click
async function handleLogoutClick() {
    logMessage('[ACTION] Logout requested');
    try {
        // Dynamically import the logout function only when needed
        const { logout } = await import('/client/auth.js');
        await logout();
        logMessage('[ACTION] Logout process initiated.');
        // UI updates handled via auth:stateChanged event
    } catch (error) {
        logMessage(`[ACTION] Logout error: ${error.message}`, 'error');
        alert('An error occurred during logout.');
    }
} 