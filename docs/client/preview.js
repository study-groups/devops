// preview.js - Handles markdown preview functionality
import { logMessage } from './log/index.js';

let previewElement = null;
let updateTimer = null;

export function initializePreview() {
    previewElement = document.getElementById('md-preview');
    if (!previewElement) {
        logMessage('[PREVIEW ERROR] Preview element not found');
        return false;
    }
    return true;
}

export function updatePreview(content) {
    if (!previewElement) {
        previewElement = document.getElementById('md-preview');
    }
    
    if (!previewElement) {
        logMessage('[PREVIEW ERROR] Preview element not found');
        return;
    }

    try {
        // Clear any pending updates
        if (updateTimer) {
            clearTimeout(updateTimer);
        }

        // Schedule the update
        updateTimer = setTimeout(() => {
            try {
                // Use marked if available, otherwise use basic HTML escaping
                if (typeof marked === 'function') {
                    previewElement.innerHTML = marked(content);
                } else {
                    previewElement.innerHTML = escapeHtml(content);
                }
                logMessage('[PREVIEW] Preview updated');
            } catch (error) {
                logMessage('[PREVIEW ERROR] Failed to render markdown: ' + error.message);
            }
        }, 100);
    } catch (error) {
        logMessage('[PREVIEW ERROR] Failed to update preview: ' + error.message);
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
} 