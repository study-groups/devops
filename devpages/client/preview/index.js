/**
 * @file client/preview/index.js
 * @description State-driven entry point for the preview system.
 * This file exports functions to initialize and update the preview,
 * which dispatch Redux thunks to manage the application state.
 */

import { appStore } from '/client/appState.js';
import { 
    renderMarkdown as renderMarkdownThunk,
    setHtmlContent
} from '/client/store/slices/previewSlice.js';
import { renderMarkdown, postProcessRender } from './renderer.js';

const log = window.APP.services.log.createLogger('Preview');

// --- Thunks ---

/**
 * Thunk for updating the preview with new content.
 * It renders the markdown and updates the preview slice.
 */
export const updatePreview = createAsyncThunk(
    'preview/updateContent',
    async ({ content, filePath }, { dispatch }) => {
        try {
            const { html, frontMatter, externalScriptUrls, inlineScriptContents } = await renderMarkdown(content, filePath);
            
            dispatch(setHtmlContent(html));
            
            // The UI component will be responsible for post-processing
            // This thunk just provides the necessary data.
            return { html, frontMatter, externalScriptUrls, inlineScriptContents };
        } catch (error) {
            log.error('PREVIEW', 'UPDATE_ERROR', `Failed to update preview: ${error.message}`, error);
            throw error;
        }
    }
);

// --- Public API ---

/**
 * Dispatches a thunk to update the preview content.
 * @param {string} content - The markdown content to render.
 * @param {string} filePath - The path of the file being rendered.
 */
export function updatePreviewContent(content, filePath) {
    appStore.dispatch(updatePreview({ content, filePath }));
}

// Export additional components for advanced use if necessary
export { renderMarkdown, postProcessRender };
export { registerPlugin } from './plugins/index.js';

// Re-export thunks from previewSlice for modular access
export { initializePreviewSystem } from '/client/store/slices/previewSlice.js'; 