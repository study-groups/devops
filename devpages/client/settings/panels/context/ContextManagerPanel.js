/**
 * ContextManagerPanel.js
 * Settings panel for managing contexts for Cursor AI
 */

import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';  
import { settingsRegistry } from '/client/settings/core/settingsRegistry.js';
import { logMessage } from '/client/log/index.js';
import { globalFetch } from '/client/globalFetch.js';

export class ContextManagerPanel {
    constructor(containerId) {
        this.containerId = containerId;
        this.containerElement = null;
        this.availableContexts = [];
        this.currentContext = '';
        
        // Load CSS
        this.loadCSS();
        
        // Register with settings registry
        this.register();
        
        this.log('Context Manager Panel initialized', 'info');
    }

    loadCSS() {
        const cssId = 'context-manager-panel-styles';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = '/client/settings/panels/context/ContextManagerPanel.css';
            document.head.appendChild(link);
            this.log('Context Manager Panel CSS loaded', 'debug');
        }
    }

    log(message, level = 'info') {
        logMessage(`[Context Manager Panel] ${message}`, level, 'CONTEXT_MANAGER_PANEL');
    }

    register() {
        settingsRegistry.register('context-manager', {
            title: 'Context Manager',
            description: 'Manage contexts for Cursor AI notepad system',
            category: 'workspace',
            order: 5,
            collapsible: true,
            render: this.render.bind(this),
            onMount: this.onMount.bind(this),
            onUnmount: this.onUnmount.bind(this)
        });
    }

    async onMount(container) {
        this.containerElement = container;
        await this.loadContexts();
        await this.loadCurrentContext();
        this.render();
        this.attachEventListeners();
        this.log('Context Manager Panel mounted', 'debug');
    }

    onUnmount() {
        this.removeEventListeners();
        this.containerElement = null;
        this.log('Context Manager Panel unmounted', 'debug');
    }

    async loadContexts() {
        try {
            const response = await globalFetch('/api/publish/context/list');
            if (response.ok) {
                const data = await response.json();
                this.availableContexts = data.contexts || [];
                this.log(`Loaded ${this.availableContexts.length} contexts`, 'debug');
            } else {
                this.log('Failed to load contexts', 'warn');
            }
        } catch (error) {
            this.log(`Error loading contexts: ${error.message}`, 'error');
        }
    }

    async loadCurrentContext() {
        const settingsState = appStore.getState().settings;
        this.currentContext = settingsState?.currentContext || '';
        this.log(`Current context: ${this.currentContext || 'none'}`, 'debug');
    }

    render() {
        if (!this.containerElement) return;

        this.containerElement.innerHTML = `
            <div class="settings-section-container">
                <h2 class="settings-section-header" tabindex="0">
                    <span class="collapse-indicator">▼</span>Current Context
                </h2>
                <div class="settings-section-content">
                    <p class="settings-text--muted">Set the active context for adding notes to Cursor AI notepad system.</p>
                    <div class="settings-flex--column" style="gap: var(--density-space-sm);">
                        <div class="settings-flex" style="gap: var(--density-space-sm); align-items: center;">
                            <input type="text" 
                                   id="current-context-input" 
                                   class="settings-input" 
                                   placeholder="Enter context name..."
                                   value="${this.currentContext}"
                                   style="flex: 1;">
                            <button id="set-context-btn" class="settings-button settings-button--primary">
                                Set as Current
                            </button>
                        </div>
                        <small class="settings-text--muted">
                            Context names can only contain letters, numbers, underscores, and hyphens.
                        </small>
                    </div>
                </div>
            </div>

            <div class="settings-section-container">
                <h2 class="settings-section-header" tabindex="0">
                    <span class="collapse-indicator">▼</span>Available Contexts
                </h2>
                <div class="settings-section-content">
                    <p class="settings-text--muted">Manage existing contexts and their contents.</p>
                    <div id="contexts-list" class="contexts-list">
                        ${this.renderContextsList()}
                    </div>
                    <div class="settings-flex" style="gap: var(--density-space-sm); margin-top: var(--density-space-md);">
                        <button id="refresh-contexts-btn" class="settings-button">
                            🔄 Refresh
                        </button>
                        <button id="create-context-btn" class="settings-button settings-button--secondary">
                            ➕ Create New Context
                        </button>
                        <button id="create-from-template-btn" class="settings-button settings-button--primary">
                            📋 From Template
                        </button>
                    </div>
                </div>
            </div>

            <div class="settings-section-container">
                <h2 class="settings-section-header" tabindex="0">
                    <span class="collapse-indicator">▼</span>Context Information
                </h2>
                <div class="settings-section-content">
                    <p class="settings-text--muted">Learn about the context system.</p>
                    <div class="context-info-grid">
                        <div class="info-item">
                            <strong>Purpose:</strong> Contexts organize files for Cursor AI to reference as notepads.
                        </div>
                        <div class="info-item">
                            <strong>Location:</strong> <code>notepads/context/[context-name]/</code>
                        </div>
                        <div class="info-item">
                            <strong>Usage:</strong> Add files to context using the "Note" button next to Publish.
                        </div>
                        <div class="info-item">
                            <strong>Best Practice:</strong> Use descriptive context names like "api-docs", "project-setup", etc.
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.updateCurrentContextDisplay();
    }

    renderContextsList() {
        if (this.availableContexts.length === 0) {
            return `
                <div class="empty-contexts">
                    <p class="settings-text--muted">No contexts found. Create one to get started.</p>
                </div>
            `;
        }

        return this.availableContexts.map(context => `
            <div class="context-item ${context === this.currentContext ? 'active' : ''}">
                <div class="context-info">
                    <div class="context-name">${context}</div>
                    <div class="context-path">notepads/context/${context}/</div>
                </div>
                <div class="context-actions">
                    <button class="context-action-btn use-context-btn" data-context="${context}">
                        Use
                    </button>
                    <button class="context-action-btn explore-context-btn" data-context="${context}">
                        📁 Explore
                    </button>
                    <button class="context-action-btn delete-context-btn" data-context="${context}">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateCurrentContextDisplay() {
        const input = this.containerElement?.querySelector('#current-context-input');
        if (input) {
            input.value = this.currentContext;
        }

        // Update active context in list
        const contextItems = this.containerElement?.querySelectorAll('.context-item');
        contextItems?.forEach(item => {
            const contextName = item.querySelector('.context-name')?.textContent;
            if (contextName === this.currentContext) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    attachEventListeners() {
        if (!this.containerElement) return;

        // Set current context
        const setContextBtn = this.containerElement.querySelector('#set-context-btn');
        setContextBtn?.addEventListener('click', this.handleSetCurrentContext.bind(this));

        // Refresh contexts
        const refreshBtn = this.containerElement.querySelector('#refresh-contexts-btn');
        refreshBtn?.addEventListener('click', this.handleRefreshContexts.bind(this));

        // Create new context
        const createBtn = this.containerElement.querySelector('#create-context-btn');
        createBtn?.addEventListener('click', this.handleCreateContext.bind(this));

        // Create from template
        const templateBtn = this.containerElement.querySelector('#create-from-template-btn');
        templateBtn?.addEventListener('click', this.handleCreateFromTemplate.bind(this));

        // Context actions
        this.containerElement.addEventListener('click', this.handleContextAction.bind(this));

        // Enter key in context input
        const contextInput = this.containerElement.querySelector('#current-context-input');
        contextInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleSetCurrentContext();
            }
        });
    }

    removeEventListeners() {
        // Event listeners are automatically removed when container is destroyed
    }

    async handleSetCurrentContext() {
        const input = this.containerElement?.querySelector('#current-context-input');
        const contextName = input?.value.trim();

        if (!contextName) {
            alert('Please enter a context name');
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(contextName)) {
            alert('Context name must only contain letters, numbers, underscores, and hyphens.');
            return;
        }

        try {
            // Update app state
            dispatch({
                type: ActionTypes.SETTINGS_SET_CURRENT_CONTEXT,
                payload: contextName
            });

            this.currentContext = contextName;
            this.updateCurrentContextDisplay();
            
            this.log(`Set current context to: ${contextName}`, 'info');
            
            // Show feedback
            const btn = this.containerElement?.querySelector('#set-context-btn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✓ Set';
                btn.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '';
                }, 1500);
            }

        } catch (error) {
            this.log(`Error setting current context: ${error.message}`, 'error');
            alert(`Failed to set context: ${error.message}`);
        }
    }

    async handleRefreshContexts() {
        const btn = this.containerElement?.querySelector('#refresh-contexts-btn');
        if (btn) {
            btn.textContent = '🔄 Refreshing...';
            btn.disabled = true;
        }

        try {
            await this.loadContexts();
            this.render();
            this.attachEventListeners();
            this.log('Contexts refreshed', 'info');
        } catch (error) {
            this.log(`Error refreshing contexts: ${error.message}`, 'error');
        } finally {
            if (btn) {
                btn.textContent = '🔄 Refresh';
                btn.disabled = false;
            }
        }
    }

    async handleCreateContext() {
        const contextName = prompt('Enter new context name:');
        if (!contextName) return;

        if (!/^[a-zA-Z0-9_-]+$/.test(contextName)) {
            alert('Context name must only contain letters, numbers, underscores, and hyphens.');
            return;
        }

        if (this.availableContexts.includes(contextName)) {
            alert('Context already exists.');
            return;
        }

        try {
            // Create context by making a dummy file
            const response = await fetch('/api/publish/context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pathname: `_init.md`,
                    contextName: contextName,
                    markdownContent: `# ${contextName} Context\n\nThis context was created for organizing notes for Cursor AI.\n`
                })
            });

            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error || `Server error: ${response.status}`);
            }

            this.log(`Created new context: ${contextName}`, 'info');
            await this.handleRefreshContexts();
            alert(`Context "${contextName}" created successfully!`);

        } catch (error) {
            this.log(`Error creating context: ${error.message}`, 'error');
            alert(`Failed to create context: ${error.message}`);
        }
    }

    async handleCreateFromTemplate() {
        try {
            // Load available templates
            const response = await globalFetch('/api/publish/context-templates');
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            // Show template selection modal
            const modal = this.createTemplateSelectionModal(data.templates);
            document.body.appendChild(modal);
            
        } catch (error) {
            this.log(`Error loading templates: ${error.message}`, 'error');
            alert(`Failed to load templates: ${error.message}`);
        }
    }

    createTemplateSelectionModal(templates) {
        const modal = document.createElement('div');
        modal.className = 'template-selection-modal';
        modal.innerHTML = `
            <div class="template-selection-overlay"></div>
            <div class="template-selection-content">
                <div class="template-selection-header">
                    <h3>📋 Create Context from Template</h3>
                    <button class="template-selection-close">×</button>
                </div>
                <div class="template-selection-body">
                    <div class="template-input-section">
                        <label for="context-name-input">Context Name:</label>
                        <input type="text" 
                               id="context-name-input" 
                               class="template-context-input" 
                               placeholder="Enter context name..."
                               pattern="[a-zA-Z0-9_-]+"
                               title="Use only letters, numbers, underscores, and hyphens">
                        <small class="input-hint">Use only letters, numbers, underscores, and hyphens</small>
                    </div>
                    <div class="template-selection-section">
                        <label>Choose a Template:</label>
                        <div class="templates-grid">
                            ${this.renderTemplateCards(templates)}
                        </div>
                    </div>
                </div>
                <div class="template-selection-footer">
                    <button class="btn-secondary template-selection-close">Cancel</button>
                    <button class="btn-primary create-context-from-template" disabled>Create Context</button>
                </div>
            </div>
        `;

        // Add event listeners
        this.attachTemplateModalEvents(modal, templates);

        return modal;
    }

    renderTemplateCards(templates) {
        return templates.map(template => `
            <div class="template-card" data-template-id="${template.id}">
                <div class="template-header">
                    <div class="template-name">${template.name}</div>
                    <div class="template-badge ${template.builtin ? 'builtin' : 'custom'}">
                        ${template.builtin ? 'Built-in' : 'Custom'}
                    </div>
                </div>
                <div class="template-description">${template.description}</div>
                <div class="template-files">
                    <strong>Files included:</strong>
                    <div class="template-files-list">
                        ${template.files.map(file => `<span class="template-file">${file}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    attachTemplateModalEvents(modal, templates) {
        const overlay = modal.querySelector('.template-selection-overlay');
        const closeButtons = modal.querySelectorAll('.template-selection-close');
        const contextInput = modal.querySelector('#context-name-input');
        const createButton = modal.querySelector('.create-context-from-template');
        let selectedTemplate = null;

        // Close modal events
        [...closeButtons, overlay].forEach(element => {
            element.addEventListener('click', () => modal.remove());
        });

        // Template card selection
        modal.addEventListener('click', (e) => {
            const card = e.target.closest('.template-card');
            if (card) {
                // Remove previous selection
                modal.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
                
                // Select this card
                card.classList.add('selected');
                selectedTemplate = card.dataset.templateId;
                
                // Enable create button if context name is also provided
                this.updateCreateButtonState(modal, selectedTemplate, contextInput.value.trim());
            }
        });

        // Context name input
        contextInput.addEventListener('input', (e) => {
            const contextName = e.target.value.trim();
            this.updateCreateButtonState(modal, selectedTemplate, contextName);
        });

        // Create context
        createButton.addEventListener('click', async () => {
            const contextName = contextInput.value.trim();
            if (selectedTemplate && contextName) {
                await this.createContextFromTemplate(selectedTemplate, contextName, modal);
            }
        });

        // Enter key to create
        contextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && selectedTemplate && e.target.value.trim()) {
                createButton.click();
            }
        });

        // ESC key to close
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    updateCreateButtonState(modal, selectedTemplate, contextName) {
        const createButton = modal.querySelector('.create-context-from-template');
        const isValid = selectedTemplate && contextName && /^[a-zA-Z0-9_-]+$/.test(contextName);
        
        createButton.disabled = !isValid;
        createButton.textContent = isValid ? 'Create Context' : 'Select template and enter name';
    }

    async createContextFromTemplate(templateId, contextName, modal) {
        const createButton = modal.querySelector('.create-context-from-template');
        
        try {
            createButton.textContent = 'Creating...';
            createButton.disabled = true;

            const response = await fetch('/api/publish/context-from-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, contextName })
            });

            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error || `Server error: ${response.status}`);
            }

            this.log(`Created context "${contextName}" from template "${templateId}"`, 'info');
            
            // Close modal and refresh
            modal.remove();
            await this.handleRefreshContexts();
            
            // Set as current context
            this.currentContext = contextName;
            dispatch({
                type: ActionTypes.SETTINGS_SET_CURRENT_CONTEXT,
                payload: contextName
            });
            this.updateCurrentContextDisplay();
            
            // Show success message
            alert(`Successfully created context "${contextName}" with ${result.filesCreated.length} files from template "${templateId}"`);

        } catch (error) {
            this.log(`Error creating context from template: ${error.message}`, 'error');
            alert(`Failed to create context: ${error.message}`);
            
            createButton.textContent = 'Create Context';
            createButton.disabled = false;
        }
    }

    async handleContextAction(event) {
        const target = event.target;
        const contextName = target.dataset.context;
        
        if (!contextName) return;

        if (target.classList.contains('use-context-btn')) {
            // Set as current context
            const input = this.containerElement?.querySelector('#current-context-input');
            if (input) {
                input.value = contextName;
                await this.handleSetCurrentContext();
            }
        } else if (target.classList.contains('explore-context-btn')) {
            // Show context contents
            await this.showContextExplorer(contextName);
        } else if (target.classList.contains('delete-context-btn')) {
            // Delete context
            if (confirm(`Are you sure you want to delete context "${contextName}"? This will remove all files in the context.`)) {
                await this.handleDeleteContext(contextName);
            }
        }
    }

    async handleDeleteContext(contextName) {
        try {
            // Note: We don't have a delete context API yet, so this is a placeholder
            alert(`Context deletion for "${contextName}" will be implemented in a future update.`);
            this.log(`Context deletion requested for: ${contextName}`, 'info');
        } catch (error) {
            this.log(`Error deleting context: ${error.message}`, 'error');
            alert(`Failed to delete context: ${error.message}`);
        }
    }

    async showContextExplorer(contextName) {
        try {
            // Load context files
            const response = await globalFetch(`/api/publish/context/${contextName}/files`);
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            // Create modal overlay
            const modal = this.createContextExplorerModal(contextName, data.files);
            document.body.appendChild(modal);
            
            // Add event listeners
            this.attachContextExplorerEvents(modal, contextName);
            
            this.log(`Opened context explorer for: ${contextName}`, 'info');

        } catch (error) {
            this.log(`Error opening context explorer: ${error.message}`, 'error');
            alert(`Failed to explore context: ${error.message}`);
        }
    }

    createContextExplorerModal(contextName, files) {
        const modal = document.createElement('div');
        modal.className = 'context-explorer-modal';
        modal.innerHTML = `
            <div class="context-explorer-overlay"></div>
            <div class="context-explorer-content">
                <div class="context-explorer-header">
                    <h3>📁 Context: ${contextName}</h3>
                    <button class="context-explorer-close">×</button>
                </div>
                <div class="context-explorer-body">
                    <div class="context-explorer-stats">
                        <span class="file-count">${files.length} files</span>
                        <span class="total-words">${files.reduce((sum, f) => sum + f.wordCount, 0)} words</span>
                    </div>
                    <div class="context-files-list">
                        ${this.renderContextFilesList(files)}
                    </div>
                </div>
                <div class="context-explorer-footer">
                    <button class="btn-secondary context-explorer-close">Close</button>
                </div>
            </div>
        `;
        return modal;
    }

    renderContextFilesList(files) {
        if (files.length === 0) {
            return `
                <div class="empty-context-files">
                    <p>No files in this context yet.</p>
                    <p>Use the "Note" button to add files to this context.</p>
                </div>
            `;
        }

        return files.map(file => `
            <div class="context-file-item" data-file-name="${file.name}">
                <div class="file-header">
                    <div class="file-name">${file.name}</div>
                    <div class="file-actions">
                        <button class="file-action-btn view-file-btn" data-file-name="${file.name}">
                            👁️ View
                        </button>
                        <button class="file-action-btn delete-file-btn" data-file-name="${file.name}">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                <div class="file-stats">
                    <span class="file-size">${this.formatFileSize(file.size)}</span>
                    <span class="file-words">${file.wordCount} words</span>
                    <span class="file-lines">${file.lineCount} lines</span>
                    <span class="file-modified">${this.formatDate(file.modified)}</span>
                </div>
                <div class="file-preview">${file.preview}</div>
            </div>
        `).join('');
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return Math.round(bytes / (1024 * 1024)) + ' MB';
    }

    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    attachContextExplorerEvents(modal, contextName) {
        // Close modal events
        const closeButtons = modal.querySelectorAll('.context-explorer-close');
        const overlay = modal.querySelector('.context-explorer-overlay');
        
        [...closeButtons, overlay].forEach(element => {
            element.addEventListener('click', () => {
                modal.remove();
            });
        });

        // File action events
        modal.addEventListener('click', async (e) => {
            const target = e.target;
            const fileName = target.dataset.fileName;
            
            if (!fileName) return;

            if (target.classList.contains('view-file-btn')) {
                await this.viewContextFile(contextName, fileName);
            } else if (target.classList.contains('delete-file-btn')) {
                if (confirm(`Delete "${fileName}" from context "${contextName}"?`)) {
                    await this.deleteContextFile(contextName, fileName, modal);
                }
            }
        });

        // ESC key to close
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    async viewContextFile(contextName, fileName) {
        try {
            const response = await globalFetch(`/api/publish/context/${contextName}/file/${fileName}`);
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            // Create file viewer modal
            const viewer = this.createFileViewerModal(contextName, fileName, data.content);
            document.body.appendChild(viewer);

        } catch (error) {
            this.log(`Error viewing file: ${error.message}`, 'error');
            alert(`Failed to view file: ${error.message}`);
        }
    }

    createFileViewerModal(contextName, fileName, content) {
        const modal = document.createElement('div');
        modal.className = 'file-viewer-modal';
        modal.innerHTML = `
            <div class="file-viewer-overlay"></div>
            <div class="file-viewer-content">
                <div class="file-viewer-header">
                    <h3>📄 ${fileName}</h3>
                    <div class="file-viewer-path">Context: ${contextName}</div>
                    <button class="file-viewer-close">×</button>
                </div>
                <div class="file-viewer-body">
                    <pre class="file-content">${this.escapeHtml(content)}</pre>
                </div>
                <div class="file-viewer-footer">
                    <button class="btn-secondary file-viewer-close">Close</button>
                </div>
            </div>
        `;

        // Add close events
        const closeElements = modal.querySelectorAll('.file-viewer-close, .file-viewer-overlay');
        closeElements.forEach(element => {
            element.addEventListener('click', () => modal.remove());
        });

        return modal;
    }

    async deleteContextFile(contextName, fileName, explorerModal) {
        try {
            const response = await fetch(`/api/publish/context/${contextName}/file/${fileName}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            this.log(`Deleted file ${fileName} from context ${contextName}`, 'info');
            
            // Refresh the explorer
            explorerModal.remove();
            await this.showContextExplorer(contextName);

        } catch (error) {
            this.log(`Error deleting file: ${error.message}`, 'error');
            alert(`Failed to delete file: ${error.message}`);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Auto-register when module loads
const contextManagerPanel = new ContextManagerPanel('context-manager-panel'); 