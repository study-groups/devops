import { withAuthHeaders } from '/client/headers.js';
import { eventBus } from '/client/eventBus.js';

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

export async function uploadImage(file) {
    log.info('IMAGE', 'UPLOAD_ATTEMPT', `Attempting to upload image: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    
    // Validate file type
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        log.warn('IMAGE', 'UNSUPPORTED_FILE_TYPE', `Unsupported file type: ${file.type}. Supported types: ${SUPPORTED_IMAGE_TYPES.join(', ')}`);
        return null;
    }
    
    const formData = new FormData();
    formData.append('image', file);

    // Find the editor element more safely
    const editor = document.getElementById('editor-container');
    
    // Check if the editor exists before trying to get selection
    if (!editor) {
        log.error('IMAGE', 'EDITOR_NOT_FOUND', 'Error: Editor element not found. The image was uploaded but could not be inserted.');
        return null;
    }
    
    // Get cursor position safely
    let cursorPos = 0;
    let previousState = '';
    
    // Check if the element is a textarea or has value property
    if (editor.tagName === 'TEXTAREA' || editor.value !== undefined) {
        cursorPos = editor.selectionStart || 0;
        previousState = editor.value || '';
    } else {
        // If it's a div with contenteditable or has another structure
        const textarea = editor.querySelector('textarea');
        if (textarea) {
            cursorPos = textarea.selectionStart || 0;
            previousState = textarea.value || '';
        } else {
            log.warn('IMAGE', 'TEXTAREA_NOT_FOUND', 'Warning: Could not find textarea in editor. Will append image at end.');
        }
    }
    
    // Check if file is large
    const isLarge = file.size > 5 * 1024 * 1024;
    const uploadUrl = `/api/images/upload`;

    try {
        log.info('IMAGE', 'UPLOADING', `Calling globalFetch for ${uploadUrl}`);
        const response = await window.APP.services.globalFetch(uploadUrl, { 
            method: 'POST', 
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });
        log.info('IMAGE', 'UPLOAD_RESPONSE', `globalFetch returned for ${uploadUrl}. Status: ${response?.status}, OK: ${response?.ok}`);

        if (!response.ok) {
            let errorMessage = `Upload failed with status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || `${response.status}: ${response.statusText || 'Server error'}`;
                log.error('IMAGE', 'UPLOAD_SERVER_ERROR', `Server error response: ${JSON.stringify(errorData)}`);
            } catch (parseError){
                let rawResponse = '';
                try {
                    rawResponse = await response.text();
                } catch {}
                errorMessage = `${response.status}: ${response.statusText || 'Server error, non-JSON response'}`;
                log.error('IMAGE', 'UPLOAD_NON_JSON_ERROR', `Server error response was not JSON: ${rawResponse}`); 
            }
            
            if (response.status === 413) {
                errorMessage = "Image too large (>10MB). Please resize the image before uploading.";
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.url) throw new Error('Invalid URL in response');

        const imageUrl = data.url.startsWith('/') ? data.url : `/${data.url}`;
        log.info('IMAGE', 'UPLOAD_SUCCESS', `Uploaded file: ${imageUrl}`);

        // REMOVED: Direct editor manipulation from imageManager
        /*
        // Insert the Markdown image reference into the editor
        // This is the part that was failing
        try {
            // Determine which element to modify
            let targetElement = editor;
            if (editor.tagName !== 'TEXTAREA' && editor.value === undefined) {
                targetElement = editor.querySelector('textarea');
                if (!targetElement) {
                    log.warn('IMAGE', 'NO_TEXTAREA_FOR_INSERT', 'Warning: Could not find textarea to insert image into.');
                    // Return the URL even if we couldn't insert it
                    return imageUrl;
                }
            }
            
            // Get the current content and insert the image
            const textBefore = targetElement.value.substring(0, cursorPos);
            const textAfter = targetElement.value.substring(cursorPos);
            const newContent = `\n![](${imageUrl})\n`;
            targetElement.value = textBefore + newContent + textAfter;
            
            // Add to undo stack if it exists
            if (typeof imageOperationsStack !== 'undefined') {
                imageOperationsStack.push(new ImageOperation(
                    'insert',
                    imageUrl,
                    newContent,
                    cursorPos,
                    previousState
                ));
                
                // Maintain max stack size
                if (imageOperationsStack.length > MAX_UNDO_STACK) {
                    imageOperationsStack.shift();
                }
            }
            
            // Update image index if function exists
            if (typeof updateImageIndex === 'function') {
                await updateImageIndex();
            }
        } catch (insertError) {
            log.warn('IMAGE', 'INSERT_ERROR', `Warning: Image uploaded but couldn't be inserted: ${insertError.message}`);
            console.error('Insert error:', insertError);
        }
        */
        
        eventBus.emit('image:uploaded', { url: imageUrl, filename: file.name });
        return imageUrl;
    } catch (error) {
        const errorMessage = error.message || 'Unknown fetch error';
        log.error('IMAGE', 'UPLOAD_ERROR', `Upload error caught: ${errorMessage}`, error);
        console.error('Upload error details:', error);
        
        eventBus.emit('image:uploadError', { filename: file.name, error: errorMessage });
        return null;
    }
}

export async function deleteImage(imageUrl) {
    try {
        log.info('IMAGE', 'DELETE_ATTEMPT', `Attempting to delete image: ${imageUrl}`);
        
        // Extract the filename from the URL
        const filename = imageUrl.split('/').pop();
        if (!filename) {
            throw new Error('Invalid image URL');
        }
        
        // Use globalFetch with the emergency endpoint that we know works
        const response = await window.APP.services.globalFetch('/image-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: imageUrl })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to delete image: ${response.status} ${errorText}`);
        }

        // Get the response data
        const data = await response.json();
        
        log.info('IMAGE', 'DELETE_SUCCESS', `Successfully deleted image: ${filename}`);
        return true;
    } catch (error) {
        log.error('IMAGE', 'DELETE_FAILED', `Failed to delete image: ${error.message}`, error);
        console.error('Delete error details:', error);
        return false;
    }
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
