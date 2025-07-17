/**
 * WorkspaceLayoutManager.js
 * Manages the three-panel workspace layout and panel sections
 */

import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { logMessage } from '/client/log/index.js';
import { PreviewPanel } from '/client/panels/PreviewPanel.js';

export class WorkspaceLayoutManager {
    constructor() {
        this.sidebarContainer = null;
        this.editorContainer = null;
        this.previewContainer = null;
        this.logContainer = null;

        this.isSidebarVisible = false;
        this.isEditorVisible = true;
        
        this.storeUnsubscribe = null;
        this.previewPanel = null;
    }

    log(message, level = 'info') {
        logMessage(`[WorkspaceLayoutManager] ${message}`, level, 'WORKSPACE');
    }

    async initialize() {
        this.log('Initializing WorkspaceLayoutManager...');
        
        try {
            this.setupPanelElements();
            this.attachEventListeners();
            this.initializePreviewPanel();
            this.setupStoreSubscription();
            this.applyInitialState();
            
            this.log('WorkspaceLayoutManager initialization complete');
        } catch (error) {
            this.log(`Failed to initialize: ${error.message}`, 'error');
            console.error('[WorkspaceLayoutManager] Initialization error:', error);
        }
    }

    initializePreviewPanel() {
        if (this.previewPanel) {
            return;
        }
        this.previewPanel = new PreviewPanel();
        this.previewPanel.mount(this.previewContainer);
        this.log('New PreviewPanel initialized and mounted.');
    }

    setupPanelElements() {
        this.sidebarContainer = document.getElementById('sidebar-container');
        this.editorContainer = document.getElementById('editor-container');
        this.previewContainer = document.getElementById('preview-container');
        this.logContainer = document.getElementById('log-container');

        if (!this.sidebarContainer || !this.editorContainer || !this.previewContainer) {
            this.log('Required panel elements not found in DOM, will retry...', 'warn');
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
        
        this.isSidebarVisible = !this.sidebarContainer.classList.contains('hidden');
        this.isEditorVisible = !this.editorContainer.classList.contains('hidden');
        
        this.applyInitialState();
        setTimeout(() => this.ensureCenterPanelContent(), 100);
    }

    attachEventListeners() {
        // Panel resize handles are disabled for now
    }

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

    debugPanelVisibility() {
        console.table({
            'Sidebar visible': this.isSidebarVisible,
            'Editor visible': this.isEditorVisible,
        });
    }

    ensureCenterPanelContent() {
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
        if (!workspaceState || !this.sidebarContainer) {
            return;
        }

        const sidebarVisible = workspaceState.sidebar?.visible ?? true;
        if (this.isSidebarVisible !== sidebarVisible) {
            this.sidebarContainer.classList.toggle('hidden', !sidebarVisible);
            this.isSidebarVisible = sidebarVisible;
            this.log(`Sidebar visibility updated to: ${sidebarVisible}`);
        }

        const sidebarWidth = workspaceState.sidebar?.width;
        if (sidebarWidth) {
            this.sidebarContainer.style.width = `${sidebarWidth}px`;
        }
    }

    setupStoreSubscription() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        
        this.storeUnsubscribe = appStore.subscribe((newState, oldState) => {
            if (newState.workspace !== oldState.workspace) {
                this.handleStateChange(newState.workspace);
            }
        });
        
        this.log('Store subscription established');
    }

    destroy() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
        
        if (this.previewPanel) {
            this.previewPanel.destroy();
            this.previewPanel = null;
        }
        
        this.log('WorkspaceLayoutManager destroyed');
    }
} 