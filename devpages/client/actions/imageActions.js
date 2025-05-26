/**
 * Image action handlers
 * Responsible for image operations like deletion and management
 */
import { globalFetch } from '/client/globalFetch.js';
import eventBus from '/client/eventBus.js';

// Helper for logging within this module
function logAction(message, level = 'debug') {
    const type = 'ACTION'
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

export const imageActionHandlers = {
    /**
     * Deletes an image
     * @param {String} imageName - Name of the image to delete
     */
    deleteImage: async (imageName) => {
        logAction(`Delete requested for image: ${imageName}`);
        
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
                logAction(`Successfully deleted: ${imageName}`);
                
                // Notify of successful deletion
                eventBus.emit('image:deleted', { imageName });
                
                // Reload the page to refresh the index
                window.location.reload();
            } catch (error) {
                logAction(`Image delete error: ${error.message}`, 'error');
                alert(`Error deleting image: ${error.message}`);
                
                // Notify of failed deletion
                eventBus.emit('image:deleteError', { imageName, error: error.message });
            }
        }
    },

    /**
     * Handles the direct delete image action
     * @param {Object} data - Data object
     * @param {HTMLElement} element - Element that triggered the action
     */
    handleDeleteImage: (data, element) => {
        const imageName = data?.imageName || element?.dataset?.imageName;
        if (!imageName) {
            logAction('Cannot delete image: No image name provided.', 'error');
            return;
        }
        
        imageActionHandlers.deleteImage(imageName);
    }
}; 