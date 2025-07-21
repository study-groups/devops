/**
 * PanelStateManager - A headless service for interacting with panel state in the Redux store.
 */
import { panelDefinitions } from './panelRegistry.js';
import { appStore } from '/client/appState.js';
import { panelThunks } from '/client/store/slices/panelSlice.js';

class PanelStateService {
    constructor() {
        this.store = appStore;
    }

    /**
     * Get the UI state for a specific panel.
     * @param {string} panelId - The ID of the panel.
     * @returns {object} The UI state of the panel.
     */
    getPanelUIState(panelId) {
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
        const state = this.store.getState();
        return state.panels.instances[panelId];
    }

    /**
     * Toggle the visibility of a panel.
     * @param {string} panelId - The ID of the panel to toggle.
     */
    togglePanelVisibility(panelId) {
        this.store.dispatch(panelThunks.togglePanelVisibility(panelId));
    }
}

export const panelStateService = new PanelStateService(); 