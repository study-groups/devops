/**
 * WorkspaceManager.js - Manages workspace UI state and content display
 * Automatically sets up editor and preview when files are loaded
 */

import { appStore } from '/client/appState.js';
import { ZoneTopBar } from './ZoneTopBar.js';

class WorkspaceManager {
    constructor() {
        this.initialized = false;
        this.lastFileContent = null;
        this.lastFilePath = null;
        this.editorTopBar = null;
        this.previewTopBar = null;
    }

    initialize() {
        if (this.initialized) return;
        
        console.log('[WorkspaceManager] Initializing...');
        
        // Subscribe to Redux state changes
        appStore.subscribe(() => {
            this.handleStateChange();
        });
        
        this.initialized = true;
        console.log('[WorkspaceManager] Initialized');
    }

    handleStateChange() {
        const state = appStore.getState();
        const fileContent = state.file?.currentFile?.content;
        const filePath = state.file?.currentFile?.pathname;
        
        // Only act when file content changes
        if (fileContent && fileContent !== this.lastFileContent) {
            console.log(`[WorkspaceManager] New file content detected: ${filePath} (${fileContent.length} chars)`);
            this.setupWorkspaceForFile(fileContent, filePath);
            this.lastFileContent = fileContent;
            this.lastFilePath = filePath;
        }
    }

    setupWorkspaceForFile(content, filePath) {
        const state = appStore.getState();
        
        console.log('[WorkspaceManager] Setting up workspace for file...');
        
        // Ensure editor and preview are visible
        if (!state.ui?.editorVisible) {
            console.log('[WorkspaceManager] Making editor visible...');
            appStore.dispatch({ type: 'ui/toggleEditorVisibility' });
        }
        
        if (!state.ui?.previewVisible) {
            console.log('[WorkspaceManager] Making preview visible...');
            appStore.dispatch({ type: 'ui/togglePreviewVisibility' });
        }
        
        // Wait for UI state to update, then populate containers
        setTimeout(() => {
            this.populateWorkspaceContainers(content, filePath);
        }, 100);
    }

    populateWorkspaceContainers(content, filePath) {
        const editorContainer = document.getElementById('workspace-editor');
        const previewContainer = document.getElementById('workspace-preview');
        
        if (!editorContainer || !previewContainer) {
            console.warn('[WorkspaceManager] Workspace containers not found');
            return;
        }
        
        // Set up editor if empty or has placeholder content
        if (this.shouldPopulateContainer(editorContainer)) {
            console.log('[WorkspaceManager] Populating editor container...');
            this.createEditor(editorContainer, content, filePath);
        }
        
        // Set up preview if empty or has placeholder content
        if (this.shouldPopulateContainer(previewContainer)) {
            console.log('[WorkspaceManager] Populating preview container...');
            this.createPreview(previewContainer, content, filePath);
        }
        
        // Update button states
        this.updateButtonStates();
    }

    shouldPopulateContainer(container) {
        return container.children.length === 0 || 
               container.textContent.includes('No content') ||
               container.textContent.includes('Loading') ||
               container.textContent.includes('Preview will appear here');
    }

    createEditor(container, content, filePath) {
        const fileName = filePath ? filePath.split('/').pop() : 'file.md';
        
        container.innerHTML = `
            <div class="editor-section">
                <textarea 
                    id="md-editor" 
                    class="markdown-editor" 
                    placeholder="Start typing..."
                >${content}</textarea>
            </div>
        `;
        
        // Create programmable top bar
        this.editorTopBar = new ZoneTopBar(container, {
            title: 'Editor',
            showStats: true,
            showStatus: true
        });
        
        // Insert top bar at the beginning
        const editorSection = container.querySelector('.editor-section');
        editorSection.insertBefore(this.editorTopBar.getElement(), editorSection.firstChild);
        
        // Set initial stats
        this.editorTopBar.setStats({
            'chars': content.length,
            'lines': content.split('\n').length,
            'file': fileName
        });
        
        // Set up editor functionality
        const textarea = container.querySelector('#md-editor');
        if (textarea) {
            // Auto-save on changes
            textarea.addEventListener('input', () => {
                // Update Redux state
                appStore.dispatch({ type: 'editor/setContent', payload: textarea.value });
                
                // Update stats in real-time
                this.editorTopBar.setStats({
                    'chars': textarea.value.length,
                    'lines': textarea.value.split('\n').length
                });
            });
        }
    }

    createPreview(container, content, filePath) {
        container.innerHTML = `
            <div class="preview-section">
                <div class="preview-container">
                    <div style="color: var(--color-text-secondary); text-align: center; padding: 20px;">
                        Rendering preview...
                    </div>
                </div>
            </div>
        `;
        
        // Create programmable top bar
        this.previewTopBar = new ZoneTopBar(container, {
            title: 'Preview',
            showStats: true,
            showStatus: true
        });
        
        // Insert top bar at the beginning
        const previewSection = container.querySelector('.preview-section');
        previewSection.insertBefore(this.previewTopBar.getElement(), previewSection.firstChild);
        
        // Set initial stats and status
        this.previewTopBar
            .setStats({ 'mode': 'markdown' })
            .setStatus('loading', 'Rendering...');
        
        // Trigger markdown rendering
        this.renderPreview(container, content, filePath);
    }

    async renderPreview(container, content, filePath) {
        const previewDiv = container.querySelector('.preview-container');
        if (!previewDiv) return;
        
        try {
            // Try to use the proper preview system
            const { updatePreview } = await import('/client/preview/index.js');
            
            appStore.dispatch(updatePreview({ content, filePath })).then(() => {
                console.log('[WorkspaceManager] Preview rendered successfully');
                
                // Update the preview container with rendered content
                setTimeout(() => {
                    const previewState = appStore.getState().preview;
                    if (previewState?.htmlContent) {
                        previewDiv.innerHTML = previewState.htmlContent;
                        console.log('[WorkspaceManager] Preview content updated in UI');
                        
                        // Update preview top bar
                        this.previewTopBar
                            .setStats({ 
                                'mode': 'markdown',
                                'size': `${Math.round(previewState.htmlContent.length / 1024)}kb`
                            })
                            .setStatus('ready');
                    }
                }, 500);
            }).catch(err => {
                console.warn('[WorkspaceManager] Preview rendering failed, using fallback:', err.message);
                this.previewTopBar.setStatus('error', 'Render failed');
                this.renderFallbackPreview(previewDiv, content);
            });
        } catch (error) {
            console.warn('[WorkspaceManager] Could not import preview system:', error.message);
            this.previewTopBar.setStatus('error', 'System error');
            this.renderFallbackPreview(previewDiv, content);
        }
    }

    renderFallbackPreview(previewDiv, content) {
        // Simple markdown-like rendering for immediate display
        const simpleHtml = content
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>');
        
        previewDiv.innerHTML = `<p>${simpleHtml}</p>`;
        console.log('[WorkspaceManager] Fallback preview rendered');
    }

    updateButtonStates() {
        const editButton = document.querySelector('#edit-toggle');
        const previewButton = document.querySelector('#preview-toggle');
        
        if (editButton) {
            editButton.classList.add('active');
        }
        
        if (previewButton) {
            previewButton.classList.add('active');
        }
    }
}

// Create and export singleton instance
export const workspaceManager = new WorkspaceManager();

// Auto-initialize when module is loaded
workspaceManager.initialize();
