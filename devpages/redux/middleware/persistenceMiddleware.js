/**
 * Redux Persistence Middleware
 * Automatically saves panel state to localStorage when certain actions are dispatched
 */

import { storageService } from '/client/services/storageService.js';

const PANELS_STORAGE_KEY = 'redux_panels_state';

// Actions that should trigger persistence
const PERSISTENCE_ACTIONS = [
    // Dock actions
    'panels/createDock',
    'panels/updateDockPosition', 
    'panels/updateDockSize',
    'panels/toggleDockCollapse',
    'panels/maximizeDock',
    'panels/bringDockToFront',
    
    // Panel actions
    'panels/createPanel',
    'panels/updatePanelPosition',
    'panels/updatePanelSize',
    'panels/togglePanelVisibility',
    'panels/activatePanel',
    'panels/updatePanelConfig',
    'panels/togglePanelFlyout',
    'panels/updatePanelLayout',
    
    // Drag operations
    'panels/updateDragPosition',
    'panels/endDrag',
    
    // Settings changes
    'panels/updateSettings',
    
    // Shortcuts
    'panels/registerShortcut',
    'panels/unregisterShortcut'
];

/**
 * Persistence middleware that automatically saves panel state to localStorage
 */
export const persistenceMiddleware = (store) => (next) => (action) => {
    // Let the action pass through first
    const result = next(action);
    
    // Check if this action should trigger persistence
    if (PERSISTENCE_ACTIONS.includes(action.type)) {
        try {
            const state = store.getState();
            if (state.panels) {
                // Only persist the essential state
                const stateToPersist = {
                    docks: state.panels.docks,
                    panels: state.panels.panels,
                    settings: state.panels.settings,
                    shortcuts: state.panels.shortcuts
                };
                
                storageService.setItem(PANELS_STORAGE_KEY, stateToPersist);
                console.log(`[PersistenceMiddleware] Saved state after action: ${action.type}`);
            }
        } catch (error) {
            console.warn(`[PersistenceMiddleware] Failed to persist state after ${action.type}:`, error);
        }
    }
    
    return result;
}; 