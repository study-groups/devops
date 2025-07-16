/**
 * PanelStateManager - Centralized panel state management
 * Integrates with existing appStore/reducer architecture
 */

import { appStore, ActionTypes } from '/client/appState.js';
import { panelRegistry } from '/client/panels/core/panelRegistry.js';

export class PanelStateManager {
    constructor() {
        this.store = appStore;
        this.unsubscribe = null;
    }

    /**
     * Initialize the state manager
     */
    initialize() {
        // Subscribe to store changes
        this.unsubscribe = this.store.subscribe(this.handleStateChange.bind(this));
    }

    /**
     * Clean up subscriptions
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    /**
     * Register a panel with the state manager
     */
    registerPanel(panelId, config) {
        // Store in registry first
        panelRegistry.register(panelId, config);
        
        // Update centralized state
        this.store.dispatch({
            type: ActionTypes.PANEL_REGISTER,
            payload: { panelId, config }
        });
    }

    /**
     * Unregister a panel
     */
    unregisterPanel(panelId) {
        panelRegistry.unregister(panelId);
        
        this.store.dispatch({
            type: ActionTypes.PANEL_UNREGISTER,
            payload: { panelId }
        });
    }

    /**
     * Get or create a panel instance
     */
    getOrCreateInstance(panelId) {
        const state = this.store.getState();
        const existingInstance = state.panels.instances[panelId];
        
        if (existingInstance) {
            return existingInstance;
        }
        
        // Create new instance
        const panelConfig = state.panels.registry[panelId];
        if (!panelConfig) {
            throw new Error(`Panel ${panelId} not registered`);
        }
        
        let instance;
        if (panelConfig.panelClass) {
            instance = new panelConfig.panelClass();
        } else if (panelConfig.instance) {
            instance = panelConfig.instance;
        } else if (panelConfig.createInstance) {
            instance = panelConfig.createInstance();
        } else {
            throw new Error(`Panel ${panelId} has no way to create instance`);
        }
        
        // Store the instance
        this.store.dispatch({
            type: ActionTypes.PANEL_SET_INSTANCE,
            payload: { panelId, instance }
        });
        
        return instance;
    }

    /**
     * Set panel visibility
     */
    setPanelVisible(panelId, visible) {
        this.store.dispatch({
            type: ActionTypes.PANEL_SET_VISIBLE,
            payload: { panelId, visible }
        });
    }

    /**
     * Set panel collapsed state
     */
    setPanelCollapsed(panelId, collapsed) {
        this.store.dispatch({
            type: ActionTypes.PANEL_SET_COLLAPSED,
            payload: { panelId, collapsed }
        });
    }

    /**
     * Set panel order
     */
    setPanelOrder(panelId, order) {
        this.store.dispatch({
            type: ActionTypes.PANEL_SET_ORDER,
            payload: { panelId, order }
        });
    }

    /**
     * Get panel UI state
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
     * Get all visible panels ordered by priority
     */
    getVisiblePanels() {
        const state = this.store.getState();
        const sidebarPanels = state.panels.sidebarPanels;
        
        return Object.keys(sidebarPanels)
            .filter(panelId => sidebarPanels[panelId].visible)
            .sort((a, b) => sidebarPanels[a].order - sidebarPanels[b].order)
            .map(panelId => ({
                id: panelId,
                config: state.panels.registry[panelId],
                uiState: sidebarPanels[panelId]
            }));
    }

    /**
     * Get panel instance
     */
    getPanelInstance(panelId) {
        const state = this.store.getState();
        return state.panels.instances[panelId];
    }

    /**
     * Clear panel instance (for cleanup)
     */
    clearPanelInstance(panelId) {
        this.store.dispatch({
            type: ActionTypes.PANEL_CLEAR_INSTANCE,
            payload: { panelId }
        });
    }

    /**
     * Force save current state
     */
    saveState() {
        this.store.dispatch({
            type: ActionTypes.PANEL_SAVE_STATE,
            payload: {}
        });
    }

    /**
     * Handle state changes (for subscriptions)
     */
    handleStateChange() {
        // Could emit events here if needed
        // For now, just let components subscribe to store directly
    }
}

// Create global instance
export const panelStateManager = new PanelStateManager(); 