// actions.js - Centralized action handlers
import { eventBus } from '/client/eventBus.js';
import { logMessage } from '/client/log/index.js';
import { withAuthHeaders } from '/client/headers.js';
import { globalFetch } from '/client/globalFetch.js';
import { setView, getView } from '/client/views.js';

// Import AUTH_STATE object from auth.js
import { AUTH_STATE, handleLogin } from '/client/auth.js';

// Initialize all action handlers
export function initializeActions() {
    // Image actions
    registerImageActions();
    
    // File actions
    registerFileActions();
    
    // Auth actions
    registerAuthActions();
    
    logMessage('[ACTIONS] All action handlers registered');
}

// Register image-related actions
function registerImageActions() {
    // Handle image deletion
    eventBus.on('image:delete', async ({ imageName }) => {
        logMessage(`[IMAGES] Delete requested for: ${imageName}`);
        
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
                logMessage(`[IMAGES] Successfully deleted: ${imageName}`);
                
                // Notify of successful deletion
                eventBus.emit('image:deleted', { imageName });
                
                // Reload the page to refresh the index
                window.location.reload();
            } catch (error) {
                logMessage(`[IMAGES ERROR] ${error.message}`);
                alert(`Error deleting image: ${error.message}`);
                
                // Notify of failed deletion
                eventBus.emit('image:deleteError', { imageName, error: error.message });
            }
        }
    });
    
    // Add other image actions here
    
    logMessage('[ACTIONS] Image actions registered');
}

// Register file-related actions
function registerFileActions() {
    // Handle file operations
    // ...
    
    logMessage('[ACTIONS] File actions registered');
}

// Register authentication actions
function registerAuthActions() {
    // Handle login event received from form submission
    eventBus.on('auth:login', async ({ username, password }) => {
        logMessage(`[AUTH] Login event received for user: ${username}`);
        
        // If password is provided, this is an initial login request
        if (password) {
            // Perform the actual login
            try {
                const success = await handleLogin(username, password);
                if (success) {
                    logMessage(`[AUTH] Login successful via event for: ${username}`);
                } else {
                    logMessage(`[AUTH ERROR] Login failed via event for: ${username}`);
                }
            } catch (error) {
                logMessage(`[AUTH ERROR] Login attempt via event failed: ${error.message}`);
            }
        } else {
            // This is just a notification of successful login
            // Make sure file manager is initialized
            try {
                const { initializeFileManager } = await import('$lib/fileManager.js');
                await initializeFileManager();
                logMessage('[AUTH] File manager initialized after login event');
            } catch (error) {
                logMessage(`[AUTH ERROR] Failed to initialize file manager: ${error.message}`);
            }
        }
    });
    
    // Handle login status updates
    eventBus.on('auth:loginStatus', async (data) => {
        if (data.success) {
            logMessage(`[AUTH] Login successful for user: ${data.username}`);
            
            // Initialize file manager after successful login
            try {
                const { initializeFileManager } = await import('$lib/fileManager.js');
                await initializeFileManager();
                logMessage('[AUTH] File manager initialized after login status update');
            } catch (error) {
                logMessage(`[AUTH ERROR] Failed to initialize file manager: ${error.message}`);
            }
        } else {
            logMessage(`[AUTH ERROR] Login failed: ${data.error || 'Unknown error'}`, 'error');
        }
    });
    
    // Handle logout
    eventBus.on('auth:logout', () => {
        logMessage('[AUTH] User logged out');
    });
    
    logMessage('[ACTIONS] Auth actions registered');
}

// Export direct action triggers for convenience
export const triggerActions = {
    deleteImage: (imageName) => eventBus.emit('image:delete', { imageName }),
    login: (username, password) => eventBus.emit('auth:login', { username, password }),
    logout: () => eventBus.emit('auth:logout')
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
  logMessage(`[ACTION] Executing: ${action}`);
  
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