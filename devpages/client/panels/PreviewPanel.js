/**
 * @file PreviewPanel.js
 * @description A clean, simple preview panel.
 * REFACTORED to use the new PanelInterface.
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
import { marked } from '/client/vendor/scripts/marked.esm.js';

export class PreviewPanel extends BasePanel {
    constructor(options = {}) {
        super(options);
        this.stateUnsubscribe = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'preview-panel';
        
        // Check if user is authenticated
        const authState = appStore.getState()?.auth || {};
        const isAuthenticated = authState.authChecked && authState.isAuthenticated;
        
        if (!isAuthenticated) {
            this.element.innerHTML = `<div class="preview-auth-required" style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #6c757d;
                font-size: 14px;
                text-align: center;
            ">Login to preview content</div>`;
            return this.element;
        }
        
        this.element.innerHTML = `<div class="preview-content"></div>`;
        return this.element;
    }

    onMount(container) {
        super.onMount(container);

        this.stateUnsubscribe = appStore.subscribe(this.onStateChange.bind(this));
        this.onStateChange(); // Set initial state
    }

    onUnmount() {
        super.onUnmount();
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
        }
    }

    onStateChange() {
        const { auth, file } = appStore.getState();
        const isAuthenticated = auth.authChecked && auth.isAuthenticated;

        // Render auth state
        if (this.element.dataset.isAuthenticated !== String(isAuthenticated)) {
            this.element.dataset.isAuthenticated = String(isAuthenticated);
            const newElement = this.render();
            if (this.element && this.element.parentNode) {
                this.element.parentNode.replaceChild(newElement, this.element);
                this.element = newElement;
            }
        }

        // Update content
        if (isAuthenticated && file.currentFile) {
            this.updateContent(file.currentFile.content);
        }
    }

    updateContent(markdownContent) {
        if (this.element) {
            const contentDiv = this.element.querySelector('.preview-content');
            if (contentDiv) {
                contentDiv.innerHTML = marked(markdownContent || '');
            }
        }
    }
}
