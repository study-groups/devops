/**
 * WorkspaceManager.js - Streamlined workspace management
 * Eliminates dock-zone mapping complexity while keeping useful zone concept
 */

import { appStore } from '/client/appState.js';
import { EditorView } from '/client/views/EditorView.js';
import { PreviewView } from '/client/views/PreviewView.js';
import { Sidebar } from '/client/layout/Sidebar.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';

export class WorkspaceManager {
    constructor() {
        // Core views: Direct view-to-container mapping (standalone workspace areas)
        this.coreViews = {
            editor: {
                container: document.getElementById('workspace-editor'),
                component: EditorView,
                instance: null,
                id: 'editor-view'
            },
            preview: {
                container: document.getElementById('workspace-preview'),
                component: PreviewView,
                instance: null,
                id: 'preview-view'
            }
        };

        // Dynamic zones: Support multiple panels with dock system (keep existing)
        this.dynamicZones = {
            sidebar: document.getElementById('workspace-sidebar'),
            debug: document.getElementById('workspace-sidebar'), // For now, debug uses sidebar
            logs: document.getElementById('workspace-sidebar')   // For now, logs use sidebar
        };

        // Add methods that the old WorkspaceManager had for compatibility
        this.render = this.render.bind(this);
        this.createAndMountPanel = this.createAndMountPanel.bind(this);
        this.registerPanel = this.registerPanel.bind(this);

        this.loadedPanelInstances = new Map(); // For backward compatibility
        this.loadedViewInstances = new Map(); // For core views
        this.debugDock = null; // Reference to DebugDock for debug panel management
        this.initialized = false;
        this.sidebar = new Sidebar();

        // Debounce tracking for panel toggle
        this._lastPanelToggleTime = 0;
        this._PANEL_TOGGLE_DEBOUNCE_INTERVAL = 300; // ms
    }

    async initialize() {
        if (this.initialized) {
            console.warn('[WorkspaceManager] Already initialized');
            return;
        }

        console.log('[WorkspaceManager] Initializing...');

        // Validate core containers exist
        this.validateCoreContainers();

        // Get the debugDock instance
        this.debugDock = window.APP.services.debugDock;

        // Get all panel definitions
        const allPanels = panelRegistry.getAllPanels();
        
        // Separate debug panels from core panels
        const debugPanels = allPanels.filter(p => p.group === 'debug');
        const corePanels = allPanels.filter(p => p.group !== 'debug');

        // Initialize the debug dock with its panels
        if (this.debugDock) {
            this.debugDock.initialize(debugPanels);
            console.log(`[WorkspaceManager] DebugDock initialized with ${debugPanels.length} panels.`);
        }

        // Initialize core views first (editor and preview)
        await this.initializeCoreViews();

        // Subscribe to Redux state changes for dynamic panels
        appStore.subscribe(this.handleStateChange.bind(this));

        // Set initial UI state on DOM elements
        this.handleStateChange();

        // Initialize sidebar with core panels
        await this.initializeSidebar(corePanels);

        this.initialized = true;
        console.log('[WorkspaceManager] ✅ Initialization complete');

        // Expose API
        this.exposeAPI(); // Temporarily disabled to debug
    }

    validateCoreContainers() {
        const missing = [];
        Object.entries(this.coreViews).forEach(([viewName, view]) => {
            if (!view.container) {
                missing.push(`workspace-${viewName}`);
            }
        });

        if (missing.length > 0) {
            console.warn('[WorkspaceManager] Missing core containers, creating them:', missing);
            this.createWorkspaceLayout();
            
            // Re-initialize container references after creation
            this.coreViews.editor.container = document.getElementById('workspace-editor');
            this.coreViews.preview.container = document.getElementById('workspace-preview');
            this.dynamicZones.sidebar = document.getElementById('workspace-sidebar');
            
            // Verify they were created successfully
            const stillMissing = [];
            Object.entries(this.coreViews).forEach(([viewName, view]) => {
                if (!view.container) {
                    stillMissing.push(`workspace-${viewName}`);
                }
            });
            
            if (stillMissing.length > 0) {
                throw new Error(`Failed to create required workspace containers: ${stillMissing.join(', ')}`);
            }
        }
    }

    createWorkspaceLayout() {
        console.log('[WorkspaceManager] Creating workspace layout...');
        
        const app = document.getElementById('app');
        if (!app) {
            throw new Error('App container not found');
        }
        
        // Create the main workspace structure
        app.innerHTML = `
            <div class="workspace-container">
                <div id="workspace-sidebar" class="workspace-sidebar"></div>
                <div class="workspace-resizer vertical" id="resizer-left"></div>
                <div id="workspace-editor" class="workspace-editor"></div>
                <div class="workspace-resizer vertical" id="resizer-right"></div>
                <div id="workspace-preview" class="workspace-preview"></div>
            </div>
            <div id="log-container" class="log-container"></div>
        `;
        
        console.log('[WorkspaceManager] ✅ Workspace layout created');
    }

