// domEvents.js - Handles DOM events and delegates to event bus
import { eventBus } from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
// Remove old import
import { authThunks } from '/client/store/slices/authSlice.js'; 
import { handleDeleteImageAction } from '/client/image/imageManager.js'; // Updated path
import { appStore } from '/client/appState.js';
// --- REMOVED: Import settings state for dynamic toolbar ---
 
import { executeRemoteCommand } from '/cli/handlers.js'; // Import CLI handler
import { appVer } from '/config.js'; // Use absolute path
// --- END ADDED ---

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('DOM', 'DomEvents');

// Add a isProcessingDelete variable to track ongoing operations
let isProcessingDelete = false;

// Define actions that require authentication
const PROTECTED_ACTIONS = new Set([
    'saveFile', 
    'delete-image', // Add back - Now handled by the global handler

]);

export function initializeDomEvents() {
    log.info('INIT_START', 'Initializing DOM event listeners...');

    // Setup delegated listener after DOM is ready
    const setupDelegatedListener = () => {
        log.info('SETUP_DELEGATED_LISTENER', 'DOM ready, attaching delegated listener...');

        document.body.addEventListener('click', (event) => {
            // If the click originated inside a .log-entry, assume it's handled by the direct listener in LogPanel.js
            if (event.target.closest('.log-entry')) {
                return;
            }

            if (event.alreadyHandled) {
                return; // Stop processing if already handled
            }

            // Check the event.target directly first, then use closest as a fallback
            let target = null;
            if (event.target.hasAttribute('data-action')) {
                target = event.target;
            } else {
                target = event.target.closest('[data-action]');
            }

            if (!target) {
                return;
            }

            const action = target.dataset.action;
            const params = { ...target.dataset }; // Pass all data attributes
            const isMenuItem = target.closest('#log-menu-container'); // Defined earlier

            // Condition for logging: not a menu item AND not the toggleLogMenu action itself
            const shouldLogDomEvent = !isMenuItem && action !== 'toggleLogMenu';

            if (shouldLogDomEvent) {
                log.info('DELEGATED_CLICK', `Delegated click found data-action: ${action} on target: ${target.tagName}#${target.id}.${target.className}`);
            }

            // --- Check Authentication --- 
            const requiresAuth = PROTECTED_ACTIONS.has(action);
            const isLoggedIn = appStore.getState().auth.isAuthenticated;

            if (requiresAuth && !isLoggedIn) {
                log.warn('AUTH_REQUIRED', `Action '${action}' requires login. User not logged in. Preventing action.`);
                alert('Please log in to perform this action.'); 
                return; // Stop execution if auth required and not logged in
            }
            // --- End Auth Check --- 

            // Check if the action exists in triggerActions
            if (triggerActions[action]) {
                if (shouldLogDomEvent) {
                    log.info('ACTION_HANDLER_FOUND', `Found handler for action '${action}' in triggerActions. Executing...`);
                }
                try {
                    triggerActions[action](params, target); // Pass params and the clicked element
                    if (shouldLogDomEvent) {
                        log.info('ACTION_EXECUTED', `Action '${action}' executed successfully via triggerActions.`);
                    }
                    
                    // <<< MODIFIED: Close Menu Directly if click was inside it >>>
                    // const menuContainer = target.closest('#log-menu-container'); // Already checked
                    if (isMenuItem) { // Use the check from above
                         // <<< SILENCED menu closure logging >>>
                         const menuToClose = document.getElementById('log-menu-container'); 
                         menuToClose?.classList.remove('visible'); 
                    }
                    // <<< END MODIFICATION >>>

                } catch (error) {
                    log.error('ACTION_EXECUTION_ERROR', `Error executing action '${action}' via triggerActions: ${error.message}`, error);
                }
            } else {
                log.warn('NO_ACTION_HANDLER', `No handler found for action: ${action}`);
            }
            
            if (target.tagName === 'BUTTON') {
                 event.preventDefault();
            }
        });
        log.info('LISTENER_ATTACHED', 'Delegated click listener for data-actions attached.');
        log.info('INIT_COMPLETE_DELEGATED', 'Delegated DOM event listener initialized.');
    };

    // Check if the DOM is already loaded
    if (document.readyState === 'loading') {  // Loading hasn't finished yet
        document.addEventListener('DOMContentLoaded', setupDelegatedListener);
    } else {  // 'DOMContentLoaded' has already fired
        setupDelegatedListener();
    }
    log.info('INIT_COMPLETE', 'initializeDomEvents function exiting.');
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
        log.warn('DELETE_IN_PROGRESS', `Delete already in progress, ignoring duplicate request`);
        return;
    }
    
    log.info('DIRECT_DELETE_REQUEST', `Direct delete requested for: ${imageName}`);
    
    if (confirm(`Are you sure you want to delete ${decodeURIComponent(imageName)}?`)) {
        try {
            isProcessingDelete = true;
            const imageUrl = `/uploads/${decodeURIComponent(imageName)}`;
            
            // Use globalFetch with the emergency endpoint
            const response = await window.APP.services.globalFetch('/image-delete', {
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
            
            log.info('DELETE_SUCCESS', `Successfully deleted: ${imageName}`);
            alert('Image deleted successfully');
            
            // Add a small delay before reload to ensure the alert is seen
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (error) {
            log.error('DELETE_ERROR', `Error deleting image: ${error.message}`, error);
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
    window.APP.services.handleImageDelete = function(imageName) {
        log.warn('LEGACY_HANDLE_IMAGE_DELETE', 'Legacy handleImageDelete called');
        // Don't call triggerActions.deleteImage(imageName) again
        // The button's onclick already triggers our direct handler
        
        // Prevent default handler from running by returning false
        return false;
    };
    
    // For login
    window.handleLogin = function(username, password) {
        log.warn('LEGACY_HANDLE_LOGIN', 'Legacy handleLogin called, forwarding to event system via triggerActions');
        triggerActions.login(username, password);
    };
    
    // For logout
    window.handleLogout = function() {
        log.warn('LEGACY_HANDLE_LOGOUT', 'Legacy handleLogout called, forwarding to event system via triggerActions');
        triggerActions.logout();
    };
    
    log.info('GLOBAL_FUNCTIONS_CONNECTED', 'Global compatibility functions connected');
}

// --- ADDED: Subscribe to login state changes to update body class ---
log.info('SUBSCRIBE_AUTH_STATE', 'Subscribing to auth state changes for body class.');
let prevState = appStore.getState(); // Initialize previous state
appStore.subscribe(() => { // CHANGED: Use appStore
    const newState = appStore.getState();
            const newLoggedIn = newState.auth?.isAuthenticated;
        const oldLoggedIn = prevState?.auth?.isAuthenticated;

    if (newLoggedIn !== oldLoggedIn) {
        const body = document.body;
        if (newLoggedIn) {
            body.classList.add('logged-in');
            body.classList.remove('logged-out');
        } else {
            body.classList.add('logged-out');
            body.classList.remove('logged-in');
        }
    }
    prevState = newState; // Update previous state
});

function handleGenericEvent(event) {
    const { type, target } = event;
    const elementPath = getElementPath(target); // Get the path of the clicked element

    // Iterate through the registered event handlers
    for (const handler of registeredEventHandlers) {
        if (handler.type === type) {
            const pathString = getPathString(elementPath, handler.depth);
            const action = handler.actions[pathString];

            if (action) {
                console.log(`[DOM Event: ${type}] Action: ${action}, Path: ${pathString}`);
                if (actions[action]) {
                    // Pass the event and the element that triggered the event
                    // ... existing code ...
                } else {
                    // If no specific action is found for the exact path,
                    // you might want to log this or handle it as a default case.
                    // For example, if you click on a deeply nested element but only have a handler for its parent.
                     console.log(`[DOM Event: ${type}] No action found for path: ${pathString}`);
                }
            }
        }
    }
} 