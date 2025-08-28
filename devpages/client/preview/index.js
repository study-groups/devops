/**
 * @file client/preview/index.js
 * @description State-driven entry point for the preview system.
 * This file exports functions to initialize and update the preview,
 * which dispatch Redux thunks to manage the application state.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import { appStore } from '/client/appState.js';
import { 
    renderMarkdown as renderMarkdownThunk,
    setHtmlContent,
    initializePreviewSystem as initializePreviewSystemThunk
} from '/client/store/slices/previewSlice.js';
import { renderMarkdown, postProcessRender } from './renderer.js';

const log = window.APP.services.log.createLogger('Preview');

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Prevent multiple simultaneous preview updates
let isUpdating = false;

/**
 * Thunk for updating the preview with new content.
 * It renders the markdown and updates the preview slice.
 */
export const updatePreview = createAsyncThunk(
    'preview/updateContent',
    async ({ content, filePath }, { dispatch }) => {
        // Prevent recursive or simultaneous updates
        if (isUpdating) return null;
        
        try {
            isUpdating = true;
            
            const { html, frontMatter, externalScriptUrls, inlineScriptContents } = await renderMarkdown(content, filePath);
            
            dispatch(setHtmlContent(html));
            
            // The UI component will be responsible for post-processing
            // This thunk just provides the necessary data.
            return { html, frontMatter, externalScriptUrls, inlineScriptContents };
        } catch (error) {
            log.error('PREVIEW', 'UPDATE_ERROR', `Failed to update preview: ${error.message}`, error);
            throw error;
        } finally {
            isUpdating = false;
        }
    }
);

// Debounced preview update function
const debouncedUpdatePreview = debounce((content, filePath) => {
    // Only dispatch if not currently updating
    if (!isUpdating) {
        appStore.dispatch(updatePreview({ content, filePath }));
    }
}, 300);

/**
 * Dispatches a thunk to update the preview content.
 * @param {string} content - The markdown content to render.
 * @param {string} filePath - The path of the file being rendered.
 */
export function updatePreviewContent(content, filePath) {
    // Use debounced version to prevent rapid, repeated updates
    debouncedUpdatePreview(content, filePath);
}

// Export additional components for advanced use if necessary
export { renderMarkdown, postProcessRender };
export { registerPlugin } from './plugins/index.js';

// Re-export thunks from previewSlice for modular access
export { initializePreviewSystem } from '/client/store/slices/previewSlice.js';

/**
 * Initialize the preview system via Redux
 * @param {Object} config - Configuration options
 * @returns {boolean} Success status
 */
export function initPreviewSystem(config = {}) {
    try {
        return appStore.dispatch(initializePreviewSystemThunk(config));
    } catch (error) {
        log.error('PREVIEW', 'INIT_SYSTEM_FAILED', `Failed to initialize preview system: ${error.message}`, error);
        return false;
    }
} 