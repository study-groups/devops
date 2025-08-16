import { withAuthHeaders } from '/client/headers.js';
import { appStore } from '/client/appState.js';
import { uploadImage as uploadImageAction } from '/client/store/slices/imageSlice.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('ImageManager');

// Undo stack for image operations
const imageOperationsStack = [];
const MAX_UNDO_STACK = 50;

// Supported image types
const SUPPORTED_IMAGE_TYPES = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'image/svg+xml'  // Add SVG support
];

class ImageOperation {
    constructor(type, imageUrl, mdContent, cursorPos, previousState) {
        this.type = type; // 'insert', 'delete', 'update'
        this.imageUrl = imageUrl;
        this.mdContent = mdContent;
        this.cursorPos = cursorPos;
        this.previousState = previousState;
        this.timestamp = Date.now();
    }
}

export async function undoLastImageOperation() {
    if (imageOperationsStack.length === 0) {
        log.info('IMAGE', 'UNDO_EMPTY', 'No image operations to undo');
        return;
    }

    const lastOperation = imageOperationsStack.pop();
    const editor = document.getElementById('md-editor');

    // Restore previous state
    editor.value = lastOperation.previousState;
    editor.selectionStart = lastOperation.cursorPos;
    editor.selectionEnd = lastOperation.cursorPos;
    
    // If it was an insert, we should also delete the image file
    if (lastOperation.type === 'insert') {
        try {
            await window.APP.services.globalFetch(`/api/images/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: lastOperation.imageUrl })
            });
        } catch (error) {
            log.error('IMAGE', 'UNDO_DELETE_FAILED', `Failed to delete image file: ${error.message}`, error);
        }
    }

    // schedulePreviewUpdate(); // REMOVED: PreviewPanel manages its own updates
    log.info('IMAGE', 'UNDO_SUCCESS', 'Undid last image operation');
}

export async function updateImageIndex() {
    try {
        const response = await window.APP.services.globalFetch('/api/images/generate-index', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${await response.text()}`);
        }
        
        log.info('IMAGE', 'UPDATE_INDEX_SUCCESS', 'Updated image index successfully');
    } catch (error) {
        log.error('IMAGE', 'UPDATE_INDEX_FAILED', `Failed to update image index: ${error.message}`, error);
        console.error('[IMAGES ERROR] Index update failed:', error);
    }
}

// Add keyboard shortcut for undo
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && 
        document.activeElement.id === 'md-editor') {
        e.preventDefault();
        undoLastImageOperation();
    }
});

// Function specifically for handling the delete button click from the index page
// Upload image function for EditorPanel
export async function uploadImage(file, onProgress) {
    if (!file) {
        throw new Error('No file provided');
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        throw new Error(`Unsupported image type: ${file.type}`);
    }

    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await window.APP.services.globalFetch('/api/upload-image', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        log.info('IMAGE', 'UPLOAD_SUCCESS', `Image uploaded: ${result.url}`);
        
        return result;
    } catch (error) {
        log.error('IMAGE', 'UPLOAD_FAILED', `Failed to upload image: ${error.message}`, error);
        throw error;
    }
}

export async function handleDeleteImageAction(actionData) {
    const imageName = actionData.imageName; // Get image name from data passed by domEvents
    if (!imageName) {
        log.error('IMAGE', 'DELETE_ACTION_NO_IMAGENAME', 'handleDeleteImageAction called without imageName');
        return;
    }

    const decodedImageName = decodeURIComponent(imageName);

    if (confirm(`Are you sure you want to delete ${decodedImageName}?`)) {
        log.info('IMAGE', 'DELETE_ACTION_ATTEMPT', `Attempting delete via action for: ${decodedImageName}`);
        try {
            const imageUrl = `/uploads/${decodedImageName}`;
            const response = await window.APP.services.globalFetch('/image-delete', { // Use correct POST endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: imageUrl })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${response.status} ${errorText}`);
            }

            const result = await response.json(); // Assuming JSON success response
            log.info('IMAGE', 'DELETE_ACTION_SUCCESS', `Successfully deleted ${decodedImageName}: ${result.message || 'Success'}`);
            alert('Image deleted successfully');
            window.location.reload(); // Reload to update the index page

        } catch (error) {
            log.error('IMAGE', 'DELETE_ACTION_FAILED', `Failed to delete ${decodedImageName}: ${error.message}`, error);
            alert(`Error deleting image: ${error.message}`);
        }
    }
}