    async initializeCoreViews() {
        console.log('[WorkspaceManager] Initializing core views...');

        for (const [viewName, view] of Object.entries(this.coreViews)) {
            try {
                console.log(`[WorkspaceManager] Creating ${viewName} view...`);

                // Create view instance
                const viewInstance = new view.component({
                    id: view.id,
                    store: appStore
                });

                // Mount view to container
                viewInstance.mount(view.container);

                // Force initial content sync for preview view with proper delay for markdown-it
                if (view.id === 'preview-view' && typeof viewInstance.syncContent === 'function') {
                    setTimeout(() => {
                        viewInstance.syncContent();
                        console.log(`[WorkspaceManager] Preview content synced with markdown-it`);
                    }, 500); // Longer delay to ensure markdown-it plugins are loaded
                }

                // Store instance
                view.instance = viewInstance;
                this.loadedViewInstances.set(view.id, viewInstance);

                console.log(`[WorkspaceManager] ✅ ${viewName} view created and mounted`);

            } catch (error) {
                console.error(`[WorkspaceManager] ❌ Failed to create ${viewName} view:`, error);
                throw error;
            }
        }
    }

    async initializeSidebar(corePanels) {
        const sidebarContainer = this.dynamicZones.sidebar;
        if (sidebarContainer) {
            await this.sidebar.initialize(sidebarContainer, corePanels);
            console.log('[WorkspaceManager] Sidebar initialized with Redux-managed panels.');
        } else {
            console.error('[WorkspaceManager] Sidebar container not found.');
        }
    }

    handleStateChange() {
        // Handle Redux state changes for core area visibility and dynamic panels
        const state = appStore.getState();
        const ui = state.ui || {};
        
        // Update editor visibility based on editorVisible state
        const editorContainer = this.coreViews.editor?.container;
        if (editorContainer) {
            editorContainer.setAttribute('data-editor-visible', String(ui.editorVisible !== false));
        }
        
        // Update preview visibility based on previewVisible state
        const previewContainer = this.coreViews.preview?.container;
        if (previewContainer) {
            previewContainer.setAttribute('data-preview-visible', String(ui.previewVisible !== false));
        }
        
        // Update right resizer visibility based on preview visibility
        const rightResizer = document.getElementById('resizer-right');
        if (rightResizer) {
            rightResizer.setAttribute('data-preview-visible', String(ui.previewVisible !== false));
        }
    }

    togglePanelVisibility(panelId) {
        console.log(`[WorkspaceManager] Attempting to toggle panel: ${panelId}`);
        
        // Prevent rapid multiple toggles
        const currentTime = Date.now();
        if (currentTime - this._lastPanelToggleTime < this._PANEL_TOGGLE_DEBOUNCE_INTERVAL) {
            console.log(`[WorkspaceManager] Toggle for panel ${panelId} prevented due to rapid calls`);
            return;
        }
        this._lastPanelToggleTime = currentTime;
        
        // Special handling for debug panel
        if (panelId === 'debug-panel' && window.APP?.debugDock) {
            console.log('[WorkspaceManager] Toggling debug dock');
            window.APP.debugDock.toggle();
            return;
        }

        // Fallback to sidebar panel toggle
        if (this.sidebar && typeof this.sidebar.togglePanel === 'function') {
            console.log(`[WorkspaceManager] Delegating panel toggle to sidebar: ${panelId}`);
            this.sidebar.togglePanel(panelId);
            return;
        }

        console.warn(`[WorkspaceManager] Unable to toggle panel: ${panelId}`);
    }

    exposeAPI() {
        if (!window.APP) {
            window.APP = {};
        }

        const workspaceAPI = {
            simplified: {
                manager: this,
                getCoreView: (viewName) => this.coreViews[viewName],
                getView: (viewId) => this.loadedViewInstances.get(viewId),
                getPanel: (panelId) => this.loadedPanelInstances.get(panelId),
                refresh: () => this.refreshCoreViews(),
                debug: () => this.debugInfo()
            },
            registerPanel: this.registerPanel.bind(this),
        };

        window.APP.workspace = workspaceAPI;
        console.log('[WorkspaceManager] API exposed to window.APP.workspace');
    }

