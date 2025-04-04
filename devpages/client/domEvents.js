// domEvents.js - Handles DOM events and delegates to event bus
import { eventBus } from '/client/eventBus.js';
import { logMessage } from '/client/log/index.js';
import { triggerActions } from '/client/actions.js';
import { globalFetch } from '/client/globalFetch.js';

// Import AUTH_STATE object AND login/logout functions from auth.js
import { AUTH_STATE, handleLogin, logout } from '/client/auth.js';

// Add a isProcessingDelete variable to track ongoing operations
let isProcessingDelete = false;

export function initializeDomEvents() {
    logMessage('[DOM EVENT] Initializing DOM event listeners...');

    // Delegate events from a common ancestor if possible for efficiency
    document.body.addEventListener('click', (event) => {
        const target = event.target;
        const action = target.dataset.action;
        
        if (action) {
            logMessage(`[DOM EVENT] Action triggered: ${action}`);
            // Handle protected actions requiring authentication
            if (target.dataset.protected === 'true') {
                 if (AUTH_STATE.current === AUTH_STATE.AUTHENTICATED) {
                    // Assuming other actions are still handled by triggerActions
                    if (typeof triggerActions[action] === 'function') {
                        triggerActions[action](event); // Pass event if needed
                    } else {
                        logMessage(`[DOM EVENT WARN] No handler found for protected action: ${action}`, 'warning');
                    }
                } else {
                    logMessage(`[DOM EVENT] Protected action '${action}' blocked: User not authenticated.`, 'warning');
                    alert('Please log in to perform this action.');
                }
            } else {
                 // Assuming other actions are still handled by triggerActions
                 if (typeof triggerActions[action] === 'function') {
                     triggerActions[action](event); // Pass event if needed
                 } else {
                     logMessage(`[DOM EVENT WARN] No handler found for action: ${action}`, 'warning');
                 }
            }
        }
    });

    // Specific listeners for elements not easily handled by delegation
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission
            const username = event.target.username.value;
            const password = event.target.password.value;
            logMessage(`[DOM EVENT] Attempting login for user: ${username}`);
            try {
                const success = await handleLogin(username, password);
                 if (success) {
                    logMessage('[DOM EVENT] handleLogin successful');
                    // UI updates are handled via auth:stateChanged event listener in uiManager.js
                } else {
                    logMessage('[DOM EVENT] handleLogin failed');
                    alert('Login failed. Please check credentials.'); // Provide feedback
                }
            } catch (error) {
                logMessage(`[DOM EVENT] Login error: ${error.message}`, 'error');
                alert('An error occurred during login.');
            }
        });
        logMessage('[DOM EVENT] Login form submit listener attached.');
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
             logMessage('[DOM EVENT] Logout button clicked');
             try {
                 await logout();
                 logMessage('[DOM EVENT] Logout process initiated.');
             } catch (error) {
                 logMessage(`[DOM EVENT] Logout error: ${error.message}`, 'error');
                 alert('An error occurred during logout.');
             }
        });
         logMessage('[DOM EVENT] Logout button click listener attached.');
    }
    
    // Example: Setup listeners for file/view buttons using delegation or specific handlers
    // setupProtectedButtonListener('save-btn', 'saveFile'); // Example if using specific listener
    // setupProtectedButtonListener('load-btn', 'loadFile'); // Load might not need auth?

    logMessage('[DOM EVENT] DOM event listeners initialized.');
}

// Handle document click events
function handleDocumentClick(event) {
    // Handle delete buttons
    if (event.target.matches('.delete-btn') || 
        event.target.matches('[data-action="delete-image"]') ||
        event.target.closest('[data-action="delete-image"]')) {
        
        // Prevent any other handlers from running
        event.preventDefault();
        event.stopPropagation();
        
        // Check if this was already handled by an inline onclick
        if (event.alreadyHandled) {
            return;
        }
        
        // Mark as handled to prevent double-processing
        event.alreadyHandled = true;
        
        const button = event.target.closest('[data-action="delete-image"]') || event.target;
        const imageName = button.getAttribute('data-image-name');
        
        if (imageName) {
            handleDirectImageDelete(imageName);
        }
    }
    
    // Handle other click events...
}

// Update handleDirectImageDelete
async function handleDirectImageDelete(imageName) {
    // Prevent multiple simultaneous deletes
    if (isProcessingDelete) {
        logMessage(`[IMAGES] Delete already in progress, ignoring duplicate request`);
        return;
    }
    
    logMessage(`[IMAGES] Direct delete requested for: ${imageName}`);
    
    if (confirm(`Are you sure you want to delete ${decodeURIComponent(imageName)}?`)) {
        try {
            isProcessingDelete = true;
            const imageUrl = `/uploads/${decodeURIComponent(imageName)}`;
            
            // Use globalFetch with the emergency endpoint
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
            
            logMessage(`[IMAGES] Successfully deleted: ${imageName}`);
            alert('Image deleted successfully');
            
            // Add a small delay before reload to ensure the alert is seen
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (error) {
            logMessage(`[IMAGES ERROR] ${error.message}`);
            alert(`Error deleting image: ${error.message}`);
        } finally {
            // Reset processing flag
            isProcessingDelete = false;
        }
    }
}

// Handle form submissions
function handleFormSubmit(event) {
    // Don't handle login forms here - they are handled in auth.js
    if (event.target.id === 'login-form') {
        return; // Let the handler in auth.js handle this
    }
    
    // Handle other form submissions as needed
    event.preventDefault();
    
    // Process form submission for non-login forms
    // ...
}

// Connect global functions for backward compatibility
function connectGlobalFunctions() {
    // For image deletion - key change is to make this a noop since direct handler works
    window.handleImageDelete = function(imageName) {
        logMessage('[COMPAT] Legacy handleImageDelete called');
        // Don't call triggerActions.deleteImage(imageName) again
        // The button's onclick already triggers our direct handler
        
        // Prevent default handler from running by returning false
        return false;
    };
    
    // For login
    window.handleLogin = function(username, password) {
        logMessage('[COMPAT] Legacy handleLogin called, forwarding to event system');
        triggerActions.login(username, password);
    };
    
    // For logout
    window.handleLogout = function() {
        logMessage('[COMPAT] Legacy handleLogout called, forwarding to event system');
        triggerActions.logout();
    };
    
    logMessage('[EVENTS] Global compatibility functions connected');
}

// Example usage: Check auth state before allowing an action
function setupProtectedButtonListener(buttonId, action) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.addEventListener('click', () => {
            // Check current state from the imported object
            if (AUTH_STATE.current === AUTH_STATE.AUTHENTICATED) {
                triggerActions(action);
            } else {
                logMessage(`[DOM EVENT] Action '${action}' blocked: User not authenticated.`, 'warning');
                alert('Please log in to perform this action.');
            }
        });
    }
} 