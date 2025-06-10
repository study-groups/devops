/**
 * preview.js
 * Provides the core Markdown preview rendering functionality.
 */
import { appStore } from '/client/appState.js';
import { updatePreview as updatePreviewInternal, initPreview } from '/client/preview/index.js';
import { postProcessRender } from '/client/preview/renderers/MarkdownRenderer.js';

function logPreview(message, level = 'debug', type = 'PREVIEW') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

let isInitialized = false;

/**
 * Renders the given Markdown content into HTML and prepares it for display.
 * @param {string} content - The Markdown content to render.
 * @param {HTMLElement} previewContainer - The DOM element to render into.
 * @returns {Promise<void>}
 */
export async function updatePreview(content, previewContainer) {
    if (!isInitialized) {
        await initPreview({ 
            container: previewContainer,
            plugins: ['highlight', 'mermaid', 'katex', 'audio-md', 'github-md'] 
        });
        isInitialized = true;
    }

    if (!previewContainer) {
        logPreview('Preview container not provided to updatePreview', 'error');
        return;
    }

    try {
        logPreview(`Refreshing preview (content length: ${content.length})`);
        
        const appState = appStore.getState();
        const currentPath = appState.file?.currentPathname || '';

        // Show loading state
        previewContainer.innerHTML = '<div class="preview-loading">Rendering...</div>';

        const renderResult = await updatePreviewInternal(content, currentPath);

        if (!renderResult || typeof renderResult.html !== 'string') {
            logPreview('Preview update returned invalid result.', 'error');
            previewContainer.innerHTML = '<div class="preview-error">Failed to render preview</div>';
            return;
        }

        const { html } = renderResult;
        previewContainer.innerHTML = html;
        logPreview('Preview container HTML updated.');

        await postProcessRender(previewContainer);
        logPreview('Post-processing complete.');

    } catch (error) {
        logPreview(`Preview refresh failed: ${error.message}`, 'error');
        console.error('Preview refresh error:', error);
        if (previewContainer) {
            previewContainer.innerHTML = `<div class="preview-error">Error: ${error.message}</div>`;
        }
    }
}

// Keep this export for now for any legacy dependencies, but it should be phased out.
export { postProcessRender }; 