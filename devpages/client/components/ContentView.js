/**
 * ContentView.js
 * 
 * Simplified component that creates minimal DOM structure for editor and preview.
 * Removes unnecessary nested divs for better performance and cleaner markup.
 */
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';

class ContentViewComponent {
    constructor(targetElementOrId) {
        // Accept either an element or an element ID
        if (typeof targetElementOrId === 'string') {
            this.targetElement = document.getElementById(targetElementOrId);
        } else if (targetElementOrId instanceof HTMLElement) {
            this.targetElement = targetElementOrId;
        } else {
            this.targetElement = null;
        }
        this.state = {
            editorVisible: true,
            previewVisible: true,
        };
        this.unsubscribe = null;
    }

    mount() {
        if (!this.targetElement) {
            logMessage('ContentView target element not found.', 'error', 'CONTENT_VIEW');
            return false;
        }

        logMessage('[ContentView] Mounting...', 'info', 'CONTENT_VIEW');
        this.loadCSS();
        this.render();

        // Subscribe to panel visibility changes
        this.unsubscribe = appStore.subscribe((newState, prevState) => {
            const newPanels = newState.panels;
            const oldPanels = prevState.panels;

            if (newPanels['editor-panel']?.visible !== oldPanels['editor-panel']?.visible ||
                newPanels['preview-panel']?.visible !== oldPanels['preview-panel']?.visible) {
                this.updateLayout(newPanels);
            }
        });
        
        // Emit ready event after a brief delay to ensure DOM is fully updated.
        setTimeout(() => {
            if (window.eventBus) {
                logMessage('[ContentView] Emitting content-view:ready event.', 'info', 'CONTENT_VIEW');
                window.eventBus.emit('content-view:ready');
            }
        }, 0);

        logMessage('[ContentView] Mounted and subscribed to appState changes.', 'info', 'CONTENT_VIEW');
        return true;
    }

    loadCSS() {
        if (!document.querySelector('link[href*="ContentView.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/client/components/styles/ContentView.css';
            document.head.appendChild(link);
        }
    }

    render() {
        // Ultra-simplified structure - just clear and prepare the preview container
        this.targetElement.innerHTML = `<!-- Preview content rendered here -->`;
        // Note: targetElement is already .preview-container, no need to change ID
    }

    updateLayout(panelsState) {
        // No layout logic needed - the target element IS the preview container
        this.targetElement.style.display = 'block';
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}

export function createContentViewComponent(targetElementId) {
    return new ContentViewComponent(targetElementId);
} 