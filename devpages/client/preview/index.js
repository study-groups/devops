/**
 * @file client/preview/index.js
 * @description State-driven entry point for the preview system.
 * This file exports functions to initialize and update the preview,
 * which dispatch Redux thunks to manage the application state.
 */

import { appStore } from '/client/appState.js';
import { 
    initializePreviewSystem, 
    updatePreviewContent as updatePreviewContentAction 
} from '/client/store/slices/previewSlice.js';
import { createAsyncThunk } from '/client/vendor/scripts/redux-toolkit.mjs';
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
            
            dispatch(updatePreviewContentAction({ content: html, frontMatter }));
            
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
 * Initializes the preview system by dispatching the initialization thunk.
 * @param {object} options - Configuration options (currently unused, handled by settings).
 * @returns {Promise<void>}
 */
export async function initPreview(options = {}) {
    log.info('PREVIEW', 'INIT_START', 'Dispatching preview system initialization...');
    try {
        await appStore.dispatch(initializePreviewSystem());
    } catch (error) {
        log.error('PREVIEW', 'INIT_ERROR', `Error during preview initialization dispatch: ${error.message}`, error);
    }
}

/**
 * Dispatches a thunk to update the preview content.
 * @param {string} content - The markdown content to render.
 * @param {string} filePath - The path of the file being rendered.
 */
export function updatePreviewContent(content, filePath) {
    appStore.dispatch(updatePreview({ content, filePath }));
}

/**
 * Sets the theme for the preview.
 * This is now handled by the settings slice, but we can provide a helper.
 * @param {string} theme - 'light' or 'dark'
 */
export function setPreviewTheme(theme) {
    // This should dispatch an action to the settings slice
    // Example: appStore.dispatch(updatePreviewSettings({ theme }));
    log.warn('PREVIEW', 'DEPRECATED_THEME_SETTER', `Setting theme to ${theme} should be handled by settingsSlice`);
}

// Export additional components for advanced use if necessary
export { renderMarkdown, postProcessRender };
export { registerPlugin } from './plugins/index.js';

// Re-export thunks from previewSlice for modular access
export { initializePreviewSystem } from '/client/store/slices/previewSlice.js'; 