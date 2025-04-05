// domEvents.js - Handles DOM events and delegates to event bus
import { eventBus } from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
import { AUTH_STATE, handleLogin, logout } from '/client/auth.js';
import { globalFetch } from '/client/globalFetch.js';

// Add a isProcessingDelete variable to track ongoing operations
let isProcessingDelete = false;

// Define actions that require authentication
const PROTECTED_ACTIONS = new Set([
    'saveFile', 
    'deleteImage', // Example, add others as needed
    // 'toggleCommunityLink' - Handled internally now
]);

// Helper for logging within this module
function logDomEvent(message, level = 'text') {
    const prefix = '[DOM EVENT]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

export function initializeDomEvents() {
    console.log('[DEBUG] Entering initializeDomEvents function.');
    logDomEvent('Initializing DOM event listeners...');

    // Attach login/logout listeners immediately (assuming elements exist or handled elsewhere)
    // Specific listeners for elements not easily handled by delegation
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission
            const usernameInput = loginForm.querySelector('input[name="username"]');
            const passwordInput = loginForm.querySelector('input[name="password"]');
            if (!usernameInput || !passwordInput) {
                 alert('Login form elements missing!');
                 logDomEvent('Login form elements missing!', 'error');
                 return;
            }
            const username = usernameInput.value;
            const password = passwordInput.value;
            logDomEvent(`Login form submitted for user: ${username}`);
            try {
                const success = await handleLogin(username, password);
                 if (success) {
                    logDomEvent('Login successful via form submit.');
                    // UI updates are handled via auth:stateChanged event listener in uiManager.js
                } else {
                    logDomEvent('Login failed via form submit.', 'warning');
                    alert('Login failed. Please check username and password.'); // Provide feedback
                }
            } catch (error) {
                logDomEvent(`Login form submission error: ${error.message}`, 'error');
                alert(`Login error: ${error.message}`);
            }
        });
        logDomEvent('Login form submit listener attached (immediate).');
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            logDomEvent('Logout button clicked.');
            try {
                await logout();
                logDomEvent('Logout function called successfully.');
                // UI updates handled by auth state change listener in uiManager
            } catch (error) {
                 logDomEvent(`Logout button click error: ${error.message}`, 'error');
                 // Maybe show an alert, though logout state should clear anyway
            }
        });
         logDomEvent('Logout button click listener attached (immediate).');
    }

    // Setup delegated listener after DOM is ready
    const setupDelegatedListener = () => {
        logDomEvent('DOM ready, attaching delegated listener...');

        // Delegate events from a common ancestor if possible for efficiency
        document.body.addEventListener('click', (event) => {
            console.log('[DEBUG] Body click listener entered. Target:', event.target);

            // Find the closest element with a data-action attribute
            const target = event.target.closest('[data-action]');
            if (!target) {
                console.log('[DEBUG] No data-action found on target or parents.');
                return; // Exit if no action target found
            }

            const action = target.dataset.action;
            logDomEvent(`Action triggered: ${action} on ${target.tagName}#${target.id}`);
            
            console.log('[DEBUG] triggerActions object:', triggerActions);
            
            // Check if the action requires authentication
            if (PROTECTED_ACTIONS.has(action)) {
                if (AUTH_STATE.current === AUTH_STATE.AUTHENTICATED) {
                    // Authenticated: Proceed with action
                     if (typeof triggerActions[action] === 'function') {
                         triggerActions[action](event); // Pass event if handler needs it
                     } else {
                         logDomEvent(`No handler found for protected action: ${action}`, 'warning');
                     }
                } else {
                    // Not authenticated: Block action and notify user
                    logDomEvent(`Protected action '${action}' blocked: User not authenticated.`, 'warning');
                    alert('Please log in to perform this action.');
                }
            } else {
                // Action does not require authentication: Proceed directly
                if (typeof triggerActions[action] === 'function') {
                    triggerActions[action](event); // Pass event if handler needs it
                } else {
                    logDomEvent(`No handler found for action: ${action}`, 'warning');
                }
            }
            
            // Optional: Prevent default for buttons to avoid potential form submits if nested
            if (target.tagName === 'BUTTON') {
                 event.preventDefault();
            }
        });
        logDomEvent('Delegated click listener for data-actions attached.');
        
        logDomEvent('Delegated DOM event listener initialized.'); // Updated log message
    };

    // Check if the DOM is already loaded
    if (document.readyState === 'loading') {  // Loading hasn't finished yet
        document.addEventListener('DOMContentLoaded', setupDelegatedListener);
    } else {  // 'DOMContentLoaded' has already fired
        setupDelegatedListener();
    }
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
        logDomEvent(`[IMAGES] Delete already in progress, ignoring duplicate request`);
        return;
    }
    
    logDomEvent(`[IMAGES] Direct delete requested for: ${imageName}`);
    
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
            
            logDomEvent(`[IMAGES] Successfully deleted: ${imageName}`);
            alert('Image deleted successfully');
            
            // Add a small delay before reload to ensure the alert is seen
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (error) {
            logDomEvent(`[IMAGES ERROR] ${error.message}`);
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
        logDomEvent('[COMPAT] Legacy handleImageDelete called');
        // Don't call triggerActions.deleteImage(imageName) again
        // The button's onclick already triggers our direct handler
        
        // Prevent default handler from running by returning false
        return false;
    };
    
    // For login
    window.handleLogin = function(username, password) {
        logDomEvent('[COMPAT] Legacy handleLogin called, forwarding to event system');
        triggerActions.login(username, password);
    };
    
    // For logout
    window.handleLogout = function() {
        logDomEvent('[COMPAT] Legacy handleLogout called, forwarding to event system');
        triggerActions.logout();
    };
    
    logDomEvent('[EVENTS] Global compatibility functions connected');
} 