// domEvents.js - Handles DOM events and delegates to event bus
import { eventBus } from './eventBus.js';
import { logMessage } from './log/index.js';
import { triggerActions } from './actions.js';
import { globalFetch } from './globalFetch.js';

// Add a isProcessingDelete variable to track ongoing operations
let isProcessingDelete = false;

export function initializeDomEvents() {
    // Set up global event delegation
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('submit', handleFormSubmit);
    
    // Connect window-level functions to our event system
    connectGlobalFunctions();
    
    logMessage('[EVENTS] DOM event delegation initialized');
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