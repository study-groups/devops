// domEvents.js - Handles DOM events and delegates to event bus
import { eventBus } from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
// Remove old import
// import { AUTH_STATE, handleLogin, logout } from '/client/auth.js';
// Import only needed functions from auth.js
import { handleLogin, logout } from '/client/auth.js'; 
// Import the new reactive state
import { authState } from '/client/authState.js'; 
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
    console.log('[DEBUG domEvents.js] === initializeDomEvents function entered ===');
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
        console.log('[DEBUG domEvents.js] === setupDelegatedListener function entered ===');
        logDomEvent('DOM ready, attaching delegated listener...');

        console.log('[DEBUG domEvents.js] Adding click listener to document.body...');
        document.body.addEventListener('click', (event) => {
            console.log('[DEBUG domEvents.js] Body click detected. Event target:', event.target);

            const target = event.target.closest('[data-action]');
            console.log('[DEBUG domEvents.js] closest data-action result:', target);

            if (!target) {
                console.log('[DEBUG domEvents.js] No data-action found on target or parents. Exiting handler.');
                return;
            }
            console.log('[DEBUG domEvents.js] Found target with data-action:', target);

            const action = target.dataset.action;
            logDomEvent(`Action triggered: ${action} on ${target.tagName}#${target.id}`);
            console.log(`[DEBUG domEvents.js] Extracted action: "${action}"`);
            
            let actionData = {}; 
            for (const key in target.dataset) {
                if (key !== 'action') { actionData[key] = target.dataset[key]; }
            }
            console.log(`[DEBUG domEvents.js] Extracted actionData:`, actionData);

            if (action === 'loadFile') {
                const fileSelect = document.getElementById('file-select');
                if (fileSelect && fileSelect.value) {
                    actionData.filename = fileSelect.value;
                    logDomEvent(`Added filename '${actionData.filename}' to data for loadFile action.`);
                } else {
                    logDomEvent('Could not find selected filename for loadFile action.', 'warning');
                }
            }
            
            console.log('[DEBUG domEvents.js] Checking triggerActions object:', triggerActions); 
            // Add a specific check for the action *before* calling it
            if (typeof triggerActions[action] !== 'function') {
                console.error(`[DEBUG domEvents.js] Error: triggerActions does not contain a function for action: "${action}"`);
                logDomEvent(`No handler function found for action: ${action}`, 'error');
                // Maybe return here or show an alert depending on desired behavior
                // return; 
            } else {
                 console.log(`[DEBUG domEvents.js] Found function for action "${action}" in triggerActions. Proceeding...`);
            }
            
            // Check if the action requires authentication using the new authState
            if (PROTECTED_ACTIONS.has(action)) {
                // Get current state directly from the reactive store
                if (authState.get().isAuthenticated) { 
                    // Authenticated: Proceed with action
                     if (typeof triggerActions[action] === 'function') {
                         triggerActions[action](actionData);
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
                    triggerActions[action](actionData);
                } else {
                    logDomEvent(`No handler found for action: ${action}`, 'warning');
                }
            }
            
            if (target.tagName === 'BUTTON') {
                 event.preventDefault();
            }
        });
        console.log('[DEBUG domEvents.js] Click listener attached to document.body.');
        logDomEvent('Delegated click listener for data-actions attached.');
        logDomEvent('Delegated DOM event listener initialized.');
    };

    // Check if the DOM is already loaded
    console.log(`[DEBUG domEvents.js] Checking document.readyState: ${document.readyState}`);
    if (document.readyState === 'loading') {  // Loading hasn't finished yet
        console.log('[DEBUG domEvents.js] DOM not ready, adding DOMContentLoaded listener.');
        document.addEventListener('DOMContentLoaded', setupDelegatedListener);
    } else {  // 'DOMContentLoaded' has already fired
        console.log('[DEBUG domEvents.js] DOM already ready, calling setupDelegatedListener directly.');
        setupDelegatedListener();
    }
    console.log('[DEBUG domEvents.js] === initializeDomEvents function exiting ===');
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