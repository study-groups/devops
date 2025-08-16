/**
 * @file PreviewPanel.js
 * @description A clean, simple preview panel.
 * ✅ MODERNIZED: Enhanced Redux patterns with optimized selectors
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
import { renderMarkdown } from '/client/preview/renderer.js';
import { getAuthState, getEditorState } from '/client/store/enhancedSelectors.js';

export class PreviewPanel extends BasePanel {
    constructor(options = {}) {
        super(options);
        this.stateUnsubscribe = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'preview-panel';
        
        // ✅ MODERNIZED: Use enhanced selector instead of direct state access
        const authState = getAuthState(appStore.getState());
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

        // ✅ MODERNIZED: Subscribe with memoized state comparison
        let lastAuthState = null;
        let lastEditorState = null;
        this.stateUnsubscribe = appStore.subscribe(() => {
            const authState = getAuthState(appStore.getState());
            const editorState = getEditorState(appStore.getState());
            
            if (authState === lastAuthState && editorState === lastEditorState) return;
            lastAuthState = authState;
            lastEditorState = editorState;
            
            this.onStateChange();
        });
        this.syncContent(); // Set initial state
    }

    onUnmount() {
        super.onUnmount();
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
        }
    }

    onStateChange() {
        // ✅ MODERNIZED: Use enhanced selectors instead of direct state access
        const authState = getAuthState(appStore.getState());
        const editorState = getEditorState(appStore.getState());
        const isAuthenticated = authState.authChecked && authState.isAuthenticated;

        // Update auth state attribute
        if (this.element.dataset.isAuthenticated !== String(isAuthenticated)) {
            this.element.dataset.isAuthenticated = String(isAuthenticated);
            
            // Update content based on auth state instead of replacing element
            if (!isAuthenticated) {
                // Show login message
                this.element.innerHTML = `<div class="preview-auth-required" style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #6c757d;
                    font-size: 14px;
                    text-align: center;
                ">Login to preview content</div>`;
            } else {
                // Show content div
                this.element.innerHTML = `<div class="preview-content"></div>`;
            }
        }

        // Update content using markdown-it plugin system
        if (isAuthenticated && this.element) {
            const contentDiv = this.element.querySelector('.preview-content');
            if (contentDiv && editorState.content) {
                this.renderContent(editorState.content, contentDiv);
            }
        }
    }

    syncContent() {
        // ✅ MODERNIZED: Use enhanced selector instead of direct state access
        const editorState = getEditorState(appStore.getState());
        if (this.element && editorState.content) {
            const contentDiv = this.element.querySelector('.preview-content');
            if (contentDiv) {
                this.renderContent(editorState.content, contentDiv);
            }
        }
    }

    async renderContent(markdownContent, contentDiv) {
        try {
            // ✅ MODERNIZED: Use enhanced selector instead of direct state access
            const state = appStore.getState();
            const currentFilePath = state.path?.currentPathname || 'preview.md';
            
            // Use the proper markdown-it rendering system with plugins
            const result = await renderMarkdown(markdownContent, currentFilePath);
            
            // The renderMarkdown function returns an object with html property
            if (result && result.html) {
                contentDiv.innerHTML = result.html;
                console.log('[PreviewPanel] Content rendered with markdown-it plugins');
            } else {
                throw new Error('No HTML content in render result');
            }
        } catch (error) {
            console.error('[PreviewPanel] Failed to render markdown:', error);
            // Fallback to simple text display
            contentDiv.innerHTML = `<pre>${markdownContent}</pre>`;
        }
    }
}

export function createPreviewPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[createPreviewPanel] Container with id '${containerId}' not found.`);
        return null;
    }

    const panel = new PreviewPanel({ id: 'preview' });
    const panelElement = panel.render();
    container.appendChild(panelElement);
    panel.onMount(container);

    return panel;
}
