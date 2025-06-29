import { UIManager } from '/client/ui/UIManager.js';
import { eventBus } from '/client/eventBus.js';

// --- Module-level state ---
let previewInstance = null;

// --- Private Functions ---

/**
 * Initializes the Preview component.
 */
function init() {
    if (previewInstance) return;

    const previewContainer = document.getElementById('preview-container');
    if (!previewContainer) {
        console.error('[Preview] Container #preview-container not found.');
        return;
    }
    previewInstance = new Preview(previewContainer);
    console.log('[Preview] Component Initialized.');
}

/**
 * Refreshes the preview by re-rendering its content.
 */
function refresh() {
    if (!previewInstance) {
        init();
        return;
    }
    previewInstance.render();
    console.log('[Preview] Component Refreshed.');
}

/**
 * Destroys the preview instance and cleans up.
 */
function destroy() {
    if (previewInstance) {
        previewInstance.destroy();
        previewInstance = null;
    }
    console.log('[Preview] Component Destroyed.');
}


class Preview {
    constructor(container) {
        this.container = container;
        this.content = '## Preview Pane\n\nThis area will update as you type in the editor.';
        
        // Listen for editor changes
        eventBus.on('editor:contentChanged', (data) => {
            this.updateContent(data.content);
        });
        
        this.render();
        console.log('[Preview] Preview component created.');
    }

    updateContent(newContent) {
        this.content = newContent;
        this.render();
    }

    render() {
        // In a real implementation, this would parse markdown.
        // For now, we just put the raw content.
        this.container.innerHTML = `<div class="preview-content">${this.content}</div>`;
    }

    destroy() {
        this.container.innerHTML = '';
        // In a real app, you'd also use eventBus.off() to remove the listener.
        console.log('[Preview] Preview instance destroyed.');
    }
}

// --- Component Definition ---

const PreviewComponent = {
    name: 'Preview',
    init,
    refresh,
    destroy
};

// --- Registration ---
UIManager.register(PreviewComponent); 