/**
 * Panels Reducer - Manages all panel state
 * Integrates with existing appState/reducer architecture
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';

const PANELS_STATE_KEY = 'devpages_panels_state';

/**
 * Save panels state to localStorage
 */
function savePanelsState(panels) {
    try {
        const { instances, registry, ...persistableState } = panels;
        localStorage.setItem(PANELS_STATE_KEY, JSON.stringify(persistableState));
    } catch (e) {
        console.error('[PanelsReducer] Error saving panels state:', e);
    }
}

export function panelsReducer(state, action) {
    if (!state) {
        return {
            editor: { visible: true, width: 50 },
            preview: { visible: true, width: 50 },
            sidebar: { visible: true, width: 280 },
            log: { visible: true, height: 200 },
            sidebarPanels: {},
            instances: {},
            registry: {},
        };
    }

    // Ensure sidebarPanels exists
    if (!state.sidebarPanels) {
        state = {
            ...state,
            sidebarPanels: {}
        };
    }

    // Safety check for action structure - handle malformed actions
    if (!action) {
        console.error('[PanelsReducer] No action received');
        return state;
    }

    // Handle actions that are just arrays or don't have a type
    if (Array.isArray(action) || !action.type) {
        console.error('[PanelsReducer] Invalid action received - missing type property:', action);
        return state;
    }

    // Debug logging for problematic actions
    if (action.type === 'PANEL_REGISTER') {
        console.log(`[PanelsReducer] PANEL_REGISTER action:`, action);
    }

    switch (action.type) {
        case ActionTypes.PANEL_REGISTER: {
            const { panelId, config } = action.payload || {};
            
            // Safety checks
            if (!panelId) {
                console.error(`[PanelsReducer] PANEL_REGISTER: No panelId provided`, action);
                return state;
            }
            
            if (!config) {
                console.error(`[PanelsReducer] PANEL_REGISTER: No config provided for panel ${panelId}`, action);
                return state;
            }
            
            // Store panel config in registry
            const newRegistry = {
                ...state.registry,
                [panelId]: config
            };
            
            // Initialize UI state if not exists
            const newSidebarPanels = {
                ...state.sidebarPanels,
                [panelId]: state.sidebarPanels[panelId] || {
                    visible: config.isVisible !== false,
                    collapsed: config.defaultCollapsed || false,
                    order: config.priority || 99
                }
            };
            
            const newState = {
                ...state,
                registry: newRegistry,
                sidebarPanels: newSidebarPanels
            };
            
            savePanelsState(newState);
            return newState;
        }

        case ActionTypes.PANEL_UNREGISTER: {
            const { panelId } = action.payload;
            
            const newRegistry = { ...state.registry };
            delete newRegistry[panelId];
            
            const newSidebarPanels = { ...state.sidebarPanels };
            delete newSidebarPanels[panelId];
            
            const newInstances = { ...state.instances };
            delete newInstances[panelId];
            
            const newState = {
                ...state,
                registry: newRegistry,
                sidebarPanels: newSidebarPanels,
                instances: newInstances
            };
            
            savePanelsState(newState);
            return newState;
        }

        case ActionTypes.PANEL_SET_VISIBLE: {
            const { panelId, visible } = action.payload;
            
            // Safety check: ensure panel exists in state before updating
            if (!state.sidebarPanels[panelId]) {
                console.warn(`[PanelsReducer] Panel ${panelId} not found in state, creating default entry`);
                const newSidebarPanels = {
                    ...state.sidebarPanels,
                    [panelId]: {
                        visible,
                        collapsed: false,
                        order: 99
                    }
                };
                
                const newState = {
                    ...state,
                    sidebarPanels: newSidebarPanels
                };
                
                savePanelsState(newState);
                return newState;
            }
            
            const newSidebarPanels = {
                ...state.sidebarPanels,
                [panelId]: {
                    ...state.sidebarPanels[panelId],
                    visible
                }
            };
            
            const newState = {
                ...state,
                sidebarPanels: newSidebarPanels
            };
            
            savePanelsState(newState);
            return newState;
        }

        case ActionTypes.PANEL_SET_COLLAPSED: {
            const { panelId, collapsed } = action.payload;
            
            // Safety check: ensure panel exists in state before updating
            if (!state.sidebarPanels[panelId]) {
                console.warn(`[PanelsReducer] Panel ${panelId} not found in state, creating default entry`);
                const newSidebarPanels = {
                    ...state.sidebarPanels,
                    [panelId]: {
                        visible: true,
                        collapsed,
                        order: 99
                    }
                };
                
                const newState = {
                    ...state,
                    sidebarPanels: newSidebarPanels
                };
                
                savePanelsState(newState);
                return newState;
            }
            
            const newSidebarPanels = {
                ...state.sidebarPanels,
                [panelId]: {
                    ...state.sidebarPanels[panelId],
                    collapsed
                }
            };
            
            const newState = {
                ...state,
                sidebarPanels: newSidebarPanels
            };
            
            savePanelsState(newState);
            return newState;
        }

        case ActionTypes.PANEL_SET_ORDER: {
            const { panelId, order } = action.payload;
            
            // Safety check: ensure panel exists in state before updating
            if (!state.sidebarPanels[panelId]) {
                console.warn(`[PanelsReducer] Panel ${panelId} not found in state, creating default entry`);
                const newSidebarPanels = {
                    ...state.sidebarPanels,
                    [panelId]: {
                        visible: true,
                        collapsed: false,
                        order
                    }
                };
                
                const newState = {
                    ...state,
                    sidebarPanels: newSidebarPanels
                };
                
                savePanelsState(newState);
                return newState;
            }
            
            const newSidebarPanels = {
                ...state.sidebarPanels,
                [panelId]: {
                    ...state.sidebarPanels[panelId],
                    order
                }
            };
            
            const newState = {
                ...state,
                sidebarPanels: newSidebarPanels
            };
            
            savePanelsState(newState);
            return newState;
        }

        case ActionTypes.PANEL_SET_INSTANCE: {
            const { panelId, instance } = action.payload;
            
            return {
                ...state,
                instances: {
                    ...state.instances,
                    [panelId]: instance
                }
            };
        }

        case ActionTypes.PANEL_CLEAR_INSTANCE: {
            const { panelId } = action.payload;
            
            const newInstances = { ...state.instances };
            delete newInstances[panelId];
            
            return {
                ...state,
                instances: newInstances
            };
        }

        case ActionTypes.PANEL_SAVE_STATE: {
            // Force save current state to localStorage
            savePanelsState(state);
            return state;
        }

        default:
            return state;
    }
} 