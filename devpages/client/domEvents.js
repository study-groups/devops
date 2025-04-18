// domEvents.js - Handles DOM events and delegates to event bus
import { eventBus } from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
// Remove old import
// import { AUTH_STATE, handleLogin, logout } from '/client/auth.js';
// Import only logout from auth.js
import { logout } from '/client/auth.js'; 
// Import the new reactive state
// import { authState } from '/client/authState.js'; 
import { globalFetch } from '/client/globalFetch.js';
import { handleDeleteImageAction } from '/client/imageManager.js'; // Import the new handler
import { appState } from '/client/appState.js';

// Add a isProcessingDelete variable to track ongoing operations
let isProcessingDelete = false;

// Define actions that require authentication
const PROTECTED_ACTIONS = new Set([
    'saveFile', 
    'delete-image', // Add back - Now handled by the global handler
    // 'toggleCommunityLink' - Handled internally now
]);

// Helper for logging within this module
function logDomEvent(message, level = 'text') {
    const type = 'DOM_EVENT';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

export function initializeDomEvents() {
    console.log('[DEBUG domEvents.js] === initializeDomEvents function entered ===');
    console.log('[DEBUG] Entering initializeDomEvents function.');
    logDomEvent('Initializing DOM event listeners...');

    // Setup delegated listener after DOM is ready
    const setupDelegatedListener = () => {
        console.log('[DEBUG domEvents.js] === setupDelegatedListener function entered ===');
        logDomEvent('DOM ready, attaching delegated listener...');

        console.log('[DEBUG domEvents.js] Adding click listener to document.body...');
        document.body.addEventListener('click', (event) => {
            console.log('[DEBUG domEvents.js] Body click detected. Event target:', event.target);

            if (event.alreadyHandled) {
                console.log('[DEBUG domEvents.js] Event already handled by another listener (e.g., inline script). Skipping global handler.');
                return; // Stop processing if already handled
            }

            const target = event.target.closest('[data-action]');
            console.log('[DEBUG domEvents.js] closest data-action result:', target);

            if (!target) {
                console.log('[DEBUG domEvents.js] No data-action found on target or parents. Exiting handler.');
                return;
            }
            console.log('[DEBUG domEvents.js] Found target with data-action:', target);

            const action = target.dataset.action;

            // --- Revised Check --- 
            // Only proceed if the action is defined in the global action map
            if (typeof triggerActions[action] !== 'function') {
                console.log(`[DEBUG domEvents.js] Action "${action}" not found in global triggerActions. Assuming handled elsewhere or invalid action.`);
                return; // Exit gracefully, allowing other handlers (like embedded scripts)
            }
            // --- End Revised Check --- 

            logDomEvent(`Action triggered: ${action} on ${target.tagName}#${target.id}`);
            console.log(`[DEBUG domEvents.js] Found function for action "${action}" in triggerActions. Proceeding...`);
            
            let actionData = {}; 
            for (const key in target.dataset) {
                // Convert camelCase keys from data attributes (e.g., data-image-name -> imageName)
                let camelCaseKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
                if (camelCaseKey !== 'action') { actionData[camelCaseKey] = target.dataset[key]; }
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
            
            // Check if the action requires authentication using appState
            if (PROTECTED_ACTIONS.has(action)) {
                // Get current state directly from appState
                if (appState.getState().auth.isLoggedIn) { 
                    // Authenticated: Proceed with action
                     if (typeof triggerActions[action] === 'function') {
                         triggerActions[action](actionData, target);
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
                    triggerActions[action](actionData, target);
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
        logDomEvent('[COMPAT] Legacy handleLogin called, forwarding to event system via triggerActions');
        triggerActions.login(username, password);
    };
    
    // For logout
    window.handleLogout = function() {
        logDomEvent('[COMPAT] Legacy handleLogout called, forwarding to event system via triggerActions');
        triggerActions.logout();
    };
    
    logDomEvent('[EVENTS] Global compatibility functions connected');
} 