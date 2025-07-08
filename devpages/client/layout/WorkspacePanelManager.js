/**
 * WorkspacePanelManager.js
 * Manages the three-panel workspace layout and panel sections
 */

import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { logMessage } from '/client/log/index.js';

export class WorkspacePanelManager {
    constructor() {
        this.sidebarContainer = null;
        this.editorContainer = null;
        this.previewContainer = null;
        this.logContainer = null;

        this.isSidebarVisible = false;
        this.isEditorVisible = true; // Start with editor visible
        this.currentPanelSection = null;
        
        // Panel sections registry
        this.panelSections = new Map();
        
        // Current mode: 'browse', 'edit', 'manage'
        this.currentMode = 'browse';
        
        // Store subscription will be set up after initialization
        this.storeUnsubscribe = null;
        
        // Editor instance
        this.editor = null;
        
        // PreviewPanel instance
        this.previewPanel = null;
    }

    log(message, level = 'info') {
        logMessage(`[WorkspacePanelManager] ${message}`, level, 'WORKSPACE');
    }

    async initialize() {
        this.log('Initializing WorkspacePanelManager...');
        
        try {
            // Set up panel element references
            this.setupPanelElements();
            
            // Register panel sections
            this.registerPanelSections();
            
            // Attach event listeners
            this.attachEventListeners();
            
            // Initialize preview panel
            await this.initializePreviewPanel();
            
            // Set up store subscription
            this.setupStoreSubscription();
            
            // Apply initial state from store
            this.applyInitialState();
            
            this.log('WorkspacePanelManager initialization complete');
        } catch (error) {
            this.log(`Failed to initialize: ${error.message}`, 'error');
            console.error('[WorkspacePanelManager] Initialization error:', error);
        }
    }

    /**
     * Initialize the PreviewPanel for the main preview container
     */
    async initializePreviewPanel() {
        // Guard against multiple initialization
        if (this.previewPanel) {
            this.log('PreviewPanel already initialized, skipping', 'debug');
            return;
        }

        try {
            const { PreviewPanel } = await import('/client/panels/types/PreviewPanel.js');
            
            this.previewPanel = new PreviewPanel({
                id: 'preview-panel',
                title: 'Preview',
                order: 2,
                width: 400,
                visible: true // Start visible so preview is shown by default
            });

            // Mount preview panel to the main preview container
            if (!this.previewContainer) {
                throw new Error('Preview container not found in the DOM.');
            }
            
            // Clear any existing content first to prevent duplicates (including ContentView content)
            this.previewContainer.innerHTML = '';
            
            await this.previewPanel.mount(this.previewContainer);
            this.log('PreviewPanel created and mounted to preview-container');
            
            // Expose to window for debugging
            window.previewPanel = this.previewPanel;
            
        } catch (error) {
            this.log(`Failed to initialize PreviewPanel: ${error.message}`, 'error');
            throw error;
        }
    }

    setupPanelElements() {
        this.sidebarContainer = document.getElementById('sidebar-container');
        this.editorContainer = document.getElementById('editor-container');
        this.previewContainer = document.getElementById('preview-container');
        this.logContainer = document.getElementById('log-container');

        this.panelSectionsList = document.getElementById('panel-sections-list');
        this.panelContent = document.getElementById('left-panel-content');
        
        if (!this.sidebarContainer || !this.editorContainer || !this.previewContainer || !this.logContainer) {
            this.log('Required panel elements not found in DOM, will retry...', 'warn');
            // Retry after a short delay
            setTimeout(() => {
                this.setupPanelElements();
                if (this.sidebarContainer && this.editorContainer) {
                    this.registerPanelSections();
                    this.attachEventListeners();
                    this.log('Panel elements found on retry, setup complete');
                }
            }, 100);
            return;
        }
        
        this.log('Panel elements successfully found and connected');
        
        // Initialize panel visibility states
        this.isSidebarVisible = !this.sidebarContainer.classList.contains('hidden');
        this.isEditorVisible = !this.editorContainer.classList.contains('hidden');
        
        // Apply initial state from the store
        this.applyInitialState();
        
        // Ensure center panel has content
        setTimeout(() => this.ensureCenterPanelContent(), 100);
    }

