/**
 * Redux Persistence Middleware
 * Automatically saves panel state to localStorage when certain actions are dispatched
 */

import { storageService } from '/services/storageService.js';

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
    'panels/unregisterShortcut',
    
    // Debug panel actions
    'debugPanel/toggleVisibility',
    'debugPanel/setPosition',
    'debugPanel/setSize',
    'debugPanel/setActivePanel',
    'debugPanel/toggleSection',
    'debugPanel/togglePanelExpanded',
    'debugPanel/setPanelExpanded',
    'debugPanel/reorderPanels',
    'debugPanel/updateDockPosition',
    'debugPanel/updateDockSize'
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
            
            // Handle panels state persistence
            if (state.panels && action.type.startsWith('panels/')) {
                const stateToPersist = {
                    docks: state.panels.docks,
                    panels: state.panels.panels,
                    settings: state.panels.settings,
                    shortcuts: state.panels.shortcuts
                };
                
                storageService.setItem(PANELS_STORAGE_KEY, stateToPersist);
                console.log(`[PersistenceMiddleware] Saved panels state after action: ${action.type}`);
            }
            
            // Handle debug panel state persistence
            if (state.debugPanel && action.type.startsWith('debugPanel/')) {
                const DEBUG_PANEL_STORAGE_KEY = 'debug_panel_state';
                const debugStateToPersist = {
                    visible: state.debugPanel.visible,
                    position: state.debugPanel.position,
                    size: state.debugPanel.size,
                    panels: state.debugPanel.panels,
                    activePanel: state.debugPanel.activePanel,
                    collapsedSections: state.debugPanel.collapsedSections
                };
                
                storageService.setItem(DEBUG_PANEL_STORAGE_KEY, debugStateToPersist);
                console.log(`[PersistenceMiddleware] Saved debug panel state after action: ${action.type}`);
            }
        } catch (error) {
            console.warn(`[PersistenceMiddleware] Failed to persist state after ${action.type}:`, error);
        }
    }
    
    return result;
}; 