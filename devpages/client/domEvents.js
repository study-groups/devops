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
import { handleDeleteImageAction } from '/client/image/imageManager.js'; // Updated path
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
// --- REMOVED: Import settings state for dynamic toolbar ---
// import { settingsState } from '/client/settings/settingsState.js'; 
import { executeRemoteCommand } from '/client/cli/handlers.js'; // Import CLI handler
import { renderMarkdown } from '/client/preview/renderer.js'; // Import markdown renderer
import { appVer } from '/config.js'; // Use absolute path
// --- END ADDED ---

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

            // If the click originated inside a .log-entry, assume it's handled by the direct listener in LogPanel.js
            if (event.target.closest('.log-entry')) {
                console.log('[DEBUG domEvents.js] Click target is inside .log-entry, assuming handled directly. Exiting body listener.');
                return;
            }

            if (event.alreadyHandled) {
                console.log('[DEBUG domEvents.js] Event already handled by another listener (e.g., inline script). Skipping global handler.');
                return; // Stop processing if already handled
            }

            // Check the event.target directly first, then use closest as a fallback
            let target = null;
            if (event.target.hasAttribute('data-action')) {
                target = event.target;
                console.log('[DEBUG domEvents.js] Found data-action directly on event.target.');
            } else {
                target = event.target.closest('[data-action]');
                console.log('[DEBUG domEvents.js] Used closest() to find data-action result:', target);
            }

            if (!target) {
                console.log('[DEBUG domEvents.js] No data-action found on target or parents (checked both directly and via closest). Exiting handler.');
                return;
            }
            console.log('[DEBUG domEvents.js] Found target with data-action:', target);

            const action = target.dataset.action;
            const params = { ...target.dataset }; // Pass all data attributes
            logDomEvent(`Delegated click found data-action: ${action} on target: ${target.tagName}#${target.id}.${target.className}`);

            // --- Check Authentication --- 
            const requiresAuth = PROTECTED_ACTIONS.has(action);
            const isLoggedIn = appStore.getState().auth.isLoggedIn;

            if (requiresAuth && !isLoggedIn) {
                logDomEvent(`Action '${action}' requires login. User not logged in. Preventing action.`, 'warning');
                alert('Please log in to perform this action.'); 
                return; // Stop execution if auth required and not logged in
            }
            // --- End Auth Check --- 

            // Check if the action exists in triggerActions
            if (triggerActions[action]) {
                // <<< SILENCE menu item clicks >>>
                const isMenuItem = target.closest('#log-menu-container');
                if (!isMenuItem) {
                    logDomEvent(`Found handler for action '${action}' in triggerActions. Executing...`);
                }
                try {
                    triggerActions[action](params, target); // Pass params and the clicked element
                    // <<< SILENCE menu item clicks >>>
                    if (!isMenuItem) {
                        logDomEvent(`Action '${action}' executed successfully via triggerActions.`);
                    }
                    
                    // <<< MODIFIED: Close Menu Directly if click was inside it >>>
                    // const menuContainer = target.closest('#log-menu-container'); // Already checked
                    if (isMenuItem) { // Use the check from above
                         // <<< SILENCED menu closure logging >>>
                         /*
                         if (action !== 'clearLog') {
                            logDomEvent('Action originated inside log menu, closing menu directly...');
                         }
                         */
                         const menuToClose = document.getElementById('log-menu-container'); 
                         menuToClose?.classList.remove('visible'); 
                    }
                    // <<< END MODIFICATION >>>

                } catch (error) {
                    logDomEvent(`Error executing action '${action}' via triggerActions: ${error.message}`, 'error');
                    console.error(`[DOM Event Action Error] Action: ${action}`, error);
                }
            } else {
                logDomEvent(`No handler found for action: ${action}`, 'warning');
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

// --- ADDED: Subscribe to login state changes to update body class ---
logDomEvent('Subscribing to auth state changes for body class.');
appStore.subscribe((newState, prevState) => { // CHANGED: Use appStore
    const newLoggedIn = newState.auth?.isLoggedIn;
    const oldLoggedIn = prevState?.auth?.isLoggedIn;

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
}); 