    registerPanelSections() {
        // Register ContextManager section
        this.registerPanelSection('context-manager', {
            title: 'Context Manager',
            icon: '📄',
            render: this.renderContextManagerSection.bind(this),
            onActivate: this.onContextManagerActivate.bind(this)
        });

        // Editor section removed - main editor is handled by EditorPanel in center area

        // Register File Browser section
        this.registerPanelSection('file-browser', {
            title: 'Files',
            icon: '📁',
            render: this.renderFileBrowserSection.bind(this),
            onActivate: this.onFileBrowserActivate.bind(this)
        });

        this.renderPanelSectionTabs();
    }

    registerPanelSection(id, config) {
        this.panelSections.set(id, config);
        this.log(`Registered panel section: ${id}`);
    }

    renderPanelSectionTabs() {
        if (!this.panelSectionsList) return;

        this.panelSectionsList.innerHTML = Array.from(this.panelSections.entries())
            .map(([id, config]) => `
                <button class="panel-section-tab" data-section="${id}">
                    <span class="section-icon">${config.icon}</span>
                    <span class="section-title">${config.title}</span>
                </button>
            `).join('') + `
                <button class="panel-section-tab panel-close-btn" data-action="close" style="margin-left: auto;">
                    <span class="section-icon">✕</span>
                </button>
            `;
    }

    attachEventListeners() {
        // Panel section tab clicks
        if (this.panelSectionsList) {
            this.panelSectionsList.addEventListener('click', (e) => {
                const tab = e.target.closest('.panel-section-tab');
                if (tab) {
                    const action = tab.dataset.action;
                    const sectionId = tab.dataset.section;
                    
                    if (action === 'close') {
                        this.hideSidebar();
                    } else if (sectionId) {
                        this.activatePanelSection(sectionId);
                    }
                }
            });
        }

        // Panel resize handles are disabled for now
        // this.setupPanelResizing();
    }

    setupPanelResizing() {
        const sidebarResizer = document.createElement('div');
        sidebarResizer.className = 'panel-resize-handle';
        this.sidebarContainer.appendChild(sidebarResizer);
        this.addResizerListener(sidebarResizer, this.sidebarContainer, 'sidebar');

        // Add resizer between editor and preview
        const editorPreviewResizer = document.createElement('div');
        editorPreviewResizer.className = 'panel-resize-handle';
        this.editorContainer.appendChild(editorPreviewResizer);
        this.addResizerListener(editorPreviewResizer, this.editorContainer, 'editor');
    }

