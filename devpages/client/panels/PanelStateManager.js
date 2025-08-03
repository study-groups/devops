/**
 * PanelStateManager - A headless service for interacting with panel state in the Redux store.
 */
import { panelDefinitions } from './panelRegistry.js';
import { panelThunks } from '/client/store/slices/panelSlice.js';

class PanelStateService {
    constructor() {
        this.store = null;
    }

    /**
     * Initializes the service with the Redux store. This must be called before any other methods.
     * @param {object} store - The Redux store instance.
     */
    initialize(store) {
        if (!store) {
            throw new Error("[PanelStateService] Initialization failed: store is required.");
        }
        this.store = store;
        console.log('[PanelStateService] Initialized with Redux store.');
    }

    /**
     * Get the UI state for a specific panel.
     * @param {string} panelId - The ID of the panel.
     * @returns {object} The UI state of the panel.
     */
    getPanelUIState(panelId) {
        if (!this.store) throw new Error("PanelStateService not initialized.");
        const state = this.store.getState();
        return state.panels.sidebarPanels[panelId] || {
            visible: true,
            collapsed: false,
            order: 99
        };
    }

    /**
     * Get all visible panels, ordered by their priority.
     * @returns {Array<object>} A sorted list of visible panels.
     */
    getVisiblePanels() {
        if (!this.store) throw new Error("PanelStateService not initialized.");
        const state = this.store.getState();
        const sidebarPanels = state.panels.sidebarPanels;

        return panelDefinitions
            .filter(panelDef => {
                const uiState = sidebarPanels[panelDef.id];
                return uiState ? uiState.visible : panelDef.isDefault;
            })
            .sort((a, b) => {
                const orderA = sidebarPanels[a.id]?.order ?? 99;
                const orderB = sidebarPanels[b.id]?.order ?? 99;
                return orderA - orderB;
            })
            .map(panelDef => {
                const defaultState = { visible: panelDef.isDefault, collapsed: false, order: 99 };
                const uiState = sidebarPanels[panelDef.id] || defaultState;
                return {
                    id: panelDef.id,
                    config: panelDef,
                    uiState: uiState
                };
            });
    }

    /**
     * Get the instance of a mounted panel.
     * @param {string} panelId - The ID of the panel.
     * @returns {object|undefined} The panel instance, if it exists.
     */
    getPanelInstance(panelId) {
        if (!this.store) throw new Error("PanelStateService not initialized.");
        const state = this.store.getState();
        return state.panels.instances[panelId];
    }

    /**
     * Register a panel with the panel system.
     * @param {string} panelId - The ID of the panel to register.
     * @param {object} component - The panel component instance.
     */
    registerPanel(panelId, component) {
        if (!this.store) throw new Error("PanelStateService not initialized.");
        this.store.dispatch(panelThunks.registerPanel({ panelId, config: component }));
    }

    /**
     * Toggle the visibility of a panel.
     * @param {string} panelId - The ID of the panel to toggle.
     */
    togglePanelVisibility(panelId) {
        if (!this.store) throw new Error("PanelStateService not initialized.");
        this.store.dispatch(panelThunks.togglePanelVisibility(panelId));
    }
}

export const panelStateService = new PanelStateService();
