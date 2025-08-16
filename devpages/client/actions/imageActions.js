/**
 * Image action handlers
 * Responsible for image operations like deletion and management
 */
import { appStore } from '/client/appState.js';
import { deleteImage } from '/client/store/slices/imageSlice.js';

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
            appStore.dispatch(deleteImage(imageName));
            // Reload the page to refresh the index
            window.location.reload();
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