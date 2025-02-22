import { logMessage } from "./utils.js";
import { schedulePreviewUpdate } from "./markdown.js";
import { globalFetch } from "./globalFetch.js";

// Undo stack for image operations
const imageOperationsStack = [];
const MAX_UNDO_STACK = 50;

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
    const formData = new FormData();
    formData.append('image', file);

    const editor = document.getElementById('md-editor');
    const cursorPos = editor.selectionStart;
    const previousState = editor.value;

    // Check if file is large (> 5MB)
    const isLarge = file.size > 5 * 1024 * 1024;
    const uploadUrl = `/api/images/upload${isLarge ? '?large=true' : ''}`;

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
            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.url) throw new Error('Invalid URL in response');

        const imageUrl = data.url.startsWith('/') ? data.url : `/${data.url}`;
        logMessage(`Uploaded file: ${imageUrl}`);

        // Insert Markdown
        const textBefore = editor.value.substring(0, cursorPos);
        const textAfter = editor.value.substring(cursorPos);
        const newContent = `\n![](${imageUrl})\n`;
        editor.value = textBefore + newContent + textAfter;

        // Add to undo stack
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

        schedulePreviewUpdate();
        
        // Update image index
        await updateImageIndex();
    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        logMessage(`Upload error: ${errorMessage}`);
        console.error('Upload error details:', error);
        
        if (!error.response && error.message.includes('502')) {
            logMessage('Network error: Server may be unavailable or restarting');
        }
    }
}

export async function deleteImage(imageUrl) {
    const editor = document.getElementById('md-editor');
    const previousState = editor.value;
    
    try {
        // First find all references to this image
        const response = await globalFetch('/api/images/references', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: imageUrl })
        });

        if (!response.ok) throw new Error('Failed to get image references');
        
        const { references } = await response.json();
        
        if (references.length > 0) {
            const confirmDelete = confirm(
                `This image is referenced ${references.length} times. Delete anyway?`
            );
            if (!confirmDelete) return;
        }

        // Delete the image file and update references
        await globalFetch('/api/images/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: imageUrl })
        });

        // Add to undo stack
        imageOperationsStack.push(new ImageOperation(
            'delete',
            imageUrl,
            null,
            editor.selectionStart,
            previousState
        ));

        // Update image index
        await updateImageIndex();
        
        logMessage(`Deleted image: ${imageUrl}`);
    } catch (error) {
        logMessage(`Failed to delete image: ${error.message}`);
    }
}

export async function updateImageIndex() {
    try {
        await globalFetch('/api/images/update-index', {
            method: 'POST'
        });
        logMessage('Updated image index');
    } catch (error) {
        logMessage(`Failed to update image index: ${error.message}`);
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
