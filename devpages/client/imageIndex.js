import { deleteImage, updateImageIndex } from './imageManager.js';
import { logMessage } from './log/index.js';

/**
 * Initialize the image index functionality, including the delete button handler
 */
export function initializeImageIndex() {
    logMessage('[IMAGES] Initializing image index functionality');
    
    logMessage('[IMAGES] Image index functionality initialized');
}

/**
 * Checks if the current page is the image index
 * @returns {boolean} True if on the image index page
 */
function isImageIndexPage() {
    // Check if the URL contains the image index path or the page contains the image index table
    return window.location.pathname.includes('/images') || 
           document.querySelector('h1')?.textContent.includes('Image Index') ||
           document.querySelector('table')?.innerHTML.includes('Image Info');
}

/**
 * Refreshes the image index table
 * Should be called after an image is deleted
 */
export async function refreshImageIndex() {
    try {
        // First, update the index on the server
        await updateImageIndex();
        
        // If we're on the image index page, reload it
        if (isImageIndexPage()) {
            const indexContainer = document.querySelector('.markdown-body');
            if (indexContainer) {
                // Get the updated index content
                const response = await fetch('/images/index');
                if (response.ok) {
                    const html = await response.text();
                    indexContainer.innerHTML = html;
                    logMessage('Image index refreshed');
                } else {
                    throw new Error(`Failed to refresh index: ${response.status}`);
                }
            } else {
                // Fallback to page reload if container not found
                window.location.reload();
            }
        }
    } catch (error) {
        logMessage(`Error refreshing image index: ${error.message}`);
        console.error('Refresh error:', error);
    }
} 