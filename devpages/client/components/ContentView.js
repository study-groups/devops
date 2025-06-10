/**
 * ContentView.js
 * 
 * This component manages the main content area, which includes the containers
 * for the Editor and Preview panels. It ensures that the panel containers
 * are in the DOM before notifying the rest of the application.
 */
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';

class ContentViewComponent {
    constructor(targetElementId) {
        this.targetElement = document.getElementById(targetElementId);
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
        const cssPath = '/client/components/styles/ContentView.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
            logMessage('ContentView CSS loaded.', 'info', 'CONTENT_VIEW');
        }
    }

    render() {
        const { editorVisible, previewVisible } = this.state;
        let layoutClass = 'mode-split'; // Default
        if (editorVisible && !previewVisible) layoutClass = 'mode-editor';
        if (!editorVisible && previewVisible) layoutClass = 'mode-preview';
        
        // This component should ONLY create the containers for the panels to be mounted into.
        // The panels themselves are responsible for their own inner HTML.
        this.targetElement.innerHTML = `
            <div id="content-editor-panel" class="content-panel">
                <!-- EditorPanel will be mounted here by PanelUIManager -->
            </div>
            <div id="content-preview-panel" class="content-panel">
                <!-- PreviewPanel will be mounted here by PanelUIManager -->
            </div>
        `;
        
        this.targetElement.className = `content-view-component ${layoutClass}`;
        this.updateLayout(appStore.getState().panels);
    }

    updateLayout(panelsState) {
        const editorPanel = this.targetElement.querySelector('#content-editor-panel');
        const previewPanel = this.targetElement.querySelector('#content-preview-panel');

        const editorState = panelsState['editor-panel'];
        const previewState = panelsState['preview-panel'];

        if (!editorPanel || !previewPanel || !editorState || !previewState) {
            return;
        }
        
        editorPanel.style.display = editorState.visible ? 'flex' : 'none';
        previewPanel.style.display = previewState.visible ? 'flex' : 'none';

        let layoutClass = '';
        if (editorState.visible && previewState.visible) {
            layoutClass = 'mode-split';
        } else if (editorState.visible) {
            layoutClass = 'mode-editor';
        } else if (previewState.visible) {
            layoutClass = 'mode-preview';
        }
        
        this.targetElement.className = `content-view-component ${layoutClass}`;
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.targetElement.innerHTML = '';
        logMessage('[ContentView] Destroyed.', 'info', 'CONTENT_VIEW');
    }
}

export function createContentViewComponent(targetElementId) {
    return new ContentViewComponent(targetElementId);
} 