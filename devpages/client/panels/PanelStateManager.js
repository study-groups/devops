/**
 * PanelStateManager - Centralized panel state management
 * Integrates with existing appStore/reducer architecture
 */

import { panelRegistry } from '/client/panels/panelRegistry.js';
import { appStore } from '/client/appState.js';

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
     * Register a panel using StateKit thunks
     * @param {string} panelId - Panel ID to register
     * @param {object} config - Panel configuration
     */
    async registerPanel(panelId, config) {
        try {
            console.log(`[PanelStateManager] Registering panel: ${panelId}`);
            
            // Import the StateKit thunk
            const { registerPanel } = await import('/client/store/slices/panelSlice.js');
            
            // Dispatch the thunk with proper parameters
            const result = await this.store.dispatch(registerPanel({ panelId, config }));
            
            if (result.error) {
                throw new Error(`Failed to register panel ${panelId}: ${result.error.message}`);
            }
            
            console.log(`[PanelStateManager] Panel registered successfully: ${panelId}`);
            return result.payload;
            
        } catch (error) {
            console.error(`[PanelStateManager] Error registering panel ${panelId}:`, error);
            throw error;
        }
    }

    /**
     * Unregister a panel using StateKit thunk pattern
     * @param {string} panelId - Panel identifier to unregister
     */
    async unregisterPanel(panelId) {
        try {
            // Import the StateKit thunk
            const { unregisterPanel } = await import('/client/store/slices/panelSlice.js');
            
            // Dispatch the StateKit thunk
            const result = await this.store.dispatch(unregisterPanel(panelId));
            
            if (result.meta.requestStatus === 'fulfilled') {
                console.log(`[PanelStateManager] Successfully unregistered panel: ${panelId}`);
            } else {
                throw new Error(result.error?.message || 'Panel unregistration failed');
            }
        } catch (error) {
            console.error(`[PanelStateManager] Error unregistering panel ${panelId}:`, error);
        }
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
     * Handle state changes (for subscriptions)
     */
    handleStateChange() {
        // Could emit events here if needed
        // For now, just let components subscribe to store directly
    }
}

// Create global instance
export const panelStateManager = new PanelStateManager(); 