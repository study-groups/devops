/**
 * PreviewPanel.js - Preview panel component for DevPages
 */

import { BasePanel } from '/client/panels/core/BasePanel.js';
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { updatePreview as updatePreviewer } from '/client/preview.js';

export class PreviewPanel extends BasePanel {
    constructor(options = {}) {
        super(options.id || 'preview-panel', options);

        this.previewManager = null;
        this.initialized = false;
        this.lastContent = '';
        this.previewContainer = null;
    }

    /**
     * Initialize the preview panel
     */
    async initialize() {
        if (this.initialized) return true;

        try {
            // Import preview functionality
            const previewModule = await import('/client/preview.js');
            
            this.initialized = true;
            this.log('PreviewPanel initialized successfully', 'info');
            return true;
        } catch (error) {
            this.log(`PreviewPanel initialization failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Dynamically load the panel's CSS
     */
    loadCSS() {
        const cssPath = '/client/panels/styles/PreviewPanel.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
            this.log('PreviewPanel CSS loaded.', 'info');
        }
    }

    /**
     * Render panel content
     */
    renderContent() {
        return `
            <div class="preview-panel-content">
                <div id="preview-container" class="preview-container">
                    <div class="preview-loading">
                        <p>Preview will appear here...</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup after DOM creation
     */
    async onMount() {
        await super.onMount();
        this.loadCSS();
        this.log('[PANEL_DEBUG] PreviewPanel onMount hook executed.', 'debug');

        // The panel is now responsible for its own preview setup.
        // The global initializePreview is no longer needed.

        // Setup preview features (like the refresh button)
        this.setupPreviewFeatures();
        
        // Subscribe to editor content changes to auto-update
        this.subscribeToEditorEvents();
        
        // Perform an initial update.
        this.refreshPreview();

        this.log('PreviewPanel fully mounted and configured.', 'info');
    }

    /**
     * Setup preview features
     */
    setupPreviewFeatures() {
        // No features to set up now that the refresh button is gone.
        this.log('Preview features setup complete', 'debug');
    }

    /**
     * Subscribe to editor content changes
     */
    subscribeToEditorEvents() {
        if (window.eventBus) {
            window.eventBus.on('editor:contentChanged', (data) => {
                const content = data?.content || '';
                this.schedulePreviewUpdate(content);
            });
            
            this.log('Subscribed to editor events', 'debug');
        }
    }

    /**
     * Schedule a preview update with debouncing
     */
    schedulePreviewUpdate(content) {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        this.updateTimer = setTimeout(() => {
            this.updatePreview(content);
        }, 300);
    }

    /**
     * Update preview with content
     */
    async updatePreview(content = null) {
        try {
            // Get content from editor if not provided
            if (content === null) {
                content = this.getEditorContent();
            }

            // Skip update if content hasn't changed
            if (content === this.lastContent) {
                return;
            }

            this.lastContent = content;
            const previewContainer = this.contentElement.querySelector('.preview-container');
            if (!previewContainer) {
                this.log('Preview container not found', 'error');
                return;
            }

            // The external updatePreviewer function now handles everything,
            // including showing a "Rendering..." message.
            await updatePreviewer(content, previewContainer);
            this.log(`Preview update completed for content length: ${content.length}`, 'debug');

        } catch (error) {
            this.log(`Preview update error: ${error.message}`, 'error');
            const previewContainer = this.contentElement.querySelector('.preview-container');
            if (previewContainer) {
                previewContainer.innerHTML = `<div class="preview-error">Error: ${error.message}</div>`;
            }
        }
    }

    /**
     * Post-process the rendered preview content
     */
    async postProcessPreview(container) {
        try {
            // Import post-processing functionality
            const { postProcessRender } = await import('/client/preview.js');
            await postProcessRender(container);
        } catch (error) {
            this.log(`Post-processing error: ${error.message}`, 'error');
        }
    }

    /**
     * Get content from the editor panel
     */
    getEditorContent() {
        // Try to get content from a visible editor panel
        const editorPanel = window.panelManager?.getPanel('editor-panel');
        if (editorPanel && editorPanel.state.visible) {
            return editorPanel.getContent();
        }

        // Fallback to DOM query if editor panel isn't available or visible
        const editorTextarea = document.querySelector('#editor-container textarea, .editor-textarea');
        return editorTextarea ? editorTextarea.value : '';
    }

    /**
     * Refresh preview manually
     */
    async refreshPreview() {
        this.log('Manual preview refresh requested', 'debug');
        this.lastContent = ''; // Force update
        await this.updatePreview();
    }

    /**
     * Clear preview content
     */
    clearPreview() {
        const previewContainer = this.contentElement?.querySelector('.preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = '<div class="preview-empty">No content to preview</div>';
        }
    }

    /**
     * Panel cleanup
     */
    cleanup() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        this.log('PreviewPanel cleanup', 'debug');
        super.cleanup();
    }

    /**
     * Panel lifecycle hooks
     */
    onShow() {
        super.onShow();
        this.log('PreviewPanel shown', 'debug');
        this.refreshPreview(); // Refresh content when shown
    }

    onHide() {
        super.onHide();
        this.log('PreviewPanel hidden', 'debug');
    }
} 