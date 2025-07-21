/**
 * Image action handlers
 * Responsible for image operations like deletion and management
 */
import eventBus from '/client/eventBus.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('ImageActions');

export const imageActionHandlers = {
    /**
     * Deletes an image
     * @param {String} imageName - Name of the image to delete
     */
    deleteImage: async (imageName) => {
        log.info('ACTION', 'DELETE_IMAGE_START', `Delete requested for image: ${imageName}`);
        
        if (confirm(`Are you sure you want to delete ${decodeURIComponent(imageName)}?`)) {
            try {
                const imageUrl = `/uploads/${decodeURIComponent(imageName)}`;
                
                // Use the emergency endpoint
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
                
                const data = await response.json();
                log.info('ACTION', 'DELETE_IMAGE_SUCCESS', `Successfully deleted: ${imageName}`, data);
                
                // Notify of successful deletion
                eventBus.emit('image:deleted', { imageName });
                
                // Reload the page to refresh the index
                window.location.reload();
            } catch (error) {
                log.error('ACTION', 'DELETE_IMAGE_FAILED', `Image delete error: ${error.message}`, error);
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
            log.error('ACTION', 'DELETE_IMAGE_FAILED', 'Cannot delete image: No image name provided.');
            return;
        }
        
        imageActionHandlers.deleteImage(imageName);
    }
}; 