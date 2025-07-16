/**
 * WorkspaceLayoutManager.js
 * Manages the three-panel workspace layout and panel sections
 */

import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { logMessage } from '/client/log/index.js';

export class WorkspaceLayoutManager {
    constructor() {
        this.sidebarContainer = null;
        this.editorContainer = null;
        this.previewContainer = null;
        this.logContainer = null;

        this.isSidebarVisible = false;
        this.isEditorVisible = true; // Start with editor visible
        
        // Store subscription will be set up after initialization
        this.storeUnsubscribe = null;
        
        // PreviewPanel instance
        this.previewPanel = null;
    }

    log(message, level = 'info') {
        logMessage(`[WorkspaceLayoutManager] ${message}`, level, 'WORKSPACE');
    }

    async initialize() {
        this.log('Initializing WorkspaceLayoutManager...');
        
        try {
            // Set up panel element references
            this.setupPanelElements();
            
            // Attach event listeners
            this.attachEventListeners();
            
            // Initialize preview panel
            await this.initializePreviewPanel();
            
            // Set up store subscription
            this.setupStoreSubscription();
            
            // Apply initial state from store
            this.applyInitialState();
            
            this.log('WorkspaceLayoutManager initialization complete');
        } catch (error) {
            this.log(`Failed to initialize: ${error.message}`, 'error');
            console.error('[WorkspaceLayoutManager] Initialization error:', error);
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

        if (!this.sidebarContainer || !this.editorContainer || !this.previewContainer || !this.logContainer) {
            this.log('Required panel elements not found in DOM, will retry...', 'warn');
            // Retry after a short delay
            setTimeout(() => {
                this.setupPanelElements();
                if (this.sidebarContainer && this.editorContainer) {
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

    attachEventListeners() {
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
        
        this.log('WorkspaceLayoutManager destroyed');
    }
}

// Create and export singleton instance
export const workspaceLayoutManager = new WorkspaceLayoutManager();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.workspaceLayoutManager = workspaceLayoutManager;
} 