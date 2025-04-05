// actions.js - Centralized action handlers
console.log('[DEBUG] actions.js: Module start');
import eventBus from '/client/eventBus.js';
import { withAuthHeaders } from '/client/headers.js';
import { globalFetch } from '/client/globalFetch.js';
import { setView, getView } from '/client/views.js';
import { AUTH_STATE, handleLogin } from '/client/auth.js';
import { logMessage } from '/client/log/index.js';
// <<< UNCOMMENT THE DEBUG IMPORT >>>
import * as debug from '/client/debug/index.js'; 
console.log('[DEBUG] actions.js: Imported debug module:', debug);

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
                const { initializeFileManager } = await import('$lib/fileManager.js');
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
                const { initializeFileManager } = await import('$lib/fileManager.js');
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
            // Dynamically import fileManager and call saveFile
            const fileManager = await import('/client/fileManager.js'); 
            // Call saveFile without arguments - it uses internal state
            const success = await fileManager.saveFile(); 
            if (success) {
                logAction('saveFile executed successfully.');
                // Optionally provide user feedback (e.g., brief notification)
                // alert('File saved!'); // Example simple feedback
            } else {
                logAction('saveFile failed.', 'error');
                alert('Failed to save file. Check console for details.'); // Provide error feedback
            }
        } catch (error) {
            logAction(`Error during saveFile trigger: ${error.message}`, 'error');
            alert('An error occurred while trying to save.'); // Provide error feedback
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
    minimizeLog: async () => {
        logAction('Triggering minimizeLog (toggle false)...');
        try {
             // Use the global LogPanel instance's toggle method
            window.logPanel?.toggle(false); // Pass false to hide/minimize
        } catch (e) { logAction(`minimizeLog failed: ${e.message}`, 'error'); }
    },
    showSystemInfo: async () => {
        logAction('Triggering showSystemInfo (calling showAppInfo)...');
        try {
            // Re-route this to the showAppInfo debug function for consistency
            debug.showAppInfo?.(); // <<< UNCOMMENT debug USAGE >>>
            // logAction('[TEMP] showSystemInfo called (debug usage commented out)', 'warning');
        } catch (e) { logAction(`showSystemInfo/showAppInfo failed: ${e.message}`, 'error'); }
    },

    // --- Debug Actions (now using imported debug module) ---
    runDebugUI: async () => {
        logAction('Triggering runAllDiagnostics...');
        try {
            // Call the new consolidated function
            await debug.runAllDiagnostics?.(); 
        } catch (e) { logAction(`runAllDiagnostics failed: ${e.message}`, 'error'); }
    },
    showAppInfo: async () => { // Keep this separate trigger if needed, maps to debug.showAppInfo
        logAction('Triggering showAppInfo...');
        try {
            debug.showAppInfo?.(); // <<< UNCOMMENT debug USAGE >>>
            // logAction('[TEMP] showAppInfo called (debug usage commented out)', 'warning');
        } catch (e) { logAction(`showAppInfo failed: ${e.message}`, 'error'); }
    },
    debugAllApiEndpoints: async () => { // New action for the consolidated endpoint tester
        logAction('Triggering debugAllApiEndpoints...');
        try {
            debug.debugAllApiEndpoints?.(); // <<< UNCOMMENT debug USAGE >>>
            // logAction('[TEMP] debugAllApiEndpoints called (debug usage commented out)', 'warning');
        } catch (e) { logAction(`debugAllApiEndpoints failed: ${e.message}`, 'error'); }
    },
    debugUrlParameters: async () => { // New action
        logAction('Triggering debugUrlParameters...');
        try {
            debug.debugUrlParameters?.(); // <<< UNCOMMENT debug USAGE >>>
            // logAction('[TEMP] debugUrlParameters called (debug usage commented out)', 'warning');
        } catch (e) { logAction(`debugUrlParameters failed: ${e.message}`, 'error'); }
    },
    debugFileList: async () => { // New action
        logAction('Triggering debugFileList...');
        try {
            debug.debugFileList?.(); // <<< UNCOMMENT debug USAGE >>>
            // logAction('[TEMP] debugFileList called (debug usage commented out)', 'warning');
        } catch (e) { logAction(`debugFileList failed: ${e.message}`, 'error'); }
    },
     debugFileLoadingIssues: async () => { // New action
        logAction('Triggering debugFileLoadingIssues...');
        try {
            debug.debugFileLoadingIssues?.(); // <<< UNCOMMENT debug USAGE >>>
            // logAction('[TEMP] debugFileLoadingIssues called (debug usage commented out)', 'warning');
        } catch (e) { logAction(`debugFileLoadingIssues failed: ${e.message}`, 'error'); }
    },
    debugAuthState: async () => { // New action
        logAction('Triggering debugAuthState...');
        try {
            debug.debugAuthState?.(); // <<< UNCOMMENT debug USAGE >>>
            // logAction('[TEMP] debugAuthState called (debug usage commented out)', 'warning');
        } catch (e) { logAction(`debugAuthState failed: ${e.message}`, 'error'); }
    },

    // --- NEW Nav Bar Actions ---
    setView: async (event) => {
        const viewMode = event?.target?.dataset?.viewMode;
        if (viewMode) {
            logAction(`Triggering setView: ${viewMode}`);
            try {
                const viewsModule = await import('/client/views.js');
                viewsModule.setView?.(viewMode);
            } catch (e) { logAction(`setView failed: ${e.message}`, 'error'); }
        } else {
             logAction('setView called without viewMode in data attribute', 'warning');
        }
    },
    toggleLogVisibility: async () => {
        logAction('Triggering toggleLogVisibility...');
        try {
            // Emit an event for the LogPanel instance to handle
            eventBus.emit('logPanel:toggleRequest');
            logAction('Emitted logPanel:toggleRequest event.');
        } catch (error) {
            logAction(`toggleLogVisibility failed: ${error.message}`, 'error');
            console.error('[ACTION ERROR] toggleLogVisibility', error);
        }
    },
    refreshPreview: async () => {
         logAction('Triggering refreshPreview...');
         try {
             const previewModule = await import('/client/preview.js');
             previewModule.refreshPreview?.(); // Assuming refreshPreview exists
         } catch (e) { logAction(`refreshPreview failed: ${e.message}`, 'error'); }
    },
    loadFile: async () => {
         logAction('Triggering loadFile...');
         try {
             const fileManager = await import('/client/fileManager.js');
             // Always get both filename and directory from UI state
             const currentFile = document.getElementById('file-select')?.value;
             const currentDir = document.getElementById('dir-select')?.value;
             
             // Proceed only if BOTH file and directory are selected in the UI
             if (currentFile && currentDir) {
                  logAction(`Requesting load for: ${currentFile} in ${currentDir}`);
                  await fileManager.loadFile(currentFile, currentDir);
             } else {
                  logAction('loadFile triggered, but file or directory not selected in UI.', 'warning');
                  // Optionally provide user feedback
                  // alert('Please select both a directory and a file to load.');
             }
         } catch (e) { logAction(`loadFile failed: ${e.message}`, 'error'); }
    }
};

// Add this helper function to get the current auth token
async function getAuthToken() {
    // Try to get the token from your authManager
    const { getCurrentUser, getAuthToken } = await import('$lib/auth.js');
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
        const { initializeFileManager } = await import('$lib/fileManager.js'); 
        await initializeFileManager();
        break;
      }
      case 'loadDirectory': {
        // Import from client/
        const { loadFiles } = await import('$lib/fileManager.js'); 
        await loadFiles(params.directory);
        break;
      }
      case 'loadFile': {
        // Import from client/
        const { loadFile } = await import('$lib/fileManager.js'); 
        await loadFile(params.filename, params.directory);
        break;
      }
      case 'saveFile': {
        // Import from client/
        const { saveFile } = await import('$lib/fileManager.js'); 
        await saveFile(params.filename, params.directory, params.content);
        break;
      }
      // ... existing code ...
      case 'authCheck': {
        // Import from client/
        const { getCurrentUser, getAuthToken } = await import('$lib/auth.js'); 
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