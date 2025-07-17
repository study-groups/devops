/**
 * @file PreviewPanel.js
 * @description A new, self-contained panel for rendering Markdown previews.
 * This version is driven by the Redux store and the previewSlice.
 */

import { logMessage } from '/client/log/index.js';
import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
import { initializePreviewSystem, updatePreview } from '/client/preview/index.js';

export class PreviewPanel extends BasePanel {
    constructor(options = {}) {
        super({
            id: 'preview-panel',
            title: 'Preview',
            ...options,
        });

        this.previewContainer = null;
        this.unsubscribe = null;
    }

    renderContent() {
        const container = document.createElement('div');
        container.className = 'preview-content';
        this.previewContainer = container;
        return container;
    }

    onMount() {
        super.onMount();
        appStore.dispatch(initializePreviewSystem());
        this.subscribeToStateChanges();
        this.updatePreviewFromState();
    }

    subscribeToStateChanges() {
        if (this.unsubscribe) this.unsubscribe();
        
        let lastPreviewState = appStore.getState().preview;

        this.unsubscribe = appStore.subscribe(() => {
            const currentPreviewState = appStore.getState().preview;
            if (currentPreviewState !== lastPreviewState) {
                this.updatePreviewFromState(currentPreviewState);
                lastPreviewState = currentPreviewState;
            }
        });
    }

    updatePreviewFromState(state) {
        if (!this.previewContainer) return;

        const previewState = state || appStore.getState().preview;
        
        // Safety check - if previewState is undefined, use default values
        if (!previewState) {
            this.previewContainer.innerHTML = '<div class="preview-placeholder">Initializing preview...</div>';
            return;
        }
        
        const { status, currentContent, frontMatter } = previewState;

        if (status === 'loading') {
            this.previewContainer.innerHTML = '<div class="preview-placeholder">Loading preview...</div>';
            return;
        }

        if (status === 'error') {
            this.previewContainer.innerHTML = '<div class="preview-error">Error initializing preview system.</div>';
            return;
        }

        if (!currentContent) {
            this.previewContainer.innerHTML = '<div class="preview-placeholder">No content to display.</div>';
            return;
        }

        this.previewContainer.innerHTML = currentContent;
        // Post-processing would be handled here based on frontMatter, etc.
        // For example, dynamically loading scripts or styles.
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        super.destroy();
    }
} 