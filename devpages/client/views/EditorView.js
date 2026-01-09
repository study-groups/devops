/**
 * EditorView.js - A feature-rich editor view for DevPages workspace
 */

import { appStore } from '/client/appState.js';
import { ViewInterface } from '/client/layout/ViewInterface.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { logMessage } from '/client/log/index.js';
import { uploadImage } from '/client/image/imageManager.js';

export class EditorView extends ViewInterface {
    constructor(options = {}) {
        super({
            id: 'editor-view',
            title: 'Editor',
            ...options
        });
        
        this.textarea = null;
        this.editor = null;
        this.stateUnsubscribe = null;
    }

    render() {
        const editorContainer = document.createElement('div');
        editorContainer.className = 'editor-container';
        editorContainer.innerHTML = `
            <textarea 
                placeholder="Write Markdown here..." 
                class="editor-textarea"
                spellcheck="false"
            ></textarea>
            <div class="editor-info-bar">
                <div class="info-item line-info">Line: <span class="line-number">1</span></div>
                <div class="info-item col-info">Col: <span class="col-number">1</span></div>
                <div class="info-item char-info">Chars: <span class="char-count">0</span></div>
            </div>
        `;
        
        return editorContainer;
    }

    async onMount(container) {
        console.log(`[DEBUG_EDITOR] EditorView onMount called. container: ${!!container}`);
        
        this.loadCSS();
        
        this.textarea = this.element.querySelector('.editor-textarea');
        if (!this.textarea) {
            console.error('Editor textarea not found in view');
            return;
        }

        this.setupEditorFeatures();
        this.attachEventListeners();
        this.setupInfoBar();
        this.checkAndRestoreAuthState();
        this.subscribeToStateChanges();

        // Schedule loading of available directories and files
        setTimeout(() => this.initializeData(), 500);

        console.log('EditorView initialized successfully');
        this.show();
    }

    onUnmount() {
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }

        // Remove event listeners
        if (this.textarea) {
            this.textarea.removeEventListener('input', this.handleInput);
            this.textarea.removeEventListener('keydown', this.handleKeydown);
            this.textarea.removeEventListener('paste', this.handlePaste);
            this.textarea.removeEventListener('dragover', this.handleDragOver);
            this.textarea.removeEventListener('dragleave', this.handleDragLeave);
            this.textarea.removeEventListener('drop', this.handleDrop);
        }

        // Redux state subscriptions are automatically cleaned up by stateUnsubscribe

        console.log('EditorView unmounted and cleaned up');
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