    async refreshCoreViews() {
        console.log('[WorkspaceManager] Refreshing core views...');
        
        // Unmount existing instances
        Object.values(this.coreViews).forEach(view => {
            if (view.instance && typeof view.instance.unmount === 'function') {
                view.instance.unmount();
            }
            view.instance = null;
        });

        // Clear loaded instances for core views
        Object.values(this.coreViews).forEach(view => {
            this.loadedViewInstances.delete(view.id);
        });

        // Reinitialize
        await this.initializeCoreViews();
    }

    debugInfo() {
        console.log('=== SIMPLIFIED WORKSPACE DEBUG ===');
        console.log('Core views:', this.coreViews);
        console.log('Dynamic zones:', this.dynamicZones);
        console.log('Loaded view instances:', this.loadedViewInstances);
        console.log('Loaded panel instances:', this.loadedPanelInstances);
        
        // Check DOM state
        Object.entries(this.coreViews).forEach(([viewName, view]) => {
            const viewEl = document.getElementById(view.id);
            console.log(`${viewName} view in DOM:`, viewEl ? 'EXISTS' : 'MISSING');
            
            if (viewEl && view.id === 'editor-view') {
                const textarea = viewEl.querySelector('.editor-textarea');
                console.log(`  Editor textarea:`, textarea ? 'EXISTS' : 'MISSING');
                if (textarea) {
                    console.log(`  Content length:`, textarea.value.length);
                }
            }
        });
        
        console.log('=== PANEL DEBUGGING ===');
        console.log('Dynamic Panel Registry:', this.dynamicPanelRegistry);
        console.log('Registered Panels:', Array.from(this.dynamicPanelRegistry?.keys() || []));
        
        console.log('=== END DEBUG ===');
        return {
            coreViews: this.coreViews,
            dynamicZones: this.dynamicZones,
            loadedViewInstances: this.loadedViewInstances,
            loadedPanelInstances: this.loadedPanelInstances,
            dynamicPanelRegistry: this.dynamicPanelRegistry
        };
    }

    // Add a method to explicitly toggle a panel
    togglePanel(panelId) {
        console.log(`[WorkspaceManager] Attempting to toggle panel: ${panelId}`);
        
        // First, check the dynamic panel registry
        if (this.dynamicPanelRegistry && this.dynamicPanelRegistry.has(panelId)) {
            console.log(`[WorkspaceManager] Found panel in dynamic registry: ${panelId}`);
            const panelEntry = this.dynamicPanelRegistry.get(panelId);
            
            // If we have a factory, try to create/mount the panel
            if (panelEntry.factory) {
                panelEntry.factory().then(PanelClass => {
                    const panel = new PanelClass();
                    panel.toggle(); // Assuming panels have a toggle method
                });
                return true;
            }
        }
        
        // Fallback: dispatch Redux action to toggle panel visibility
        const { store } = window.APP.services;
        if (store) {
            store.dispatch({
                type: 'panels/togglePanelVisibility',
                payload: { panelId }
            });
            return true;
        }
        
        console.warn(`[WorkspaceManager] Could not toggle panel: ${panelId}`);
        return false;
    }

    // Compatibility methods for the old WorkspaceManager API
    render() {
        console.log('[WorkspaceManager] Render called (compatibility mode)');
        // Core areas are always rendered, no need to re-render
    }

    async createAndMountPanel(panel, container, semanticZone) {
        console.log(`[WorkspaceManager] createAndMountPanel called for ${panel.id} (compatibility mode)`);
        // This would be used for dynamic panels, but for now we'll just log
        return Promise.resolve();
    }

    registerPanel(panelId, factory) {
        console.log(`[WorkspaceManager] registerPanel called for ${panelId}`);
        
        // Store the panel registration for potential future use
        if (!this.dynamicPanelRegistry) {
            this.dynamicPanelRegistry = new Map();
        }
        
        this.dynamicPanelRegistry.set(panelId, {
            id: panelId,
            factory: factory,
            registered: true
        });
        
        console.log(`[WorkspaceManager] ✅ Panel ${panelId} registered successfully`);
        return true; // Return success for compatibility
    }

    // Add semantic zones property for compatibility
    get semanticZones() {
        return {
            sidebar: this.dynamicZones.sidebar,
            editor: this.coreViews.editor.container,
            preview: this.coreViews.preview.container,
            debug: this.dynamicZones.debug,
            logs: this.dynamicZones.logs
        };
    }

    getZoneBySemanticName(zoneName) {
        return this.semanticZones[zoneName] || null;
    }
}

// Create singleton instance
export const workspaceManager = new WorkspaceManager();
