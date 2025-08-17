/**
 * EditorPanel.js - A feature-rich editor panel component for DevPages
 * REFACTORED to use the new PanelInterface.
 */

import { appStore } from '/client/appState.js';
import { BasePanel } from '/client/panels/BasePanel.js';
import { uploadImage } from '/client/image/imageManager.js';
import { setContent, setModified } from '/client/store/slices/editorSlice.js';
import { renderMarkdown } from '/client/store/slices/previewSlice.js';
import { debounce } from '/client/utils/debounce.js';
import { getEditorState, getAuthState } from '/client/store/enhancedSelectors.js';

export class EditorPanel extends BasePanel {
    constructor(options = {}) {
        super(options);
        this.textarea = null;
        this.stateUnsubscribe = null;
        this.debouncedRender = debounce(this.renderPreview.bind(this), 300);
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'editor-panel';
        
        // ✅ MODERNIZED: Use enhanced selectors instead of direct state access
        const authState = getAuthState(appStore.getState());
        const isAuthenticated = authState.authChecked && authState.isAuthenticated;
        
        const contentElement = this.renderContent(isAuthenticated);
        this.element.appendChild(contentElement);
        
        return this.element;
    }

    renderContent(isAuthenticated) {
        const contentWrapper = document.createElement('div');
        contentWrapper.style.height = '100%';
        contentWrapper.style.display = 'flex';
        contentWrapper.style.flexDirection = 'column';

        if (!isAuthenticated) {
            contentWrapper.innerHTML = `<div class="editor-auth-required" style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #6c757d;
                font-size: 14px;
                text-align: center;
            ">Login required to edit files</div>`;
        } else {
            contentWrapper.innerHTML = `<textarea 
                placeholder="Write Markdown here..." 
                class="editor-textarea"
                spellcheck="false"
            ></textarea>`;
        }
        return contentWrapper;
    }

    onMount(container) {
        super.onMount(container);
        this.loadCSS();

        this.textarea = this.element.querySelector('.editor-textarea');
        if (this.textarea) {
            this.setupEditorFeatures();
        }

        this.stateUnsubscribe = appStore.subscribe(this.onStateChange.bind(this));
        this.syncContent(); // Set initial content
    }

    onUnmount() {
        super.onUnmount();
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
        }
    }

    onStateChange() {
        // ✅ MODERNIZED: Use enhanced selectors for better performance
        const authState = getAuthState(appStore.getState());
        const editorState = getEditorState(appStore.getState());
        const isAuthenticated = authState.authChecked && authState.isAuthenticated;

        // Render auth state
        if (this.element.dataset.isAuthenticated !== String(isAuthenticated)) {
            this.element.dataset.isAuthenticated = String(isAuthenticated);
            const contentElement = this.renderContent(isAuthenticated);
            this.element.innerHTML = '';
            this.element.appendChild(contentElement);
            this.textarea = this.element.querySelector('.editor-textarea');
            if (this.textarea) {
                this.setupEditorFeatures();
            }
        }

        // Update content using enhanced editor state
        if (this.textarea && this.textarea.value !== editorState.content) {
            this.textarea.value = editorState.content;
        }
    }

    syncContent() {
        // ✅ MODERNIZED: Use enhanced selector for editor state
        const editorState = getEditorState(appStore.getState());
        if (this.textarea && this.textarea.value !== editorState.content) {
            this.textarea.value = editorState.content;
        }
    }

    loadCSS() {
        const cssPath = '/client/panels/styles/EditorPanel.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
        }
    }

    setupEditorFeatures() {
        // Only setup features if textarea exists (user is authenticated)
        if (!this.textarea) {
            return;
        }
        
        this.textarea.addEventListener('input', this.handleInput.bind(this));
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '\t');
            }
        });
        this.textarea.addEventListener('paste', this.handlePaste.bind(this));
    }

    renderPreview(markdown) {
        appStore.dispatch(renderMarkdown(markdown));
    }

    async handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob) {
                    await this.uploadPastedImage(blob);
                }
                return;
            }
        }
    }

    async uploadPastedImage(blob) {
        this.textarea.style.cursor = 'wait';
        try {
            const imageUrl = await uploadImage(blob);
            if (imageUrl) {
                const markdownToInsert = `\n![](${imageUrl})\n`;
                document.execCommand('insertText', false, markdownToInsert);
                this.handleInput();
            }
        } catch (error) {
            console.error('Image upload failed:', error);
            alert(`Image upload failed: ${error.message}`);
        } finally {
            this.textarea.style.cursor = 'text';
        }
    }

    handleInput() {
        const content = this.textarea.value;
        appStore.dispatch(setContent(content));
        appStore.dispatch(setModified(true));
        this.debouncedRender(content);
    }
}

export function createEditorPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[createEditorPanel] Container with id '${containerId}' not found.`);
        return null;
    }

    const panel = new EditorPanel({ id: 'editor' });
    const panelElement = panel.render();
    container.appendChild(panelElement);
    panel.onMount(container);

    return panel;
}
