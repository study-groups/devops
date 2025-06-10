/**
 * EditorPanel.js - Editor panel component for DevPages
 */

import { BasePanel } from '/client/panels/core/BasePanel.js';
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';

export class EditorPanel extends BasePanel {
    constructor(options = {}) {
        super(options.id || 'editor-panel', options);

        this.editor = null;
        this.initialized = false;
        this.textarea = null;
    }

    /**
     * Initialize the editor panel
     */
    async initialize() {
        if (this.initialized) return true;

        try {
            // Import editor functionality
            const editorModule = await import('/client/editor.js');
            
            this.initialized = true;
            this.log('EditorPanel initialized successfully', 'info');
            return true;
        } catch (error) {
            this.log(`EditorPanel initialization failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Dynamically load the panel's CSS
     */
    loadCSS() {
        const cssPath = '/client/panels/styles/EditorPanel.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
            this.log('EditorPanel CSS loaded.', 'info');
        }
    }

    /**
     * Render panel content
     */
    renderContent() {
        return `
            <div id="editor-container" class="editor-container">
                <textarea 
                    placeholder="Write Markdown here..." 
                    class="editor-textarea"
                    spellcheck="false"
                ></textarea>
            </div>
        `;
    }

    /**
     * Setup after DOM creation
     */
    async onMount() {
        await super.onMount();
        this.loadCSS();
        this.log('[PANEL_DEBUG] EditorPanel onMount hook executed.', 'debug');

        // The panel is now responsible for its own editor setup.

        // Get the textarea element within this panel's content
        const textarea = this.contentElement.querySelector('.editor-textarea');
        if (!textarea) {
            this.log('Editor textarea not found in panel', 'error');
            return;
        }

        // Setup editor functionality
        this.setupEditorFeatures(textarea);
        
        // Apply initial content from app state
        this.applyInitialContent(textarea);

        this.log('EditorPanel fully mounted and configured.', 'info');
    }

    /**
     * Setup editor features on the textarea
     */
    setupEditorFeatures(textarea) {
        // Debounced input handler
        let debounceTimer;
        textarea.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleContentChange(textarea.value);
            }, 250);
        });

        // Focus/blur events
        textarea.addEventListener('focus', () => {
            this.onEditorFocus();
        });

        textarea.addEventListener('blur', () => {
            this.onEditorBlur();
        });

        // Tab key handling for indentation
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                
                // Insert tab character
                textarea.value = textarea.value.substring(0, start) + '\t' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 1;
            }
        });

        this.log('Editor features setup complete', 'debug');
    }

    /**
     * Apply initial content from app state
     */
    applyInitialContent(textarea) {
        try {
            const appState = appStore.getState();
            const fileContent = appState.file?.content || '';
            textarea.value = fileContent;
            this.log(`Applied initial content (${fileContent.length} chars)`, 'debug');
        } catch (error) {
            this.log(`Error applying initial content: ${error.message}`, 'error');
        }
    }

    /**
     * Handle content changes
     */
    handleContentChange(content) {
        // Emit content change event
        if (window.eventBus) {
            window.eventBus.emit('editor:contentChanged', { content });
        }

        // Update app state if needed
        // This would typically be handled by a file manager or similar
        this.log(`Content changed (${content.length} chars)`, 'debug');
    }

    /**
     * Editor focus handler
     */
    onEditorFocus() {
        this.log('Editor focused', 'debug');
        if (window.eventBus) {
            window.eventBus.emit('editor:focus');
        }
    }

    /**
     * Editor blur handler
     */
    onEditorBlur() {
        this.log('Editor blurred', 'debug');
        if (window.eventBus) {
            window.eventBus.emit('editor:blur');
        }
    }

    /**
     * Panel lifecycle hooks
     */
    onShow() {
        super.onShow();
        this.log('EditorPanel shown', 'debug');
        // Potentially refresh or focus editor
    }

    onHide() {
        super.onHide();
        this.log('EditorPanel hidden', 'debug');
    }

    /**
     * Get current editor content
     */
    getContent() {
        const textarea = this.contentElement?.querySelector('.editor-textarea');
        return textarea ? textarea.value : '';
    }

    /**
     * Set editor content
     */
    setContent(content) {
        const textarea = this.contentElement?.querySelector('.editor-textarea');
        if (textarea) {
            textarea.value = content || '';
            textarea.dispatchEvent(new Event('input'));
            return true;
        }
        return false;
    }

    /**
     * Insert text at cursor position
     */
    insertTextAtCursor(text) {
        const textarea = this.contentElement?.querySelector('.editor-textarea');
        if (!textarea || !text) return false;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.dispatchEvent(new Event('input'));
        
        return true;
    }

    /**
     * Focus the editor
     */
    focus() {
        const textarea = this.contentElement?.querySelector('.editor-textarea');
        if (textarea) {
            textarea.focus();
        }
    }

    /**
     * Panel cleanup
     */
    cleanup() {
        this.log('EditorPanel cleanup', 'debug');
        super.cleanup();
    }
} 