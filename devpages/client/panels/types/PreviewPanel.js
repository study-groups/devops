/**
 * PreviewPanel.js - Preview panel component for DevPages
 */

import { BasePanel } from '/client/panels/core/BasePanel.js';
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { updatePreview } from '/client/preview/index.js';

export class PreviewPanel extends BasePanel {
    constructor(options = {}) {
        super(options.id || 'preview-panel', options);

        // This panel works with the existing preview
        this.previewContainer = null;
    }

    /**
     * Initialize the preview panel
     */
    async initialize() {
        if (this.initialized) return true;

        try {
            // Import preview functionality
            const previewModule = await import('/client/preview/index.js');
            
            this.initialized = true;
            this.log('PreviewPanel initialized successfully', 'info');
            return true;
        } catch (error) {
            this.log(`PreviewPanel initialization failed: ${error.message}`, 'error');
            return false;
        }
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

    /**
     * Mount the panel to its container
     */
    async mount(container) {
        if (!container) {
            this.log('No container provided for PreviewPanel mount', 'error');
            return false;
        }

        this.log(`Mounting PreviewPanel to container: ${container.id || container.className}`, 'debug');

        this.loadCSS();

        // The container IS the preview container - use it directly
        this.previewContainer = container;
        this.log('Using container directly as preview container', 'debug');

        // Set the container element for BasePanel
        this.containerElement = container;
        this.contentElement = this.previewContainer;

        // Initialize the preview system
        await this.initializePreviewSystem();

        // Subscribe to state changes
        this.subscribeToStateChanges();

        // Trigger initial update
        await this.updatePreview();

        this.log('PreviewPanel mounted successfully', 'info');
        return true;
    }

    /**
     * Dynamically load the panel's CSS.
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
     * Subscribe to app state changes for preview updates
     */
    subscribeToStateChanges() {
        // Subscribe to file content changes to update preview
        this.unsubscribe = appStore.subscribe((newState, prevState) => {
            const newFile = newState.file?.currentPathname;
            const oldFile = prevState.file?.currentPathname;
            const newContent = newState.file?.content;
            const oldContent = prevState.file?.content;

            // Update preview when file changes or content is updated
            if (newFile !== oldFile || newContent !== oldContent) {
                this.updatePreview();
            }
        });
    }

    /**
     * Update the preview content
     */
    async updatePreview() {
        if (!this.previewContainer) {
            this.log('No preview container available', 'warn');
            return;
        }

        try {
            const state = appStore.getState();
            const content = state.file?.content || '';
            const filePath = state.file?.currentPathname || '';
            
            // More detailed debugging
            this.log(`App state debug:`, 'debug');
            this.log(`- state.file exists: ${!!state.file}`, 'debug');
            this.log(`- filePath: "${filePath}"`, 'debug');
            this.log(`- content length: ${content.length}`, 'debug');
            this.log(`- content preview: "${content.substring(0, 100)}..."`, 'debug');
            this.log(`- state.file keys: ${state.file ? Object.keys(state.file).join(', ') : 'none'}`, 'debug');

            // If no content, show a placeholder
            if (!content && !filePath) {
                this.previewContainer.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: #666;">
                        <h3>No Content</h3>
                        <p>No file selected or content loaded.</p>
                        <p><small>Select a file to see its preview here.</small></p>
                    </div>
                `;
                return;
            }

            // If we have a file path but no content, try to load it
            if (filePath && !content) {
                this.previewContainer.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: #666;">
                        <h3>Loading Content</h3>
                        <p>File: ${filePath}</p>
                        <p><small>Content is being loaded...</small></p>
                    </div>
                `;
                try {
                    const { loadFile } = await import('/client/filesystem/fileManager.js');
                    await loadFile(filePath);
                    this.log(`File load triggered successfully for: ${filePath}`, 'info');
                } catch (error) {
                    this.log(`Failed to trigger file load for ${filePath}: ${error.message}`, 'error');
                    this.showError(`Failed to load file: ${filePath}`);
                }
                return;
            }

            // Use the global preview updater
            await updatePreview(content, filePath);

        } catch (error) {
            this.log(`Preview update failed: ${error.message}`, 'error');
            this.showError('Failed to update preview');
        }
    }

    showError(message) {
        if (this.previewContainer) {
            this.previewContainer.innerHTML = `
                <div class="preview-error">
                    <div class="preview-error__content">
                        <strong>Preview Error:</strong> ${message}
                    </div>
                </div>
            `;
        }
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        super.destroy();
    }
}