/**
 * SimplifiedWorkspaceManager.js - Streamlined workspace management
 * Eliminates dock-zone mapping complexity while keeping useful zone concept
 */

import { appStore } from '/client/appState.js';
import { EditorPanel } from '/client/panels/EditorPanel.js';
import { PreviewPanel } from '/client/panels/PreviewPanel.js';

export class SimplifiedWorkspaceManager {
    constructor() {
        // Core areas: Direct component-to-container mapping (no docks needed)
        this.coreAreas = {
            editor: {
                container: document.getElementById('workspace-editor'),
                component: EditorPanel,
                instance: null,
                id: 'editor-panel'
            },
            preview: {
                container: document.getElementById('workspace-preview'),
                component: PreviewPanel,
                instance: null,
                id: 'preview-panel'
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

        this.loadedPanelInstances = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) {
            console.warn('[SimplifiedWorkspaceManager] Already initialized');
            return;
        }

        console.log('[SimplifiedWorkspaceManager] Initializing...');

        // Validate core containers exist
        this.validateCoreContainers();

        // Initialize core areas first (editor and preview)
        await this.initializeCoreAreas();

        // Subscribe to Redux state changes for dynamic panels
        appStore.subscribe(this.handleStateChange.bind(this));

        // Set initial UI state on DOM elements
        this.handleStateChange();

        // Initialize dynamic panels from Redux state
        this.initializeDynamicPanels();

        this.initialized = true;
        console.log('[SimplifiedWorkspaceManager] ✅ Initialization complete');

        // Expose API
        this.exposeAPI();
    }

    validateCoreContainers() {
        const missing = [];
        Object.entries(this.coreAreas).forEach(([areaName, area]) => {
            if (!area.container) {
                missing.push(`workspace-${areaName}`);
            }
        });

        if (missing.length > 0) {
            console.error('[SimplifiedWorkspaceManager] Missing core containers:', missing);
            throw new Error(`Missing required workspace containers: ${missing.join(', ')}`);
        }
    }

    async initializeCoreAreas() {
        console.log('[SimplifiedWorkspaceManager] Initializing core areas...');

        for (const [areaName, area] of Object.entries(this.coreAreas)) {
            try {
                console.log(`[SimplifiedWorkspaceManager] Creating ${areaName} panel...`);

                // Create panel instance
                const panelInstance = new area.component({
                    id: area.id,
                    store: appStore
                });

                // Render and mount
                const panelElement = panelInstance.render();
                panelElement.id = area.id;
                
                // Clear container and add panel
                area.container.innerHTML = '';
                area.container.appendChild(panelElement);

                // Call onMount if available
                if (typeof panelInstance.onMount === 'function') {
                    panelInstance.onMount(area.container);
                }

                // Force initial content sync for preview panel with proper delay for markdown-it
                if (area.id === 'preview-panel' && typeof panelInstance.syncContent === 'function') {
                    setTimeout(() => {
                        panelInstance.syncContent();
                        console.log(`[SimplifiedWorkspaceManager] Preview content synced with markdown-it`);
                    }, 500); // Longer delay to ensure markdown-it plugins are loaded
                }

                // Store instance
                area.instance = panelInstance;
                this.loadedPanelInstances.set(area.id, panelInstance);

                console.log(`[SimplifiedWorkspaceManager] ✅ ${areaName} panel created and mounted`);

            } catch (error) {
                console.error(`[SimplifiedWorkspaceManager] ❌ Failed to create ${areaName} panel:`, error);
                throw error;
            }
        }
    }

    initializeDynamicPanels() {
        // Handle sidebar panels directly
        console.log('[SimplifiedWorkspaceManager] Initializing dynamic panels...');
        
        // For now, we'll let the bootloader handle other panels through the component system
        // The sidebar panels (file-browser, settings, etc.) will be mounted by the bootloader
        console.log('[SimplifiedWorkspaceManager] Dynamic panels handled by bootloader component system');
    }

    handleStateChange() {
        // Handle Redux state changes for core area visibility and dynamic panels
        const state = appStore.getState();
        const ui = state.ui || {};
        
        // Update editor visibility based on editorVisible state
        const editorContainer = this.coreAreas.editor?.container;
        if (editorContainer) {
            editorContainer.setAttribute('data-editor-visible', String(ui.editorVisible !== false));
        }
        
        // Update preview visibility based on previewVisible state
        const previewContainer = this.coreAreas.preview?.container;
        if (previewContainer) {
            previewContainer.setAttribute('data-preview-visible', String(ui.previewVisible !== false));
        }
        
        // Update right resizer visibility based on preview visibility
        const rightResizer = document.getElementById('resizer-right');
        if (rightResizer) {
            rightResizer.setAttribute('data-preview-visible', String(ui.previewVisible !== false));
        }
    }

    exposeAPI() {
        if (!window.APP) window.APP = {};
        if (!window.APP.workspace) window.APP.workspace = {};

        window.APP.workspace.simplified = {
            manager: this,
            getCoreArea: (areaName) => this.coreAreas[areaName],
            getPanel: (panelId) => this.loadedPanelInstances.get(panelId),
            refresh: () => this.refreshCoreAreas(),
            debug: () => this.debugInfo()
        };

        // Also expose at the main workspace level for compatibility
        if (!window.APP.workspace.registerPanel) {
            window.APP.workspace.registerPanel = this.registerPanel.bind(this);
        }

        console.log('[SimplifiedWorkspaceManager] ✅ API exposed to window.APP.workspace.simplified');
    }

    async refreshCoreAreas() {
        console.log('[SimplifiedWorkspaceManager] Refreshing core areas...');
        
        // Unmount existing instances
        Object.values(this.coreAreas).forEach(area => {
            if (area.instance && typeof area.instance.onUnmount === 'function') {
                area.instance.onUnmount();
            }
            area.instance = null;
        });

        // Clear loaded instances for core areas
        Object.values(this.coreAreas).forEach(area => {
            this.loadedPanelInstances.delete(area.id);
        });

        // Reinitialize
        await this.initializeCoreAreas();
    }

    debugInfo() {
        console.log('=== SIMPLIFIED WORKSPACE DEBUG ===');
        console.log('Core areas:', this.coreAreas);
        console.log('Dynamic zones:', this.dynamicZones);
        console.log('Loaded instances:', this.loadedPanelInstances);
        
        // Check DOM state
        Object.entries(this.coreAreas).forEach(([areaName, area]) => {
            const panelEl = document.getElementById(area.id);
            console.log(`${areaName} panel in DOM:`, panelEl ? 'EXISTS' : 'MISSING');
            
            if (panelEl && area.id === 'editor-panel') {
                const textarea = panelEl.querySelector('.editor-textarea');
                console.log(`  Editor textarea:`, textarea ? 'EXISTS' : 'MISSING');
                if (textarea) {
                    console.log(`  Content length:`, textarea.value.length);
                }
            }
        });
        
        console.log('=== END DEBUG ===');
        return {
            coreAreas: this.coreAreas,
            dynamicZones: this.dynamicZones,
            loadedInstances: this.loadedPanelInstances
        };
    }

    // Compatibility methods for the old WorkspaceManager API
    render() {
        console.log('[SimplifiedWorkspaceManager] Render called (compatibility mode)');
        // Core areas are always rendered, no need to re-render
    }

    async createAndMountPanel(panel, container, semanticZone) {
        console.log(`[SimplifiedWorkspaceManager] createAndMountPanel called for ${panel.id} (compatibility mode)`);
        // This would be used for dynamic panels, but for now we'll just log
        return Promise.resolve();
    }

    registerPanel(panelId, factory) {
        console.log(`[SimplifiedWorkspaceManager] registerPanel called for ${panelId}`);
        
        // Store the panel registration for potential future use
        if (!this.dynamicPanelRegistry) {
            this.dynamicPanelRegistry = new Map();
        }
        
        this.dynamicPanelRegistry.set(panelId, {
            id: panelId,
            factory: factory,
            registered: true
        });
        
        console.log(`[SimplifiedWorkspaceManager] ✅ Panel ${panelId} registered successfully`);
        return true; // Return success for compatibility
    }

    // Add semantic zones property for compatibility
    get semanticZones() {
        return {
            sidebar: this.dynamicZones.sidebar,
            editor: this.coreAreas.editor.container,
            preview: this.coreAreas.preview.container,
            debug: this.dynamicZones.debug,
            logs: this.dynamicZones.logs
        };
    }

    getZoneBySemanticName(zoneName) {
        return this.semanticZones[zoneName] || null;
    }
}

// Create singleton instance
export const simplifiedWorkspaceManager = new SimplifiedWorkspaceManager();
