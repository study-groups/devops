/**
 * EditorPanel.js - A feature-rich editor panel component for DevPages
 */

import { appStore } from '/client/appState.js';
import { BasePanel } from '/client/panels/BasePanel.js';
// REMOVED: messageQueue import (file deleted) - using Redux dispatch
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { logMessage } from '/client/log/index.js';
import { uploadImage } from '/client/image/imageManager.js';

export class EditorPanel extends BasePanel {
    constructor(options = {}) {
        const editorOptions = {
            headless: false,
            resizable: false,
            width: null,
            minWidth: null,
            maxWidth: null,
            ...options
        };
        super(options.id || 'editor-panel', editorOptions);
        this.textarea = null;
        this.boundHandleFileSelected = this.handleFileSelected.bind(this);
        this.boundHandleFileLoaded = this.handleFileLoaded.bind(this);
        this.boundHandleAuthLogin = this.handleAuthLogin.bind(this);
        this.editor = null;
        this.stateUnsubscribe = null;
    }
    
    init() {
        super.init();
        let prevState = appStore.getState(); // Initialize previous state
        this.stateUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            if (newState.file.currentPathname !== prevState.file.currentPathname) {
                this.updateEditorContent(newState.file.currentContent);
            }
            prevState = newState; // Update previous state
        });
    }

    renderContent() {
        return `<textarea 
            placeholder="Write Markdown here..." 
            class="editor-textarea"
            spellcheck="false"
        ></textarea>`;
    }

    async onMount() {
        console.log(`[DEBUG_EDITOR] EditorPanel onMount called. this.element: ${!!this.element}, this.contentElement: ${!!this.contentElement}`);
        await super.onMount();
        this.loadCSS();
        
        if (this.element) {
            this.element.style.removeProperty('width');
            this.element.style.removeProperty('max-width');
            this.element.style.removeProperty('min-width');
        }

        this.textarea = this.contentElement.querySelector('.editor-textarea');
        if (!this.textarea) {
            this.log('Editor textarea not found in panel', 'error');
            return;
        }

        this.setupEditorFeatures();
        this.attachEventListeners();
        this.checkAndRestoreAuthState();
        this.subscribeToStateChanges();

        // Schedule loading of available directories and files
        setTimeout(() => this.initializeData(), 500); // Delay to ensure auth is ready

        this.log('EditorPanel initialized successfully');
        this.show();
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

    attachEventListeners() {
        document.addEventListener('file:selected', this.boundHandleFileSelected);
        document.addEventListener('file:loaded', this.boundHandleFileLoaded);
        document.addEventListener('auth:login', this.boundHandleAuthLogin);
    }

    subscribeToStateChanges() {
        // This method is now obsolete as file content is driven by the state.
        // The editor component should listen to state changes and update its content.
    }

    setupEditorFeatures() {
        this.textarea.addEventListener('input', this.handleInput.bind(this));
        this.textarea.addEventListener('scroll', this.handleScroll.bind(this));
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                this.textarea.value = this.textarea.value.substring(0, start) + '\t' + this.textarea.value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 1;
            }
        });

        // Setup paste event handler
        this.textarea.addEventListener('paste', async (e) => {
            this.log('Paste event detected');
            if (!e.clipboardData || !e.clipboardData.items) {
                this.log('No clipboard data available');
                return;
            }

            const items = e.clipboardData.items;
            let imageItem = null;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    imageItem = items[i];
                    break;
                }
            }

            if (imageItem) {
                this.log('Found image in clipboard data');
                e.preventDefault();
                const blob = imageItem.getAsFile();
                if (!blob) {
                    this.log('Could not get image file from clipboard', 'error');
                    return;
                }
                await this.uploadPastedImage(blob);
            }
        });
    }

    async uploadPastedImage(blob) {
        if (!blob) return false;
        
        if (!this.textarea) {
            this.log('Textarea not found for uploadPastedImage', 'error');
            return false;
        }
        
        const originalCursorPos = this.textarea.selectionStart;
        
        this.textarea.style.cursor = 'wait'; 
        const originalBorder = this.textarea.style.border;
        this.textarea.style.border = '2px dashed orange';
        
        try {
            this.log('Uploading pasted image');
            const imageUrl = await uploadImage(blob);
            
            this.textarea.style.cursor = 'text';
            this.textarea.style.border = originalBorder;
            
            if (imageUrl) {
                this.log(`Image upload successful: ${imageUrl}. Inserting...`);
                
                const textBefore = this.textarea.value.substring(0, originalCursorPos);
                const textAfter = this.textarea.value.substring(originalCursorPos);
                const markdownToInsert = `\n![](${imageUrl})\n`;
                
                this.textarea.value = `${textBefore}${markdownToInsert}${textAfter}`;
                
                const newCursorPos = originalCursorPos + markdownToInsert.length;
                this.textarea.setSelectionRange(newCursorPos, newCursorPos);
                
                // Trigger preview update
                this.handleInput();
                
                return true;
            } else {
                this.log('Image upload failed - no URL returned', 'error');
                alert('Image upload failed.');
                return false;
            }
        } catch (error) {
            this.log(`Image upload failed: ${error.message}`, 'error');
            console.error('[EDITOR ERROR]', error);
            
            this.textarea.style.cursor = 'text';
            this.textarea.style.border = originalBorder;
            alert(`Image upload failed: ${error.message}`);
            return false;
        }
    }

    checkAndRestoreAuthState() {
        try {
            const authState = appStore.getState().auth;
            if (authState && authState.isAuthenticated && authState.user) {
                this.log('Found valid auth state in appStore');
                document.body.setAttribute('data-auth-state', 'logged-in');
                if (!document.body.hasAttribute('data-app-state') || document.body.getAttribute('data-app-state') !== 'ready') {
                    // The file manager is now initialized centrally in bootstrap.js
                    // and its state is managed by pathSlice. This component no longer
                    // needs to trigger its initialization.
                }
            }
        } catch (error) {
            this.log(`Error restoring auth state: ${error.message}`, 'error');
        }
    }

    // This method is now obsolete as file content is driven by the state.
    // The editor component should listen to state changes and update its content.

    loadFile(filename, directory) {
        this.log(`Loading file: ${filename} in directory: ${directory}`);
        document.dispatchEvent(new CustomEvent('file:load', {
            detail: { filename, directory }
        }));
    }
    
    handleInput() {
        const content = this.textarea.value;
        
        // Dispatch change event for auto-update functionality
        const customEvent = new CustomEvent('editor:change', {
            detail: { content: content }
        });
        document.dispatchEvent(customEvent);
        
        // Also emit to eventBus if available
        if (window.eventBus) {
            window.eventBus.emit('editor:contentChanged', { content });
        }
        
        // Update app state to trigger preview update
        dispatch({
            type: ActionTypes.FS_SET_STATE,
            payload: { content: content }
        });
        
        this.saveCurrentContent();
    }

    handleScroll() {
        try {
            localStorage.setItem('editorScrollPosition', this.textarea.scrollTop);
        } catch (error) {
            this.log(`Failed to save scroll position: ${error.message}`, 'error');
        }
    }
    
    handleFileSelected(event) {
        const { filename, directory } = event.detail;
        this.loadFile(filename, directory);
    }
    
    handleFileLoaded(event) {
        const { content } = event.detail;
        this.setValue(content);
        this.log('File content loaded into editor.');
    }
    
    handleAuthLogin(event) {
        const { username } = event.detail;
        this.log(`Auth login event received for ${username}. Initializing file manager.`);
        // The file manager is now initialized centrally in bootstrap.js
        // and its state is managed by pathSlice. This component no longer
        // needs to trigger its initialization.
    }

    saveCurrentContent() {
        try {
            if (this.textarea.value.trim()) {
                localStorage.setItem('editorContent', this.textarea.value);
                localStorage.setItem('editorTimestamp', Date.now());
            }
        } catch (error) {
            this.log(`Failed to save editor content: ${error.message}`, 'error');
        }
    }
    
    getValue() {
        return this.textarea ? this.textarea.value : '';
    }

    setValue(content) {
        if (this.textarea) {
            const oldContent = this.textarea.value;
            this.textarea.value = content || '';
            
            this.log(`Content set: ${content?.length || 0} chars (was ${oldContent?.length || 0} chars)`, 'debug');
            
            // Only trigger change event if content actually changed AND we're not updating from state
            if (oldContent !== (content || '') && !this.isUpdatingFromState) {
                // Trigger change event to update any dependent components (like preview)
                this.handleInput();
            }
            
            // Restore scroll position after setting content
            this.restoreScrollPosition();
        } else {
            this.log('Cannot set content - textarea not found', 'error');
        }
    }
    
    restoreScrollPosition() {
        try {
            const scrollPos = localStorage.getItem('editorScrollPosition');
            if (this.textarea && scrollPos) {
                this.textarea.scrollTop = parseInt(scrollPos, 10);
            }
        } catch (error) {
            this.log(`Failed to restore scroll position: ${error.message}`, 'error');
        }
    }

    cleanup() {
        super.cleanup();
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        document.removeEventListener('file:selected', this.boundHandleFileSelected);
        document.removeEventListener('file:loaded', this.boundHandleFileLoaded);
        document.removeEventListener('auth:login', this.boundHandleAuthLogin);
        this.log('EditorPanel cleaned up.', 'info');
    }

    // Add method to handle file loading requests
    async initializeData() {
        try {
            // Check if we have a current file to load
            const state = appStore.getState();
            const currentFile = state.file?.currentPathname;
            
            if (currentFile && !state.file?.isDirectorySelected) {
                this.log(`Loading current file from state: ${currentFile}`, 'info');
                // File manager should handle the loading via the restored state
            } else {
                this.log('No current file in state to load', 'debug');
            }
            
            // Debug current state
            this.debugCurrentState();
        } catch (error) {
            this.log(`Error during data initialization: ${error.message}`, 'error');
        }
    }

    // Debug method to check current state
    debugCurrentState() {
        try {
            const state = appStore.getState();
            const fileState = state.file;
            this.log(`[DEBUG] Current file state:`, 'debug');
            this.log(`  - currentPathname: "${fileState?.currentPathname || 'null'}"`, 'debug');
            this.log(`  - isDirectorySelected: ${fileState?.isDirectorySelected}`, 'debug');
            this.log(`  - content length: ${fileState?.content?.length || 0}`, 'debug');
            this.log(`  - isLoading: ${fileState?.isLoading}`, 'debug');
            this.log(`  - error: ${fileState?.error || 'none'}`, 'debug');
            this.log(`  - current editor content length: ${this.getValue()?.length || 0}`, 'debug');
            
            // Expose to window for easy debugging
            window.editorPanel = this;
            window.debugEditorState = () => this.debugCurrentState();
            window.forceRefreshEditor = () => this.forceRefreshFromState();
        } catch (error) {
            this.log(`Error in debugCurrentState: ${error.message}`, 'error');
        }
    }

    // Force refresh editor content from app state
    forceRefreshFromState() {
        try {
            const state = appStore.getState();
            const content = state.file?.content || '';
            this.log(`Force refreshing editor from state: ${content.length} chars`, 'info');
            this.setValue(content);
        } catch (error) {
            this.log(`Error in forceRefreshFromState: ${error.message}`, 'error');
        }
    }
} 