// previewRefresh.js - Handles manual preview refresh functionality
import { logMessage } from "./log/index.js";
import { updatePreview } from './markdown.js';

/**
 * Manually refreshes the markdown preview with the current editor content
 */
export function refreshPreview() {
    try {
        const editor = document.querySelector('#md-editor textarea');
        if (!editor) {
            logMessage('[PREVIEW ERROR] Editor not found');
            return;
        }
        
        const content = editor.value;
        updatePreview(content);
        logMessage('[PREVIEW] Preview manually refreshed');
    } catch (error) {
        logMessage(`[PREVIEW ERROR] Failed to refresh preview: ${error.message}`);
        console.error('[PREVIEW ERROR]', error);
    }
}

/**
 * Initialize the preview refresh button
 */
export function initPreviewRefreshButton() {
    const refreshBtn = document.getElementById('refresh-preview-btn');
    if (!refreshBtn) {
        logMessage('[PREVIEW] Refresh button not found');
        return;
    }
    
    refreshBtn.addEventListener('click', refreshPreview);
    logMessage('[PREVIEW] Refresh button initialized');
    
    // Add keyboard shortcut (Ctrl+R)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.altKey && !e.shiftKey) {
            e.preventDefault(); // Prevent browser refresh
            refreshPreview();
            logMessage('[PREVIEW] Refresh triggered by keyboard shortcut (Ctrl+R)');
        }
    });
} 