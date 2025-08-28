// imageEvents.js - Centralized image event handling
import { deleteImage, updateImageIndex } from './imageManager.js';
import { logMessage } from './log/index.js';

/**
 * Initialize image event delegation
 * Sets up global event listeners for image-related actions
 */
export function initializeImageEvents() {
    logMessage('[IMAGES] Initializing image event handlers');
    
    // IMPORTANT: Don't redefine window.handleImageDelete if it already exists!
    // Instead, just add the event listener
    
    // Add a click handler specifically for delete buttons
    document.addEventListener('click', function(event) {
        // Find the delete button if clicked on or inside one
        const deleteBtn = event.target.closest('[data-action="delete-image"]');
        if (deleteBtn) {
            event.preventDefault();
            event.stopPropagation();
            
            const imageName = deleteBtn.getAttribute('data-image-name');
            if (imageName) {
                // Use the already-defined global handler
                if (typeof window.APP.services.handleImageDelete === 'function') {
                    window.handleImageDelete(imageName);
                }
            }
        }
    });
    
    logMessage('[IMAGES] Image event handlers initialized');
}

/**
 * Central handler for all image-related actions
 * Uses data-* attributes to determine the action and parameters
 */
function handleImageEvent(event) {
    // Find if the clicked element or any of its parents has a data-action attribute
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return; // Not an action element
    
    const action = actionElement.dataset.action;
    
    // Handle different types of image actions
    switch (action) {
        case 'delete-image':
            handleDeleteImage(actionElement);
            break;
        case 'upload-image':
            handleUploadImage(actionElement);
            break;
        // Add more actions as needed
    }
}

/**
 * Handle image deletion
 * @param {HTMLElement} element - The element with the delete action
 */
async function handleDeleteImage(element) {
    const imageName = decodeURIComponent(element.dataset.imageName);
    
    logMessage(`[IMAGES] Delete requested for: ${imageName}`);
    
    if (confirm(`Are you sure you want to delete ${imageName}?`)) {
        try {
            const imageUrl = `/uploads/${imageName}`;
            logMessage(`[IMAGES] Deleting image: ${imageUrl}`);
            
            // Use the existing deleteImage function from imageManager.js
            const success = await deleteImage(imageUrl);
            
            if (success) {
                logMessage(`[IMAGES] Successfully deleted image: ${imageName}`);
                // Reload the page to refresh the index
                window.location.reload();
            } else {
                throw new Error('Delete operation failed');
            }
        } catch (error) {
            logMessage(`[IMAGES ERROR] Failed to delete image: ${error.message}`);
            alert(`Error deleting image: ${error.message}`);
        }
    }
}

/**
 * Handle image upload (placeholder for extensibility)
 */
function handleUploadImage(element) {
    // Implementation for upload if needed
    logMessage('[IMAGES] Upload action triggered');
}

// Add this function to handle legacy delete calls
async function handleLegacyImageDelete(imageName, imageUrl) {
    if (confirm(`Are you sure you want to delete ${imageName}?`)) {
        try {
            logMessage(`[IMAGES] Deleting image via legacy handler: ${imageUrl}`);
            
            // Use the existing deleteImage function from imageManager.js
            const success = await deleteImage(imageUrl);
            
            if (success) {
                logMessage(`[IMAGES] Successfully deleted image: ${imageName}`);
                // Reload the page to refresh the index
                window.location.reload();
            } else {
                throw new Error('Delete operation failed');
            }
        } catch (error) {
            logMessage(`[IMAGES ERROR] Failed to delete image: ${error.message}`);
            alert(`Error deleting image: ${error.message}`);
        }
    }
} 