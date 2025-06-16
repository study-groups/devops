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

// Preview state management to prevent error flashing
const previewState = {
    isRendering: false,
    lastContent: '',
    lastRenderTime: 0,
    renderQueue: [],
    debounceTimer: null
};

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

    // Debounce rapid updates to prevent flashing
    if (previewState.debounceTimer) {
        clearTimeout(previewState.debounceTimer);
    }

    // Skip if content hasn't changed and we're not forcing a refresh
    if (content === previewState.lastContent && !previewContainer.dataset.forceRefresh) {
        logPreview('Content unchanged, skipping update');
        return;
    }

    // Clear force refresh flag if it was set
    if (previewContainer.dataset.forceRefresh) {
        delete previewContainer.dataset.forceRefresh;
        logPreview('Force refresh requested, proceeding with update');
    }

    previewState.debounceTimer = setTimeout(async () => {
        await performPreviewUpdate(content, previewContainer);
    }, 150); // Small debounce to prevent rapid updates
}

/**
 * Performs the actual preview update with improved error handling
 */
async function performPreviewUpdate(content, previewContainer) {
    if (previewState.isRendering) {
        logPreview('Already rendering, queuing update');
        previewState.renderQueue.push({ content, previewContainer });
        return;
    }

    previewState.isRendering = true;
    previewState.lastContent = content;
    previewState.lastRenderTime = Date.now();

    try {
        logPreview(`Refreshing preview (content length: ${content.length})`);
        
        const appState = appStore.getState();
        const currentPath = appState.file?.currentPathname || '';

        // Show loading state with smooth transition
        showLoadingState(previewContainer);

        const renderResult = await updatePreviewInternal(content, currentPath);

        if (!renderResult || typeof renderResult.html !== 'string') {
            logPreview('Preview update returned invalid result.', 'error');
            showErrorState(previewContainer, 'Failed to render preview');
            return;
        }

        const { html } = renderResult;
        
        // Update content with fade transition
        await updateContentWithTransition(previewContainer, html);
        
        logPreview('Preview container HTML updated.');

        await postProcessRender(previewContainer);
        logPreview('Post-processing complete.');

        // Show success state
        showSuccessState(previewContainer);

    } catch (error) {
        logPreview(`Preview refresh failed: ${error.message}`, 'error');
        console.error('Preview refresh error:', error);
        showErrorState(previewContainer, error.message);
    } finally {
        previewState.isRendering = false;
        
        // Process any queued updates
        if (previewState.renderQueue.length > 0) {
            const nextUpdate = previewState.renderQueue.shift();
            setTimeout(() => performPreviewUpdate(nextUpdate.content, nextUpdate.previewContainer), 100);
        }
    }
}

/**
 * Shows loading state with improved UX
 */
function showLoadingState(container) {
    // Don't show loading for very quick updates
    const timeSinceLastRender = Date.now() - previewState.lastRenderTime;
    if (timeSinceLastRender < 500) {
        return;
    }

    container.classList.add('preview-updating');
    
    // Only show loading indicator if container is empty or has error
    if (!container.innerHTML || container.querySelector('.preview-error')) {
        container.innerHTML = '<div class="preview-loading"></div>';
    }
}

/**
 * Shows error state with better styling and no flash
 */
function showErrorState(container, message) {
    container.classList.remove('preview-updating', 'preview-success');
    container.classList.add('preview-error-state');
    
    const errorHtml = `
        <div class="preview-error preview-error--smooth">
            <div class="preview-error__icon">⚠️</div>
            <div class="preview-error__content">
                <h4>Preview Error</h4>
                <p>${message}</p>
                <button class="preview-error__retry" onclick="this.closest('.preview-container').dataset.forceRefresh = 'true'; window.dispatchEvent(new CustomEvent('preview:retry'))">
                    Retry
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = errorHtml;
}

/**
 * Shows success state and removes error classes
 */
function showSuccessState(container) {
    container.classList.remove('preview-updating', 'preview-error-state');
    container.classList.add('preview-success');
    
    // Remove success class after animation
    setTimeout(() => {
        container.classList.remove('preview-success');
    }, 300);
}

/**
 * Updates content with smooth transition to prevent flashing
 */
async function updateContentWithTransition(container, html) {
    return new Promise((resolve) => {
        // Add transition class
        container.classList.add('preview-transitioning');
        
        // Small delay to ensure transition starts
        setTimeout(() => {
            container.innerHTML = html;
            container.classList.remove('preview-transitioning', 'preview-updating');
            
            // Allow transition to complete
            setTimeout(resolve, 100);
        }, 50);
    });
}

// Keep this export for now for any legacy dependencies, but it should be phased out.
export { postProcessRender }; 