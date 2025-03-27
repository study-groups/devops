// actions.js - Centralized action handlers
import { eventBus } from './eventBus.js';
import { logMessage } from './log/index.js';
import { withAuthHeaders } from './auth/headers.js';
import { globalFetch } from './globalFetch.js';

// Import from auth.js instead of authService.js
import { authState, handleLogin } from './auth.js';

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
                const { initializeFileManager } = await import('./fileManager/index.js');
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
                const { initializeFileManager } = await import('./fileManager/index.js');
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
    const { getCurrentUser, getAuthToken } = await import('./authManager.js');
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