    addResizerListener(resizerElement, panelElement, panelName) {
        resizerElement.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.body.classList.add('resizing');
            
            const mousemove = (e) => {
                if (panelName === 'sidebar') {
                    const containerRect = this.sidebarContainer.parentElement.getBoundingClientRect();
                    const newWidth = Math.max(250, Math.min(500, e.clientX - containerRect.left));
                    dispatch({
                        type: ActionTypes.WORKSPACE_SET_PANEL_WIDTH,
                        payload: { panel: 'sidebar', width: newWidth }
                    });
                } else if (panelName === 'editor') {
                    // Calculate based on the main-panels container width
                    const mainPanelsRect = this.editorContainer.parentElement.getBoundingClientRect();
                    const sidebarWidth = this.isSidebarVisible ? this.sidebarContainer.offsetWidth : 0;
                    const availableWidth = mainPanelsRect.width - sidebarWidth;
                    const editorWidth = Math.max(300, e.clientX - mainPanelsRect.left - sidebarWidth);
                    const editorWidthPercent = Math.max(20, Math.min(80, (editorWidth / availableWidth) * 100));
                    
                    dispatch({
                        type: ActionTypes.WORKSPACE_SET_PANEL_WIDTH,
                        payload: { panel: 'editor', width: editorWidthPercent }
                    });
                    dispatch({
                        type: ActionTypes.WORKSPACE_SET_PANEL_WIDTH,
                        payload: { panel: 'preview', width: 100 - editorWidthPercent }
                    });
                }
            }

            const mouseup = () => {
                document.body.classList.remove('resizing');
                document.removeEventListener('mousemove', mousemove);
                document.removeEventListener('mouseup', mouseup);
            }

            document.addEventListener('mousemove', mousemove);
            document.addEventListener('mouseup', mouseup);
        });
    }

    // Panel visibility methods
    showSidebar() {
        dispatch({ type: ActionTypes.WORKSPACE_SET_PANEL_VISIBILITY, payload: { panel: 'sidebar', visible: true } });
    }

    hideSidebar() {
        dispatch({ type: ActionTypes.WORKSPACE_SET_PANEL_VISIBILITY, payload: { panel: 'sidebar', visible: false } });
    }

    toggleSidebar() {
        const isVisible = this.isSidebarVisible;
        dispatch({ type: ActionTypes.WORKSPACE_SET_PANEL_VISIBILITY, payload: { panel: 'sidebar', visible: !isVisible } });
    }

    showEditor() {
        if (this.editorContainer) {
            this.editorContainer.classList.remove('hidden');
        }
        this.isEditorVisible = true;
        this.log('Editor shown');
    }

    hideEditor() {
        if (this.editorContainer) {
            this.editorContainer.classList.add('hidden');
        }
        this.isEditorVisible = false;
        this.log('Editor hidden');
    }

    toggleEditor() {
        if (this.isEditorVisible) {
            this.hideEditor();
        } else {
            this.showEditor();
        }
    }

    showLog() {
        if (this.logContainer) {
            this.logContainer.classList.remove('hidden');
            this.log('Log container shown');
        }
    }

    hideLog() {
        if (this.logContainer) {
            this.logContainer.classList.add('hidden');
            this.log('Log container hidden');
        }
    }

    toggleLog() {
        if (this.logContainer) {
            this.logContainer.classList.toggle('hidden');
            const isVisible = !this.logContainer.classList.contains('hidden');
            this.log(`Log container ${isVisible ? 'shown' : 'hidden'}`);
        }
    }

    // Panel section management
    activatePanelSection(sectionId) {
        const section = this.panelSections.get(sectionId);
        if (!section) {
            this.log(`Panel section not found: ${sectionId}`, 'error');
            return;
        }

        // Update tab states
        this.panelSectionsList.querySelectorAll('.panel-section-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.section === sectionId);
        });

        // Render section content into the left panel
        if (section.render && this.panelContent) {
            this.panelContent.innerHTML = section.render();
        }

        // Attach events and load data for the new content
        switch(sectionId) {
            case 'context-manager':
                this.attachContextManagerEvents();
                this.loadContextData();
                break;
            case 'file-browser':
                this.attachFileBrowserEvents();
                this.loadFileTree();
                break;
        }

        // Call section activation handler
        if (section.onActivate) {
            section.onActivate();
        }

        this.currentPanelSection = sectionId;
        if (!this.isSidebarVisible) {
            this.showSidebar();
        }
        this.log(`Activated panel section: ${sectionId}`);
    }

    // Section render methods
    renderContextManagerSection() {
        return `
            <div class="context-manager-section">
                <div class="current-context-section">
                    <h3>Current Context</h3>
                    <div class="context-input-group">
                        <input type="text" id="current-context-input" placeholder="No context selected" class="context-input">
                        <button id="set-context-btn" class="editor-action-btn primary">Set</button>
                    </div>
                </div>
                <div class="contexts-list-section">
                    <div class="section-header">
                        <h3>Available Contexts</h3>
                        <button id="create-context-btn" class="editor-action-btn">+ New</button>
                    </div>
                    <div id="contexts-list" class="contexts-list">
                        <!-- Contexts will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    // renderEditorSection removed - editor functionality moved to main EditorPanel

    renderFileBrowserSection() {
        return `
            <div class="file-browser-section">
                <div class="file-browser-header">
                    <h3>File Browser</h3>
                    <button id="refresh-files-btn" class="editor-action-btn">↻</button>
                </div>
                <div id="file-tree" class="file-tree">
                    <!-- File tree will be populated here -->
                </div>
            </div>
        `;
    }

    // Event handlers
    attachContextManagerEvents() {
        const setContextBtn = document.getElementById('set-context-btn');
        const createContextBtn = document.getElementById('create-context-btn');
        const contextInput = document.getElementById('current-context-input');

        if (setContextBtn) {
            setContextBtn.addEventListener('click', () => this.setCurrentContext());
        }

        if (createContextBtn) {
            createContextBtn.addEventListener('click', () => this.createNewContext());
        }

        if (contextInput) {
            contextInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.setCurrentContext();
            });
        }
    }

    // attachEditorEvents removed - editor events handled by main EditorPanel

    attachFileBrowserEvents() {
        const refreshBtn = document.getElementById('refresh-files-btn');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadFileTree());
        }
    }

    // Section activation handlers
    onContextManagerActivate() {
        this.currentMode = 'manage';
        this.log('Activated Context Manager mode');
    }

    // onEditorActivate removed - editor handled by main EditorPanel

    onFileBrowserActivate() {
        this.currentMode = 'browse';
        this.log('Activated File Browser mode');
    }

    // Context Manager methods
    async loadContextData() {
        try {
            const response = await fetch('/api/publish/context/list');
            const result = await response.json();
            const contexts = result.success ? result.contexts : [];
            this.renderContextsList(contexts);
            
            // Load current context
            const settingsState = appStore.getState().settings;
            const currentContext = settingsState?.currentContext || '';
            const contextInput = document.getElementById('current-context-input');
            if (contextInput) {
                contextInput.value = currentContext;
            }
        } catch (error) {
            this.log(`Failed to load context data: ${error.message}`, 'error');
        }
    }

    renderContextsList(contexts) {
        const contextsList = document.getElementById('contexts-list');
        if (!contextsList) return;

        if (contexts.length === 0) {
            contextsList.innerHTML = '<div class="empty-state">No contexts found</div>';
            return;
        }

        contextsList.innerHTML = contexts.map(context => `
            <div class="context-item" data-context="${context.name}">
                <div class="context-info">
                    <div class="context-name">${context.name}</div>
                    <div class="context-stats">${context.fileCount} files</div>
                </div>
                <div class="context-actions">
                    <button class="context-action-btn select-btn" data-action="select">Select</button>
                    <button class="context-action-btn delete-btn" data-action="delete">Delete</button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        contextsList.addEventListener('click', (e) => this.handleContextAction(e));
    }

    async setCurrentContext() {
        const contextInput = document.getElementById('current-context-input');
        if (!contextInput) return;

        const contextName = contextInput.value.trim();
        if (!contextName) return;

        dispatch({
            type: ActionTypes.SETTINGS_SET_CURRENT_CONTEXT,
            payload: contextName
        });

        this.log(`Set current context: ${contextName}`);
        await this.loadContextData(); // Refresh
    }

    createNewContext() {
        const contextName = prompt('Enter new context name:');
        if (!contextName) return;
        
        if (!/^[a-zA-Z0-9_-]+$/.test(contextName)) {
            alert('Context name must only contain letters, numbers, underscores, and hyphens');
            return;
        }

        const contextInput = document.getElementById('current-context-input');
        if (contextInput) {
            contextInput.value = contextName;
            this.setCurrentContext();
        }
    }

    handleContextAction(e) {
        const actionBtn = e.target.closest('.context-action-btn');
        if (!actionBtn) return;

        const action = actionBtn.dataset.action;
        const contextItem = actionBtn.closest('.context-item');
        const contextName = contextItem?.dataset.context;

        if (!contextName) return;

        switch (action) {
            case 'select':
                this.selectContext(contextName);
                break;
            case 'delete':
                this.deleteContext(contextName);
                break;
        }
    }

    selectContext(contextName) {
        dispatch({
            type: ActionTypes.SETTINGS_SET_CURRENT_CONTEXT,
            payload: contextName
        });
        this.loadContextData(); // Refresh
    }

    async deleteContext(contextName) {
        if (!confirm(`Delete context "${contextName}"?`)) return;

        try {
            const response = await fetch(`/api/publish/context/${contextName}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await this.loadContextData(); // Refresh
                this.log(`Deleted context: ${contextName}`);
            }
        } catch (error) {
            this.log(`Error deleting context: ${error.message}`, 'error');
        }
    }

    // Editor methods
    saveFile() {
        this.log('Save file requested');
        // Implement save functionality
    }

    publishFile() {
        this.log('Publish file requested');
        // Implement publish functionality
    }

    addToContext() {
        this.log('Add to context requested');
        // Implement add to context functionality
    }

    // File browser methods
    loadFileTree() {
        const fileTree = document.getElementById('file-tree');
        if (!fileTree) return;

        // Placeholder file tree
        fileTree.innerHTML = `
            <div class="file-item folder">
                <span class="file-icon">📁</span>
                <span class="file-name">notepads</span>
            </div>
            <div class="file-item file">
                <span class="file-icon">📝</span>
                <span class="file-name">example.md</span>
            </div>
        `;
    }

    // Public API methods
    openPanelSections() {
        this.showSidebar();
        // Default to context manager
        this.activatePanelSection('context-manager');
    }

    // openEditor removed - main editor is handled by EditorPanel in center area

    getCurrentMode() {
        return this.currentMode;
    }

    getCurrentPanelSection() {
        return this.currentPanelSection;
    }

    // Debug methods
    debugPanelVisibility() {
        this.log(`Sidebar visible: ${this.isSidebarVisible}`, 'debug');
        this.log(`Editor visible: ${this.isEditorVisible}`, 'debug');
        this.log(`Log visible: ${this.logContainer ? !this.logContainer.classList.contains('hidden') : 'N/A'}`, 'debug');
    }

    // Initialize center panel content if needed
    ensureCenterPanelContent() {
        // This method may need to be re-evaluated based on the new layout.
        // For now, we ensure the editor container exists.
        if (!this.editorContainer) {
            this.log('Editor container not found!', 'warn');
        }
    }

    applyInitialState() {
        const state = appStore.getState().workspace;
        if (state) {
            this.handleStateChange(state);
        }
    }

    handleStateChange(workspaceState) {
        if (!workspaceState) return;

        // Handle sidebar visibility - directly manipulate DOM, don't dispatch
        if (this.isSidebarVisible !== workspaceState.sidebar.visible) {
            if (workspaceState.sidebar.visible) {
                if (this.sidebarContainer) {
                    this.sidebarContainer.classList.remove('hidden');
                }
                this.isSidebarVisible = true;
                this.log('Sidebar shown');
            } else {
                if (this.sidebarContainer) {
                    this.sidebarContainer.classList.add('hidden');
                }
                this.isSidebarVisible = false;
                this.log('Sidebar hidden');
            }
        }

        // Handle editor visibility - these methods are already DOM-only
        if (this.isEditorVisible !== workspaceState.editor.visible) {
            if (workspaceState.editor.visible) {
                this.showEditor();
            } else {
                this.hideEditor();
            }
        }
        
        // Handle active panel section - only if it's valid
        if (workspaceState.sidebar.activeSection && 
            this.currentPanelSection !== workspaceState.sidebar.activeSection) {
            this.activatePanelSection(workspaceState.sidebar.activeSection);
        }
    }

    setupStoreSubscription() {
        // Subscribe to store updates now that DOM elements are available
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe(); // Clean up any existing subscription
        }
        
        this.storeUnsubscribe = appStore.subscribe((newState, prevState) => {
            const newWorkspace = newState?.workspace;
            const prevWorkspace = prevState?.workspace;
            
            // Only update if workspace state actually changed
            if (JSON.stringify(newWorkspace) !== JSON.stringify(prevWorkspace)) {
                this.log('Workspace state changed, updating panels');
                this.handleStateChange(newWorkspace);
            }
        });
        
        this.log('Store subscription established');
    }

    // Cleanup method
    destroy() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
        
        if (this.previewPanel) {
            this.previewPanel.destroy();
            this.previewPanel = null;
        }
        
        // Editor cleanup now handled by EditorPanel
        
        this.log('WorkspacePanelManager destroyed');
    }
}

// Create and export singleton instance
export const workspacePanelManager = new WorkspacePanelManager();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.workspacePanelManager = workspacePanelManager;
} 