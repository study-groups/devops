import { logMessage } from "/client/log/index.js";
import { schedulePreviewUpdate } from "/client/markdown.js";
import { globalFetch } from "/client/globalFetch.js";
import { withAuthHeaders } from '/client/headers.js';

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
        logMessage('No image operations to undo');
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
            await globalFetch(`/api/images/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: lastOperation.imageUrl })
            });
        } catch (error) {
            logMessage(`Failed to delete image file: ${error.message}`);
        }
    }

    schedulePreviewUpdate();
    logMessage('Undid last image operation');
}

export async function uploadImage(file) {
    logMessage('Uploading image...');
    
    // Validate file type
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        logMessage(`Unsupported file type: ${file.type}. Supported types: ${SUPPORTED_IMAGE_TYPES.join(', ')}`);
        return null;
    }
    
    const formData = new FormData();
    formData.append('image', file);

    // Find the editor element more safely
    const editor = document.getElementById('md-editor');
    
    // Check if the editor exists before trying to get selection
    if (!editor) {
        logMessage('Error: Editor element not found. The image was uploaded but could not be inserted.');
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
            logMessage('Warning: Could not find textarea in editor. Will append image at end.');
        }
    }
    
    // Check if file is large
    const isLarge = file.size > 5 * 1024 * 1024;
    const uploadUrl = `/api/images/upload`;

    try {
        const response = await globalFetch(uploadUrl, { 
            method: 'POST', 
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            let errorMessage = 'Upload failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || `${response.status}: ${response.statusText}`;
            } catch {
                errorMessage = `${response.status}: ${response.statusText}`;
            }
            
            if (response.status === 413) {
                errorMessage = "Image too large (>10MB). Please resize the image before uploading.";
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.url) throw new Error('Invalid URL in response');

        const imageUrl = data.url.startsWith('/') ? data.url : `/${data.url}`;
        logMessage(`Uploaded file: ${imageUrl}`);

        // Insert the Markdown image reference into the editor
        // This is the part that was failing
        try {
            // Determine which element to modify
            let targetElement = editor;
            if (editor.tagName !== 'TEXTAREA' && editor.value === undefined) {
                targetElement = editor.querySelector('textarea');
                if (!targetElement) {
                    logMessage('Warning: Could not find textarea to insert image into.');
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
            
            // Update preview if function exists
            if (typeof schedulePreviewUpdate === 'function') {
                schedulePreviewUpdate();
            }
            
            // Update image index if function exists
            if (typeof updateImageIndex === 'function') {
                await updateImageIndex();
            }
        } catch (insertError) {
            logMessage(`Warning: Image uploaded but couldn't be inserted: ${insertError.message}`);
            console.error('Insert error:', insertError);
        }
        
        return imageUrl;
    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        logMessage(`Upload error: ${errorMessage}`);
        console.error('Upload error details:', error);
        
        return null;
    }
}

export async function deleteImage(imageUrl) {
    try {
        logMessage(`Attempting to delete image: ${imageUrl}`);
        
        // Extract the filename from the URL
        const filename = imageUrl.split('/').pop();
        if (!filename) {
            throw new Error('Invalid image URL');
        }
        
        // Use globalFetch with the emergency endpoint that we know works
        const response = await globalFetch('/image-delete', {
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
        
        logMessage(`Successfully deleted image: ${filename}`);
        return true;
    } catch (error) {
        logMessage(`Failed to delete image: ${error.message}`);
        console.error('Delete error details:', error);
        return false;
    }
}

export async function updateImageIndex() {
    try {
        const response = await globalFetch('/api/images/generate-index', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${await response.text()}`);
        }
        
        logMessage('Updated image index successfully');
    } catch (error) {
        logMessage(`Failed to update image index: ${error.message}`);
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
