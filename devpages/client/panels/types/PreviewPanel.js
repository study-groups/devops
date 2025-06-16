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

        // This panel just provides the preview container
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
                <div id="preview-container" class="preview-container markdown-content" data-markdown-content>
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

        // Initialize the preview system now that the container exists
        await this.initializePreviewSystem();

        this.log('PreviewPanel fully mounted and configured.', 'info');
    }

    /**
     * Initialize the preview system
     */
    async initializePreviewSystem() {
        try {
            // Import and initialize the preview manager
            const { initializePreviewManager } = await import('/client/previewManager.js');
            await initializePreviewManager();
            this.log('Preview system initialized successfully', 'info');
        } catch (error) {
            this.log(`Failed to initialize preview system: ${error.message}`, 'error');
        }
    }

    // Preview system is initialized and managed by previewManager

    /**
     * Panel cleanup
     */
    cleanup() {
        this.log('PreviewPanel cleanup', 'debug');
        super.cleanup();
    }
} 