    subscribeToStateChanges() {
        let prevState = appStore.getState();
        this.stateUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            const prevFile = prevState.file?.currentFile;
            const newFile = newState.file?.currentFile;
            
            // Update editor content when file changes
            if (newFile?.pathname !== prevFile?.pathname || 
                newFile?.content !== prevFile?.content) {
                this.updateEditorContent(newFile?.content || '');
                
                // Also sync the editor slice when file content changes
                if (newFile?.content !== undefined) {
                    import('/client/store/slices/editorSlice.js').then(({ setContentSaved }) => {
                        appStore.dispatch(setContentSaved(newFile.content));
                    });
                }
            }
            
            prevState = newState;
        });
    }

    setupEditorFeatures() {
        if (!this.textarea) return;

        // Set initial content from Redux state
        const state = appStore.getState();
        if (state.file?.currentFile?.content) {
            this.textarea.value = state.file.currentFile.content;
        }

        // Setup auto-resize
        this.setupAutoResize();
        
        // Setup syntax highlighting hints (basic)
        this.setupSyntaxHints();
    }

    setupAutoResize() {
        if (!this.textarea) return;
        
        const autoResize = () => {
            this.textarea.style.height = 'auto';
            this.textarea.style.height = this.textarea.scrollHeight + 'px';
        };
        
        this.textarea.addEventListener('input', autoResize);
        autoResize(); // Initial resize
    }

    setupSyntaxHints() {
        // Basic markdown syntax highlighting could be added here
        // For now, just ensure proper styling is applied
        if (this.textarea) {
            this.textarea.classList.add('markdown-editor');
        }
    }

    setupInfoBar() {
        if (!this.textarea) return;
        
        this.infoBar = {
            lineNumber: this.element.querySelector('.line-number'),
            colNumber: this.element.querySelector('.col-number'),
            charCount: this.element.querySelector('.char-count')
        };
        
        // Update info bar on cursor position change
        this.updateInfoBar = this.updateInfoBar.bind(this);
        this.textarea.addEventListener('input', this.updateInfoBar);
        this.textarea.addEventListener('keyup', this.updateInfoBar);
        this.textarea.addEventListener('mouseup', this.updateInfoBar);
        this.textarea.addEventListener('focus', this.updateInfoBar);
        
        // Initial update
        this.updateInfoBar();
    }

    updateInfoBar() {
        if (!this.textarea || !this.infoBar.lineNumber) return;
        
        const content = this.textarea.value;
        const cursorPos = this.textarea.selectionStart;
        
        // Calculate line and column
        const textBeforeCursor = content.substring(0, cursorPos);
        const lineNumber = textBeforeCursor.split('\n').length;
        const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
        const colNumber = cursorPos - lastLineStart + 1;
        
        // Update the display
        this.infoBar.lineNumber.textContent = lineNumber;
        this.infoBar.colNumber.textContent = colNumber;
        this.infoBar.charCount.textContent = content.length;
        
        // Update Redux state
        import('/client/store/slices/editorSlice.js').then(({ setCursorPosition }) => {
            appStore.dispatch(setCursorPosition(cursorPos));
        });
    }

    attachEventListeners() {
        if (!this.textarea) return;

        // Input handling
        this.handleInput = this.handleInput.bind(this);
        this.textarea.addEventListener('input', this.handleInput);

        // Keyboard shortcuts
        this.handleKeydown = this.handleKeydown.bind(this);
        this.textarea.addEventListener('keydown', this.handleKeydown);

        // Paste handling
        this.handlePaste = this.handlePaste.bind(this);
        this.textarea.addEventListener('paste', this.handlePaste);

        // Drag and drop handling for images
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.textarea.addEventListener('dragover', this.handleDragOver);
        this.textarea.addEventListener('dragleave', this.handleDragLeave);
        this.textarea.addEventListener('drop', this.handleDrop);

        // Redux state subscriptions are handled in subscribeToStateChanges()
        // No need for manual event subscriptions
    }

    async handleInput(event) {
        const content = this.textarea.value;
        
        // Update both file and editor slices to keep state consistent
        const { fileActions } = await import('/client/store/slices/fileSlice.js');
        const { setContent } = await import('/client/store/slices/editorSlice.js');
        
        appStore.dispatch(fileActions.updateFileContent({ content }));
        appStore.dispatch(setContent(content));

        // Auto-save functionality could be added here
        this.scheduleAutoSave();
    }

    handleKeydown(event) {
        // Ctrl+S or Cmd+S for save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.saveFile();
        }

        // Tab handling for indentation
        if (event.key === 'Tab') {
            event.preventDefault();
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            
            this.textarea.value = this.textarea.value.substring(0, start) + 
                                 '  ' + 
                                 this.textarea.value.substring(end);
            
            this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
        }
    }

    async handlePaste(event) {
        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    try {
                        const result = await uploadImage(file);
                        const imageUrl = result.url || result;
                        this.insertAtCursor(`![Image](${imageUrl})`);
                        logMessage('Image uploaded successfully', 'info');
                    } catch (error) {
                        console.error('Failed to upload image:', error);
                        logMessage('Failed to upload image', 'error');
                    }
                }
            }
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        this.textarea.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.textarea.classList.remove('drag-over');
    }

    async handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.textarea.classList.remove('drag-over');

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                try {
                    logMessage('Uploading dropped image...', 'info');
                    const result = await uploadImage(file);
                    const imageUrl = result.url || result;
                    this.insertAtCursor(`![${file.name}](${imageUrl})\n`);
                    logMessage('Image uploaded successfully', 'info');
                } catch (error) {
                    console.error('Failed to upload image:', error);
                    logMessage(`Failed to upload image: ${error.message}`, 'error');
                }
            }
        }
    }

    insertAtCursor(text) {
        if (!this.textarea) return;
        
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        
        this.textarea.value = this.textarea.value.substring(0, start) + 
                             text + 
                             this.textarea.value.substring(end);
        
        this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
        this.textarea.focus();
        
        // Trigger input event to update state
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.autoSave();
        }, 2000); // Auto-save after 2 seconds of inactivity
    }

    async autoSave() {
        const state = appStore.getState();
        // v2: pathname is at file.currentFile.pathname
        if (state.file?.currentFile?.pathname && state.auth?.isAuthenticated) {
            try {
                await this.saveFile(true); // Silent save
            } catch (error) {
                console.warn('Auto-save failed:', error);
            }
        }
    }

    async saveFile(silent = false) {
        const state = appStore.getState();
        const content = this.textarea?.value || '';
        
        if (!state.file?.currentFile?.pathname) {
            if (!silent) {
                logMessage('No file selected to save', 'warn');
            }
            return;
        }

        try {
            // Use the proper fileThunks.saveFile action
            const { fileThunks } = await import('/client/store/slices/fileSlice.js');
            await appStore.dispatch(fileThunks.saveFile());
            
            if (!silent) {
                logMessage('File saved successfully', 'info');
            }
        } catch (error) {
            console.error('Save failed:', error);
            if (!silent) {
                logMessage('Failed to save file', 'error');
            }
        }
    }

    updateEditorContent(content) {
        if (this.textarea && content !== undefined) {
            this.textarea.value = content;
            this.setupAutoResize(); // Adjust height for new content
        }
    }

    // File selection and loading are now handled via Redux state subscriptions

    checkAndRestoreAuthState() {
        const state = appStore.getState();
        if (state.auth && state.auth.isAuthenticated) {
            // Enable editor features that require authentication
            if (this.textarea) {
                this.textarea.disabled = false;
                this.textarea.placeholder = 'Write Markdown here...';
            }
        } else {
            // Disable or limit editor features
            if (this.textarea) {
                this.textarea.placeholder = 'Please log in to edit files...';
            }
        }
    }

    async initializeData() {
        // Load initial data if needed
        const state = appStore.getState();
        if (state.auth && state.auth.isAuthenticated) {
            // Initialize any data that requires authentication
            console.log('EditorView: Initializing authenticated features');
        }
    }

    // Public API methods
    getContent() {
        return this.textarea?.value || '';
    }

    setContent(content) {
        if (this.textarea) {
            this.textarea.value = content;
            this.setupAutoResize();
        }
    }

    focus() {
        if (this.textarea) {
            this.textarea.focus();
        }
    }

    insertText(text) {
        this.insertAtCursor(text);
    }
}
