/**
 * EditorPanel.js - A feature-rich editor panel component for DevPages
 * REFACTORED to use the new PanelInterface.
 */

import { appStore } from '/client/appState.js';
import { BasePanel } from '/client/panels/BasePanel.js';
import { uploadImage } from '/client/image/imageManager.js';
import { fileActions } from '/client/store/reducers/fileReducer.js';
import { updatePreviewContent } from '/client/store/slices/previewSlice.js';

export class EditorPanel extends BasePanel {
    constructor(options = {}) {
        super(options);
        this.textarea = null;
        this.stateUnsubscribe = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'editor-panel';
        
        const authState = appStore.getState()?.auth || {};
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
            const contentElement = this.renderContent(isAuthenticated);
            this.element.innerHTML = '';
            this.element.appendChild(contentElement);
            this.textarea = this.element.querySelector('.editor-textarea');
            if (this.textarea) {
                this.setupEditorFeatures();
            }
        }

        // Update content
        if (this.textarea && file.currentFile) {
            this.setValue(file.currentFile.content);
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
        // Dispatch the new action to update the file content in the main file state
        appStore.dispatch(fileActions.updateFileContent(content));
        
        // Also update the preview so it remains in sync
        appStore.dispatch(updatePreviewContent({ content: content }));
    }

    setValue(content) {
        if (this.textarea) {
            this.textarea.value = content || '';
            // The crucial diagnostic log
            console.log('%c[EditorPanel] Textarea value updated. Inspect the element below:', 'color: #28a745; font-weight: bold;', this.textarea);
        } else {
            console.error('[EditorPanel] setValue called, but this.textarea is null!');
        }
    }
}
